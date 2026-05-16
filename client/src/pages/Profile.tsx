import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useToast } from "@/hooks/useToast"
import { getUserProfile, updateUserProfile, uploadAvatar, UserProfile } from "@/api/user"
import { searchDhlLocations, type DhlLocation } from "@/api/shipping"
import { getSavedDeviceInfo, DeviceInfo } from "@/utils/deviceDetection"
import { CountrySelect } from "@/components/checkout/CountrySelect"
import { DEFAULT_COUNTRY_CODE } from "@/lib/countries"
import "./profile.css"
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
  TrendingUp,
  Calendar,
  DollarSign,
  Smartphone,
  Monitor,
  Tablet,
  Wifi,
  Globe,
  Info,
  Home,
  PackageSearch,
  Truck,
  Search,
  Loader2,
  Clock,
  MapPinned,
  X,
} from "lucide-react"

export function Profile() {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [deliveryType, setDeliveryType] = useState<"same" | "address" | "packstation">("same")
  const [dhlFinderOpen, setDhlFinderOpen] = useState(false)
  const [dhlFinderQuery, setDhlFinderQuery] = useState("")
  const [dhlFinderLoading, setDhlFinderLoading] = useState(false)
  const [dhlFinderResults, setDhlFinderResults] = useState<DhlLocation[]>([])
  const [dhlFinderError, setDhlFinderError] = useState("")
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null)
  const { toast } = useToast()
  const { t } = useTranslation()

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
        setValue("invoiceAddress.country", profileData.invoiceAddress?.country || DEFAULT_COUNTRY_CODE)

        // Payment/shipping address with proper field structure
        setValue("paymentAddress.street", profileData.paymentAddress?.street || '')
        setValue("paymentAddress.city", profileData.paymentAddress?.city || '')
        setValue("paymentAddress.state", profileData.paymentAddress?.state || '')
        setValue("paymentAddress.zipCode", profileData.paymentAddress?.zipCode || '')
        setValue("paymentAddress.country", profileData.paymentAddress?.country || DEFAULT_COUNTRY_CODE)
        setValue("paymentAddress.packstationNumber", profileData.paymentAddress?.packstationNumber || '')
        setValue("paymentAddress.postNumber", profileData.paymentAddress?.postNumber || '')

        // Determine delivery type from saved data
        const savedDeliveryType = profileData.paymentAddress?.deliveryType
        const savedSameAsInvoice = profileData.paymentAddress?.sameAsInvoice !== false
        if (savedDeliveryType === 'packstation') {
          setDeliveryType('packstation')
        } else if (!savedSameAsInvoice || savedDeliveryType === 'address') {
          setDeliveryType('address')
        } else {
          setDeliveryType('same')
        }
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

      let paymentAddress: Record<string, any>
      if (deliveryType === 'same') {
        paymentAddress = { sameAsInvoice: true, deliveryType: 'address', street: '', city: '', state: '', zipCode: '', country: '', packstationNumber: '', postNumber: '' }
      } else if (deliveryType === 'packstation') {
        paymentAddress = {
          sameAsInvoice: false,
          deliveryType: 'packstation',
          packstationNumber: data.paymentAddress?.packstationNumber || '',
          postNumber: data.paymentAddress?.postNumber || '',
          zipCode: data.paymentAddress?.zipCode || '',
          city: data.paymentAddress?.city || '',
          country: data.paymentAddress?.country || DEFAULT_COUNTRY_CODE,
          street: '',
          state: '',
        }
      } else {
        paymentAddress = {
          sameAsInvoice: false,
          deliveryType: 'address',
          street: data.paymentAddress?.street || '',
          city: data.paymentAddress?.city || '',
          state: data.paymentAddress?.state || '',
          zipCode: data.paymentAddress?.zipCode || '',
          country: data.paymentAddress?.country || DEFAULT_COUNTRY_CODE,
          packstationNumber: '',
          postNumber: '',
        }
      }

      const profileData = {
        ...data,
        paymentAddress,
      }

      const response = await updateUserProfile(profileData)
      setProfile((response as any).user)

      toast({
        title: t('common.success'),
        description: t('profilePage.profileUpdated')
      })
    } catch (error: any) {
      console.error("Error updating profile:", error)
      toast({
        title: t('common.error'),
        description: error.message || t('profilePage.updateFailed'),
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
        title: t('common.success'),
        description: t('profilePage.pictureUpdated')
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
        title: t('common.error'),
        description: error.message || t('profilePage.uploadFailed'),
        variant: "destructive"
      })
    } finally {
      setUploadingAvatar(false)
    }
  }

  const handleDhlFinderSearch = async () => {
    const q = dhlFinderQuery.trim()
    if (q.length < 3) return
    try {
      setDhlFinderLoading(true)
      setDhlFinderError("")
      const results = await searchDhlLocations(q, watch("paymentAddress.country") || "DE")
      setDhlFinderResults(results)
      if (results.length === 0) setDhlFinderError("Keine DHL-Standorte gefunden. Bitte eine andere Suche versuchen.")
    } catch (err: any) {
      setDhlFinderError(err?.message || "Fehler beim Laden der Standorte.")
      setDhlFinderResults([])
    } finally {
      setDhlFinderLoading(false)
    }
  }

  const handleDhlLocationSelect = (loc: DhlLocation) => {
    const isLocker = loc.type === "locker"
    if (isLocker) {
      setDeliveryType("packstation")
      setValue("paymentAddress.packstationNumber", loc.keywordId || "")
      setValue("paymentAddress.zipCode", loc.address.postalCode || "")
      setValue("paymentAddress.city", loc.address.city || "")
      setValue("paymentAddress.country", loc.address.countryCode || "DE")
    } else {
      setDeliveryType("address")
      setValue("paymentAddress.street", loc.address.street || "")
      setValue("paymentAddress.zipCode", loc.address.postalCode || "")
      setValue("paymentAddress.city", loc.address.city || "")
      setValue("paymentAddress.country", loc.address.countryCode || "DE")
    }
    setDhlFinderOpen(false)
    setDhlFinderResults([])
    setDhlFinderQuery("")
    setDhlFinderError("")
  }

  if (loading) {
    return (
      <div className="profile-container">
        <div className="profile-loading">
          <div className="h-10 w-64 bg-gray-200 rounded-lg animate-pulse"></div>
          <div className="h-6 w-96 bg-gray-200 rounded animate-pulse mt-4"></div>
        </div>

        {[1, 2, 3].map((i) => (
          <Card key={i} className="profile-card">
            <CardHeader>
              <div className="h-6 bg-gray-200 rounded w-1/3 animate-pulse"></div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="h-10 bg-gray-200 rounded animate-pulse"></div>
                <div className="h-10 bg-gray-200 rounded animate-pulse"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (!profile) return null

  return (
    <>
    {/* DHL Location Finder Dialog */}
    <Dialog open={dhlFinderOpen} onOpenChange={(v) => { setDhlFinderOpen(v); if (!v) { setDhlFinderResults([]); setDhlFinderError("") } }}>
      <DialogContent className="max-h-[80vh] w-[96vw] max-w-md overflow-hidden rounded-xl border border-[#d8dce6] p-0 [&>button]:text-[#5f6d86]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#e7eaf1] bg-[#1a2a5e] px-4 py-3">
          <div className="flex items-center gap-2">
            <PackageSearch className="h-4 w-4 text-[#f5b800]" />
            <span className="text-sm font-bold text-white">DHL Standort suchen</span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-white hover:bg-white/10"
            onClick={() => setDhlFinderOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Search bar */}
        <div className="border-b border-[#e7eaf1] px-4 py-3">
          <div className="flex gap-2">
            <Input
              value={dhlFinderQuery}
              onChange={(e) => setDhlFinderQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleDhlFinderSearch()}
              placeholder="PLZ oder Ort eingeben …"
              className="h-9 flex-1 text-sm"
              autoFocus
            />
            <Button
              type="button"
              className="h-9 bg-[#f5b800] px-3 font-bold text-[#1a2a5e] hover:bg-[#e5ab00]"
              onClick={handleDhlFinderSearch}
              disabled={dhlFinderLoading || dhlFinderQuery.trim().length < 3}
            >
              {dhlFinderLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>
          <p className="mt-1.5 text-[10px] text-[#5f6d86]">Zeigt Packstations, Postfilialen und Paketshops in der Nähe.</p>
        </div>

        {/* Results */}
        <div className="overflow-y-auto" style={{ maxHeight: "calc(80vh - 150px)" }}>
          {dhlFinderError && (
            <div className="px-4 py-6 text-center text-xs text-[#b91c1c]">{dhlFinderError}</div>
          )}
          {!dhlFinderError && dhlFinderResults.length === 0 && !dhlFinderLoading && (
            <div className="px-4 py-8 text-center text-xs text-[#5f6d86]">
              PLZ oder Ort eingeben und auf Suchen tippen.
            </div>
          )}
          {dhlFinderResults.length > 0 && (
            <ul className="divide-y divide-[#f0f2f7]">
              {dhlFinderResults.map((loc) => {
                const isLocker = loc.type === "locker"
                return (
                  <li key={loc.locationId}>
                    <button
                      type="button"
                      className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-[#f6f8fc] active:bg-[#eef1f8]"
                      onClick={() => handleDhlLocationSelect(loc)}
                    >
                      <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${isLocker ? "bg-[#fff3b0]" : "bg-[#e8f0fe]"}`}>
                        {isLocker
                          ? <PackageSearch className="h-3.5 w-3.5 text-[#b45309]" />
                          : <MapPinned className="h-3.5 w-3.5 text-[#1a2a5e]" />
                        }
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="truncate text-xs font-semibold text-[#1a2a5e]">{loc.name}</p>
                          <span className="shrink-0 text-[10px] text-[#5f6d86]">{loc.distance < 1000 ? `${loc.distance} m` : `${(loc.distance / 1000).toFixed(1)} km`}</span>
                        </div>
                        <p className="text-[11px] text-[#5f6d86]">{loc.address.street}</p>
                        <p className="text-[11px] text-[#5f6d86]">{[loc.address.postalCode, loc.address.city].filter(Boolean).join(" ")}</p>
                        {loc.openingHours.length > 0 && (
                          <p className="mt-0.5 flex items-center gap-1 text-[10px] text-[#6b7280]">
                            <Clock className="h-2.5 w-2.5 shrink-0" />
                            {loc.openingHours[0].opens}–{loc.openingHours[0].closes}
                          </p>
                        )}
                        <span className={`mt-1 inline-block rounded px-1.5 py-0.5 text-[9px] font-medium ${isLocker ? "bg-[#fef3c7] text-[#92400e]" : "bg-[#dbeafe] text-[#1e40af]"}`}>
                          {isLocker ? "Packstation" : loc.type === "postoffice" ? "Postfiliale" : "Paketshop"}
                        </span>
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>

    <div className="profile-container">
      {/* Header Section */}
      <div className="profile-header">
        <div className="profile-header-content">
          {/* Avatar Section */}
          <div className="profile-avatar-section">
            <Avatar className="profile-avatar">
              <AvatarImage src={profile.avatar} className="object-cover" />
              <AvatarFallback className="profile-avatar-fallback">
                {profile.firstName?.[0]}{profile.lastName?.[0]}
              </AvatarFallback>
            </Avatar>
            <Label htmlFor="avatar" className="profile-avatar-upload">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={uploadingAvatar}
                className="profile-avatar-btn"
                asChild
              >
                <span>
                  <Camera className="h-4 w-4 mr-2" />
                  {uploadingAvatar ? t('profilePage.uploading') : t('profilePage.changePhoto')}
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
          </div>

          {/* User Info */}
          <div className="profile-user-info">
            <h1 className="profile-title">
              {profile.firstName} {profile.lastName}
            </h1>
            <div className="profile-contact-info">
              <div className="profile-contact-item">
                <Mail className="h-4 w-4" />
                <span>{profile.email}</span>
              </div>
              {profile.phone && (
                <div className="profile-contact-item">
                  <Phone className="h-4 w-4" />
                  <span>{profile.phone}</span>
                </div>
              )}
            </div>
            <div className="profile-member-since">
              <Calendar className="h-4 w-4" />
              <span>
                {t('profilePage.memberSince')} {new Date(profile.createdAt).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="profile-stats">
        <Card className="profile-stat-card">
          <CardContent className="profile-stat-content">
            <div className="profile-stat-icon profile-stat-icon-blue">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div className="profile-stat-info">
              <p className="profile-stat-label">{t('profilePage.totalOrders')}</p>
              <p className="profile-stat-value">{profile.totalOrders}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="profile-stat-card">
          <CardContent className="profile-stat-content">
            <div className="profile-stat-icon profile-stat-icon-yellow">
              <DollarSign className="h-5 w-5" />
            </div>
            <div className="profile-stat-info">
              <p className="profile-stat-label">{t('profilePage.totalSpent')}</p>
              <p className="profile-stat-value">${profile.totalSpent.toFixed(2)}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="profile-stat-card">
          <CardContent className="profile-stat-content">
            <div className="profile-stat-icon profile-stat-icon-blue">
              <Shield className="h-5 w-5" />
            </div>
            <div className="profile-stat-info">
              <p className="profile-stat-label">{t('profilePage.memberSinceLabel')}</p>
              <p className="profile-stat-value">
                {new Date(profile.createdAt).getFullYear()}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Current Device Information */}
      {deviceInfo && (
        <Card className="profile-card">
          <CardHeader className="profile-card-header">
            <CardTitle className="profile-card-title">
              {deviceInfo.isMobile ? <Smartphone className="h-5 w-5" /> :
               deviceInfo.isTablet ? <Tablet className="h-5 w-5" /> :
               <Monitor className="h-5 w-5" />}
              {t('profilePage.currentDeviceInfo')}
            </CardTitle>
            <CardDescription className="profile-card-description">
              {t('profilePage.currentDeviceDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent className="profile-card-content">
            <div className="profile-device-grid">
              {/* Device Type */}
              <div className="profile-device-item">
                <div className="profile-device-label">
                  {deviceInfo.isMobile ? <Smartphone className="h-4 w-4" /> :
                   deviceInfo.isTablet ? <Tablet className="h-4 w-4" /> :
                   <Monitor className="h-4 w-4" />}
                  {t('profilePage.deviceType')}
                </div>
                <p className="profile-device-value">
                  {deviceInfo.isMobile ? t('profilePage.mobile') : deviceInfo.isTablet ? t('profilePage.tablet') : t('profilePage.desktop')}
                </p>
                <p className="profile-device-detail">{deviceInfo.deviceModel}</p>
              </div>

              {/* Operating System */}
              <div className="profile-device-item">
                <div className="profile-device-label">
                  <Globe className="h-4 w-4" />
                  {t('profilePage.operatingSystem')}
                </div>
                <p className="profile-device-value">{deviceInfo.os}</p>
                <p className="profile-device-detail">Version {deviceInfo.osVersion}</p>
              </div>

              {/* Browser */}
              <div className="profile-device-item">
                <div className="profile-device-label">
                  <Globe className="h-4 w-4" />
                  {t('profilePage.browser')}
                </div>
                <p className="profile-device-value">{deviceInfo.browser}</p>
                <p className="profile-device-detail">Version {deviceInfo.browserVersion}</p>
              </div>

              {/* Screen Resolution */}
              <div className="profile-device-item">
                <div className="profile-device-label">
                  <Monitor className="h-4 w-4" />
                  {t('profilePage.screenResolution')}
                </div>
                <p className="profile-device-value">
                  {deviceInfo.screenWidth} × {deviceInfo.screenHeight}
                </p>
                <p className="profile-device-detail">
                  {deviceInfo.screenOrientation} • {deviceInfo.pixelRatio}x
                </p>
              </div>

              {/* Touch Support */}
              <div className="profile-device-item">
                <div className="profile-device-label">
                  <Smartphone className="h-4 w-4" />
                  {t('profilePage.touchSupport')}
                </div>
                <p className="profile-device-value">
                  {deviceInfo.touchSupport ? 'Yes' : 'No'}
                </p>
                {deviceInfo.touchSupport && (
                  <p className="profile-device-detail">
                    {deviceInfo.maxTouchPoints} touch points
                  </p>
                )}
              </div>

              {/* Connection */}
              <div className="profile-device-item">
                <div className="profile-device-label">
                  <Wifi className="h-4 w-4" />
                  {t('profilePage.connection')}
                </div>
                <p className="profile-device-value">
                  {deviceInfo.effectiveType !== 'Unknown' ? deviceInfo.effectiveType.toUpperCase() : 'Unknown'}
                </p>
                {deviceInfo.connectionType !== 'Unknown' && (
                  <p className="profile-device-detail">{deviceInfo.connectionType}</p>
                )}
              </div>

              {/* Vendor */}
              <div className="profile-device-item">
                <div className="profile-device-label">
                  <Info className="h-4 w-4" />
                  {t('profilePage.vendor')}
                </div>
                <p className="profile-device-value">{deviceInfo.vendor}</p>
                <p className="profile-device-detail">{deviceInfo.platform}</p>
              </div>

              {/* Language & Timezone */}
              <div className="profile-device-item">
                <div className="profile-device-label">
                  <Globe className="h-4 w-4" />
                  {t('profilePage.languageTimezone')}
                </div>
                <p className="profile-device-value">{deviceInfo.language}</p>
                <p className="profile-device-detail">{deviceInfo.timezone}</p>
              </div>

              {/* Detection Time */}
              <div className="profile-device-item">
                <div className="profile-device-label">
                  <Calendar className="h-4 w-4" />
                  {t('profilePage.detected')}
                </div>
                <p className="profile-device-value">
                  {localStorage.getItem('deviceInfoTimestamp')
                    ? new Date(localStorage.getItem('deviceInfoTimestamp')!).toLocaleString()
                    : 'Recently'}
                </p>
                <p className="profile-device-detail">On homepage visit</p>
              </div>
            </div>

            {/* Additional Info - User Agent */}
            <div className="profile-device-useragent">
              <div className="profile-device-useragent-header">
                <Info className="h-4 w-4" />
                <span>User Agent</span>
              </div>
              <p className="profile-device-useragent-text">
                {deviceInfo.userAgent}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="profile-form">
        {/* Personal Information */}
        <Card className="profile-card">
          <CardHeader className="profile-card-header">
            <CardTitle className="profile-card-title">
              <User className="h-5 w-5" />
              {t('profile.personalInfo')}
            </CardTitle>
            <CardDescription className="profile-card-description">
              {t('profilePage.personalInfoDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent className="profile-card-content">
            <div className="profile-form-grid">
              <div className="profile-form-field">
                <Label htmlFor="firstName" className="profile-label">{t('profile.firstName')}</Label>
                <Input
                  id="firstName"
                  {...register("firstName", { required: "First name is required" })}
                  className="profile-input"
                />
                {errors.firstName && (
                  <p className="profile-error">{errors.firstName.message as string}</p>
                )}
              </div>

              <div className="profile-form-field">
                <Label htmlFor="lastName" className="profile-label">{t('profile.lastName')}</Label>
                <Input
                  id="lastName"
                  {...register("lastName", { required: "Last name is required" })}
                  className="profile-input"
                />
                {errors.lastName && (
                  <p className="profile-error">{errors.lastName.message as string}</p>
                )}
              </div>

              <div className="profile-form-field">
                <Label htmlFor="email" className="profile-label">{t('profile.email')}</Label>
                <Input
                  id="email"
                  type="email"
                  {...register("email", { required: "Email is required" })}
                  disabled
                  className="profile-input profile-input-disabled"
                />
                <p className="profile-field-hint">
                  {t('profilePage.emailChangeHint')}
                </p>
              </div>

              <div className="profile-form-field">
                <Label htmlFor="phone" className="profile-label">{t('profile.phone')}</Label>
                <Input
                  id="phone"
                  type="tel"
                  {...register("phone")}
                  className="profile-input"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Invoice Address */}
        <Card className="profile-card">
          <CardHeader className="profile-card-header">
            <CardTitle className="profile-card-title">
              <FileText className="h-5 w-5" />
              {t('profile.invoiceAddress')}
            </CardTitle>
            <CardDescription className="profile-card-description">
              {t('profilePage.invoiceAddressDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent className="profile-card-content">
            <div className="profile-form-field profile-form-field-full">
              <Label htmlFor="invoiceStreet" className="profile-label">{t('profilePage.streetAddress')}</Label>
              <Input
                id="invoiceStreet"
                {...register("invoiceAddress.street")}
                className="profile-input"
              />
            </div>

            <div className="profile-form-grid">
              <div className="profile-form-field">
                <Label htmlFor="invoiceCity" className="profile-label">{t('profilePage.city')}</Label>
                <Input
                  id="invoiceCity"
                  {...register("invoiceAddress.city")}
                  className="profile-input"
                />
              </div>

              <div className="profile-form-field">
                <Label htmlFor="invoiceState" className="profile-label">{t('profilePage.state')}</Label>
                <Input
                  id="invoiceState"
                  {...register("invoiceAddress.state")}
                  className="profile-input"
                />
              </div>
            </div>

            <div className="profile-form-grid">
              <div className="profile-form-field">
                <Label htmlFor="invoiceZipCode" className="profile-label">{t('profilePage.zipCode')}</Label>
                <Input
                  id="invoiceZipCode"
                  {...register("invoiceAddress.zipCode")}
                  className="profile-input"
                />
              </div>

              <div className="profile-form-field">
                <Label htmlFor="invoiceCountry" className="profile-label">{t('profilePage.country')}</Label>
                <CountrySelect
                  id="invoiceCountry"
                  value={watch("invoiceAddress.country") || DEFAULT_COUNTRY_CODE}
                  onChange={(val) => setValue("invoiceAddress.country", val)}
                  className="profile-input"
                />
              </div>
            </div>
          </CardContent>
        </Card>

          {/* Delivery / Shipping Address */}
          <Card className="profile-card">
            <CardHeader className="profile-card-header">
              <CardTitle className="profile-card-title">
                <Truck className="h-5 w-5" />
                Lieferadresse
              </CardTitle>
              <CardDescription className="profile-card-description">
                Wohin sollen Ihre Bestellungen geliefert werden?
              </CardDescription>
            </CardHeader>
            <CardContent className="profile-card-content">
              {/* Delivery type selector */}
              <div className="mb-4">
                <Label className="profile-label mb-2 block">Versandart</Label>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      { value: "same" as const, label: "Wie Rechnungsadresse", Icon: Home },
                      { value: "address" as const, label: "Abweichende Adresse", Icon: MapPin },
                      { value: "packstation" as const, label: "Packstation (DHL)", Icon: PackageSearch },
                    ]
                  ).map(({ value, label, Icon }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setDeliveryType(value)}
                      className={`flex items-center gap-1.5 rounded border px-3 py-1.5 text-sm font-medium transition-colors ${
                        deliveryType === value
                          ? "border-[#1a2a5e] bg-[#1a2a5e] text-white"
                          : "border-gray-300 bg-white text-[#1a2a5e] hover:border-[#1a2a5e]"
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Address form */}
              {deliveryType === "address" && (
                <>
                  <div className="profile-form-field profile-form-field-full">
                    <Label htmlFor="paymentStreet" className="profile-label">{t('profilePage.streetAddress')}</Label>
                    <Input
                      id="paymentStreet"
                      {...register("paymentAddress.street")}
                      className="profile-input"
                    />
                  </div>

                  <div className="profile-form-grid">
                    <div className="profile-form-field">
                      <Label htmlFor="paymentCity" className="profile-label">{t('profilePage.city')}</Label>
                      <Input
                        id="paymentCity"
                        {...register("paymentAddress.city")}
                        className="profile-input"
                      />
                    </div>

                    <div className="profile-form-field">
                      <Label htmlFor="paymentState" className="profile-label">{t('profilePage.state')}</Label>
                      <Input
                        id="paymentState"
                        {...register("paymentAddress.state")}
                        className="profile-input"
                      />
                    </div>
                  </div>

                  <div className="profile-form-grid">
                    <div className="profile-form-field">
                      <Label htmlFor="paymentZipCode" className="profile-label">{t('profilePage.zipCode')}</Label>
                      <Input
                        id="paymentZipCode"
                        {...register("paymentAddress.zipCode")}
                        className="profile-input"
                      />
                    </div>

                    <div className="profile-form-field">
                      <Label htmlFor="paymentCountry" className="profile-label">{t('profilePage.country')}</Label>
                      <CountrySelect
                        id="paymentCountry"
                        value={watch("paymentAddress.country") || DEFAULT_COUNTRY_CODE}
                        onChange={(val) => setValue("paymentAddress.country", val)}
                        className="profile-input"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Packstation form */}
              {deliveryType === "packstation" && (
                <>
                  <div className="mb-3 flex items-start gap-3">
                    <div className="flex-1 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">
                      Die <strong>Packstation-Nr.</strong> steht auf dem gelben Schild an der Station. Die <strong>Postnummer</strong> ist Ihre persönliche DHL-Kundennummer (8-stellig).
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="shrink-0 border-[#f5b800] px-3 py-2 text-sm font-semibold text-[#1a2a5e] hover:bg-[#fff9e6]"
                      onClick={() => { setDhlFinderOpen(true); setDhlFinderResults([]); setDhlFinderError("") }}
                    >
                      <Search className="mr-1.5 h-4 w-4" />
                      Standort suchen
                    </Button>
                  </div>

                  <div className="profile-form-grid">
                    <div className="profile-form-field">
                      <Label htmlFor="packstationNumber" className="profile-label">Packstation-Nr. *</Label>
                      <Input
                        id="packstationNumber"
                        {...register("paymentAddress.packstationNumber")}
                        placeholder="z.B. 123"
                        className="profile-input"
                      />
                    </div>

                    <div className="profile-form-field">
                      <Label htmlFor="postNumber" className="profile-label">Postnummer (DHL) *</Label>
                      <Input
                        id="postNumber"
                        {...register("paymentAddress.postNumber")}
                        placeholder="12345678"
                        className="profile-input"
                      />
                    </div>
                  </div>

                  <div className="profile-form-grid">
                    <div className="profile-form-field">
                      <Label htmlFor="packstationZip" className="profile-label">PLZ der Packstation *</Label>
                      <Input
                        id="packstationZip"
                        {...register("paymentAddress.zipCode")}
                        placeholder="12345"
                        className="profile-input"
                      />
                    </div>

                    <div className="profile-form-field">
                      <Label htmlFor="packstationCity" className="profile-label">{t('profilePage.city')} *</Label>
                      <Input
                        id="packstationCity"
                        {...register("paymentAddress.city")}
                        placeholder="Berlin"
                        className="profile-input"
                      />
                    </div>
                  </div>

                  <div className="profile-form-field">
                    <Label htmlFor="packstationCountry" className="profile-label">{t('profilePage.country')}</Label>
                    <CountrySelect
                      id="packstationCountry"
                      value={watch("paymentAddress.country") || DEFAULT_COUNTRY_CODE}
                      onChange={(val) => setValue("paymentAddress.country", val)}
                      className="profile-input"
                    />
                  </div>
                </>
              )}

              {deliveryType === "same" && (
                <p className="text-sm text-muted-foreground">
                  Ihre Bestellungen werden an die oben eingetragene Rechnungsadresse geliefert.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Notification Preferences */}
          <Card className="profile-card">
            <CardHeader className="profile-card-header">
              <CardTitle className="profile-card-title">
                <Bell className="h-5 w-5" />
                {t('profile.notifications')}
              </CardTitle>
              <CardDescription className="profile-card-description">
                {t('profilePage.notificationDesc')}
              </CardDescription>
            </CardHeader>
            <CardContent className="profile-card-content">
              <div className="profile-notification-item">
                <div>
                  <Label htmlFor="email-notifications" className="profile-notification-label">{t('profile.emailNotifications')}</Label>
                  <p className="profile-notification-desc">
                    {t('profilePage.emailNotificationsDesc')}
                  </p>
                </div>
                <Switch
                  id="email-notifications"
                  defaultChecked={profile.preferences.notifications.email}
                />
              </div>

              <div className="profile-notification-item">
                <div>
                  <Label htmlFor="sms-notifications" className="profile-notification-label">{t('profile.smsNotifications')}</Label>
                  <p className="profile-notification-desc">
                    {t('profilePage.smsNotificationsDesc')}
                  </p>
                </div>
                <Switch
                  id="sms-notifications"
                  defaultChecked={profile.preferences.notifications.sms}
                />
              </div>

              <div className="profile-notification-item">
                <div>
                  <Label htmlFor="push-notifications" className="profile-notification-label">{t('profile.pushNotifications')}</Label>
                  <p className="profile-notification-desc">
                    {t('profilePage.pushNotificationsDesc')}
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
          <div className="profile-save-section">
            <Button
              type="submit"
              disabled={saving}
              className="profile-save-btn"
            >
              <Save className="h-4 w-4 mr-2" />
              {saving ? t('profilePage.saving') : t('profilePage.saveChanges')}
            </Button>
          </div>
        </form>
      </div>
    </>
    )
}

