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
  Copy,
  TrendingUp,
  Calendar,
  DollarSign
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

      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header with gradient background */}
        <div className="animate-fade-in-up">
          <div className="profile-gradient rounded-xl p-8 shadow-lg mb-8">
            <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
              {/* Avatar Section */}
              <div className="relative group">
                <Avatar className="w-32 h-32 border-4 border-white shadow-xl transition-transform duration-300 group-hover:scale-105">
                  <AvatarImage src={profile.avatar} className="object-cover" />
                  <AvatarFallback className="text-3xl bg-white text-yellow-600 font-bold">
                    {profile.firstName?.[0]}{profile.lastName?.[0]}
                  </AvatarFallback>
                </Avatar>
                <div className="absolute inset-0 rounded-full ring-4 ring-yellow-400 ring-offset-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </div>

              {/* User Info */}
              <div className="flex-1 text-center md:text-left">
                <h1 className="text-4xl font-bold text-gray-900 mb-2">
                  {profile.firstName} {profile.lastName}
                </h1>
                <div className="flex flex-col md:flex-row gap-4 text-gray-700">
                  <div className="flex items-center justify-center md:justify-start gap-2">
                    <Mail className="h-5 w-5" />
                    <span>{profile.email}</span>
                  </div>
                  {profile.phone && (
                    <div className="flex items-center justify-center md:justify-start gap-2">
                      <Phone className="h-5 w-5" />
                      <span>{profile.phone}</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-center md:justify-start gap-2 mt-3 text-gray-600">
                  <Calendar className="h-4 w-4" />
                  <span className="text-sm">
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
                    disabled={uploadingAvatar}
                    className="bg-white hover:bg-gray-50 border-2 hover:border-yellow-400 transition-all duration-200 shadow-md hover:shadow-lg"
                    asChild
                  >
                    <span>
                      <Camera className="h-4 w-4 mr-2" />
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
                <p className="text-xs text-gray-600 mt-2 text-center">
                  JPG, PNG or GIF. Max 5MB.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid gap-6 md:grid-cols-3 animate-scale-in" style={{ animationDelay: '0.1s' }}>
          <Card className="hover-lift stat-card border-2 border-blue-100 bg-gradient-to-br from-blue-50 to-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-600 mb-1">Total Orders</p>
                  <p className="text-3xl font-bold text-gray-900">{profile.totalOrders}</p>
                </div>
                <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="hover-lift stat-card border-2 border-green-100 bg-gradient-to-br from-green-50 to-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-600 mb-1">Total Spent</p>
                  <p className="text-3xl font-bold text-gray-900">${profile.totalSpent.toFixed(2)}</p>
                </div>
                <div className="w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center">
                  <DollarSign className="h-6 w-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="hover-lift stat-card border-2 border-purple-100 bg-gradient-to-br from-purple-50 to-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-purple-600 mb-1">Member Since</p>
                  <p className="text-3xl font-bold text-gray-900">
                    {new Date(profile.createdAt).getFullYear()}
                  </p>
                </div>
                <div className="w-12 h-12 bg-purple-500 rounded-lg flex items-center justify-center">
                  <Shield className="h-6 w-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Personal Information */}
          <Card className="hover-lift border-2 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
            <CardHeader className="bg-gradient-to-r from-yellow-50 to-white">
              <CardTitle className="flex items-center gap-2 text-xl">
                <User className="h-5 w-5 text-yellow-600" />
                Personal Information
              </CardTitle>
              <CardDescription>
                Update your personal details and contact information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="firstName" className="text-sm font-semibold">First Name</Label>
                  <Input
                    id="firstName"
                    {...register("firstName", { required: "First name is required" })}
                    className="border-2 focus:border-yellow-400 transition-colors"
                  />
                  {errors.firstName && (
                    <p className="text-sm text-destructive">{errors.firstName.message as string}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="lastName" className="text-sm font-semibold">Last Name</Label>
                  <Input
                    id="lastName"
                    {...register("lastName", { required: "Last name is required" })}
                    className="border-2 focus:border-yellow-400 transition-colors"
                  />
                  {errors.lastName && (
                    <p className="text-sm text-destructive">{errors.lastName.message as string}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-semibold">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    {...register("email", { required: "Email is required" })}
                    disabled
                    className="bg-gray-50"
                  />
                  <p className="text-xs text-muted-foreground">
                    Contact support to change your email address
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-sm font-semibold">Phone Number</Label>
                  <Input
                    id="phone"
                    type="tel"
                    {...register("phone")}
                    className="border-2 focus:border-yellow-400 transition-colors"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Invoice Address */}
          <Card className="hover-lift border-2 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
            <CardHeader className="bg-gradient-to-r from-blue-50 to-white">
              <CardTitle className="flex items-center gap-2 text-xl">
                <FileText className="h-5 w-5 text-blue-600" />
                Invoice Address
              </CardTitle>
              <CardDescription>
                Address used for billing and invoices
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              <div className="space-y-2">
                <Label htmlFor="invoiceStreet" className="text-sm font-semibold">Street Address</Label>
                <Input
                  id="invoiceStreet"
                  {...register("invoiceAddress.street")}
                  className="border-2 focus:border-blue-400 transition-colors"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="invoiceCity" className="text-sm font-semibold">City</Label>
                  <Input
                    id="invoiceCity"
                    {...register("invoiceAddress.city")}
                    className="border-2 focus:border-blue-400 transition-colors"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="invoiceState" className="text-sm font-semibold">State</Label>
                  <Input
                    id="invoiceState"
                    {...register("invoiceAddress.state")}
                    className="border-2 focus:border-blue-400 transition-colors"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="invoiceZipCode" className="text-sm font-semibold">ZIP Code</Label>
                  <Input
                    id="invoiceZipCode"
                    {...register("invoiceAddress.zipCode")}
                    className="border-2 focus:border-blue-400 transition-colors"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="invoiceCountry" className="text-sm font-semibold">Country</Label>
                  <Input
                    id="invoiceCountry"
                    {...register("invoiceAddress.country")}
                    className="border-2 focus:border-blue-400 transition-colors"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payment Address */}
          <Card className="hover-lift border-2 animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
            <CardHeader className="bg-gradient-to-r from-green-50 to-white">
              <CardTitle className="flex items-center gap-2 text-xl">
                <CreditCard className="h-5 w-5 text-green-600" />
                Payment Address
              </CardTitle>
              <CardDescription>
                Address used for payment processing and shipping
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              <div className="flex items-center justify-between p-4 bg-gradient-to-r from-yellow-50 to-white rounded-lg border-2 border-yellow-200">
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
                    className="border-2"
                  />
                  <Label htmlFor="sameAsInvoice" className="text-sm font-semibold">
                    Same as invoice address
                  </Label>
                </div>
                {!sameAsInvoice && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={copyInvoiceToPayment}
                    className="hover:bg-yellow-100 border-2 hover:border-yellow-400 transition-all"
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copy from invoice
                  </Button>
                )}
              </div>

              {!sameAsInvoice && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="paymentStreet" className="text-sm font-semibold">Street Address</Label>
                    <Input
                      id="paymentStreet"
                      {...register("paymentAddress.street")}
                      className="border-2 focus:border-green-400 transition-colors"
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="paymentCity" className="text-sm font-semibold">City</Label>
                      <Input
                        id="paymentCity"
                        {...register("paymentAddress.city")}
                        className="border-2 focus:border-green-400 transition-colors"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="paymentState" className="text-sm font-semibold">State</Label>
                      <Input
                        id="paymentState"
                        {...register("paymentAddress.state")}
                        className="border-2 focus:border-green-400 transition-colors"
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="paymentZipCode" className="text-sm font-semibold">ZIP Code</Label>
                      <Input
                        id="paymentZipCode"
                        {...register("paymentAddress.zipCode")}
                        className="border-2 focus:border-green-400 transition-colors"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="paymentCountry" className="text-sm font-semibold">Country</Label>
                      <Input
                        id="paymentCountry"
                        {...register("paymentAddress.country")}
                        className="border-2 focus:border-green-400 transition-colors"
                      />
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Notification Preferences */}
          <Card className="hover-lift border-2 animate-fade-in-up" style={{ animationDelay: '0.5s' }}>
            <CardHeader className="bg-gradient-to-r from-purple-50 to-white">
              <CardTitle className="flex items-center gap-2 text-xl">
                <Bell className="h-5 w-5 text-purple-600" />
                Notification Preferences
              </CardTitle>
              <CardDescription>
                Choose how you want to receive notifications
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              <div className="flex items-center justify-between p-4 rounded-lg border-2 hover:border-purple-300 transition-all">
                <div>
                  <Label htmlFor="email-notifications" className="text-sm font-semibold">Email Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Receive order updates via email
                  </p>
                </div>
                <Switch
                  id="email-notifications"
                  defaultChecked={profile.preferences.notifications.email}
                />
              </div>

              <div className="flex items-center justify-between p-4 rounded-lg border-2 hover:border-purple-300 transition-all">
                <div>
                  <Label htmlFor="sms-notifications" className="text-sm font-semibold">SMS Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Receive order updates via SMS
                  </p>
                </div>
                <Switch
                  id="sms-notifications"
                  defaultChecked={profile.preferences.notifications.sms}
                />
              </div>

              <div className="flex items-center justify-between p-4 rounded-lg border-2 hover:border-purple-300 transition-all">
                <div>
                  <Label htmlFor="push-notifications" className="text-sm font-semibold">Push Notifications</Label>
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

          {/* Save Button */}
          <div className="flex justify-end animate-fade-in" style={{ animationDelay: '0.6s' }}>
            <Button
              type="submit"
              disabled={saving}
              className="bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold shadow-lg hover:shadow-xl transition-all duration-200 px-8 py-6 text-lg"
            >
              <Save className="h-5 w-5 mr-2" />
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </div>
    </>
  )
}
