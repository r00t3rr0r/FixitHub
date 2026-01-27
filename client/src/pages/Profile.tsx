import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useToast } from "@/hooks/useToast"
import { getUserProfile, updateUserProfile, uploadAvatar, UserProfile } from "@/api/user"
import { getSavedDeviceInfo, DeviceInfo } from "@/utils/deviceDetection"
import {
  User,
  Mail,
  Phone,
  MapPin,
  Bell,
  Shield,
  Camera,
  Save,
  CreditCard,
  FileText,
  Copy,
  TrendingUp,
  Calendar,
  DollarSign,
  Smartphone,
  Monitor,
  Tablet,
  Wifi,
  Globe,
  Info
} from "lucide-react"

export function Profile() {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [sameAsInvoice, setSameAsInvoice] = useState(true)
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null)
  const { toast } = useToast()

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm()

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        console.log("Fetching user profile...")
        const response = await getUserProfile()
        const profileData = (response as any).user
        setProfile(profileData)

        // Set form values with proper field names
        setValue("firstName", profileData.firstName || '')
        setValue("lastName", profileData.lastName || '')
        setValue("email", profileData.email || '')
        setValue("phone", profileData.phone || '')

        // Invoice address with proper field structure
        setValue("invoiceAddress.street", profileData.invoiceAddress?.street || '')
        setValue("invoiceAddress.city", profileData.invoiceAddress?.city || '')
        setValue("invoiceAddress.state", profileData.invoiceAddress?.state || '')
        setValue("invoiceAddress.zipCode", profileData.invoiceAddress?.zipCode || '')
        setValue("invoiceAddress.country", profileData.invoiceAddress?.country || '')

        // Payment address with proper field structure
        setValue("paymentAddress.street", profileData.paymentAddress?.street || '')
        setValue("paymentAddress.city", profileData.paymentAddress?.city || '')
        setValue("paymentAddress.state", profileData.paymentAddress?.state || '')
        setValue("paymentAddress.zipCode", profileData.paymentAddress?.zipCode || '')
        setValue("paymentAddress.country", profileData.paymentAddress?.country || '')

        setSameAsInvoice(profileData.paymentAddress?.sameAsInvoice ?? true)
      } catch (error) {
        console.error("Error fetching profile:", error)
        toast({
          title: "Error",
          description: "Failed to load profile",
          variant: "destructive"
        })
      } finally {
        setLoading(false)
      }
    }

    fetchProfile()
  }, [toast, setValue])

  // Load device information from localStorage
  useEffect(() => {
    console.log("Loading device information from localStorage...")
    const savedDeviceInfo = getSavedDeviceInfo()
    if (savedDeviceInfo) {
      console.log("Device information loaded:", savedDeviceInfo)
      setDeviceInfo(savedDeviceInfo)
    } else {
      console.log("No device information found in localStorage")
    }
  }, [])

  const onSubmit = async (data: any) => {
    try {
      setSaving(true)
      console.log("Updating profile:", data)

      const profileData = {
        ...data,
        paymentAddress: {
          ...data.paymentAddress,
          sameAsInvoice
        }
      }

      const response = await updateUserProfile(profileData)
      setProfile((response as any).user)

      toast({
        title: "Success!",
        description: "Your profile has been updated"
      })
    } catch (error: any) {
      console.error("Error updating profile:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to update profile",
        variant: "destructive"
      })
    } finally {
      setSaving(false)
    }
  }

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      setUploadingAvatar(true)
      console.log("Uploading avatar...")
      const response = await uploadAvatar(file)

      toast({
        title: "Success!",
        description: "Profile picture updated"
      })

      // Update profile with new avatar
      if (profile) {
        setProfile({
          ...profile,
          avatar: (response as any).avatarUrl
        })
      }
    } catch (error: any) {
      console.error("Error uploading avatar:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to upload avatar",
        variant: "destructive"
      })
    } finally {
      setUploadingAvatar(false)
    }
  }

  const copyInvoiceToPayment = () => {
    if (!profile) return

    setValue("paymentAddress.street", profile.invoiceAddress.street)
    setValue("paymentAddress.city", profile.invoiceAddress.city)
    setValue("paymentAddress.state", profile.invoiceAddress.state)
    setValue("paymentAddress.zipCode", profile.invoiceAddress.zipCode)
    setValue("paymentAddress.country", profile.invoiceAddress.country)

    toast({
      title: "Address copied",
      description: "Invoice address has been copied to payment address"
    })
  }

  if (loading) {
    return (
      <>
        <style>{`
          @keyframes shimmer {
            0% {
              background-position: -1000px 0;
            }
            100% {
              background-position: 1000px 0;
            }
          }

          .animate-shimmer {
            animation: shimmer 2s infinite linear;
            background: linear-gradient(to right, #f0f0f0 4%, #e0e0e0 25%, #f0f0f0 36%);
            background-size: 1000px 100%;
          }
        `}</style>
        <div className="max-w-5xl mx-auto space-y-8">
          <div className="space-y-2">
            <div className="h-10 w-64 bg-muted rounded-lg animate-shimmer"></div>
            <div className="h-6 w-96 bg-muted rounded animate-shimmer"></div>
          </div>

          {[1, 2, 3].map((i) => (
            <Card key={i} className="overflow-hidden border-2">
              <CardHeader>
                <div className="h-6 bg-muted rounded w-1/3 animate-shimmer"></div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="h-10 bg-muted rounded animate-shimmer"></div>
                  <div className="h-10 bg-muted rounded animate-shimmer"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </>
    )
  }

  if (!profile) return null

  return (
    <>
      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes scaleIn {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        @keyframes slideInRight {
          from {
            opacity: 0;
            transform: translateX(30px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        .animate-fade-in-up {
          animation: fadeInUp 0.6s ease-out;
        }

        .animate-fade-in {
          animation: fadeIn 0.6s ease-out;
        }

        .animate-scale-in {
          animation: scaleIn 0.5s ease-out;
        }

        .animate-slide-in-right {
          animation: slideInRight 0.6s ease-out;
        }

        .hover-lift {
          transition: transform 0.3s ease, box-shadow 0.3s ease;
        }

        .hover-lift:hover {
          transform: translateY(-4px);
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
        }

        .stat-card {
          position: relative;
          overflow: hidden;
        }

        .stat-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent);
          transition: left 0.5s ease;
        }

        .stat-card:hover::before {
          left: 100%;
        }

        .glass-card {
          background: rgba(255, 255, 255, 0.9);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.5);
        }

        .profile-gradient {
          background: linear-gradient(135deg, #fef3c7 0%, #fde68a 50%, #fcd34d 100%);
        }
      `}</style>

      <div className="max-w-6xl mx-auto space-y-5">
        {/* Header with gradient background */}
        <div className="animate-fade-in-up">
          <div className="profile-gradient rounded-lg p-6 shadow-md mb-6">
            <div className="flex flex-col md:flex-row items-center md:items-start gap-5">
              {/* Avatar Section */}
              <div className="relative group">
                <Avatar className="w-24 h-24 border-3 border-white shadow-lg transition-transform duration-300 group-hover:scale-105">
                  <AvatarImage src={profile.avatar} className="object-cover" />
                  <AvatarFallback className="text-2xl bg-white text-yellow-600 font-bold">
                    {profile.firstName?.[0]}{profile.lastName?.[0]}
                  </AvatarFallback>
                </Avatar>
              </div>

              {/* User Info */}
              <div className="flex-1 text-center md:text-left">
                <h1 className="text-2xl font-bold text-gray-900 mb-1.5">
                  {profile.firstName} {profile.lastName}
                </h1>
                <div className="flex flex-col md:flex-row gap-3 text-sm text-gray-700">
                  <div className="flex items-center justify-center md:justify-start gap-1.5">
                    <Mail className="h-4 w-4" />
                    <span>{profile.email}</span>
                  </div>
                  {profile.phone && (
                    <div className="flex items-center justify-center md:justify-start gap-1.5">
                      <Phone className="h-4 w-4" />
                      <span>{profile.phone}</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-center md:justify-start gap-1.5 mt-2 text-gray-600 text-xs">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>
                    Member since {new Date(profile.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </span>
                </div>
              </div>

              {/* Upload Avatar Button */}
              <div className="animate-slide-in-right">
                <Label htmlFor="avatar" className="cursor-pointer">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={uploadingAvatar}
                    className="bg-white hover:bg-gray-50 border-2 hover:border-yellow-400 transition-all duration-200 shadow-sm hover:shadow-md"
                    asChild
                  >
                    <span>
                      <Camera className="h-3.5 w-3.5 mr-1.5" />
                      {uploadingAvatar ? "Uploading..." : "Change Photo"}
                    </span>
                  </Button>
                </Label>
                <Input
                  id="avatar"
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  className="hidden"
                />
                <p className="text-[10px] text-gray-600 mt-1.5 text-center">
                  JPG, PNG or GIF. Max 5MB.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid gap-4 md:grid-cols-3 animate-scale-in" style={{ animationDelay: '0.1s' }}>
          <Card className="hover-lift stat-card border border-blue-100 bg-gradient-to-br from-blue-50/50 to-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-blue-600 mb-0.5 uppercase tracking-wide">Total Orders</p>
                  <p className="text-2xl font-bold text-gray-900">{profile.totalOrders}</p>
                </div>
                <div className="w-10 h-10 bg-blue-500 rounded-md flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="hover-lift stat-card border border-green-100 bg-gradient-to-br from-green-50/50 to-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-green-600 mb-0.5 uppercase tracking-wide">Total Spent</p>
                  <p className="text-2xl font-bold text-gray-900">${profile.totalSpent.toFixed(2)}</p>
                </div>
                <div className="w-10 h-10 bg-green-500 rounded-md flex items-center justify-center">
                  <DollarSign className="h-5 w-5 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="hover-lift stat-card border border-purple-100 bg-gradient-to-br from-purple-50/50 to-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-purple-600 mb-0.5 uppercase tracking-wide">Member Since</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {new Date(profile.createdAt).getFullYear()}
                  </p>
                </div>
                <div className="w-10 h-10 bg-purple-500 rounded-md flex items-center justify-center">
                  <Shield className="h-5 w-5 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Current Device Information */}
        {deviceInfo && (
          <Card className="hover-lift border animate-fade-in-up" style={{ animationDelay: '0.15s' }}>
            <CardHeader className="bg-gradient-to-r from-indigo-50/50 to-white py-4">
              <CardTitle className="flex items-center gap-2 text-base font-bold">
                {deviceInfo.isMobile ? <Smartphone className="h-4 w-4 text-indigo-600" /> :
                 deviceInfo.isTablet ? <Tablet className="h-4 w-4 text-indigo-600" /> :
                 <Monitor className="h-4 w-4 text-indigo-600" />}
                Current Device Information
              </CardTitle>
              <CardDescription className="text-xs">
                Details about the device you're currently using
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {/* Device Type */}
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-gray-700 uppercase tracking-wide">
                    {deviceInfo.isMobile ? <Smartphone className="h-3.5 w-3.5" /> :
                     deviceInfo.isTablet ? <Tablet className="h-3.5 w-3.5" /> :
                     <Monitor className="h-3.5 w-3.5" />}
                    Device Type
                  </div>
                  <p className="text-sm text-gray-900 font-semibold">
                    {deviceInfo.isMobile ? 'Mobile' : deviceInfo.isTablet ? 'Tablet' : 'Desktop'}
                  </p>
                  <p className="text-xs text-gray-600">{deviceInfo.deviceModel}</p>
                </div>

                {/* Operating System */}
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-gray-700 uppercase tracking-wide">
                    <Globe className="h-3.5 w-3.5" />
                    Operating System
                  </div>
                  <p className="text-sm text-gray-900 font-semibold">{deviceInfo.os}</p>
                  <p className="text-xs text-gray-600">Version {deviceInfo.osVersion}</p>
                </div>

                {/* Browser */}
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-gray-700 uppercase tracking-wide">
                    <Globe className="h-3.5 w-3.5" />
                    Browser
                  </div>
                  <p className="text-sm text-gray-900 font-semibold">{deviceInfo.browser}</p>
                  <p className="text-xs text-gray-600">Version {deviceInfo.browserVersion}</p>
                </div>

                {/* Screen Resolution */}
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-gray-700 uppercase tracking-wide">
                    <Monitor className="h-3.5 w-3.5" />
                    Screen Resolution
                  </div>
                  <p className="text-sm text-gray-900 font-semibold">
                    {deviceInfo.screenWidth} × {deviceInfo.screenHeight}
                  </p>
                  <p className="text-xs text-gray-600">
                    {deviceInfo.screenOrientation} • {deviceInfo.pixelRatio}x
                  </p>
                </div>

                {/* Touch Support */}
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-gray-700 uppercase tracking-wide">
                    <Smartphone className="h-3.5 w-3.5" />
                    Touch Support
                  </div>
                  <p className="text-sm text-gray-900 font-semibold">
                    {deviceInfo.touchSupport ? 'Yes' : 'No'}
                  </p>
                  {deviceInfo.touchSupport && (
                    <p className="text-xs text-gray-600">
                      {deviceInfo.maxTouchPoints} touch points
                    </p>
                  )}
                </div>

                {/* Connection */}
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-gray-700 uppercase tracking-wide">
                    <Wifi className="h-3.5 w-3.5" />
                    Connection
                  </div>
                  <p className="text-sm text-gray-900 font-semibold">
                    {deviceInfo.effectiveType !== 'Unknown' ? deviceInfo.effectiveType.toUpperCase() : 'Unknown'}
                  </p>
                  {deviceInfo.connectionType !== 'Unknown' && (
                    <p className="text-xs text-gray-600">{deviceInfo.connectionType}</p>
                  )}
                </div>

                {/* Vendor */}
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-gray-700 uppercase tracking-wide">
                    <Info className="h-3.5 w-3.5" />
                    Vendor
                  </div>
                  <p className="text-sm text-gray-900 font-semibold">{deviceInfo.vendor}</p>
                  <p className="text-xs text-gray-600">{deviceInfo.platform}</p>
                </div>

                {/* Language & Timezone */}
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-gray-700 uppercase tracking-wide">
                    <Globe className="h-3.5 w-3.5" />
                    Language & Timezone
                  </div>
                  <p className="text-sm text-gray-900 font-semibold">{deviceInfo.language}</p>
                  <p className="text-xs text-gray-600">{deviceInfo.timezone}</p>
                </div>

                {/* Detection Time */}
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-gray-700 uppercase tracking-wide">
                    <Calendar className="h-3.5 w-3.5" />
                    Detected
                  </div>
                  <p className="text-sm text-gray-900 font-semibold">
                    {localStorage.getItem('deviceInfoTimestamp')
                      ? new Date(localStorage.getItem('deviceInfoTimestamp')!).toLocaleString()
                      : 'Recently'}
                  </p>
                  <p className="text-xs text-gray-600">On homepage visit</p>
                </div>
              </div>

              {/* Additional Info - User Agent */}
              <div className="mt-4 p-3 bg-gray-50 rounded-md border border-gray-200">
                <div className="flex items-start gap-1.5 mb-1.5">
                  <Info className="h-3.5 w-3.5 text-gray-600 mt-0.5" />
                  <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">User Agent</span>
                </div>
                <p className="text-[10px] text-gray-600 font-mono break-all leading-relaxed">
                  {deviceInfo.userAgent}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Personal Information */}
          <Card className="hover-lift border animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
            <CardHeader className="bg-gradient-to-r from-yellow-50/50 to-white py-4">
              <CardTitle className="flex items-center gap-2 text-base font-bold">
                <User className="h-4 w-4 text-yellow-600" />
                Personal Information
              </CardTitle>
              <CardDescription className="text-xs">
                Update your personal details and contact information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 pt-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="firstName" className="text-xs font-bold uppercase tracking-wide">First Name</Label>
                  <Input
                    id="firstName"
                    {...register("firstName", { required: "First name is required" })}
                    className="border focus:border-yellow-400 transition-colors h-9"
                  />
                  {errors.firstName && (
                    <p className="text-xs text-destructive">{errors.firstName.message as string}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="lastName" className="text-xs font-bold uppercase tracking-wide">Last Name</Label>
                  <Input
                    id="lastName"
                    {...register("lastName", { required: "Last name is required" })}
                    className="border focus:border-yellow-400 transition-colors h-9"
                  />
                  {errors.lastName && (
                    <p className="text-xs text-destructive">{errors.lastName.message as string}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-xs font-bold uppercase tracking-wide">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    {...register("email", { required: "Email is required" })}
                    disabled
                    className="bg-gray-50 h-9"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Contact support to change your email address
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="phone" className="text-xs font-bold uppercase tracking-wide">Phone Number</Label>
                  <Input
                    id="phone"
                    type="tel"
                    {...register("phone")}
                    className="border focus:border-yellow-400 transition-colors h-9"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Invoice Address */}
          <Card className="hover-lift border animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
            <CardHeader className="bg-gradient-to-r from-blue-50/50 to-white py-4">
              <CardTitle className="flex items-center gap-2 text-base font-bold">
                <FileText className="h-4 w-4 text-blue-600" />
                Invoice Address
              </CardTitle>
              <CardDescription className="text-xs">
                Address used for billing and invoices
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 pt-4">
              <div className="space-y-1.5">
                <Label htmlFor="invoiceStreet" className="text-xs font-bold uppercase tracking-wide">Street Address</Label>
                <Input
                  id="invoiceStreet"
                  {...register("invoiceAddress.street")}
                  className="border focus:border-blue-400 transition-colors h-9"
                />
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="invoiceCity" className="text-xs font-bold uppercase tracking-wide">City</Label>
                  <Input
                    id="invoiceCity"
                    {...register("invoiceAddress.city")}
                    className="border focus:border-blue-400 transition-colors h-9"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="invoiceState" className="text-xs font-bold uppercase tracking-wide">State</Label>
                  <Input
                    id="invoiceState"
                    {...register("invoiceAddress.state")}
                    className="border focus:border-blue-400 transition-colors h-9"
                  />
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="invoiceZipCode" className="text-xs font-bold uppercase tracking-wide">ZIP Code</Label>
                  <Input
                    id="invoiceZipCode"
                    {...register("invoiceAddress.zipCode")}
                    className="border focus:border-blue-400 transition-colors h-9"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="invoiceCountry" className="text-xs font-bold uppercase tracking-wide">Country</Label>
                  <Input
                    id="invoiceCountry"
                    {...register("invoiceAddress.country")}
                    className="border focus:border-blue-400 transition-colors h-9"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payment Address */}
          <Card className="hover-lift border animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
            <CardHeader className="bg-gradient-to-r from-green-50/50 to-white py-4">
              <CardTitle className="flex items-center gap-2 text-base font-bold">
                <CreditCard className="h-4 w-4 text-green-600" />
                Payment Address
              </CardTitle>
              <CardDescription className="text-xs">
                Address used for payment processing and shipping
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 pt-4">
              <div className="flex items-center justify-between p-3 bg-gradient-to-r from-yellow-50/50 to-white rounded-lg border border-yellow-200">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="sameAsInvoice"
                    checked={sameAsInvoice}
                    onCheckedChange={(checked) => {
                      setSameAsInvoice(checked as boolean)
                      if (checked) {
                        copyInvoiceToPayment()
                      }
                    }}
                    className="border"
                  />
                  <Label htmlFor="sameAsInvoice" className="text-xs font-bold">
                    Same as invoice address
                  </Label>
                </div>
                {!sameAsInvoice && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={copyInvoiceToPayment}
                    className="hover:bg-yellow-100 border hover:border-yellow-400 transition-all h-8 text-xs"
                  >
                    <Copy className="h-3.5 w-3.5 mr-1.5" />
                    Copy from invoice
                  </Button>
                )}
              </div>

              {!sameAsInvoice && (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="paymentStreet" className="text-xs font-bold uppercase tracking-wide">Street Address</Label>
                    <Input
                      id="paymentStreet"
                      {...register("paymentAddress.street")}
                      className="border focus:border-green-400 transition-colors h-9"
                    />
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="paymentCity" className="text-xs font-bold uppercase tracking-wide">City</Label>
                      <Input
                        id="paymentCity"
                        {...register("paymentAddress.city")}
                        className="border focus:border-green-400 transition-colors h-9"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="paymentState" className="text-xs font-bold uppercase tracking-wide">State</Label>
                      <Input
                        id="paymentState"
                        {...register("paymentAddress.state")}
                        className="border focus:border-green-400 transition-colors h-9"
                      />
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="paymentZipCode" className="text-xs font-bold uppercase tracking-wide">ZIP Code</Label>
                      <Input
                        id="paymentZipCode"
                        {...register("paymentAddress.zipCode")}
                        className="border focus:border-green-400 transition-colors h-9"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="paymentCountry" className="text-xs font-bold uppercase tracking-wide">Country</Label>
                      <Input
                        id="paymentCountry"
                        {...register("paymentAddress.country")}
                        className="border focus:border-green-400 transition-colors h-9"
                      />
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Notification Preferences */}
          <Card className="hover-lift border animate-fade-in-up" style={{ animationDelay: '0.5s' }}>
            <CardHeader className="bg-gradient-to-r from-purple-50/50 to-white py-4">
              <CardTitle className="flex items-center gap-2 text-base font-bold">
                <Bell className="h-4 w-4 text-purple-600" />
                Notification Preferences
              </CardTitle>
              <CardDescription className="text-xs">
                Choose how you want to receive notifications
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2.5 pt-4">
              <div className="flex items-center justify-between p-3 rounded-lg border hover:border-purple-300 transition-all">
                <div>
                  <Label htmlFor="email-notifications" className="text-xs font-bold">Email Notifications</Label>
                  <p className="text-[10px] text-muted-foreground">
                    Receive order updates via email
                  </p>
                </div>
                <Switch
                  id="email-notifications"
                  defaultChecked={profile.preferences.notifications.email}
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg border hover:border-purple-300 transition-all">
                <div>
                  <Label htmlFor="sms-notifications" className="text-xs font-bold">SMS Notifications</Label>
                  <p className="text-[10px] text-muted-foreground">
                    Receive order updates via SMS
                  </p>
                </div>
                <Switch
                  id="sms-notifications"
                  defaultChecked={profile.preferences.notifications.sms}
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg border hover:border-purple-300 transition-all">
                <div>
                  <Label htmlFor="push-notifications" className="text-xs font-bold">Push Notifications</Label>
                  <p className="text-[10px] text-muted-foreground">
                    Receive browser notifications
                  </p>
                </div>
                <Switch
                  id="push-notifications"
                  defaultChecked={profile.preferences.notifications.push}
                />
              </div>
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="flex justify-end animate-fade-in" style={{ animationDelay: '0.6s' }}>
            <Button
              type="submit"
              disabled={saving}
              className="bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-bold shadow-md hover:shadow-lg transition-all duration-200 px-6 h-10 text-sm"
            >
              <Save className="h-4 w-4 mr-2" />
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </div>
    </>
  )
}
