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
import { getInvoices, Invoice } from "@/api/financial"
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
  ExternalLink,
  FileText
} from "lucide-react"
import "./UserDetailsDialog.css"

interface UserDetailsDialogProps {
  userId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function UserDetailsDialog({ userId, open, onOpenChange }: UserDetailsDialogProps) {
  const [user, setUser] = useState<DetailedUser | null>(null)
  const [loading, setLoading] = useState(false)
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loadingInvoices, setLoadingInvoices] = useState(false)
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
        
        // Fetch invoices for this user
        await fetchUserInvoices(userId)
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

  const fetchUserInvoices = async (customerId: string) => {
    try {
      setLoadingInvoices(true)
      console.log("Fetching invoices for user:", customerId)
      const response = await getInvoices({ customerId })
      setInvoices(response.invoices || [])
    } catch (error: any) {
      console.error("Error fetching user invoices:", error)
      // Don't show error toast for invoices, just log it
      setInvoices([])
    } finally {
      setLoadingInvoices(false)
    }
  }

  const handleOrderClick = (orderId: string) => {
    console.log("Navigating to order details:", orderId)
    // Close the user details dialog first
    onOpenChange(false)
    // Navigate to order details page
    navigate(`/orders/${orderId}`)
  }

  const handleInvoiceClick = (invoiceId: string) => {
    console.log("Navigating to invoice in financial management:", invoiceId)
    // Close the user details dialog first
    onOpenChange(false)
    // Navigate to financial management page with invoices tab
    navigate('/admin/financial')
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-white text-[#1a2a5e] border border-[#1a2a5e] font-bold hover:bg-gray-50'
      case 'staff':
        return 'bg-[#f5b800] text-[#1a2a5e] font-bold hover:bg-[#e5ab00]'
      case 'customer':
        return 'bg-green-600 text-white font-bold hover:bg-green-700'
      default:
        return 'bg-gray-500 text-white font-bold hover:bg-gray-600'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-600 text-white font-bold hover:bg-green-700'
      case 'inactive':
        return 'bg-gray-500 text-white font-bold hover:bg-gray-600'
      case 'suspended':
        return 'bg-red-600 text-white font-bold hover:bg-red-700'
      default:
        return 'bg-gray-500 text-white font-bold hover:bg-gray-600'
    }
  }

  const getOrderStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
      case 'cancelled':
        return <XCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
      case 'in-progress':
        return <AlertCircle className="h-5 w-5 text-[#f5b800] flex-shrink-0" />
      default:
        return <Clock className="h-5 w-5 text-[#1a2a5e] flex-shrink-0" />
    }
  }

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-600'
      case 'failed':
        return 'text-red-600'
      case 'pending':
        return 'text-[#f5b800]'
      default:
        return 'text-[#1a2a5e]'
    }
  }

  const getInvoiceStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case 'paid':
        return 'default'
      case 'sent':
      case 'viewed':
        return 'secondary'
      case 'overdue':
        return 'destructive'
      default:
        return 'outline'
    }
  }

  if (loading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="user-details-dialog user-details-dialog--compact max-w-4xl max-h-[90vh] bg-white p-0">
          <DialogHeader className="user-details-dialog__header">
            <DialogTitle className="user-details-dialog__title">Loading User Details...</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 p-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-100 rounded animate-pulse"></div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  if (!user) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="user-details-dialog user-details-dialog--compact max-w-6xl max-h-[90vh] bg-white overflow-hidden p-0">
        <DialogHeader className="user-details-dialog__header border-b border-gray-200 pb-4">
          <DialogTitle className="user-details-dialog__title flex items-center gap-3 flex-wrap">
            <Avatar className="w-10 h-10 border-2 border-[#f5b800]">
              <AvatarImage src={user.avatar} />
              <AvatarFallback className="bg-white text-[#1a2a5e] font-bold border border-[#1a2a5e]">
                {user.firstName?.[0]}{user.lastName?.[0]}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="user-details-name text-xl md:text-2xl font-bold text-[#1a2a5e] truncate">{user.name}</span>
                <Badge className={getRoleColor(user.role)}>
                  {user.role}
                </Badge>
                <Badge className={getStatusColor(user.status)}>
                  {user.status}
                </Badge>
              </div>
              <p className="text-sm text-gray-600 font-normal truncate">
                {user.email}
              </p>
            </div>
          </DialogTitle>
          <DialogDescription className="user-details-dialog__subtitle text-base text-gray-600">
            Comprehensive user information and activity overview
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="user-details-scroll h-[70vh] px-1">
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="user-details-tabs-list grid w-full grid-cols-7 bg-gray-100 p-1 gap-1 rounded-lg mb-4 overflow-x-auto">
              <TabsTrigger value="overview" className="user-details-tabs-trigger data-[state=active]:bg-[#f5b800] data-[state=active]:text-[#1a2a5e] data-[state=active]:font-bold transition-all text-xs md:text-sm whitespace-nowrap">Overview</TabsTrigger>
              <TabsTrigger value="orders" className="user-details-tabs-trigger data-[state=active]:bg-[#f5b800] data-[state=active]:text-[#1a2a5e] data-[state=active]:font-bold transition-all text-xs md:text-sm whitespace-nowrap">Orders</TabsTrigger>
              <TabsTrigger value="invoices" className="user-details-tabs-trigger data-[state=active]:bg-[#f5b800] data-[state=active]:text-[#1a2a5e] data-[state=active]:font-bold transition-all text-xs md:text-sm whitespace-nowrap">Invoices</TabsTrigger>
              <TabsTrigger value="payments" className="user-details-tabs-trigger data-[state=active]:bg-[#f5b800] data-[state=active]:text-[#1a2a5e] data-[state=active]:font-bold transition-all text-xs md:text-sm whitespace-nowrap">Payments</TabsTrigger>
              <TabsTrigger value="profile" className="user-details-tabs-trigger data-[state=active]:bg-[#f5b800] data-[state=active]:text-[#1a2a5e] data-[state=active]:font-bold transition-all text-xs md:text-sm whitespace-nowrap">Profile</TabsTrigger>
              <TabsTrigger value="activity" className="user-details-tabs-trigger data-[state=active]:bg-[#f5b800] data-[state=active]:text-[#1a2a5e] data-[state=active]:font-bold transition-all text-xs md:text-sm whitespace-nowrap">Activity</TabsTrigger>
              <TabsTrigger value="settings" className="user-details-tabs-trigger data-[state=active]:bg-[#f5b800] data-[state=active]:text-[#1a2a5e] data-[state=active]:font-bold transition-all text-xs md:text-sm whitespace-nowrap">Settings</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4 pt-2">
              {/* Stats Cards */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card className="border-none shadow-md hover:shadow-lg transition-shadow bg-white">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-bold uppercase tracking-wide text-[#1a2a5e]">Total Orders</CardTitle>
                    <Package className="h-5 w-5 text-[#f5b800]" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-extrabold text-[#1a2a5e]">{user.orderStats.totalOrders}</div>
                  </CardContent>
                </Card>
                <Card className="border-none shadow-md hover:shadow-lg transition-shadow bg-white">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-bold uppercase tracking-wide text-[#1a2a5e]">Total Spent</CardTitle>
                    <DollarSign className="h-5 w-5 text-[#f5b800]" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-extrabold text-[#1a2a5e]">${user.orderStats.totalSpent.toFixed(2)}</div>
                  </CardContent>
                </Card>
                <Card className="border-none shadow-md hover:shadow-lg transition-shadow bg-white">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-bold uppercase tracking-wide text-[#1a2a5e]">Avg Order Value</CardTitle>
                    <CreditCard className="h-5 w-5 text-[#f5b800]" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-extrabold text-[#1a2a5e]">${user.orderStats.avgOrderValue.toFixed(2)}</div>
                  </CardContent>
                </Card>
                <Card className="border-none shadow-md hover:shadow-lg transition-shadow bg-white">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-bold uppercase tracking-wide text-[#1a2a5e]">Customer Group</CardTitle>
                    <Shield className="h-5 w-5 text-[#f5b800]" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-lg font-bold text-[#f5b800]">{user.customerGroup}</div>
                  </CardContent>
                </Card>
              </div>

              {/* Basic Information */}
              <Card className="border-none shadow-md bg-white">
                <CardHeader className="border-b border-gray-100 pb-3">
                  <CardTitle className="flex items-center gap-2 text-xl font-bold text-[#1a2a5e]">
                    <User className="h-6 w-6 text-[#f5b800]" />
                    Basic Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-6 md:grid-cols-2 pt-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 transition-colors">
                      <Mail className="h-5 w-5 text-[#f5b800] flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-bold uppercase tracking-wide text-gray-500 block">Email</span>
                        <span className="text-sm font-medium text-[#1a2a5e] truncate block">{user.email}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 transition-colors">
                      <Phone className="h-5 w-5 text-[#f5b800] flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-bold uppercase tracking-wide text-gray-500 block">Phone</span>
                        <span className="text-sm font-medium text-[#1a2a5e]">{user.phone || 'Not provided'}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 transition-colors">
                      <Calendar className="h-5 w-5 text-[#f5b800] flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-bold uppercase tracking-wide text-gray-500 block">Member Since</span>
                        <span className="text-sm font-medium text-[#1a2a5e]">{new Date(user.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 transition-colors">
                      <Activity className="h-5 w-5 text-[#f5b800] flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-bold uppercase tracking-wide text-gray-500 block">Last Login</span>
                        <span className="text-sm font-medium text-[#1a2a5e]">
                          {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : 'Never'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 transition-colors">
                      <Shield className="h-5 w-5 text-[#f5b800] flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-bold uppercase tracking-wide text-gray-500 block">Role</span>
                        <Badge className={getRoleColor(user.role)}>{user.role}</Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 transition-colors">
                      <Settings className="h-5 w-5 text-[#f5b800] flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-bold uppercase tracking-wide text-gray-500 block">Status</span>
                        <Badge className={getStatusColor(user.status)}>{user.status}</Badge>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Recent Orders */}
              <Card className="border-none shadow-md bg-white">
                <CardHeader className="border-b border-gray-100 pb-3">
                  <CardTitle className="flex items-center gap-2 text-xl font-bold text-[#1a2a5e]">
                    <Package className="h-6 w-6 text-[#f5b800]" />
                    Recent Orders
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="space-y-3">
                    {user.orders.slice(0, 5).map((order) => (
                      <div 
                        key={order._id} 
                        className="flex items-center justify-between p-4 bg-gray-50 rounded-lg cursor-pointer hover:bg-[#f5b800]/10 hover:border-l-4 hover:border-[#f5b800] transition-all shadow-sm hover:shadow-md"
                        onClick={() => handleOrderClick(order._id)}
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          {getOrderStatusIcon(order.status)}
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-[#1a2a5e] flex items-center gap-2 text-sm md:text-base">
                              {order.orderNumber}
                              <ExternalLink className="h-3 w-3 text-[#f5b800]" />
                            </p>
                            <p className="text-sm text-gray-600 truncate">
                              {order.deviceBrand} {order.deviceModel}
                            </p>
                          </div>
                        </div>
                        <div className="text-right ml-4">
                          <p className="font-bold text-[#1a2a5e] text-sm md:text-base">${order.totalCost.toFixed(2)}</p>
                          <p className="text-xs text-gray-500">
                            {new Date(order.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="orders" className="space-y-4 pt-2">
              <Card className="border-none shadow-md bg-white">
                <CardHeader className="border-b border-gray-100 pb-3">
                  <CardTitle className="text-xl font-bold text-[#1a2a5e]">Order History</CardTitle>
                  <CardDescription className="text-base text-gray-600">Complete list of user orders - click on any order to view details</CardDescription>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="space-y-3">
                    {user.orders.map((order) => (
                      <div 
                        key={order._id} 
                        className="flex flex-col md:flex-row md:items-center md:justify-between p-4 border border-gray-200 rounded-lg cursor-pointer hover:border-[#f5b800] hover:bg-[#f5b800]/5 hover:shadow-md transition-all"
                        onClick={() => handleOrderClick(order._id)}
                      >
                        <div className="flex items-start md:items-center gap-4 flex-1 min-w-0">
                          {getOrderStatusIcon(order.status)}
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-[#1a2a5e] flex items-center gap-2 text-sm md:text-base">
                              {order.orderNumber}
                              <ExternalLink className="h-3 w-3 text-[#f5b800]" />
                            </p>
                            <p className="text-sm text-gray-600 truncate">
                              {order.deviceBrand} {order.deviceModel}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              {new Date(order.createdAt).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 mt-3 md:mt-0 md:text-right md:ml-4">
                          <Badge variant="outline" className="border-[#1a2a5e] text-[#1a2a5e] font-bold">{order.status}</Badge>
                          <p className="font-bold text-[#1a2a5e] text-sm md:text-base">${order.totalCost.toFixed(2)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="invoices" className="space-y-4 pt-2">
              <Card className="border-none shadow-md bg-white">
                <CardHeader className="border-b border-gray-100 pb-3">
                  <CardTitle className="flex items-center gap-2 text-xl font-bold text-[#1a2a5e]">
                    <FileText className="h-6 w-6 text-[#f5b800]" />
                    Invoice History
                  </CardTitle>
                  <CardDescription className="text-base text-gray-600">All invoices for this user - click on any invoice to view in financial management</CardDescription>
                </CardHeader>
                <CardContent className="pt-4">
                  {loadingInvoices ? (
                    <div className="space-y-3">
                      {[...Array(3)].map((_, i) => (
                        <div key={i} className="h-20 bg-gray-100 rounded animate-pulse"></div>
                      ))}
                    </div>
                  ) : invoices.length === 0 ? (
                    <div className="text-center py-8">
                      <FileText className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                      <p className="text-gray-500 font-medium">No invoices found for this user</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {invoices.map((invoice) => (
                        <div 
                          key={invoice._id} 
                          className="flex flex-col md:flex-row md:items-center md:justify-between p-4 border border-gray-200 rounded-lg cursor-pointer hover:border-[#f5b800] hover:bg-[#f5b800]/5 hover:shadow-md transition-all"
                          onClick={() => handleInvoiceClick(invoice._id)}
                        >
                          <div className="flex items-start md:items-center gap-4 flex-1 min-w-0">
                            <FileText className="h-5 w-5 text-[#f5b800] flex-shrink-0 mt-1 md:mt-0" />
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-[#1a2a5e] flex items-center gap-2 text-sm md:text-base">
                                {invoice.invoiceNumber}
                                <ExternalLink className="h-3 w-3 text-[#f5b800]" />
                              </p>
                              <p className="text-sm text-gray-600">
                                Due: {new Date(invoice.dueDate).toLocaleDateString()}
                              </p>
                              <p className="text-xs text-gray-500">
                                Created: {new Date(invoice.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 mt-3 md:mt-0 md:text-right md:ml-4">
                            <Badge variant={getInvoiceStatusVariant(invoice.status)} className="font-bold">
                              {invoice.status}
                            </Badge>
                            <p className="font-bold text-[#1a2a5e] text-sm md:text-base">${invoice.total.toFixed(2)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="payments" className="space-y-4 pt-2">
              <Card className="border-none shadow-md bg-white">
                <CardHeader className="border-b border-gray-100 pb-3">
                  <CardTitle className="text-xl font-bold text-[#1a2a5e]">Payment History</CardTitle>
                  <CardDescription className="text-base text-gray-600">Transaction history and payment methods</CardDescription>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="space-y-3">
                    {user.paymentHistory.map((payment) => (
                      <div key={payment._id} className="flex flex-col md:flex-row md:items-center md:justify-between p-4 border border-gray-200 rounded-lg hover:border-[#f5b800] hover:bg-[#f5b800]/5 transition-all">
                        <div className="flex items-start md:items-center gap-4 flex-1 min-w-0">
                          <CreditCard className="h-5 w-5 text-[#f5b800] flex-shrink-0 mt-1 md:mt-0" />
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-[#1a2a5e] text-sm md:text-base">Transaction {payment.transactionId}</p>
                            <p className="text-sm text-gray-600 uppercase font-medium">
                              {payment.method.replace('_', ' ')}
                            </p>
                            <p className="text-xs text-gray-500">
                              {new Date(payment.createdAt).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 mt-3 md:mt-0 md:text-right md:ml-4">
                          <p className={`font-bold uppercase text-sm ${getPaymentStatusColor(payment.status)}`}>
                            {payment.status}
                          </p>
                          <p className="font-bold text-[#1a2a5e] text-sm md:text-base">${payment.amount.toFixed(2)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="profile" className="space-y-4 pt-2">
              <div className="grid gap-4 md:grid-cols-2">
                {/* Invoice Address */}
                <Card className="border-none shadow-md bg-white">
                  <CardHeader className="border-b border-gray-100 pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg font-bold text-[#1a2a5e]">
                      <MapPin className="h-5 w-5 text-[#f5b800]" />
                      Invoice Address
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <div className="space-y-2 text-sm">
                      <p className="text-[#1a2a5e] font-medium">{user.invoiceAddress?.street || 'Not provided'}</p>
                      <p className="text-gray-600">
                        {user.invoiceAddress?.city && user.invoiceAddress?.state
                          ? `${user.invoiceAddress.city}, ${user.invoiceAddress.state}`
                          : 'City, State not provided'}
                      </p>
                      <p className="text-gray-600">
                        {user.invoiceAddress?.zipCode && user.invoiceAddress?.country
                          ? `${user.invoiceAddress.zipCode}, ${user.invoiceAddress.country}`
                          : 'ZIP, Country not provided'}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* Payment Address */}
                <Card className="border-none shadow-md bg-white">
                  <CardHeader className="border-b border-gray-100 pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg font-bold text-[#1a2a5e]">
                      <CreditCard className="h-5 w-5 text-[#f5b800]" />
                      Payment Address
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4">
                    {user.paymentAddress?.sameAsInvoice ? (
                      <p className="text-sm text-gray-500 font-medium">Same as invoice address</p>
                    ) : (
                      <div className="space-y-2 text-sm">
                        <p className="text-[#1a2a5e] font-medium">{user.paymentAddress?.street || 'Not provided'}</p>
                        <p className="text-gray-600">
                          {user.paymentAddress?.city && user.paymentAddress?.state
                            ? `${user.paymentAddress.city}, ${user.paymentAddress.state}`
                            : 'City, State not provided'}
                        </p>
                        <p className="text-gray-600">
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
                <Card className="border-none shadow-md bg-white">
                  <CardHeader className="border-b border-gray-100 pb-3">
                    <CardTitle className="text-xl font-bold text-[#1a2a5e]">Staff Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <p className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-1">Department</p>
                        <p className="text-sm font-medium text-[#1a2a5e]">{user.department || 'Not specified'}</p>
                      </div>
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <p className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-1">Employment Start</p>
                        <p className="text-sm font-medium text-[#1a2a5e]">
                          {user.employmentStartDate ? new Date(user.employmentStartDate).toLocaleDateString() : 'Not specified'}
                        </p>
                      </div>
                    </div>
                    {user.specializations && user.specializations.length > 0 && (
                      <div>
                        <p className="text-sm font-bold uppercase tracking-wide text-gray-500 mb-2">Specializations</p>
                        <div className="flex flex-wrap gap-2">
                          {user.specializations.map((spec, index) => (
                            <Badge key={index} variant="secondary" className="bg-[#f5b800]/20 text-[#1a2a5e] font-medium">{spec}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    {user.skills && user.skills.length > 0 && (
                      <div>
                        <p className="text-sm font-bold uppercase tracking-wide text-gray-500 mb-2">Skills</p>
                        <div className="space-y-2">
                          {user.skills.map((skill, index) => (
                            <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                              <span className="text-sm font-medium text-[#1a2a5e]">{skill.name}</span>
                              <Badge variant="outline" className="border-[#f5b800] text-[#f5b800] font-medium">{skill.level}</Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="activity" className="space-y-4 pt-2">
              <Card className="border-none shadow-md bg-white">
                <CardHeader className="border-b border-gray-100 pb-3">
                  <CardTitle className="flex items-center gap-2 text-xl font-bold text-[#1a2a5e]">
                    <Activity className="h-6 w-6 text-[#f5b800]" />
                    Activity Log
                  </CardTitle>
                  <CardDescription className="text-base text-gray-600">Recent user activities and system interactions</CardDescription>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="space-y-3">
                    {user.activityLog.map((activity) => (
                      <div key={activity._id} className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg hover:bg-[#f5b800]/5 transition-colors border-l-4 border-transparent hover:border-[#f5b800]">
                        <Monitor className="h-5 w-5 text-[#f5b800] flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-[#1a2a5e] text-sm md:text-base">{activity.description}</p>
                          <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-gray-500">
                            <span className="font-medium">IP: {activity.ipAddress}</span>
                            <span>{new Date(activity.timestamp).toLocaleString()}</span>
                          </div>
                          <p className="text-xs text-gray-500 mt-1 truncate">
                            {activity.userAgent}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="settings" className="space-y-4 pt-2">
              <Card className="border-none shadow-md bg-white">
                <CardHeader className="border-b border-gray-100 pb-3">
                  <CardTitle className="flex items-center gap-2 text-xl font-bold text-[#1a2a5e]">
                    <Settings className="h-6 w-6 text-[#f5b800]" />
                    User Preferences
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 pt-4">
                  <div>
                    <h4 className="font-bold text-sm uppercase tracking-wide text-gray-500 mb-3">Notification Preferences</h4>
                    <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <span className="text-sm font-medium text-[#1a2a5e]">Email</span>
                        <Badge variant={user.preferences?.notifications?.email ? "default" : "secondary"} className={user.preferences?.notifications?.email ? "bg-[#f5b800] text-[#1a2a5e] hover:bg-[#f5b800]/90" : ""}>
                          {user.preferences?.notifications?.email ? "Enabled" : "Disabled"}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <span className="text-sm font-medium text-[#1a2a5e]">SMS</span>
                        <Badge variant={user.preferences?.notifications?.sms ? "default" : "secondary"} className={user.preferences?.notifications?.sms ? "bg-[#f5b800] text-[#1a2a5e] hover:bg-[#f5b800]/90" : ""}>
                          {user.preferences?.notifications?.sms ? "Enabled" : "Disabled"}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <span className="text-sm font-medium text-[#1a2a5e]">Push</span>
                        <Badge variant={user.preferences?.notifications?.push ? "default" : "secondary"} className={user.preferences?.notifications?.push ? "bg-[#f5b800] text-[#1a2a5e] hover:bg-[#f5b800]/90" : ""}>
                          {user.preferences?.notifications?.push ? "Enabled" : "Disabled"}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <Separator />
                  <div>
                    <h4 className="font-bold text-sm uppercase tracking-wide text-gray-500 mb-3">Communication Preferences</h4>
                    <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <span className="text-sm font-medium text-[#1a2a5e]">Order Updates</span>
                        <Badge variant={user.preferences?.communication?.orderUpdates ? "default" : "secondary"} className={user.preferences?.communication?.orderUpdates ? "bg-[#f5b800] text-[#1a2a5e] hover:bg-[#f5b800]/90" : ""}>
                          {user.preferences?.communication?.orderUpdates ? "Enabled" : "Disabled"}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <span className="text-sm font-medium text-[#1a2a5e]">Promotions</span>
                        <Badge variant={user.preferences?.communication?.promotions ? "default" : "secondary"} className={user.preferences?.communication?.promotions ? "bg-[#f5b800] text-[#1a2a5e] hover:bg-[#f5b800]/90" : ""}>
                          {user.preferences?.communication?.promotions ? "Enabled" : "Disabled"}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <span className="text-sm font-medium text-[#1a2a5e]">Newsletter</span>
                        <Badge variant={user.preferences?.communication?.newsletter ? "default" : "secondary"} className={user.preferences?.communication?.newsletter ? "bg-[#f5b800] text-[#1a2a5e] hover:bg-[#f5b800]/90" : ""}>
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