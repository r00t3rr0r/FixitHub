import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { useToast } from "@/hooks/useToast"
import { updateUser, User } from "@/api/users"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"

interface EditUserDialogProps {
  user: User | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onUserUpdated: (user: User) => void
}

export function EditUserDialog({ user, open, onOpenChange, onUserUpdated }: EditUserDialogProps) {
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    role: "customer" as "customer" | "staff" | "admin",
    isActive: true,
    firstName: "",
    lastName: "",
    department: "",
    specializations: [] as string[],
    skills: [] as Array<{ name: string; level: string }>,
    invoiceAddress: {
      street: "",
      city: "",
      state: "",
      zipCode: "",
      country: ""
    },
    paymentAddress: {
      street: "",
      city: "",
      state: "",
      zipCode: "",
      country: "",
      sameAsInvoice: true
    },
    preferences: {
      notifications: {
        email: true,
        sms: true,
        push: true
      },
      communication: {
        orderUpdates: true,
        promotions: false,
        newsletter: true
      }
    }
  })

  const [newSpecialization, setNewSpecialization] = useState("")
  const [newSkill, setNewSkill] = useState({ name: "", level: "intermediate" })

  useEffect(() => {
    if (user && open) {
      console.log("EditUserDialog: Loading user data:", user)
      setFormData({
        name: user.name || "",
        email: user.email || "",
        phone: user.phone || "",
        role: user.role || "customer",
        isActive: user.isActive !== false,
        firstName: (user as any).firstName || "",
        lastName: (user as any).lastName || "",
        department: (user as any).department || "",
        specializations: (user as any).specializations || [],
        skills: (user as any).skills || [],
        invoiceAddress: (user as any).invoiceAddress || {
          street: "",
          city: "",
          state: "",
          zipCode: "",
          country: ""
        },
        paymentAddress: (user as any).paymentAddress || {
          street: "",
          city: "",
          state: "",
          zipCode: "",
          country: "",
          sameAsInvoice: true
        },
        preferences: (user as any).preferences || {
          notifications: {
            email: true,
            sms: true,
            push: true
          },
          communication: {
            orderUpdates: true,
            promotions: false,
            newsletter: true
          }
        }
      })
    }
  }, [user, open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!user) return

    try {
      setLoading(true)
      console.log("EditUserDialog: Updating user:", user._id, formData)

      const updateData = {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        role: formData.role,
        isActive: formData.isActive,
        firstName: formData.firstName,
        lastName: formData.lastName,
        department: formData.department,
        specializations: formData.specializations,
        skills: formData.skills,
        invoiceAddress: formData.invoiceAddress,
        paymentAddress: formData.paymentAddress,
        preferences: formData.preferences
      }

      const response = await updateUser(user._id, updateData)

      toast({
        title: "Success!",
        description: "User updated successfully"
      })

      onUserUpdated(response.user)
      onOpenChange(false)
    } catch (error: any) {
      console.error("EditUserDialog: Error updating user:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to update user",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const addSpecialization = () => {
    if (newSpecialization.trim() && !formData.specializations.includes(newSpecialization.trim())) {
      setFormData({
        ...formData,
        specializations: [...formData.specializations, newSpecialization.trim()]
      })
      setNewSpecialization("")
    }
  }

  const removeSpecialization = (index: number) => {
    setFormData({
      ...formData,
      specializations: formData.specializations.filter((_, i) => i !== index)
    })
  }

  const addSkill = () => {
    if (newSkill.name.trim()) {
      setFormData({
        ...formData,
        skills: [...formData.skills, { ...newSkill, name: newSkill.name.trim() }]
      })
      setNewSkill({ name: "", level: "intermediate" })
    }
  }

  const removeSkill = (index: number) => {
    setFormData({
      ...formData,
      skills: formData.skills.filter((_, i) => i !== index)
    })
  }

  if (!user) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] bg-background">
        <DialogHeader>
          <DialogTitle>Edit User: {user.name}</DialogTitle>
          <DialogDescription>
            Update user information, role, and preferences
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="basic">Basic Info</TabsTrigger>
              <TabsTrigger value="address">Address</TabsTrigger>
              <TabsTrigger value="staff">Staff Details</TabsTrigger>
              <TabsTrigger value="preferences">Preferences</TabsTrigger>
            </TabsList>

            <div className="max-h-[60vh] overflow-y-auto">
              <TabsContent value="basic" className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name</Label>
                    <Input
                      id="firstName"
                      value={formData.firstName}
                      onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input
                      id="lastName"
                      value={formData.lastName}
                      onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="role">Role</Label>
                    <Select
                      value={formData.role}
                      onValueChange={(value: "customer" | "staff" | "admin") =>
                        setFormData({ ...formData, role: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="customer">Customer</SelectItem>
                        <SelectItem value="staff">Staff</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="isActive"
                        checked={formData.isActive}
                        onCheckedChange={(checked) =>
                          setFormData({ ...formData, isActive: checked as boolean })
                        }
                      />
                      <Label htmlFor="isActive">Active</Label>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="address" className="space-y-4">
                <div>
                  <h3 className="text-lg font-medium mb-3">Invoice Address</h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="invoiceStreet">Street</Label>
                      <Input
                        id="invoiceStreet"
                        value={formData.invoiceAddress.street}
                        onChange={(e) => setFormData({
                          ...formData,
                          invoiceAddress: { ...formData.invoiceAddress, street: e.target.value }
                        })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="invoiceCity">City</Label>
                      <Input
                        id="invoiceCity"
                        value={formData.invoiceAddress.city}
                        onChange={(e) => setFormData({
                          ...formData,
                          invoiceAddress: { ...formData.invoiceAddress, city: e.target.value }
                        })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="invoiceState">State</Label>
                      <Input
                        id="invoiceState"
                        value={formData.invoiceAddress.state}
                        onChange={(e) => setFormData({
                          ...formData,
                          invoiceAddress: { ...formData.invoiceAddress, state: e.target.value }
                        })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="invoiceZipCode">ZIP Code</Label>
                      <Input
                        id="invoiceZipCode"
                        value={formData.invoiceAddress.zipCode}
                        onChange={(e) => setFormData({
                          ...formData,
                          invoiceAddress: { ...formData.invoiceAddress, zipCode: e.target.value }
                        })}
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="invoiceCountry">Country</Label>
                      <Input
                        id="invoiceCountry"
                        value={formData.invoiceAddress.country}
                        onChange={(e) => setFormData({
                          ...formData,
                          invoiceAddress: { ...formData.invoiceAddress, country: e.target.value }
                        })}
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-medium mb-3">Payment Address</h3>
                  <div className="flex items-center space-x-2 mb-3">
                    <Checkbox
                      id="sameAsInvoice"
                      checked={formData.paymentAddress.sameAsInvoice}
                      onCheckedChange={(checked) =>
                        setFormData({
                          ...formData,
                          paymentAddress: { ...formData.paymentAddress, sameAsInvoice: checked as boolean }
                        })
                      }
                    />
                    <Label htmlFor="sameAsInvoice">Same as invoice address</Label>
                  </div>
                  
                  {!formData.paymentAddress.sameAsInvoice && (
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="paymentStreet">Street</Label>
                        <Input
                          id="paymentStreet"
                          value={formData.paymentAddress.street}
                          onChange={(e) => setFormData({
                            ...formData,
                            paymentAddress: { ...formData.paymentAddress, street: e.target.value }
                          })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="paymentCity">City</Label>
                        <Input
                          id="paymentCity"
                          value={formData.paymentAddress.city}
                          onChange={(e) => setFormData({
                            ...formData,
                            paymentAddress: { ...formData.paymentAddress, city: e.target.value }
                          })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="paymentState">State</Label>
                        <Input
                          id="paymentState"
                          value={formData.paymentAddress.state}
                          onChange={(e) => setFormData({
                            ...formData,
                            paymentAddress: { ...formData.paymentAddress, state: e.target.value }
                          })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="paymentZipCode">ZIP Code</Label>
                        <Input
                          id="paymentZipCode"
                          value={formData.paymentAddress.zipCode}
                          onChange={(e) => setFormData({
                            ...formData,
                            paymentAddress: { ...formData.paymentAddress, zipCode: e.target.value }
                          })}
                        />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="paymentCountry">Country</Label>
                        <Input
                          id="paymentCountry"
                          value={formData.paymentAddress.country}
                          onChange={(e) => setFormData({
                            ...formData,
                            paymentAddress: { ...formData.paymentAddress, country: e.target.value }
                          })}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="staff" className="space-y-4">
                {formData.role === 'staff' && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="department">Department</Label>
                      <Input
                        id="department"
                        value={formData.department}
                        onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Specializations</Label>
                      <div className="flex gap-2">
                        <Input
                          value={newSpecialization}
                          onChange={(e) => setNewSpecialization(e.target.value)}
                          placeholder="Add specialization"
                          onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addSpecialization())}
                        />
                        <Button type="button" onClick={addSpecialization}>Add</Button>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {formData.specializations.map((spec, index) => (
                          <div key={index} className="bg-secondary px-2 py-1 rounded text-sm flex items-center gap-2">
                            {spec}
                            <button
                              type="button"
                              onClick={() => removeSpecialization(index)}
                              className="text-red-500 hover:text-red-700"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Skills</Label>
                      <div className="flex gap-2">
                        <Input
                          value={newSkill.name}
                          onChange={(e) => setNewSkill({ ...newSkill, name: e.target.value })}
                          placeholder="Skill name"
                        />
                        <Select
                          value={newSkill.level}
                          onValueChange={(value) => setNewSkill({ ...newSkill, level: value })}
                        >
                          <SelectTrigger className="w-40">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="beginner">Beginner</SelectItem>
                            <SelectItem value="intermediate">Intermediate</SelectItem>
                            <SelectItem value="advanced">Advanced</SelectItem>
                            <SelectItem value="expert">Expert</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button type="button" onClick={addSkill}>Add</Button>
                      </div>
                      <div className="space-y-2 mt-2">
                        {formData.skills.map((skill, index) => (
                          <div key={index} className="bg-secondary p-2 rounded flex items-center justify-between">
                            <span>{skill.name} - {skill.level}</span>
                            <button
                              type="button"
                              onClick={() => removeSkill(index)}
                              className="text-red-500 hover:text-red-700"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
                {formData.role !== 'staff' && (
                  <p className="text-muted-foreground">Staff details are only available for staff members.</p>
                )}
              </TabsContent>

              <TabsContent value="preferences" className="space-y-4">
                <div>
                  <h3 className="text-lg font-medium mb-3">Notification Preferences</h3>
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="emailNotifications"
                        checked={formData.preferences.notifications.email}
                        onCheckedChange={(checked) =>
                          setFormData({
                            ...formData,
                            preferences: {
                              ...formData.preferences,
                              notifications: { ...formData.preferences.notifications, email: checked as boolean }
                            }
                          })
                        }
                      />
                      <Label htmlFor="emailNotifications">Email Notifications</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="smsNotifications"
                        checked={formData.preferences.notifications.sms}
                        onCheckedChange={(checked) =>
                          setFormData({
                            ...formData,
                            preferences: {
                              ...formData.preferences,
                              notifications: { ...formData.preferences.notifications, sms: checked as boolean }
                            }
                          })
                        }
                      />
                      <Label htmlFor="smsNotifications">SMS Notifications</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="pushNotifications"
                        checked={formData.preferences.notifications.push}
                        onCheckedChange={(checked) =>
                          setFormData({
                            ...formData,
                            preferences: {
                              ...formData.preferences,
                              notifications: { ...formData.preferences.notifications, push: checked as boolean }
                            }
                          })
                        }
                      />
                      <Label htmlFor="pushNotifications">Push Notifications</Label>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-medium mb-3">Communication Preferences</h3>
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="orderUpdates"
                        checked={formData.preferences.communication.orderUpdates}
                        onCheckedChange={(checked) =>
                          setFormData({
                            ...formData,
                            preferences: {
                              ...formData.preferences,
                              communication: { ...formData.preferences.communication, orderUpdates: checked as boolean }
                            }
                          })
                        }
                      />
                      <Label htmlFor="orderUpdates">Order Updates</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="promotions"
                        checked={formData.preferences.communication.promotions}
                        onCheckedChange={(checked) =>
                          setFormData({
                            ...formData,
                            preferences: {
                              ...formData.preferences,
                              communication: { ...formData.preferences.communication, promotions: checked as boolean }
                            }
                          })
                        }
                      />
                      <Label htmlFor="promotions">Promotions</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="newsletter"
                        checked={formData.preferences.communication.newsletter}
                        onCheckedChange={(checked) =>
                          setFormData({
                            ...formData,
                            preferences: {
                              ...formData.preferences,
                              communication: { ...formData.preferences.communication, newsletter: checked as boolean }
                            }
                          })
                        }
                      />
                      <Label htmlFor="newsletter">Newsletter</Label>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </div>
          </Tabs>

          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Updating..." : "Update User"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}