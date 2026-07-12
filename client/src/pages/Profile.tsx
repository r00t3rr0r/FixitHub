import { useEffect, useState } from "react"
import { SEO } from '@/components/SEO'
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useToast } from "@/hooks/useToast"
import { getUserProfile, updateUserProfile, UserProfile } from "@/api/user"
import { searchDhlLocations, type DhlLocation } from "@/api/shipping"
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
  Save,
  CreditCard,
  FileText,
  TrendingUp,
  Calendar,
  DollarSign,
  Home,
  PackageSearch,
  Truck,
  Search,
  Loader2,
  Clock,
  MapPinned,
  X,
} from "lucide-react"

const NOTIFICATION_TYPE_KEYS = [
  "order_update",
  "payment",
  "message",
  "system",
  "assignment",
  "reminder",
] as const

type NotificationTypeKey = typeof NOTIFICATION_TYPE_KEYS[number]

const defaultTypeChannels: Record<NotificationTypeKey, { email: boolean; push: boolean }> = {
  order_update: { email: true, push: true },
  payment: { email: true, push: true },
  message: { email: true, push: true },
  system: { email: true, push: true },
  assignment: { email: true, push: true },
  reminder: { email: true, push: true },
}

export function Profile() {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deliveryType, setDeliveryType] = useState<"same" | "address" | "packstation">("same")
  const [dhlFinderOpen, setDhlFinderOpen] = useState(false)
  const [dhlFinderQuery, setDhlFinderQuery] = useState("")
  const [dhlFinderLoading, setDhlFinderLoading] = useState(false)
  const [dhlFinderResults, setDhlFinderResults] = useState<DhlLocation[]>([])
  const [dhlFinderError, setDhlFinderError] = useState("")
  const { toast } = useToast()
  const { t } = useTranslation()

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm()
  const emailNotificationsEnabled = watch("preferences.notifications.email") !== false
  const pushNotificationsEnabled = watch("preferences.notifications.push") !== false

  const setDefaultTypeChannels = (profileData: any) => {
    for (const key of NOTIFICATION_TYPE_KEYS) {
      setValue(
        `preferences.notifications.channelsByType.${key}.email`,
        profileData?.preferences?.notifications?.channelsByType?.[key]?.email !== false
      )
      setValue(
        `preferences.notifications.channelsByType.${key}.push`,
        profileData?.preferences?.notifications?.channelsByType?.[key]?.push !== false
      )
    }
  }

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

        setValue("preferences.notifications.email", profileData.preferences?.notifications?.email !== false)
        setValue("preferences.notifications.push", profileData.preferences?.notifications?.push !== false)

        setDefaultTypeChannels(profileData)
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
        preferences: {
          ...(profile?.preferences || {}),
          ...(data.preferences || {}),
          notifications: {
            ...(profile?.preferences?.notifications || {}),
            ...(data.preferences?.notifications || {}),
            email: data.preferences?.notifications?.email !== false,
            push: data.preferences?.notifications?.push !== false,
            channelsByType: NOTIFICATION_TYPE_KEYS.reduce((acc, key) => {
              const email = data.preferences?.notifications?.channelsByType?.[key]?.email !== false
              const push = data.preferences?.notifications?.channelsByType?.[key]?.push !== false
              acc[key] = { email, push }
              return acc
            }, { ...(profile?.preferences?.notifications?.channelsByType || defaultTypeChannels) } as Record<NotificationTypeKey, { email: boolean; push: boolean }>),
          },
        },
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
    <SEO
      title="Mein Profil – McRepair.de Kundenportal"
      description="Verwalten Sie Ihre persönlichen Daten, Passwort und Kommunikationseinstellungen im McRepair.de Kundenportal."
      canonical="/profile"
      noindex={true}
    />
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
          </div>

          {/* User Info */}
          <div className="profile-user-info">
            <div className="profile-role-badge">
              {profile.role === 'admin' ? 'Administrator' : profile.role === 'staff' ? 'Mitarbeiter' : 'Kunde'}
            </div>
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
              <div className="profile-channel-card">
                <div className="profile-channel-header">
                  <div>
                    <Label className="profile-notification-label">{t('profile.emailNotifications')}</Label>
                    <p className="profile-notification-desc">{t('profilePage.emailNotificationsDesc')}</p>
                  </div>
                  <RadioGroup
                    value={emailNotificationsEnabled ? 'on' : 'off'}
                    onValueChange={(value) => setValue('preferences.notifications.email', value === 'on')}
                    className="profile-channel-radio-group"
                  >
                    <div className="profile-radio-option">
                      <RadioGroupItem value="on" id="email-channel-on" />
                      <Label htmlFor="email-channel-on" className="profile-radio-label">{t('profilePage.channelOn')}</Label>
                    </div>
                    <div className="profile-radio-option">
                      <RadioGroupItem value="off" id="email-channel-off" />
                      <Label htmlFor="email-channel-off" className="profile-radio-label">{t('profilePage.channelOff')}</Label>
                    </div>
                  </RadioGroup>
                </div>

                {emailNotificationsEnabled && (
                  <details className="profile-channel-dropdown" open>
                    <summary className="profile-channel-dropdown-summary">{t('profilePage.channelTypeDropdown')}</summary>
                    <div className="profile-channel-dropdown-content">
                      <div className="profile-notification-events-grid">
                        {NOTIFICATION_TYPE_KEYS.map((typeKey) => {
                          const checked = watch(`preferences.notifications.channelsByType.${typeKey}.email`) !== false
                          const isPaymentType = typeKey === 'payment'
                          return (
                            <div className="profile-checkbox-option" key={`email-${typeKey}`}>
                              <Checkbox
                                id={`type-email-${typeKey}`}
                                checked={checked}
                                disabled={isPaymentType}
                                onCheckedChange={(checkedState) => setValue(`preferences.notifications.channelsByType.${typeKey}.email`, checkedState === true)}
                              />
                              <Label htmlFor={`type-email-${typeKey}`} className="profile-checkbox-label">
                                {t(`profilePage.type.${typeKey}`)}
                                {isPaymentType ? ` (${t('profilePage.invoiceAlwaysEmailShort')})` : ''}
                              </Label>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </details>
                )}
              </div>

              <div className="profile-channel-card">
                <div className="profile-channel-header">
                  <div>
                    <Label className="profile-notification-label">{t('profilePage.notificationChannel')}</Label>
                    <p className="profile-notification-desc">{t('profilePage.notificationChannelDesc')}</p>
                  </div>
                  <RadioGroup
                    value={pushNotificationsEnabled ? 'on' : 'off'}
                    onValueChange={(value) => setValue('preferences.notifications.push', value === 'on')}
                    className="profile-channel-radio-group"
                  >
                    <div className="profile-radio-option">
                      <RadioGroupItem value="on" id="notification-channel-on" />
                      <Label htmlFor="notification-channel-on" className="profile-radio-label">{t('profilePage.channelOn')}</Label>
                    </div>
                    <div className="profile-radio-option">
                      <RadioGroupItem value="off" id="notification-channel-off" />
                      <Label htmlFor="notification-channel-off" className="profile-radio-label">{t('profilePage.channelOff')}</Label>
                    </div>
                  </RadioGroup>
                </div>

                {pushNotificationsEnabled && (
                  <details className="profile-channel-dropdown" open>
                    <summary className="profile-channel-dropdown-summary">{t('profilePage.channelTypeDropdown')}</summary>
                    <div className="profile-channel-dropdown-content">
                      <div className="profile-notification-events-grid">
                        {NOTIFICATION_TYPE_KEYS.map((typeKey) => {
                          const checked = watch(`preferences.notifications.channelsByType.${typeKey}.push`) !== false
                          return (
                            <div className="profile-checkbox-option" key={`push-${typeKey}`}>
                              <Checkbox
                                id={`type-push-${typeKey}`}
                                checked={checked}
                                onCheckedChange={(checkedState) => setValue(`preferences.notifications.channelsByType.${typeKey}.push`, checkedState === true)}
                              />
                              <Label htmlFor={`type-push-${typeKey}`} className="profile-checkbox-label">
                                {t(`profilePage.type.${typeKey}`)}
                              </Label>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </details>
                )}
              </div>

              <p className="profile-notification-desc">
                {t('profilePage.invoiceAlwaysEmailHint')}
              </p>
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

