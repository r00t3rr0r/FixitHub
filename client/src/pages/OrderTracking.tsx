import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/useToast"
import { createOrderComplaint, getOrders, Order } from "@/api/orders"
import { searchDevices, SearchResult } from "@/api/devices"
import { formatPrice } from "@/lib/utils"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export function OrderTracking() {
  const [orders, setOrders] = useState<Order[]>([])
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([])
  const [deviceImageByOrderId, setDeviceImageByOrderId] = useState<Record<string, string | null>>({})
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [complaintDialogOpen, setComplaintDialogOpen] = useState(false)
  const [selectedOrderForComplaint, setSelectedOrderForComplaint] = useState<Order | null>(null)
  const [complaintReason, setComplaintReason] = useState("")
  const [complaintDescription, setComplaintDescription] = useState("")
  const [submittingComplaint, setSubmittingComplaint] = useState(false)
  const { toast } = useToast()

  const openComplaintDialog = (order: Order) => {
    setSelectedOrderForComplaint(order)
    setComplaintReason("")
    setComplaintDescription("")
    setComplaintDialogOpen(true)
  }

  const handleSubmitComplaint = async () => {
    if (!selectedOrderForComplaint) {
      return
    }

    if (!complaintReason.trim() || !complaintDescription.trim()) {
      toast({
        title: "Fehlende Angaben",
        description: "Bitte Reklamationsgrund und Beschreibung ausfuellen.",
        variant: "destructive"
      })
      return
    }

    try {
      setSubmittingComplaint(true)
      await createOrderComplaint(selectedOrderForComplaint._id, {
        reason: complaintReason.trim(),
        description: complaintDescription.trim()
      })

      toast({
        title: "Reklamation eingereicht",
        description: "Deine Reklamation wurde erfolgreich an das Admin-Team gesendet."
      })

      setComplaintDialogOpen(false)

      const refreshed = await getOrders()
      const refreshedOrders = (refreshed as any).orders || []
      setOrders(refreshedOrders)
      setFilteredOrders(refreshedOrders)
    } catch (error: any) {
      toast({
        title: "Reklamation fehlgeschlagen",
        description: error?.message || "Reklamation konnte nicht angelegt werden.",
        variant: "destructive"
      })
    } finally {
      setSubmittingComplaint(false)
    }
  }

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

  useEffect(() => {
    let isCancelled = false

    const normalize = (value: string = "") => value.toLowerCase().replace(/\s+/g, " ").trim()
    const pickImageUrl = (value: unknown): string | null => {
      return typeof value === "string" && value.trim() ? value.trim() : null
    }

    const resolveImages = async () => {
      if (!orders.length) {
        setDeviceImageByOrderId({})
        return
      }

      const directImages: Record<string, string | null> = {}
      const unresolvedByKey: Record<string, Order[]> = {}

      orders.forEach((order) => {
        const orderAny = order as any
        const directCandidates: unknown[] = [
          orderAny.deviceImage,
          orderAny.deviceModelImage,
          orderAny.device?.image,
          orderAny.deviceModel?.image,
          orderAny.deviceModelId?.image,
          orderAny.deviceModelId?.images?.[0]?.url,
          orderAny.deviceModelId?.images?.[0]?.base64,
        ]

        const directImage = directCandidates
          .map((candidate) => pickImageUrl(candidate))
          .find((candidate): candidate is string => Boolean(candidate))

        if (directImage) {
          directImages[order._id] = directImage
          return
        }

        const key = `${normalize(order.deviceBrand)}|${normalize(order.deviceModel)}`
        if (!unresolvedByKey[key]) {
          unresolvedByKey[key] = []
        }
        unresolvedByKey[key].push(order)
      })

      const resolvedByKey: Record<string, string | null> = {}

      await Promise.all(
        Object.entries(unresolvedByKey).map(async ([key, keyOrders]) => {
          const sample = keyOrders[0]
          const query = `${sample.deviceBrand || ""} ${sample.deviceModel || ""}`.trim() || sample.deviceModel

          try {
            const response = await searchDevices(query)
            const devices: SearchResult[] = ((response as any)?.devices || []) as SearchResult[]

            const model = normalize(sample.deviceModel)
            const brand = normalize(sample.deviceBrand)

            const exactBrandAndModel = devices.find((device) => {
              const name = normalize(device.name)
              const manufacturer = normalize(device.manufacturer)
              return Boolean(device.image) && name === model && (!brand || manufacturer === brand)
            })

            const sameModel = devices.find((device) => {
              const name = normalize(device.name)
              return Boolean(device.image) && name === model
            })

            const fuzzyMatch = devices.find((device) => {
              const name = normalize(device.name)
              const displayName = normalize(device.displayName)
              return Boolean(device.image) && (displayName.includes(model) || model.includes(name))
            })

            const bestMatch = exactBrandAndModel || sameModel || fuzzyMatch || devices.find((device) => Boolean(device.image))
            resolvedByKey[key] = bestMatch?.image || null
          } catch (error) {
            console.error("OrderTracking: Failed to resolve catalog image:", error)
            resolvedByKey[key] = null
          }
        })
      )

      const nextByOrderId: Record<string, string | null> = {}
      orders.forEach((order) => {
        const key = `${normalize(order.deviceBrand)}|${normalize(order.deviceModel)}`
        nextByOrderId[order._id] = directImages[order._id] || resolvedByKey[key] || null
      })

      if (!isCancelled) {
        setDeviceImageByOrderId(nextByOrderId)
      }
    }

    resolveImages()

    return () => {
      isCancelled = true
    }
  }, [orders])

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
    const resolvedImage = deviceImageByOrderId[order._id]
    if (resolvedImage) {
      return resolvedImage
    }

    if (order.photos && order.photos.length > 0) {
      return order.photos[0]
    }
    // Return a simple colored div instead of broken image
    return undefined
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
                        ${formatPrice(order.totalCost)}
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
                          {typeof service === "string" && service.trim() ? service : `Service #${index + 1}`}
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
                          {addOn.name} (+${formatPrice(addOn.price)})
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
                <div className="flex justify-end gap-2 pt-2">
                  {order.status === 'completed' && !order.hasComplaint && (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => openComplaintDialog(order)}
                    >
                      <AlertCircle className="h-4 w-4 mr-2" />
                      Reklamation anmelden
                    </Button>
                  )}
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

      <Dialog open={complaintDialogOpen} onOpenChange={setComplaintDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reklamation anmelden</DialogTitle>
            <DialogDescription>
              Diese Option ist nur fuer abgeschlossene Auftraege verfuegbar.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <Input
              placeholder="Reklamationsgrund (z.B. Fehler wieder aufgetreten)"
              value={complaintReason}
              onChange={(e) => setComplaintReason(e.target.value)}
            />
            <Textarea
              placeholder="Bitte beschreibe den Sachverhalt moeglichst konkret"
              value={complaintDescription}
              onChange={(e) => setComplaintDescription(e.target.value)}
              rows={5}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setComplaintDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleSubmitComplaint} disabled={submittingComplaint}>
              {submittingComplaint ? 'Wird gesendet...' : 'Reklamation senden'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}