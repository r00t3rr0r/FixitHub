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
  Copy
} from "lucide-react"

export function Profile() {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [sameAsInvoice, setSameAsInvoice] = useState(true)
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
      <div className="max-w-4xl mx-auto space-y-6">
        <Card className="animate-pulse">
          <CardHeader>
            <div className="h-6 bg-muted rounded w-1/3"></div>
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

  if (!profile) return null

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Profile Settings</h1>
        <p className="text-muted-foreground">
          Manage your account information and preferences
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Profile Picture */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Profile Picture
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6">
              <Avatar className="w-24 h-24">
                <AvatarImage src={profile.avatar} />
                <AvatarFallback className="text-lg">
                  {profile.firstName?.[0]}{profile.lastName?.[0]}
                </AvatarFallback>
              </Avatar>
              <div>
                <Label htmlFor="avatar" className="cursor-pointer">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={uploadingAvatar}
                    asChild
                  >
                    <span>
                      <Camera className="h-4 w-4 mr-2" />
                      {uploadingAvatar ? "Uploading..." : "Change Picture"}
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
                <p className="text-xs text-muted-foreground mt-2">
                  JPG, PNG or GIF. Max size 5MB.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Personal Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Personal Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  {...register("firstName", { required: "First name is required" })}
                />
                {errors.firstName && (
                  <p className="text-sm text-destructive">{errors.firstName.message as string}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  {...register("lastName", { required: "Last name is required" })}
                />
                {errors.lastName && (
                  <p className="text-sm text-destructive">{errors.lastName.message as string}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  {...register("email", { required: "Email is required" })}
                  disabled
                />
                <p className="text-xs text-muted-foreground">
                  Contact support to change your email address
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  {...register("phone")}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Invoice Address */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Invoice Address
            </CardTitle>
            <CardDescription>
              Address used for billing and invoices
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="invoiceStreet">Street Address</Label>
              <Input
                id="invoiceStreet"
                {...register("invoiceAddress.street")}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="invoiceCity">City</Label>
                <Input
                  id="invoiceCity"
                  {...register("invoiceAddress.city")}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="invoiceState">State</Label>
                <Input
                  id="invoiceState"
                  {...register("invoiceAddress.state")}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="invoiceZipCode">ZIP Code</Label>
                <Input
                  id="invoiceZipCode"
                  {...register("invoiceAddress.zipCode")}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="invoiceCountry">Country</Label>
                <Input
                  id="invoiceCountry"
                  {...register("invoiceAddress.country")}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Payment Address */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Payment Address
            </CardTitle>
            <CardDescription>
              Address used for payment processing and shipping
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
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
                />
                <Label htmlFor="sameAsInvoice" className="text-sm font-medium">
                  Same as invoice address
                </Label>
              </div>
              {!sameAsInvoice && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={copyInvoiceToPayment}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copy from invoice
                </Button>
              )}
            </div>

            {!sameAsInvoice && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="paymentStreet">Street Address</Label>
                  <Input
                    id="paymentStreet"
                    {...register("paymentAddress.street")}
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="paymentCity">City</Label>
                    <Input
                      id="paymentCity"
                      {...register("paymentAddress.city")}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="paymentState">State</Label>
                    <Input
                      id="paymentState"
                      {...register("paymentAddress.state")}
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="paymentZipCode">ZIP Code</Label>
                    <Input
                      id="paymentZipCode"
                      {...register("paymentAddress.zipCode")}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="paymentCountry">Country</Label>
                    <Input
                      id="paymentCountry"
                      {...register("paymentAddress.country")}
                    />
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Notification Preferences */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notification Preferences
            </CardTitle>
            <CardDescription>
              Choose how you want to receive notifications
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="email-notifications">Email Notifications</Label>
                <p className="text-sm text-muted-foreground">
                  Receive order updates via email
                </p>
              </div>
              <Switch
                id="email-notifications"
                defaultChecked={profile.preferences.notifications.email}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="sms-notifications">SMS Notifications</Label>
                <p className="text-sm text-muted-foreground">
                  Receive order updates via SMS
                </p>
              </div>
              <Switch
                id="sms-notifications"
                defaultChecked={profile.preferences.notifications.sms}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="push-notifications">Push Notifications</Label>
                <p className="text-sm text-muted-foreground">
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

        {/* Account Stats */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Account Statistics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <p className="text-2xl font-bold text-primary">{profile.totalOrders}</p>
                <p className="text-sm text-muted-foreground">Total Orders</p>
              </div>
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <p className="text-2xl font-bold text-primary">${profile.totalSpent.toFixed(2)}</p>
                <p className="text-sm text-muted-foreground">Total Spent</p>
              </div>
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <p className="text-2xl font-bold text-primary">
                  {new Date(profile.createdAt).getFullYear()}
                </p>
                <p className="text-sm text-muted-foreground">Member Since</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button type="submit" disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </form>
    </div>
  )
}