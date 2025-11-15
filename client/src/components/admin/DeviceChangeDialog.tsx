import { useState, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { useToast } from "@/hooks/useToast"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  AlertCircle,
  CheckCircle,
  TrendingDown,
  TrendingUp,
  Smartphone,
  Loader,
} from "lucide-react"
import {
  changeDeviceAndRecalculateServices,
  confirmDeviceChange,
} from "@/api/adminOrders"
import { searchDevices } from "@/api/devices"

interface PricingChange {
  serviceName: string
  serviceId: string
  originalPrice: number
  newPrice: number
  difference: number
  percentageChange: number
  status: 'increase' | 'decrease' | 'no-change'
}

interface PricingChangesSummary {
  originalDevice: {
    brand: string
    model: string
    type: string
  }
  newDevice: {
    brand: string
    model: string
    type: string
  }
  serviceChanges: PricingChange[]
  totalCostBefore: number
  totalCostAfter: number
  totalCostDifference: number
  totalCostStatus: 'increase' | 'decrease' | 'no-change'
  requiresConfirmation: boolean
  changedAt: string
  changedBy: string
}

interface DeviceChangeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  orderId: string
  currentDevice: {
    brand: string
    model: string
    type: string
  }
  onDeviceChanged?: (order: any) => void
}

export function DeviceChangeDialog({
  open,
  onOpenChange,
  orderId,
  currentDevice,
  onDeviceChanged,
}: DeviceChangeDialogProps) {
  const { t } = useTranslation()
  const { toast } = useToast()

  const [step, setStep] = useState<'select' | 'review' | 'confirm'>('select')
  const [deviceSearchQuery, setDeviceSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [selectedDevice, setSelectedDevice] = useState<any | null>(null)
  const [loading, setLoading] = useState(false)
  const [pricingChanges, setPricingChanges] = useState<PricingChangesSummary | null>(null)
  const [confirming, setConfirming] = useState(false)

  const deviceTypes = ['Smartphone', 'Tablet', 'Laptop', 'Watch', 'Headphones']

  // Reset dialog state when it opens
  useEffect(() => {
    if (open) {
      setStep('select')
      setDeviceSearchQuery("")
      setSearchResults([])
      setSelectedDevice(null)
      setPricingChanges(null)
    }
  }, [open])

  const handleSearchDevice = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([])
      return
    }

    try {
      setLoading(true)
      console.log("[DeviceChange] Searching for devices:", query)
      const response = await searchDevices(query)
      // API returns response.devices, not response.results
      setSearchResults((response as any).devices || [])
    } catch (error) {
      console.error("[DeviceChange] Error searching devices:", error)
      toast({
        title: "Error",
        description: "Failed to search devices",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSelectDevice = (device: any) => {
    setSelectedDevice(device)
    console.log("[DeviceChange] Selected device:", device)
  }

  const handleRecalculateServices = async () => {
    if (!selectedDevice) {
      toast({
        title: "Error",
        description: "Please select a device first",
        variant: "destructive",
      })
      return
    }

    try {
      setLoading(true)
      console.log("[DeviceChange] Recalculating services for new device:", selectedDevice)

      // Extract device data from search result
      // SearchResult has: name, deviceType, manufacturer
      // API expects: deviceBrand, deviceModel, deviceType
      const result = await changeDeviceAndRecalculateServices(
        orderId,
        selectedDevice.manufacturer,
        selectedDevice.name,
        selectedDevice.deviceType
      )

      setPricingChanges(result.pricingChangesSummary)
      setStep('review')

      toast({
        title: "Success",
        description: "Services recalculated based on new device",
      })
    } catch (error) {
      console.error("[DeviceChange] Error recalculating services:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to recalculate services",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleConfirmDeviceChange = async () => {
    try {
      setConfirming(true)
      console.log("[DeviceChange] Confirming device change for order:", orderId)

      const result = await confirmDeviceChange(orderId, true)

      toast({
        title: "Success",
        description: "Device change confirmed. Customer has been notified.",
      })

      if (onDeviceChanged) {
        onDeviceChanged(result.order)
      }

      onOpenChange(false)
    } catch (error) {
      console.error("[DeviceChange] Error confirming device change:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to confirm device change",
        variant: "destructive",
      })
    } finally {
      setConfirming(false)
    }
  }

  const handleCancel = () => {
    setStep('select')
    setSelectedDevice(null)
    setPricingChanges(null)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="w-5 h-5" />
            Change Device
          </DialogTitle>
          <DialogDescription>
            Change the device for this repair order and recalculate services
          </DialogDescription>
        </DialogHeader>

        {/* Current Device Info */}
        <Card className="bg-muted/50 border-muted">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Current Device</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <span className="font-medium">
                {currentDevice.brand} {currentDevice.model}
              </span>
              <Badge variant="outline">{currentDevice.type}</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Step 1: Select Device */}
        {step === 'select' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="device-search">Search for a new device</Label>
              <Input
                id="device-search"
                placeholder="e.g., iPhone 13 Pro, Samsung Galaxy S23..."
                value={deviceSearchQuery}
                onChange={(e) => {
                  setDeviceSearchQuery(e.target.value)
                  handleSearchDevice(e.target.value)
                }}
                disabled={loading}
              />
            </div>

            {loading && (
              <div className="flex items-center justify-center py-8">
                <Loader className="w-6 h-6 animate-spin text-primary" />
              </div>
            )}

            {searchResults.length > 0 && (
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                <Label className="text-xs text-muted-foreground">
                  {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} found
                </Label>
                {searchResults.map((device) => (
                  <Card
                    key={`${device.manufacturer}-${device.name}`}
                    className={`cursor-pointer transition-colors ${
                      selectedDevice?.name === device.name
                        ? 'border-primary bg-primary/5'
                        : 'hover:border-muted-foreground/50'
                    }`}
                    onClick={() => handleSelectDevice(device)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">
                            {device.manufacturer} {device.name}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {device.deviceType}
                          </div>
                        </div>
                        {selectedDevice?.name === device.name && (
                          <CheckCircle className="w-5 h-5 text-green-600" />
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {deviceSearchQuery && searchResults.length === 0 && !loading && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  No devices found. Try a different search query.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {/* Step 2: Review Pricing Changes */}
        {step === 'review' && pricingChanges && (
          <div className="space-y-4">
            <Card className="bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 dark:text-blue-400" />
                  <div className="flex-1">
                    <p className="font-medium text-blue-900 dark:text-blue-100">
                      Service prices will be updated
                    </p>
                    <p className="text-sm text-blue-800 dark:text-blue-200">
                      The services compatible with this new device will have their prices recalculated based on device type compatibility.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* New Device Info */}
            <Card className="border-primary/30 bg-primary/5">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">New Device</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <span className="font-medium">
                    {pricingChanges.newDevice.brand} {pricingChanges.newDevice.model}
                  </span>
                  <Badge className="bg-primary">{pricingChanges.newDevice.type}</Badge>
                </div>
              </CardContent>
            </Card>

            {/* Service Price Changes */}
            <div className="space-y-2">
              <Label className="text-base font-semibold">Service Price Changes</Label>
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {pricingChanges.serviceChanges.map((change, idx) => (
                  <Card key={idx} className="border-muted">
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="font-medium text-sm">{change.serviceName}</div>
                          <div className="text-xs text-muted-foreground">
                            ${change.originalPrice.toFixed(2)} → ${change.newPrice.toFixed(2)}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {change.status === 'increase' && (
                            <div className="flex items-center gap-1 text-red-600">
                              <TrendingUp className="w-4 h-4" />
                              <span className="text-sm font-medium">
                                +${Math.abs(change.difference).toFixed(2)}
                              </span>
                            </div>
                          )}
                          {change.status === 'decrease' && (
                            <div className="flex items-center gap-1 text-green-600">
                              <TrendingDown className="w-4 h-4" />
                              <span className="text-sm font-medium">
                                -${Math.abs(change.difference).toFixed(2)}
                              </span>
                            </div>
                          )}
                          {change.status === 'no-change' && (
                            <span className="text-xs text-muted-foreground">No change</span>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* Total Cost Summary */}
            <Card className="border-2">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Total Cost Change</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Previous Total:</span>
                  <span className="font-medium">${pricingChanges.totalCostBefore.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t">
                  <span className="text-muted-foreground">New Total:</span>
                  <span className="font-medium text-lg">${pricingChanges.totalCostAfter.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t-2 bg-muted/30 -mx-6 px-6 py-2 rounded">
                  <span className="font-semibold">Difference:</span>
                  <div className="flex items-center gap-2">
                    {pricingChanges.totalCostStatus === 'increase' && (
                      <div className="flex items-center gap-1 text-red-600">
                        <TrendingUp className="w-4 h-4" />
                        <span className="font-bold text-lg">
                          +${pricingChanges.totalCostDifference.toFixed(2)}
                        </span>
                      </div>
                    )}
                    {pricingChanges.totalCostStatus === 'decrease' && (
                      <div className="flex items-center gap-1 text-green-600">
                        <TrendingDown className="w-4 h-4" />
                        <span className="font-bold text-lg">
                          -${Math.abs(pricingChanges.totalCostDifference).toFixed(2)}
                        </span>
                      </div>
                    )}
                    {pricingChanges.totalCostStatus === 'no-change' && (
                      <span className="text-muted-foreground">No change</span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {pricingChanges.requiresConfirmation && (
              <Alert className="border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950">
                <AlertCircle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                <AlertDescription className="text-orange-800 dark:text-orange-200">
                  Customer confirmation is required before proceeding with this device change due to pricing changes.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {/* Step 3: Confirmation */}
        {step === 'confirm' && (
          <div className="space-y-4">
            <Alert className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
              <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
              <AlertDescription className="text-green-800 dark:text-green-200">
                Device change is ready to be confirmed. The customer will be notified automatically.
              </AlertDescription>
            </Alert>

            {pricingChanges && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Old Device:</span>
                    <span className="font-medium">
                      {pricingChanges.originalDevice.brand} {pricingChanges.originalDevice.model}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">New Device:</span>
                    <span className="font-medium">
                      {pricingChanges.newDevice.brand} {pricingChanges.newDevice.model}
                    </span>
                  </div>
                  <div className="flex justify-between pt-2 border-t">
                    <span className="text-muted-foreground">Total Cost Change:</span>
                    <span className="font-medium">
                      {pricingChanges.totalCostStatus === 'increase' ? '+' : ''}
                      ${pricingChanges.totalCostDifference.toFixed(2)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={loading || confirming}
          >
            Cancel
          </Button>

          {step === 'select' && (
            <Button
              onClick={handleRecalculateServices}
              disabled={!selectedDevice || loading}
            >
              {loading ? 'Recalculating...' : 'Recalculate Services'}
            </Button>
          )}

          {step === 'review' && (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  setStep('select')
                  setSelectedDevice(null)
                }}
                disabled={loading}
              >
                Back
              </Button>
              <Button
                onClick={() => setStep('confirm')}
                disabled={loading}
              >
                Continue to Confirmation
              </Button>
            </>
          )}

          {step === 'confirm' && (
            <>
              <Button
                variant="outline"
                onClick={() => setStep('review')}
                disabled={confirming}
              >
                Back
              </Button>
              <Button
                onClick={handleConfirmDeviceChange}
                disabled={confirming}
              >
                {confirming ? 'Confirming...' : 'Confirm Device Change'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
