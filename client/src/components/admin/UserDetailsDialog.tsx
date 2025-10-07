import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useToast } from "@/hooks/useToast"
import { getUserDetails, DetailedUser } from "@/api/users"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import {
  User,
  Mail,
  Phone,
  MapPin,
  Calendar,
  DollarSign,
  Package,
  CreditCard,
  Activity,
  Shield,
  Settings,
  Clock,
  Monitor,
  CheckCircle,
  XCircle,
  AlertCircle,
  ExternalLink
} from "lucide-react"

interface UserDetailsDialogProps {
  userId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function UserDetailsDialog({ userId, open, onOpenChange }: UserDetailsDialogProps) {
  const [user, setUser] = useState<DetailedUser | null>(null)
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()
  const navigate = useNavigate()

  useEffect(() => {
    const fetchUserDetails = async () => {
      if (!userId || !open) return

      try {
        setLoading(true)
        console.log("Fetching user details for:", userId)
        const response = await getUserDetails(userId)
        setUser(response.user)
      } catch (error: any) {
        console.error("Error fetching user details:", error)
        toast({
          title: "Error",
          description: error.message || "Failed to load user details",
          variant: "destructive"
        })
      } finally {
        setLoading(false)
      }
    }

    fetchUserDetails()
  }, [userId, open, toast])

  const handleOrderClick = (orderId: string) => {
    console.log("Navigating to order details:", orderId)
    // Close the user details dialog first
    onOpenChange(false)
    // Navigate to order details page
    navigate(`/orders/${orderId}`)
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-red-500 text-white'
      case 'staff':
        return 'bg-blue-500 text-white'
      case 'customer':
        return 'bg-green-500 text-white'
      default:
        return 'bg-gray-500 text-white'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-500 text-white'
      case 'inactive':
        return 'bg-gray-500 text-white'
      case 'suspended':
        return 'bg-red-500 text-white'
      default:
        return 'bg-gray-500 text-white'
    }
  }

  const getOrderStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'cancelled':
        return <XCircle className="h-4 w-4 text-red-600" />
      case 'in-progress':
        return <AlertCircle className="h-4 w-4 text-blue-600" />
      default:
        return <Clock className="h-4 w-4 text-yellow-600" />
    }
  }

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-600'
      case 'failed':
        return 'text-red-600'
      case 'pending':
        return 'text-yellow-600'
      default:
        return 'text-gray-600'
    }
  }

  if (loading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] bg-background">
          <DialogHeader>
            <DialogTitle>Loading User Details...</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-muted rounded animate-pulse"></div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  if (!user) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] bg-background">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Avatar className="w-10 h-10">
              <AvatarImage src={user.avatar} />
              <AvatarFallback>
                {user.firstName?.[0]}{user.lastName?.[0]}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center gap-2">
                {user.name}
                <Badge className={getRoleColor(user.role)}>
                  {user.role}
                </Badge>
                <Badge className={getStatusColor(user.status)}>
                  {user.status}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground font-normal">
                {user.email}
              </p>
            </div>
          </DialogTitle>
          <DialogDescription>
            Comprehensive user information and activity overview
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[70vh]">
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="orders">Orders</TabsTrigger>
              <TabsTrigger value="payments">Payments</TabsTrigger>
              <TabsTrigger value="profile">Profile</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              {/* Stats Cards */}
              <div className="grid gap-4 md:grid-cols-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
                    <Package className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{user.orderStats.totalOrders}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Spent</CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">${user.orderStats.totalSpent.toFixed(2)}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Avg Order Value</CardTitle>
                    <CreditCard className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">${user.orderStats.avgOrderValue.toFixed(2)}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Customer Group</CardTitle>
                    <Shield className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-lg font-bold text-primary">{user.customerGroup}</div>
                  </CardContent>
                </Card>
              </div>

              {/* Basic Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Basic Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Email:</span>
                      <span className="text-sm">{user.email}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Phone:</span>
                      <span className="text-sm">{user.phone || 'Not provided'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Member Since:</span>
                      <span className="text-sm">{new Date(user.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Activity className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Last Login:</span>
                      <span className="text-sm">
                        {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : 'Never'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Role:</span>
                      <Badge className={getRoleColor(user.role)}>{user.role}</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Settings className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Status:</span>
                      <Badge className={getStatusColor(user.status)}>{user.status}</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Recent Orders */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    Recent Orders
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {user.orders.slice(0, 5).map((order) => (
                      <div 
                        key={order._id} 
                        className="flex items-center justify-between p-3 bg-muted/50 rounded-lg cursor-pointer hover:bg-muted/70 transition-colors"
                        onClick={() => handleOrderClick(order._id)}
                      >
                        <div className="flex items-center gap-3">
                          {getOrderStatusIcon(order.status)}
                          <div>
                            <p className="font-medium flex items-center gap-2">
                              {order.orderNumber}
                              <ExternalLink className="h-3 w-3 text-muted-foreground" />
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {order.deviceBrand} {order.deviceModel}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">${order.totalCost.toFixed(2)}</p>
                          <p className="text-sm text-muted-foreground">
                            {new Date(order.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="orders" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Order History</CardTitle>
                  <CardDescription>Complete list of user orders - click on any order to view details</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {user.orders.map((order) => (
                      <div 
                        key={order._id} 
                        className="flex items-center justify-between p-4 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => handleOrderClick(order._id)}
                      >
                        <div className="flex items-center gap-4">
                          {getOrderStatusIcon(order.status)}
                          <div>
                            <p className="font-medium flex items-center gap-2">
                              {order.orderNumber}
                              <ExternalLink className="h-3 w-3 text-muted-foreground" />
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {order.deviceBrand} {order.deviceModel}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(order.createdAt).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge variant="outline">{order.status}</Badge>
                          <p className="font-medium mt-1">${order.totalCost.toFixed(2)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="payments" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Payment History</CardTitle>
                  <CardDescription>Transaction history and payment methods</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {user.paymentHistory.map((payment) => (
                      <div key={payment._id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-4">
                          <CreditCard className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <p className="font-medium">Transaction {payment.transactionId}</p>
                            <p className="text-sm text-muted-foreground">
                              {payment.method.replace('_', ' ').toUpperCase()}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(payment.createdAt).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`font-medium ${getPaymentStatusColor(payment.status)}`}>
                            {payment.status.toUpperCase()}
                          </p>
                          <p className="font-medium">${payment.amount.toFixed(2)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="profile" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                {/* Invoice Address */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MapPin className="h-5 w-5" />
                      Invoice Address
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <p>{user.invoiceAddress?.street || 'Not provided'}</p>
                      <p>
                        {user.invoiceAddress?.city && user.invoiceAddress?.state
                          ? `${user.invoiceAddress.city}, ${user.invoiceAddress.state}`
                          : 'City, State not provided'}
                      </p>
                      <p>
                        {user.invoiceAddress?.zipCode && user.invoiceAddress?.country
                          ? `${user.invoiceAddress.zipCode}, ${user.invoiceAddress.country}`
                          : 'ZIP, Country not provided'}
                      </p>
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
                  </CardHeader>
                  <CardContent>
                    {user.paymentAddress?.sameAsInvoice ? (
                      <p className="text-sm text-muted-foreground">Same as invoice address</p>
                    ) : (
                      <div className="space-y-2 text-sm">
                        <p>{user.paymentAddress?.street || 'Not provided'}</p>
                        <p>
                          {user.paymentAddress?.city && user.paymentAddress?.state
                            ? `${user.paymentAddress.city}, ${user.paymentAddress.state}`
                            : 'City, State not provided'}
                        </p>
                        <p>
                          {user.paymentAddress?.zipCode && user.paymentAddress?.country
                            ? `${user.paymentAddress.zipCode}, ${user.paymentAddress.country}`
                            : 'ZIP, Country not provided'}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Staff Information (if applicable) */}
              {user.role === 'staff' && (
                <Card>
                  <CardHeader>
                    <CardTitle>Staff Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <p className="text-sm font-medium">Department</p>
                        <p className="text-sm text-muted-foreground">{user.department || 'Not specified'}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium">Employment Start</p>
                        <p className="text-sm text-muted-foreground">
                          {user.employmentStartDate ? new Date(user.employmentStartDate).toLocaleDateString() : 'Not specified'}
                        </p>
                      </div>
                    </div>
                    {user.specializations && user.specializations.length > 0 && (
                      <div>
                        <p className="text-sm font-medium mb-2">Specializations</p>
                        <div className="flex flex-wrap gap-2">
                          {user.specializations.map((spec, index) => (
                            <Badge key={index} variant="secondary">{spec}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    {user.skills && user.skills.length > 0 && (
                      <div>
                        <p className="text-sm font-medium mb-2">Skills</p>
                        <div className="space-y-2">
                          {user.skills.map((skill, index) => (
                            <div key={index} className="flex items-center justify-between">
                              <span className="text-sm">{skill.name}</span>
                              <Badge variant="outline">{skill.level}</Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="activity" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    Activity Log
                  </CardTitle>
                  <CardDescription>Recent user activities and system interactions</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {user.activityLog.map((activity) => (
                      <div key={activity._id} className="flex items-start gap-4 p-3 bg-muted/50 rounded-lg">
                        <Monitor className="h-5 w-5 text-muted-foreground mt-0.5" />
                        <div className="flex-1">
                          <p className="font-medium">{activity.description}</p>
                          <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                            <span>IP: {activity.ipAddress}</span>
                            <span>{new Date(activity.timestamp).toLocaleString()}</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 truncate">
                            {activity.userAgent}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="settings" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    User Preferences
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-2">Notification Preferences</h4>
                    <div className="grid gap-2 md:grid-cols-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Email</span>
                        <Badge variant={user.preferences?.notifications?.email ? "default" : "secondary"}>
                          {user.preferences?.notifications?.email ? "Enabled" : "Disabled"}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">SMS</span>
                        <Badge variant={user.preferences?.notifications?.sms ? "default" : "secondary"}>
                          {user.preferences?.notifications?.sms ? "Enabled" : "Disabled"}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Push</span>
                        <Badge variant={user.preferences?.notifications?.push ? "default" : "secondary"}>
                          {user.preferences?.notifications?.push ? "Enabled" : "Disabled"}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <Separator />
                  <div>
                    <h4 className="font-medium mb-2">Communication Preferences</h4>
                    <div className="grid gap-2 md:grid-cols-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Order Updates</span>
                        <Badge variant={user.preferences?.communication?.orderUpdates ? "default" : "secondary"}>
                          {user.preferences?.communication?.orderUpdates ? "Enabled" : "Disabled"}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Promotions</span>
                        <Badge variant={user.preferences?.communication?.promotions ? "default" : "secondary"}>
                          {user.preferences?.communication?.promotions ? "Enabled" : "Disabled"}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Newsletter</span>
                        <Badge variant={user.preferences?.communication?.newsletter ? "default" : "secondary"}>
                          {user.preferences?.communication?.newsletter ? "Enabled" : "Disabled"}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}