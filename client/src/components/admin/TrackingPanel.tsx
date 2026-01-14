import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { useToast } from "@/hooks/useToast"
import { getOrderTracking, updateOrderTracking, TrackingInfo } from "@/api/shipping"
import { Package, MapPin, Clock, RefreshCw, Loader2, Download, ExternalLink, Truck } from "lucide-react"
import { CreateShippingLabelDialog } from "./CreateShippingLabelDialog"

interface TrackingPanelProps {
  orderId: string
  orderData: any
  onUpdate: () => void
}

export function TrackingPanel({ orderId, orderData, onUpdate }: TrackingPanelProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [trackingInfo, setTrackingInfo] = useState<TrackingInfo | null>(null)
  const [createLabelOpen, setCreateLabelOpen] = useState(false)

  useEffect(() => {
    if (orderData?.trackingNumber) {
      loadTrackingInfo()
    }
  }, [orderId, orderData?.trackingNumber])

  const loadTrackingInfo = async () => {
    setLoading(true)
    try {
      const info = await getOrderTracking(orderId)
      setTrackingInfo(info)
    } catch (error: any) {
      console.error('Error loading tracking info:', error)
      // Don't show error toast for missing tracking - it's expected initially
    } finally {
      setLoading(false)
    }
  }

  const handleRefreshTracking = async () => {
    setRefreshing(true)
    try {
      const result = await updateOrderTracking(orderId)
      setTrackingInfo(result.trackingInfo)

      toast({
        title: "Success",
        description: "Tracking information updated successfully"
      })

      onUpdate()
    } catch (error: any) {
      console.error('Error refreshing tracking:', error)
      toast({
        title: "Error",
        description: error.message || "Failed to update tracking information",
        variant: "destructive"
      })
    } finally {
      setRefreshing(false)
    }
  }

  const handleDownloadLabel = () => {
    if (orderData?.shippingLabelUrl) {
      const link = document.createElement('a')
      link.href = orderData.shippingLabelUrl
      link.download = `shipping-label-${orderData.orderNumber}.pdf`
      link.click()

      toast({
        title: "Success",
        description: "Shipping label download started"
      })
    }
  }

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'delivered':
        return 'default' as const
      case 'in-transit':
      case 'out-for-delivery':
        return 'secondary' as const
      case 'failed':
        return 'destructive' as const
      default:
        return 'outline' as const
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'delivered':
        return <Package className="h-4 w-4" />
      case 'in-transit':
      case 'out-for-delivery':
        return <Truck className="h-4 w-4" />
      default:
        return <Clock className="h-4 w-4" />
    }
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <>
      <Card className="border-border/50">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Shipping & Tracking
              </CardTitle>
              <CardDescription>
                DHL shipment tracking and label management
              </CardDescription>
            </div>
            {orderData?.trackingNumber ? (
              <Button
                size="sm"
                variant="outline"
                onClick={handleRefreshTracking}
                disabled={refreshing}
              >
                {refreshing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Updating...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                  </>
                )}
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={() => setCreateLabelOpen(true)}
              >
                <Package className="h-4 w-4 mr-2" />
                Create Shipping Label
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {!orderData?.trackingNumber ? (
            <div className="text-center py-8">
              <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground mb-4">
                No shipping label created yet
              </p>
              <Button onClick={() => setCreateLabelOpen(true)}>
                <Package className="h-4 w-4 mr-2" />
                Create DHL Shipping Label
              </Button>
            </div>
          ) : (
            <>
              {/* Tracking Number & Status */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Tracking Number</p>
                    <div className="flex items-center gap-2">
                      <p className="text-lg font-mono font-semibold">{orderData.trackingNumber}</p>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          navigator.clipboard.writeText(orderData.trackingNumber)
                          toast({ title: "Copied", description: "Tracking number copied to clipboard" })
                        }}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <Badge variant={getStatusBadgeVariant(orderData.shippingStatus)} className="flex items-center gap-1">
                    {getStatusIcon(orderData.shippingStatus)}
                    {orderData.shippingStatus?.replace('-', ' ').toUpperCase()}
                  </Badge>
                </div>

                {orderData.shippingLabelUrl && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDownloadLabel}
                    className="w-full"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download Shipping Label (PDF)
                  </Button>
                )}
              </div>

              <Separator />

              {/* Delivery Estimates */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Estimated Delivery
                  </p>
                  <p className="text-sm font-medium">
                    {formatDate(orderData.estimatedDelivery || trackingInfo?.estimatedDelivery || '')}
                  </p>
                </div>
                {orderData.actualDelivery && (
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      Actual Delivery
                    </p>
                    <p className="text-sm font-medium">
                      {formatDate(orderData.actualDelivery)}
                    </p>
                  </div>
                )}
              </div>

              {/* Current Status */}
              {trackingInfo && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Current Status</p>
                    <p className="text-sm text-muted-foreground">
                      {trackingInfo.description}
                    </p>
                  </div>
                </>
              )}

              {/* Tracking Events */}
              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  {(trackingInfo?.events || orderData.trackingEvents)?.length > 0 && (
                    <>
                      <Separator />
                      <div className="space-y-4">
                        <p className="text-sm font-medium">Tracking History</p>
                        <div className="space-y-4">
                          {(trackingInfo?.events || orderData.trackingEvents)?.map((event: any, index: number) => (
                            <div key={index} className="flex gap-4">
                              <div className="relative">
                                <div className="h-8 w-8 rounded-full border-2 border-primary bg-background flex items-center justify-center">
                                  <MapPin className="h-4 w-4 text-primary" />
                                </div>
                                {index < ((trackingInfo?.events || orderData.trackingEvents)?.length - 1) && (
                                  <div className="absolute top-8 left-4 w-0.5 h-full bg-border" />
                                )}
                              </div>
                              <div className="flex-1 space-y-1 pb-8">
                                <div className="flex items-center justify-between">
                                  <p className="text-sm font-medium">{event.description || event.status}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {formatDate(event.timestamp)}
                                  </p>
                                </div>
                                {event.location && (
                                  <p className="text-sm text-muted-foreground">{event.location}</p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}

              {/* Additional Info */}
              {orderData.shippingCost > 0 && (
                <>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">Shipping Cost</p>
                    <p className="text-sm font-medium">€{orderData.shippingCost.toFixed(2)}</p>
                  </div>
                </>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <CreateShippingLabelDialog
        open={createLabelOpen}
        onOpenChange={setCreateLabelOpen}
        orderId={orderId}
        onSuccess={() => {
          onUpdate()
          loadTrackingInfo()
        }}
      />
    </>
  )
}
