import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/useToast"
import { getOrders, Order } from "@/api/orders"
import {
  Package,
  Search,
  Clock,
  CheckCircle,
  AlertCircle,
  Calendar,
  DollarSign,
  Eye,
  Filter,
  Plus,
  Smartphone
} from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export function OrderTracking() {
  const [orders, setOrders] = useState<Order[]>([])
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const { toast } = useToast()

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        console.log("Fetching orders...")
        const response = await getOrders()
        console.log("Orders API response received:", response)
        const ordersData = (response as any).orders || []
        console.log("Orders data extracted:", ordersData)
        setOrders(ordersData)
        setFilteredOrders(ordersData)
      } catch (error) {
        console.error("Error fetching orders:", error)
        toast({
          title: "Error",
          description: "Failed to load orders",
          variant: "destructive"
        })
      } finally {
        setLoading(false)
      }
    }

    fetchOrders()
  }, [toast])

  useEffect(() => {
    let filtered = orders

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(order =>
        order.deviceBrand.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.deviceModel.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.services.some(service => service.toLowerCase().includes(searchTerm.toLowerCase()))
      )
    }

    // Filter by status
    if (statusFilter !== "all") {
      filtered = filtered.filter(order => order.status === statusFilter)
    }

    setFilteredOrders(filtered)
  }, [orders, searchTerm, statusFilter])

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

  const formatStatus = (status: string) => {
    return status.split('-').map(word =>
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ')
  }

  // Helper function to get device image or fallback
  const getDeviceImage = (order: Order) => {
    if (order.photos && order.photos.length > 0) {
      return order.photos[0]
    }
    // Return a simple colored div instead of broken image
    return null
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div className="h-8 bg-muted rounded w-48 animate-pulse"></div>
          <div className="h-10 bg-muted rounded w-32 animate-pulse"></div>
        </div>
        <div className="grid gap-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-6 bg-muted rounded w-3/4"></div>
                <div className="h-4 bg-muted rounded w-1/2"></div>
              </CardHeader>
              <CardContent>
                <div className="h-4 bg-muted rounded w-full"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">My Orders</h1>
          <p className="text-muted-foreground">
            Track your device repair orders and their progress
          </p>
        </div>
        <Button asChild>
          <Link to="/new-order">
            <Plus className="h-4 w-4 mr-2" />
            New Order
          </Link>
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search orders by device or service..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="sm:w-48">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in-progress">In Progress</SelectItem>
                  <SelectItem value="quality-check">Quality Check</SelectItem>
                  <SelectItem value="ready-for-pickup">Ready for Pickup</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Orders List */}
      <div className="space-y-4">
        {filteredOrders.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <Package className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-lg font-semibold mb-2">No orders found</h3>
              <p className="text-muted-foreground mb-4">
                {searchTerm || statusFilter !== "all"
                  ? "Try adjusting your search or filter criteria"
                  : "You haven't placed any repair orders yet"
                }
              </p>
              {!searchTerm && statusFilter === "all" && (
                <Button asChild>
                  <Link to="/new-order">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Your First Order
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          filteredOrders.map((order) => (
            <Card key={order._id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {getDeviceImage(order) ? (
                        <img
                          src={getDeviceImage(order)}
                          alt="Device"
                          className="w-8 h-8 rounded object-cover"
                          onError={(e) => {
                            // Hide broken image and show fallback
                            e.currentTarget.style.display = 'none'
                          }}
                        />
                      ) : (
                        <div className="w-8 h-8 rounded bg-primary/20 flex items-center justify-center">
                          <Smartphone className="h-4 w-4 text-primary" />
                        </div>
                      )}
                      Order #{order.orderNumber || order._id.slice(-6)}
                    </CardTitle>
                    <CardDescription className="flex items-center gap-4 mt-2">
                      <span>Device: {order.deviceBrand} {order.deviceModel}</span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {new Date(order.createdAt).toLocaleDateString()}
                      </span>
                      <span className="flex items-center gap-1">
                        <DollarSign className="h-4 w-4" />
                        ${order.totalCost}
                      </span>
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={getStatusColor(order.status)}>
                      {getStatusIcon(order.status)}
                      <span className="ml-1">{formatStatus(order.status)}</span>
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Services */}
                <div>
                  <h4 className="font-medium mb-2">Services:</h4>
                  <div className="flex flex-wrap gap-2">
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

                {/* Add-ons */}
                {order.addOns && order.addOns.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">Add-ons:</h4>
                    <div className="flex flex-wrap gap-2">
                      {order.addOns.map((addOn) => (
                        <Badge key={addOn._id} variant="secondary">
                          {addOn.name} (+${addOn.price})
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Progress */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium">Progress</span>
                    <span className="text-sm text-muted-foreground">{order.progress}%</span>
                  </div>
                  <Progress value={order.progress} className="h-2" />
                  {order.estimatedCompletion && order.status !== 'completed' && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Estimated completion: {new Date(order.estimatedCompletion).toLocaleDateString()}
                    </p>
                  )}
                </div>

                {/* Customer Notes */}
                {order.customerNotes && (
                  <div>
                    <h4 className="font-medium mb-1">Your Notes:</h4>
                    <p className="text-sm text-muted-foreground bg-muted/50 p-2 rounded">
                      {order.customerNotes}
                    </p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex justify-end pt-2">
                  <Button variant="outline" size="sm" asChild>
                    <Link to={`/orders/${order._id}`}>
                      <Eye className="h-4 w-4 mr-2" />
                      View Details
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}