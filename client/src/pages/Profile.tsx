import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
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

  const copyInvoiceToPayment = () => {
    if (!profile) return

    setValue("paymentAddress.street", profile.invoiceAddress.street)
    setValue("paymentAddress.city", profile.invoiceAddress.city)
    setValue("paymentAddress.state", profile.invoiceAddress.state)
    setValue("paymentAddress.zipCode", profile.invoiceAddress.zipCode)
    setValue("paymentAddress.country", profile.invoiceAddress.country)

    toast({
      title: t('profilePage.addressCopied'),
      description: t('profilePage.addressCopiedDesc')
    })
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
                <Input
                  id="invoiceCountry"
                  {...register("invoiceAddress.country")}
                  className="profile-input"
                />
              </div>
            </div>
          </CardContent>
        </Card>

          {/* Payment Address */}
          <Card className="profile-card">
            <CardHeader className="profile-card-header">
              <CardTitle className="profile-card-title">
                <CreditCard className="h-5 w-5" />
                {t('profile.paymentAddress')}
              </CardTitle>
              <CardDescription className="profile-card-description">
                {t('profilePage.paymentAddressDesc')}
              </CardDescription>
            </CardHeader>
            <CardContent className="profile-card-content">
              <div className="profile-same-address">
                <div className="profile-same-address-checkbox">
                  <Checkbox
                    id="sameAsInvoice"
                    checked={sameAsInvoice}
                    onCheckedChange={(checked) => {
                      setSameAsInvoice(checked as boolean)
                      if (checked) {
                        copyInvoiceToPayment()
                      }
                    }}
                  />
                  <Label htmlFor="sameAsInvoice" className="profile-same-address-label">
                    {t('profilePage.sameAsInvoice')}
                  </Label>
                </div>
                {!sameAsInvoice && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={copyInvoiceToPayment}
                    className="profile-copy-btn"
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    {t('profilePage.copyFromInvoice')}
                  </Button>
                )}
              </div>

              {!sameAsInvoice && (
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
                      <Input
                        id="paymentCountry"
                        {...register("paymentAddress.country")}
                        className="profile-input"
                      />
                    </div>
                  </div>
                </>
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
    )
}

