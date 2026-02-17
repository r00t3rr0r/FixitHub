import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useToast } from "@/hooks/useToast"
import { generateAvatarPlaceholder, generateImagePlaceholder } from "@/utils/placeholders"
import {
  Package,
  Search,
  Filter,
  Clock,
  CheckCircle,
  AlertTriangle,
  Calendar,
  DollarSign,
  Eye,
  Edit,
  MessageSquare,
  Camera,
  Play,
  Pause
} from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"

interface StaffOrder {
  _id: string
  orderNumber: string
  customer: {
    _id: string
    name: string
    email: string
    phone: string
    avatar: string
  }
  deviceBrand: string
  deviceModel: string
  services: string[]
  addOns: {
    _id: string
    name: string
    status: 'pending' | 'in-progress' | 'completed'
    price: number
  }[]
  status: 'pending' | 'in-progress' | 'quality-check' | 'completed' | 'ready-for-pickup'
  priority: 'low' | 'normal' | 'high' | 'urgent'
  estimatedCompletion: string
  totalCost: number
  createdAt: string
  photos: string[]
  customerNotes: string
  progress: number
  timeTracking: {
    startTime?: string
    totalTime: number
    isActive: boolean
  }
}

export function StaffOrders() {
  const [orders, setOrders] = useState<StaffOrder[]>([])
  const [filteredOrders, setFilteredOrders] = useState<StaffOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [priorityFilter, setPriorityFilter] = useState("all")
  const [selectedOrder, setSelectedOrder] = useState<StaffOrder | null>(null)
  const [statusNote, setStatusNote] = useState("")
  const [updating, setUpdating] = useState<string | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    const fetchStaffOrders = async () => {
      try {
        // Mock data for staff orders
        const mockOrders: StaffOrder[] = [
          {
            _id: '1',
            orderNumber: 'ORD-2024-001',
            customer: {
              _id: 'customer1',
              name: 'John Doe',
              email: 'john.doe@example.com',
              phone: '+1 (555) 123-4567',
              avatar: generateAvatarPlaceholder('JD', 50)
            },
            deviceBrand: 'Apple',
            deviceModel: 'iPhone 15 Pro',
            services: ['Screen Replacement', 'Battery Replacement'],
            addOns: [
              {
                _id: 'addon1',
                name: 'Screen Protector',
                status: 'completed',
                price: 25
              }
            ],
            status: 'in-progress',
            priority: 'high',
            estimatedCompletion: '2024-01-16T17:00:00Z',
            totalCost: 359,
            createdAt: '2024-01-14T09:00:00Z',
            photos: [generateImagePlaceholder('iPhone 15 Pro', 400, 300)],
            customerNotes: 'Phone dropped, screen cracked and battery draining fast',
            progress: 65,
            timeTracking: {
              startTime: '2024-01-15T09:00:00Z',
              totalTime: 120,
              isActive: true
            }
          },
          {
            _id: '2',
            orderNumber: 'ORD-2024-002',
            customer: {
              _id: 'customer2',
              name: 'Emily Davis',
              email: 'emily.davis@example.com',
              phone: '+1 (555) 234-5678',
              avatar: generateAvatarPlaceholder('ED', 50)
            },
            deviceBrand: 'Samsung',
            deviceModel: 'Galaxy S24 Ultra',
            services: ['Camera Repair'],
            addOns: [],
            status: 'quality-check',
            priority: 'normal',
            estimatedCompletion: '2024-01-15T16:00:00Z',
            totalCost: 149,
            createdAt: '2024-01-13T14:00:00Z',
            photos: [generateImagePlaceholder('Galaxy S24', 400, 300)],
            customerNotes: 'Camera not focusing properly, especially in low light',
            progress: 90,
            timeTracking: {
              totalTime: 180,
              isActive: false
            }
          }
        ]

        setOrders(mockOrders)
        setFilteredOrders(mockOrders)
      } catch (error) {
        console.error("Error fetching staff orders:", error)
        toast({
          title: "Error",
          description: "Failed to load orders",
          variant: "destructive"
        })
      } finally {
        setLoading(false)
      }
    }

    fetchStaffOrders()
  }, [toast])

  useEffect(() => {
    let filtered = orders

    if (searchTerm) {
      filtered = filtered.filter(order =>
        order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.deviceBrand.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.deviceModel.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter(order => order.status === statusFilter)
    }

    if (priorityFilter !== "all") {
      filtered = filtered.filter(order => order.priority === priorityFilter)
    }

    setFilteredOrders(filtered)
  }, [orders, searchTerm, statusFilter, priorityFilter])

  const handleStatusUpdate = async (orderId: string, newStatus: string) => {
    try {
      setUpdating(orderId)
      // Mock API call
      await new Promise(resolve => setTimeout(resolve, 1000))

      setOrders(orders.map(order =>
        order._id === orderId ? { ...order, status: newStatus as any } : order
      ))

      toast({
        title: "Success!",
        description: "Order status updated successfully"
      })
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to update order status",
        variant: "destructive"
      })
    } finally {
      setUpdating(null)
    }
  }

  const handleTimeTracking = async (orderId: string, action: 'start' | 'pause' | 'stop') => {
    try {
      // Mock API call
      await new Promise(resolve => setTimeout(resolve, 500))

      setOrders(orders.map(order => {
        if (order._id === orderId) {
          const updatedOrder = { ...order }
          if (action === 'start') {
            updatedOrder.timeTracking.isActive = true
            updatedOrder.timeTracking.startTime = new Date().toISOString()
          } else if (action === 'pause' || action === 'stop') {
            updatedOrder.timeTracking.isActive = false
          }
          return updatedOrder
        }
        return order
      }))

      toast({
        title: "Success!",
        description: `Time tracking ${action}ed`
      })
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to update time tracking",
        variant: "destructive"
      })
    }
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

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-600 text-white'
      case 'high':
        return 'bg-orange-500 text-white'
      case 'normal':
        return 'bg-blue-500 text-white'
      case 'low':
        return 'bg-gray-500 text-white'
      default:
        return 'bg-gray-500 text-white'
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-muted rounded w-48 animate-pulse"></div>
        <Card className="animate-pulse">
          <CardHeader>
            <div className="h-6 bg-muted rounded w-1/3"></div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-16 bg-muted rounded"></div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Package className="h-8 w-8" />
          My Orders
        </h1>
        <p className="text-muted-foreground">
          Manage your assigned repair orders and track progress
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-300">
              Assigned Orders
            </CardTitle>
            <Package className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
              {orders.length}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900 border-orange-200 dark:border-orange-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-orange-700 dark:text-orange-300">
              In Progress
            </CardTitle>
            <Clock className="h-4 w-4 text-orange-600 dark:text-orange-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-900 dark:text-orange-100">
              {orders.filter(o => o.status === 'in-progress').length}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200 dark:border-green-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-green-700 dark:text-green-300">
              Completed
            </CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-900 dark:text-green-100">
              {orders.filter(o => o.status === 'completed').length}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950 dark:to-red-900 border-red-200 dark:border-red-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-red-700 dark:text-red-300">
              Urgent Orders
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-900 dark:text-red-100">
              {orders.filter(o => o.priority === 'urgent').length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search orders by number, customer, or device..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="All Status" />
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

              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="All Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priority</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Orders Table */}
      <Card>
        <CardHeader>
          <CardTitle>Assigned Orders</CardTitle>
          <CardDescription>
            Orders assigned to you for repair and maintenance
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Device</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead>Time</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                    <p className="text-muted-foreground">No orders found</p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredOrders.map((order) => (
                  <TableRow key={order._id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{order.orderNumber}</p>
                        <p className="text-sm text-muted-foreground">
                          ${order.totalCost}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="w-8 h-8">
                          <AvatarImage src={order.customer.avatar} />
                          <AvatarFallback>
                            {order.customer.name.split(' ').map(n => n[0]).join('')}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{order.customer.name}</p>
                          <p className="text-sm text-muted-foreground">{order.customer.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{order.deviceBrand} {order.deviceModel}</p>
                        <p className="text-sm text-muted-foreground">
                          {order.services.join(', ')}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={order.status}
                        onValueChange={(value) => handleStatusUpdate(order._id, value)}
                        disabled={updating === order._id}
                      >
                        <SelectTrigger className="w-36">
                          <SelectValue>
                            <Badge className={getStatusColor(order.status)}>
                              {order.status.replace('-', ' ')}
                            </Badge>
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="in-progress">In Progress</SelectItem>
                          <SelectItem value="quality-check">Quality Check</SelectItem>
                          <SelectItem value="ready-for-pickup">Ready for Pickup</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Badge className={getPriorityColor(order.priority)}>
                        {order.priority}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span>{order.progress}%</span>
                        </div>
                        <Progress value={order.progress} className="h-2" />
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{Math.floor(order.timeTracking.totalTime / 60)}h {order.timeTracking.totalTime % 60}m</span>
                        {order.timeTracking.isActive ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleTimeTracking(order._id, 'pause')}
                          >
                            <Pause className="h-3 w-3" />
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleTimeTracking(order._id, 'start')}
                          >
                            <Play className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        <Button variant="ghost" size="sm">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm">
                          <MessageSquare className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Camera className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}