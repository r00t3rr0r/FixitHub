import { useEffect, useState } from "react"
import { useParams, Link } from "react-router-dom"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useToast } from "@/hooks/useToast"
import { getOrderById, Order } from "@/api/orders"
import { getConversationMessages, sendMessage } from "@/api/messages"
import { getAvailableStaff, assignStaffToOrder, StaffMember } from "@/api/adminOrders"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  ArrowLeft,
  Package,
  Clock,
  CheckCircle,
  AlertCircle,
  Calendar,
  DollarSign,
  MessageSquare,
  Camera,
  Send,
  Paperclip,
  Shield,
  Star,
  MapPin,
  Phone,
  Mail,
  Smartphone,
  User,
  CreditCard,
  Home,
  Users,
  UserPlus
} from "lucide-react"

export function OrderDetails() {
  const { id } = useParams<{ id: string }>()
  const [order, setOrder] = useState<Order | null>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [newMessage, setNewMessage] = useState("")
  const [sending, setSending] = useState(false)
  const [availableStaff, setAvailableStaff] = useState<StaffMember[]>([])
  const [selectedStaff, setSelectedStaff] = useState<string[]>([])
  const [assigningStaff, setAssigningStaff] = useState(false)
  const [staffDialogOpen, setStaffDialogOpen] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    const fetchOrderDetails = async () => {
      if (!id) return

      try {
        console.log("Fetching order details:", id)
        const [orderResponse, messagesResponse] = await Promise.all([
          getOrderById(id),
          getConversationMessages(`conv_${id}`)
        ])

        setOrder((orderResponse as any).order)
        setMessages((messagesResponse as any).messages || [])
      } catch (error) {
        console.error("Error fetching order details:", error)
        toast({
          title: "Error",
          description: "Failed to load order details",
          variant: "destructive"
        })
      } finally {
        setLoading(false)
      }
    }

    fetchOrderDetails()
  }, [id, toast])

  useEffect(() => {
    const fetchAvailableStaff = async () => {
      try {
        const response = await getAvailableStaff()
        setAvailableStaff((response as any).staff || [])
      } catch (error) {
        console.error("Error fetching available staff:", error)
      }
    }

    fetchAvailableStaff()
  }, [])

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !id) return

    try {
      setSending(true)
      const response = await sendMessage(`conv_${id}`, newMessage)
      setMessages([...messages, (response as any).message])
      setNewMessage("")
      toast({
        title: "Message sent",
        description: "Your message has been sent to the repair team"
      })
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to send message",
        variant: "destructive"
      })
    } finally {
      setSending(false)
    }
  }

  const handleStaffAssignment = async () => {
    if (!id || selectedStaff.length === 0) return

    try {
      setAssigningStaff(true)
      await assignStaffToOrder(id, selectedStaff)

      // Update the order with assigned staff
      if (order) {
        const assignedStaffMembers = availableStaff
          .filter(staff => selectedStaff.includes(staff._id))
          .map(staff => ({
            _id: staff._id,
            name: staff.name,
            avatar: staff.avatar
          }))

        setOrder({
          ...order,
          assignedStaff: assignedStaffMembers
        } as Order)
      }

      setStaffDialogOpen(false)
      setSelectedStaff([])

      toast({
        title: "Success!",
        description: "Staff assigned successfully"
      })
    } catch (error: any) {
      console.error("Staff assignment error:", error.message)
      toast({
        title: "Error",
        description: error.message || "Failed to assign staff",
        variant: "destructive"
      })
    } finally {
      setAssigningStaff(false)
    }
  }

  const handleStaffToggle = (staffId: string, checked: boolean) => {
    setSelectedStaff(prev =>
      checked
        ? [...prev, staffId]
        : prev.filter(id => id !== staffId)
    )
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500 text-white'
      case 'in-progress':
        return 'bg-blue-500 text-white'
      case 'quality-check':
        return 'bg-yellow-500 text-black'
      case 'ready-for-pickup':
        return 'bg-purple-500 text-white'
      case 'pending':
        return 'bg-gray-500 text-white'
      default:
        return 'bg-gray-500 text-white'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4" />
      case 'in-progress':
        return <Clock className="h-4 w-4" />
      case 'quality-check':
        return <AlertCircle className="h-4 w-4" />
      case 'ready-for-pickup':
        return <Package className="h-4 w-4" />
      default:
        return <Package className="h-4 w-4" />
    }
  }

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-500 text-white'
      case 'pending':
        return 'bg-yellow-500 text-black'
      case 'refunded':
        return 'bg-red-500 text-white'
      case 'partial':
        return 'bg-orange-500 text-white'
      default:
        return 'bg-gray-500 text-white'
    }
  }

  // Helper function to get device image or fallback
  const getDeviceImage = (order: Order) => {
    if (order.photos && order.photos.length > 0) {
      return order.photos[0]
    }
    return null
  }

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <Card className="animate-pulse">
          <CardHeader>
            <div className="h-8 bg-muted rounded w-1/2"></div>
            <div className="h-4 bg-muted rounded w-1/3"></div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="h-32 bg-muted rounded"></div>
              <div className="h-20 bg-muted rounded"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="max-w-6xl mx-auto">
        <Card>
          <CardContent className="text-center py-12">
            <Package className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-semibold mb-2">Order not found</h3>
            <p className="text-muted-foreground mb-4">
              The order you're looking for doesn't exist
            </p>
            <Button asChild>
              <Link to="/orders">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Orders
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Back Button */}
      <Button variant="ghost" asChild>
        <Link to="/orders">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Orders
        </Link>
      </Button>

      {/* Order Header */}
      <Card className="bg-gradient-to-r from-primary/10 to-secondary/10">
        <CardHeader>
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <div>
              <CardTitle className="text-2xl flex items-center gap-2">
                <Package className="h-6 w-6" />
                Order #{order.orderNumber || order._id.slice(-6)}
              </CardTitle>
              <CardDescription className="text-base mt-2">
                {order.deviceBrand} {order.deviceModel} • Created {new Date(order.createdAt).toLocaleDateString()}
              </CardDescription>
            </div>
            <div className="flex items-center gap-4">
              <Badge className={`${getStatusColor(order.status)} text-lg px-4 py-2`}>
                {getStatusIcon(order.status)}
                <span className="ml-2">{order.status.replace('-', ' ')}</span>
              </Badge>
              <Badge className={`${getPaymentStatusColor(order.paymentStatus)} text-sm px-3 py-1`}>
                <CreditCard className="h-3 w-3 mr-1" />
                {order.paymentStatus}
              </Badge>
              <div className="text-right">
                <p className="text-2xl font-bold text-primary">${order.totalCost}</p>
                <p className="text-sm text-muted-foreground">Total Cost</p>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Customer Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Customer Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <Avatar className="w-16 h-16">
                  <AvatarImage src={order.customerId.avatar} />
                  <AvatarFallback className="text-lg">
                    {order.customerId.name.split(' ').map(n => n[0]).join('')}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold">{order.customerId.name}</h3>
                  <p className="text-muted-foreground flex items-center gap-2 mt-1">
                    <Mail className="h-4 w-4" />
                    {order.customerId.email}
                  </p>
                  <p className="text-muted-foreground flex items-center gap-2 mt-1">
                    <Phone className="h-4 w-4" />
                    {order.customerId.phone}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Customer since {new Date(order.customerId.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>

              {/* Address Information */}
              {order.customerId.address && (
                <div className="bg-muted/50 p-4 rounded-lg">
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <Home className="h-4 w-4" />
                    Address
                  </h4>
                  <div className="text-sm text-muted-foreground">
                    <p>{order.customerId.address.street}</p>
                    <p>{order.customerId.address.city}, {order.customerId.address.state} {order.customerId.address.zipCode}</p>
                    <p>{order.customerId.address.country}</p>
                  </div>
                </div>
              )}

              {/* Payment Methods */}
              {order.customerId.paymentMethods && order.customerId.paymentMethods.length > 0 && (
                <div className="bg-muted/50 p-4 rounded-lg">
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <CreditCard className="h-4 w-4" />
                    Payment Methods
                  </h4>
                  <div className="space-y-2">
                    {order.customerId.paymentMethods.map((method, index) => (
                      <div key={index} className="flex items-center justify-between text-sm">
                        <span className="capitalize">{method.type} ending in {method.last4}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">
                            {method.expiryMonth}/{method.expiryYear}
                          </span>
                          {method.isDefault && (
                            <Badge variant="secondary" className="text-xs">Default</Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Assigned Staff */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Assigned Staff
                </div>
                <Dialog open={staffDialogOpen} onOpenChange={setStaffDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <UserPlus className="h-4 w-4 mr-2" />
                      Assign Staff
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Assign Staff to Order</DialogTitle>
                      <DialogDescription>
                        Select one or more staff members to assign to this repair order.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 max-h-64 overflow-y-auto">
                      {availableStaff.map((staff) => (
                        <div key={staff._id} className="flex items-center space-x-3">
                          <Checkbox
                            id={staff._id}
                            checked={selectedStaff.includes(staff._id)}
                            onCheckedChange={(checked) => handleStaffToggle(staff._id, checked as boolean)}
                          />
                          <div className="flex items-center gap-3 flex-1">
                            <Avatar className="w-8 h-8">
                              <AvatarImage src={staff.avatar} />
                              <AvatarFallback>
                                {staff.name.split(' ').map(n => n[0]).join('')}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">{staff.name}</p>
                              <p className="text-sm text-muted-foreground">{staff.email}</p>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {staff.specializations.slice(0, 2).map((spec, index) => (
                                  <Badge key={index} variant="secondary" className="text-xs">
                                    {spec}
                                  </Badge>
                                ))}
                                {staff.specializations.length > 2 && (
                                  <Badge variant="secondary" className="text-xs">
                                    +{staff.specializations.length - 2} more
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <DialogFooter>
                      <Button
                        onClick={handleStaffAssignment}
                        disabled={selectedStaff.length === 0 || assigningStaff}
                      >
                        {assigningStaff ? "Assigning..." : "Assign Staff"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {order.assignedStaff && order.assignedStaff.length > 0 ? (
                <div className="space-y-3">
                  {order.assignedStaff.map((staff) => (
                    <div key={staff._id} className="flex items-center gap-3 p-3 border rounded-lg">
                      <Avatar className="w-10 h-10">
                        <AvatarImage src={staff.avatar} />
                        <AvatarFallback>
                          {staff.name.split(' ').map(n => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{staff.name}</p>
                        <p className="text-sm text-muted-foreground">Repair Technician</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No staff assigned yet</p>
                  <p className="text-sm">Click "Assign Staff" to assign technicians to this order</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Device Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Camera className="h-5 w-5" />
                Device Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                {getDeviceImage(order) ? (
                  <img
                    src={getDeviceImage(order)}
                    alt={`${order.deviceBrand} ${order.deviceModel}`}
                    className="w-24 h-24 rounded-lg object-cover border-2 border-primary/20"
                    onError={(e) => {
                      // Replace with fallback on error
                      e.currentTarget.style.display = 'none'
                      const fallback = e.currentTarget.nextElementSibling as HTMLElement
                      if (fallback) fallback.style.display = 'flex'
                    }}
                  />
                ) : null}
                <div className="w-24 h-24 rounded-lg border-2 border-primary/20 bg-primary/10 flex items-center justify-center" style={{ display: getDeviceImage(order) ? 'none' : 'flex' }}>
                  <Smartphone className="h-8 w-8 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold">{order.deviceBrand} {order.deviceModel}</h3>
                  <p className="text-muted-foreground">Repair Services</p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {order.services && order.services.length > 0 ? (
                      order.services.map((service, index) => (
                        <Badge key={index} variant="outline">
                          Service #{index + 1}
                        </Badge>
                      ))
                    ) : (
                      <Badge variant="outline">No services selected</Badge>
                    )}
                  </div>
                </div>
              </div>

              {order.customerNotes && (
                <div className="bg-muted/50 p-4 rounded-lg">
                  <h4 className="font-medium mb-2">Your Notes:</h4>
                  <p className="text-sm text-muted-foreground">{order.customerNotes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Add-On Services */}
          {order.addOns && order.addOns.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Add-On Services
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {order.addOns.map((addOn) => (
                    <div key={addOn._id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${
                          addOn.status === 'completed' ? 'bg-green-500' :
                          addOn.status === 'in-progress' ? 'bg-blue-500' :
                          'bg-gray-500'
                        }`} />
                        <div>
                          <h4 className="font-medium">{addOn.name}</h4>
                          <p className="text-sm text-muted-foreground">{addOn.description}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge className={getStatusColor(addOn.status)}>
                          {addOn.status}
                        </Badge>
                        <p className="text-sm text-muted-foreground mt-1">+${addOn.price}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Progress Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Repair Progress
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-medium">Overall Progress</span>
                  <span className="text-sm text-muted-foreground">{order.progress}%</span>
                </div>
                <Progress value={order.progress} className="h-3" />
                {order.estimatedCompletion && order.status !== 'completed' && (
                  <p className="text-sm text-muted-foreground">
                    Estimated completion: {new Date(order.estimatedCompletion).toLocaleDateString()}
                  </p>
                )}
              </div>

              <div className="space-y-4">
                <h4 className="font-medium">Repair Timeline</h4>
                <div className="space-y-3">
                  {[
                    { step: "Order Received", completed: true, date: order.createdAt },
                    { step: "Diagnostic Assessment", completed: order.progress >= 25, date: order.createdAt },
                    { step: "Repair in Progress", completed: order.progress >= 50, date: null },
                    { step: "Quality Check", completed: order.progress >= 75, date: null },
                    { step: "Ready for Pickup", completed: order.progress >= 100, date: null }
                  ].map((step, index) => (
                    <div key={index} className="flex items-center gap-3">
                      <div className={`w-4 h-4 rounded-full border-2 ${
                        step.completed
                          ? 'bg-green-500 border-green-500'
                          : 'border-gray-300 bg-background'
                      }`}>
                        {step.completed && <CheckCircle className="h-3 w-3 text-white" />}
                      </div>
                      <div className="flex-1">
                        <p className={`font-medium ${step.completed ? 'text-foreground' : 'text-muted-foreground'}`}>
                          {step.step}
                        </p>
                        {step.date && (
                          <p className="text-xs text-muted-foreground">
                            {new Date(step.date).toLocaleString()}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Order Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Order Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                {order.services && order.services.length > 0 ? (
                  order.services.map((service, index) => (
                    <div key={index} className="flex justify-between text-sm">
                      <span>Service #{index + 1}</span>
                      <span>$199</span>
                    </div>
                  ))
                ) : (
                  <div className="flex justify-between text-sm">
                    <span>No services</span>
                    <span>$0</span>
                  </div>
                )}
                {order.addOns && order.addOns.map((addOn) => (
                  <div key={addOn._id} className="flex justify-between text-sm">
                    <span>{addOn.name}</span>
                    <span>${addOn.price}</span>
                  </div>
                ))}
              </div>
              <div className="border-t pt-2 flex justify-between font-semibold">
                <span>Total</span>
                <span>${order.totalCost}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Payment Status</span>
                <Badge className={getPaymentStatusColor(order.paymentStatus)}>
                  {order.paymentStatus}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button className="w-full" variant="outline">
                <MessageSquare className="h-4 w-4 mr-2" />
                Contact Support
              </Button>
              <Button className="w-full" variant="outline">
                <Camera className="h-4 w-4 mr-2" />
                Upload Photos
              </Button>
              <Button className="w-full" variant="outline">
                <Star className="h-4 w-4 mr-2" />
                Rate Service
              </Button>
            </CardContent>
          </Card>

          {/* Communication */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Messages
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="max-h-64 overflow-y-auto space-y-3">
                {messages.map((message) => (
                  <div key={message._id} className={`flex gap-2 ${
                    message.senderRole === 'customer' ? 'justify-end' : 'justify-start'
                  }`}>
                    <div className={`max-w-xs p-3 rounded-lg ${
                      message.senderRole === 'customer'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    }`}>
                      <p className="text-sm">{message.content}</p>
                      <p className="text-xs opacity-70 mt-1">
                        {new Date(message.timestamp).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Textarea
                  placeholder="Type your message..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  className="min-h-[60px]"
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim() || sending}
                  size="sm"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}