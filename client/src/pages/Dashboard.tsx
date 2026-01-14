import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useToast } from "@/hooks/useToast"
import { getOrders, Order } from "@/api/orders"
import { getCart, Cart } from "@/api/shop"
import { getBlogPosts, BlogPost } from "@/api/blog"
import { getNotifications } from "@/api/notifications"
import {
  Plus,
  Package,
  ShoppingCart,
  Clock,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  Calendar,
  Star,
  ArrowRight,
  MessageSquare,
  CreditCard,
  BookOpen,
  Smartphone,
  Wrench,
  Shield,
  Zap,
  Eye,
  Heart,
  Bell
} from "lucide-react"

export function Dashboard() {
  const { t } = useTranslation()
  const [orders, setOrders] = useState<Order[]>([])
  const [cart, setCart] = useState<Cart | null>(null)
  const [blogPosts, setBlogPosts] = useState<BlogPost[]>([])
  const [notifications, setNotifications] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        console.log("Fetching dashboard data...")
        const [ordersResponse, cartResponse, blogResponse, notificationsResponse] = await Promise.all([
          getOrders(),
          getCart(),
          getBlogPosts({ limit: 3 }),
          getNotifications({ limit: 5 })
        ])

        setOrders((ordersResponse as any).orders || [])
        setCart((cartResponse as any).cart || null)
        setBlogPosts((blogResponse as any).posts || [])
        setNotifications((notificationsResponse as any).notifications || [])
      } catch (error: any) {
        console.error("Error fetching dashboard data:", error)
        toast({
          title: "Error",
          description: error.message || "Failed to load dashboard data",
          variant: "destructive"
        })
      } finally {
        setLoading(false)
      }
    }

    fetchDashboardData()
  }, [toast])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500'
      case 'in-progress':
        return 'bg-blue-500'
      case 'quality-check':
        return 'bg-yellow-500'
      case 'pending':
        return 'bg-gray-500'
      default:
        return 'bg-gray-500'
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
      default:
        return <Package className="h-4 w-4" />
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="space-y-0 pb-2">
                <div className="h-4 bg-muted rounded w-3/4"></div>
                <div className="h-8 bg-muted rounded w-1/2 mt-2"></div>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  const activeOrders = orders.filter(order => order.status !== 'completed')
  const completedOrders = orders.filter(order => order.status === 'completed')
  const unreadNotifications = notifications.filter(n => !n.isRead)

  return (
    <div className="space-y-8">
      {/* Enhanced Welcome Section */}
      <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent rounded-xl p-8 border border-primary/20 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-primary/20 to-transparent rounded-full -translate-y-16 translate-x-16"></div>
        <div className="relative">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-4xl font-bold text-foreground mb-2">Welcome back!</h1>
              <p className="text-lg text-muted-foreground">
                Here's what's happening with your device repairs and orders.
              </p>
            </div>
            {unreadNotifications.length > 0 && (
              <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-950/20 px-4 py-2 rounded-lg">
                <Bell className="h-5 w-5 text-blue-600" />
                <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                  {unreadNotifications.length} new notification{unreadNotifications.length > 1 ? 's' : ''}
                </span>
              </div>
            )}
          </div>

          {/* Recent Activity Timeline */}
          <div className="bg-background/50 backdrop-blur-sm rounded-lg p-4 border">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Recent Activity
            </h3>
            <div className="space-y-2">
              {notifications.slice(0, 3).map((notification, index) => (
                <div key={notification._id} className="flex items-center gap-3 text-sm">
                  <div className={`w-2 h-2 rounded-full ${!notification.isRead ? 'bg-blue-500' : 'bg-gray-300'}`}></div>
                  <span className="text-muted-foreground">{notification.message}</span>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {new Date(notification.createdAt).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800 hover:shadow-lg transition-all duration-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-300">
              Active Orders
            </CardTitle>
            <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
              <Package className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
              {activeOrders.length}
            </div>
            <p className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1 mt-1">
              <TrendingUp className="h-3 w-3" />
              Currently in progress
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200 dark:border-green-800 hover:shadow-lg transition-all duration-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-green-700 dark:text-green-300">
              Completed Orders
            </CardTitle>
            <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
              <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-900 dark:text-green-100">
              {completedOrders.length}
            </div>
            <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1 mt-1">
              <CheckCircle className="h-3 w-3" />
              Successfully finished
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border-purple-200 dark:border-purple-800 hover:shadow-lg transition-all duration-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-purple-700 dark:text-purple-300">
              Cart Items
            </CardTitle>
            <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
              <ShoppingCart className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-900 dark:text-purple-100">
              {cart?.totalItems || 0}
            </div>
            <p className="text-xs text-purple-600 dark:text-purple-400 flex items-center gap-1 mt-1">
              <TrendingUp className="h-3 w-3" />
              ${cart?.total?.toFixed(2) || '0.00'} total
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900 border-orange-200 dark:border-orange-800 hover:shadow-lg transition-all duration-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-orange-700 dark:text-orange-300">
              Total Spent
            </CardTitle>
            <div className="p-2 bg-orange-100 dark:bg-orange-900 rounded-lg">
              <TrendingUp className="h-4 w-4 text-orange-600 dark:text-orange-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-900 dark:text-orange-100">
              ${orders.reduce((sum, order) => sum + (Number(order.totalCost) || 0), 0).toFixed(2)}
            </div>
            <p className="text-xs text-orange-600 dark:text-orange-400 flex items-center gap-1 mt-1">
              <Calendar className="h-3 w-3" />
              Lifetime total
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Enhanced Quick Actions Panel */}
      <Card className="bg-gradient-to-r from-background to-secondary/20 border-2 border-primary/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Zap className="h-6 w-6 text-primary" />
            Quick Actions
          </CardTitle>
          <CardDescription className="text-base">
            Get started with common tasks and manage your repairs
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Button asChild className="h-auto p-6 flex-col gap-3 bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-lg hover:shadow-xl transition-all duration-200">
              <Link to="/new-order">
                <div className="p-3 bg-white/20 rounded-full">
                  <Plus className="h-8 w-8" />
                </div>
                <div className="text-center">
                  <span className="font-semibold text-lg">New Repair Order</span>
                  <span className="text-sm opacity-90 block">Start a device repair</span>
                </div>
              </Link>
            </Button>

            <Button asChild variant="outline" className="h-auto p-6 flex-col gap-3 border-2 hover:bg-accent hover:border-primary/50 transition-all duration-200 group">
              <Link to="/orders">
                <div className="p-3 bg-primary/10 rounded-full group-hover:bg-primary/20 transition-colors">
                  <MessageSquare className="h-8 w-8 text-primary" />
                </div>
                <div className="text-center">
                  <span className="font-semibold text-lg">View Messages</span>
                  <span className="text-sm text-muted-foreground block">
                    {unreadNotifications.length > 0 ? `${unreadNotifications.length} unread` : 'No new messages'}
                  </span>
                </div>
                {unreadNotifications.length > 0 && (
                  <Badge variant="destructive" className="absolute -top-2 -right-2">
                    {unreadNotifications.length}
                  </Badge>
                )}
              </Link>
            </Button>

            <Button asChild variant="outline" className="h-auto p-6 flex-col gap-3 border-2 hover:bg-accent hover:border-primary/50 transition-all duration-200 group relative">
              <Link to="/cart">
                <div className="p-3 bg-purple-100 dark:bg-purple-900 rounded-full group-hover:bg-purple-200 dark:group-hover:bg-purple-800 transition-colors">
                  <ShoppingCart className="h-8 w-8 text-purple-600 dark:text-purple-400" />
                </div>
                <div className="text-center">
                  <span className="font-semibold text-lg">Shopping Cart</span>
                  <span className="text-sm text-muted-foreground block">
                    {cart?.totalItems || 0} items • ${cart?.total?.toFixed(2) || '0.00'}
                  </span>
                </div>
                {cart && cart.totalItems > 0 && (
                  <Badge variant="secondary" className="absolute -top-2 -right-2">
                    {cart.totalItems}
                  </Badge>
                )}
              </Link>
            </Button>

            <Button asChild variant="outline" className="h-auto p-6 flex-col gap-3 border-2 hover:bg-accent hover:border-primary/50 transition-all duration-200 group">
              <Link to="/orders">
                <div className="p-3 bg-green-100 dark:bg-green-900 rounded-full group-hover:bg-green-200 dark:group-hover:bg-green-800 transition-colors">
                  <CreditCard className="h-8 w-8 text-green-600 dark:text-green-400" />
                </div>
                <div className="text-center">
                  <span className="font-semibold text-lg">Payment History</span>
                  <span className="text-sm text-muted-foreground block">View transactions</span>
                </div>
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Enhanced Recent Orders with Device Images */}
        <Card className="hover:shadow-lg transition-shadow duration-200">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Recent Orders
              </CardTitle>
              <CardDescription>Your latest repair requests with progress</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link to="/orders" className="flex items-center gap-1">
                View all
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {orders.slice(0, 3).map((order) => (
              <div key={order._id} className="group p-4 rounded-lg border bg-gradient-to-r from-card to-card/50 hover:from-accent/50 hover:to-accent/30 transition-all duration-200">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <img
                      src={order.photos?.[0] || "https://via.placeholder.com/64x64/3b82f6/ffffff?text=Device"}
                      alt={`${order.deviceBrand} ${order.deviceModel}`}
                      className="w-16 h-16 rounded-lg object-cover border-2 border-primary/20"
                    />
                    <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-background ${getStatusColor(order.status)}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold text-lg">{order.deviceBrand} {order.deviceModel}</h4>
                      <Badge variant="secondary" className="flex items-center gap-1">
                        {getStatusIcon(order.status)}
                        {order.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">
                      {order.services.join(', ')}
                    </p>
                    {order.addOns && order.addOns.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {order.addOns.map((addOn) => (
                          <Badge key={addOn._id} variant="outline" className="text-xs">
                            <Shield className="h-3 w-3 mr-1" />
                            {addOn.name}
                          </Badge>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Progress value={order.progress} className="w-20 h-2" />
                        <span className="text-xs text-muted-foreground">{order.progress}%</span>
                      </div>
                      <span className="font-semibold text-primary">${order.totalCost}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {orders.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="mb-2">No orders yet</p>
                <Button asChild size="sm">
                  <Link to="/new-order">Create your first order</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Content Recommendations */}
        <Card className="hover:shadow-lg transition-shadow duration-200">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                Recommended Articles
              </CardTitle>
              <CardDescription>Personalized tips based on your devices</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link to="/blog" className="flex items-center gap-1">
                View all
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {blogPosts.map((post) => (
              <Link
                key={post._id}
                to={`/blog/${post._id}`}
                className="group block p-4 rounded-lg border bg-gradient-to-r from-card to-card/50 hover:from-accent/50 hover:to-accent/30 transition-all duration-200"
              >
                <div className="flex items-start gap-4">
                  <img
                    src={post.featuredImage}
                    alt={post.title}
                    className="w-20 h-20 rounded-lg object-cover border-2 border-primary/20 group-hover:border-primary/40 transition-colors"
                  />
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-base line-clamp-2 mb-2 group-hover:text-primary transition-colors">
                      {post.title}
                    </h4>
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                      {post.excerpt}
                    </p>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(post.publishedAt).toLocaleDateString()}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {post.readTime} min read
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="flex items-center gap-1">
                          <Heart className={`h-3 w-3 ${post.isLiked ? 'fill-red-500 text-red-500' : ''}`} />
                          {post.likes}
                        </span>
                        <span className="flex items-center gap-1">
                          <Eye className="h-3 w-3" />
                          {post.views}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
            {blogPosts.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No articles available</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Enhanced Shopping Cart Widget */}
      {cart && cart.items.length > 0 && (
        <Card className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950 dark:to-pink-950 border-purple-200 dark:border-purple-800 hover:shadow-lg transition-shadow duration-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-purple-900 dark:text-purple-100">
              <ShoppingCart className="h-6 w-6" />
              Shopping Cart Preview
            </CardTitle>
            <CardDescription className="text-purple-700 dark:text-purple-300">
              You have {cart.totalItems} items ready for checkout
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 mb-4">
              {cart.items.slice(0, 2).map((item) => (
                <div key={item._id} className="flex items-center gap-3 p-3 bg-background/50 rounded-lg">
                  <img
                    src={item.productId.images[0]}
                    alt={item.productId.name}
                    className="w-12 h-12 rounded object-cover"
                  />
                  <div className="flex-1">
                    <p className="font-medium text-sm">{item.productId.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Qty: {item.quantity} • ${((Number(item.productId.price) || 0) * (Number(item.quantity) || 0)).toFixed(2)}
                    </p>
                  </div>
                </div>
              ))}
              {cart.items.length > 2 && (
                <p className="text-sm text-muted-foreground text-center">
                  +{cart.items.length - 2} more items
                </p>
              )}
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-purple-800 dark:text-purple-200">
                  Subtotal: ${(Number(cart.subtotal) || 0).toFixed(2)}
                </p>
                <p className="text-lg font-bold text-purple-900 dark:text-purple-100">
                  Total: ${(Number(cart.total) || 0).toFixed(2)}
                </p>
              </div>
              <Button asChild className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700">
                <Link to="/cart">
                  View Cart
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}