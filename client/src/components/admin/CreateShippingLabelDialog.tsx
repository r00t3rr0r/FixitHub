import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/useToast"
import { createShippingLabel, ShipmentData, lookupPickupLocations, PickupLocation } from "@/api/shipping"
import { getOrderById } from "@/api/orders"
import { Package, Loader2, User, Building2 } from "lucide-react"
import { Separator } from "@/components/ui/separator"

interface CreateShippingLabelDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  orderId: string
  onSuccess: () => void
}

export function CreateShippingLabelDialog({
  open,
  onOpenChange,
  orderId,
  onSuccess
}: CreateShippingLabelDialogProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [loadingOrder, setLoadingOrder] = useState(false)
  const [loadingPickupLocations, setLoadingPickupLocations] = useState(false)
  const [pickupLocations, setPickupLocations] = useState<PickupLocation[]>([])
  const [selectedPickupLocationId, setSelectedPickupLocationId] = useState('')
  const [pickupSearch, setPickupSearch] = useState({
    postalCode: '',
    city: '',
    street: '',
    houseNumber: '',
    countryCode: 'DE',
    radius: 15,
    limit: 10,
    locationType: 'branch' as 'branch' | 'locker' | 'retail',
  })

  const [formData, setFormData] = useState<ShipmentData>({
    weight: 1.0,
    length: 20,
    width: 15,
    height: 10,
    serviceType: 'P',
    // Shipper defaults
    shipperAddress: 'Company Street 1',
    shipperCity: 'Berlin',
    shipperPostalCode: '10115',
    shipperCountry: 'DE',
    shipperEmail: 'info@fixithub.com',
    shipperPhone: '+49 30 1234567',
    shipperCompany: 'FixitHub',
    shipperName: 'FixitHub Logistics',
    // Receiver fields - will be pre-filled from order
    receiverName: '',
    receiverAddress: '',
    receiverCity: '',
    receiverPostalCode: '',
    receiverCountry: 'NL',
    receiverEmail: '',
    receiverPhone: '',
    receiverNumber: '1',
    shippingCost: 0,
    isCustomsDeclarable: false
  })

  // Load order details and pre-fill receiver information when dialog opens
  useEffect(() => {
    if (open && orderId) {
      loadOrderDetails()
      setPickupLocations([])
      setSelectedPickupLocationId('')
    }
  }, [open, orderId])

  const loadOrderDetails = async () => {
    setLoadingOrder(true)
    try {
      const response = await getOrderById(orderId)
      const order = response.order

      console.log('Loaded order for shipping label:', order)

      // Pre-fill receiver information from order data
      const customer = order.customerId
      const shippingAddress = order.shippingAddress
      const invoiceAddress = customer?.invoiceAddress

      // Use shipping address if available, otherwise fall back to invoice address
      const address = shippingAddress || invoiceAddress

      setFormData(prev => ({
        ...prev,
        receiverName: customer?.name || '',
        receiverEmail: customer?.email || '',
        receiverPhone: customer?.phone || '',
        receiverAddress: address?.street || '',
        receiverCity: address?.city || '',
        receiverPostalCode: address?.zipCode || '',
        receiverCountry: address?.country || 'NL',
        receiverNumber: '1' // Default house number
      }))

      setPickupSearch(prev => ({
        ...prev,
        postalCode: address?.zipCode || prev.postalCode,
        city: address?.city || prev.city,
        street: address?.street || prev.street,
        countryCode: (address?.country || prev.countryCode || 'DE').toUpperCase(),
      }))

      console.log('Pre-filled receiver information:', {
        name: customer?.name,
        email: customer?.email,
        phone: customer?.phone,
        address: address?.street,
        city: address?.city,
        zipCode: address?.zipCode,
        country: address?.country
      })
    } catch (error: any) {
      console.error('Error loading order details:', error)
      toast({
        title: "Warning",
        description: "Could not pre-fill receiver information. Please enter manually.",
        variant: "destructive"
      })
    } finally {
      setLoadingOrder(false)
    }
  }

  const handleSearchPickupLocations = async () => {
    if (!pickupSearch.postalCode && !pickupSearch.city) {
      toast({
        title: 'Error',
        description: 'Please provide at least postal code or city for pickup search',
        variant: 'destructive'
      })
      return
    }

    setLoadingPickupLocations(true)
    try {
      const result = await lookupPickupLocations(orderId, {
        postalCode: pickupSearch.postalCode,
        city: pickupSearch.city,
        street: pickupSearch.street,
        houseNumber: pickupSearch.houseNumber,
        countryCode: pickupSearch.countryCode,
        radius: pickupSearch.radius,
        limit: pickupSearch.limit,
        locationType: pickupSearch.locationType,
      })

      setPickupLocations(result.locations || [])

      if ((result.locations || []).length === 0) {
        setSelectedPickupLocationId('')
        toast({
          title: 'No pickup locations found',
          description: 'Try broadening search radius or using another postal code/city.',
        })
      } else {
        toast({
          title: 'Pickup locations loaded',
          description: `${result.locations.length} pickup locations found.`,
        })
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to search pickup locations',
        variant: 'destructive'
      })
    } finally {
      setLoadingPickupLocations(false)
    }
  }

  const handleApplyPickupLocation = () => {
    const selected = pickupLocations.find((location) => location.id === selectedPickupLocationId)
    if (!selected) {
      toast({
        title: 'Error',
        description: 'Please select a pickup location first',
        variant: 'destructive'
      })
      return
    }

    setFormData(prev => ({
      ...prev,
      receiverName: selected.name || prev.receiverName,
      receiverAddress: selected.address?.street || prev.receiverAddress,
      receiverNumber: selected.address?.houseNumber || prev.receiverNumber,
      receiverPostalCode: selected.address?.postalCode || prev.receiverPostalCode,
      receiverCity: selected.address?.city || prev.receiverCity,
      receiverCountry: selected.address?.countryCode || prev.receiverCountry,
    }))

    toast({
      title: 'Pickup location applied',
      description: 'Receiver address has been updated to selected DHL pickup point.',
    })
  }

  const handleCreate = async () => {
    // Validate package dimensions
    if (!formData.weight || !formData.length || !formData.width || !formData.height) {
      toast({
        title: "Error",
        description: "Please fill in all package dimensions",
        variant: "destructive"
      })
      return
    }

    // Validate receiver address fields
    if (!formData.receiverAddress || !formData.receiverAddress.trim()) {
      toast({
        title: "Error",
        description: "Receiver street address is required",
        variant: "destructive"
      })
      return
    }

    if (!formData.receiverCity || !formData.receiverCity.trim()) {
      toast({
        title: "Error",
        description: "Receiver city is required",
        variant: "destructive"
      })
      return
    }

    if (!formData.receiverPostalCode || !formData.receiverPostalCode.trim()) {
      toast({
        title: "Error",
        description: "Receiver postal code is required",
        variant: "destructive"
      })
      return
    }

    if (!formData.receiverCountry || !formData.receiverCountry.trim()) {
      toast({
        title: "Error",
        description: "Receiver country is required",
        variant: "destructive"
      })
      return
    }

    setLoading(true)
    try {
      const selectedPickupLocation = pickupLocations.find((location) => location.id === selectedPickupLocationId)
      const shipmentPayload: ShipmentData = {
        ...formData,
      }

      if (selectedPickupLocation) {
        shipmentPayload.parcelDePickupPayload = {
          location: {
            id: selectedPickupLocation.id,
            type: selectedPickupLocation.type,
            name: selectedPickupLocation.name,
            branchCode: selectedPickupLocation.branchCode,
            retailID: selectedPickupLocation.retailID,
            addressStreet: selectedPickupLocation.address?.street,
            addressHouse: selectedPickupLocation.address?.houseNumber,
            postalCode: selectedPickupLocation.address?.postalCode,
            city: selectedPickupLocation.address?.city,
            countryCode: selectedPickupLocation.address?.countryCode,
          },
        }
      }

      const result = await createShippingLabel(orderId, shipmentPayload)

      toast({
        title: "Success",
        description: `Shipping label created! Tracking: ${result.trackingNumber}`
      })

      onSuccess()
      onOpenChange(false)
    } catch (error: any) {
      console.error('Error creating shipping label:', error)
      toast({
        title: "Error",
        description: error.message || "Failed to create shipping label",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Create DHL Shipping Label
          </DialogTitle>
          <DialogDescription>
            Configure shipment details and generate DHL shipping label
          </DialogDescription>
        </DialogHeader>

        {loadingOrder ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-2 text-muted-foreground">Loading order details...</span>
          </div>
        ) : (
          <div className="grid gap-6 py-4">
            {/* Receiver Information */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold">Receiver Information</h3>
              </div>
              <Separator />
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="receiverName">Full Name</Label>
                  <Input
                    id="receiverName"
                    value={formData.receiverName}
                    onChange={(e) => setFormData(prev => ({ ...prev, receiverName: e.target.value }))}
                    placeholder="John Doe"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="receiverEmail">Email</Label>
                  <Input
                    id="receiverEmail"
                    type="email"
                    value={formData.receiverEmail}
                    onChange={(e) => setFormData(prev => ({ ...prev, receiverEmail: e.target.value }))}
                    placeholder="john@example.com"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="receiverPhone">Phone</Label>
                <Input
                  id="receiverPhone"
                  value={formData.receiverPhone}
                  onChange={(e) => setFormData(prev => ({ ...prev, receiverPhone: e.target.value }))}
                  placeholder="+31 20 1234567"
                />
              </div>
              <div className="grid grid-cols-4 gap-4">
                <div className="col-span-3 space-y-2">
                  <Label htmlFor="receiverAddress">Street Address *</Label>
                  <Input
                    id="receiverAddress"
                    value={formData.receiverAddress}
                    onChange={(e) => setFormData(prev => ({ ...prev, receiverAddress: e.target.value }))}
                    placeholder="Main Street"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="receiverNumber">Number *</Label>
                  <Input
                    id="receiverNumber"
                    value={formData.receiverNumber}
                    onChange={(e) => setFormData(prev => ({ ...prev, receiverNumber: e.target.value }))}
                    placeholder="123"
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="receiverCity">City *</Label>
                  <Input
                    id="receiverCity"
                    value={formData.receiverCity}
                    onChange={(e) => setFormData(prev => ({ ...prev, receiverCity: e.target.value }))}
                    placeholder="Amsterdam"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="receiverPostalCode">Postal Code *</Label>
                  <Input
                    id="receiverPostalCode"
                    value={formData.receiverPostalCode}
                    onChange={(e) => setFormData(prev => ({ ...prev, receiverPostalCode: e.target.value }))}
                    placeholder="1012AB"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="receiverCountry">Country *</Label>
                  <Input
                    id="receiverCountry"
                    value={formData.receiverCountry}
                    onChange={(e) => setFormData(prev => ({ ...prev, receiverCountry: e.target.value.toUpperCase() }))}
                    placeholder="NL"
                    maxLength={2}
                    required
                  />
                </div>
              </div>
            </div>

            {/* Package Dimensions */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold">Package Dimensions</h3>
              </div>
              <Separator />
              <div className="grid grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="weight">Weight (kg) *</Label>
                  <Input
                    id="weight"
                    type="number"
                    step="0.1"
                    min="0.1"
                    value={formData.weight}
                    onChange={(e) => setFormData(prev => ({ ...prev, weight: parseFloat(e.target.value) }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="length">Length (cm) *</Label>
                  <Input
                    id="length"
                    type="number"
                    min="1"
                    value={formData.length}
                    onChange={(e) => setFormData(prev => ({ ...prev, length: parseInt(e.target.value) }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="width">Width (cm) *</Label>
                  <Input
                    id="width"
                    type="number"
                    min="1"
                    value={formData.width}
                    onChange={(e) => setFormData(prev => ({ ...prev, width: parseInt(e.target.value) }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="height">Height (cm) *</Label>
                  <Input
                    id="height"
                    type="number"
                    min="1"
                    value={formData.height}
                    onChange={(e) => setFormData(prev => ({ ...prev, height: parseInt(e.target.value) }))}
                  />
                </div>
              </div>
            </div>

            {/* DHL Pickup Location Search */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold">DHL Parcel DE Pickup</h3>
              </div>
              <Separator />

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="pickupPostalCode">Postal Code</Label>
                  <Input
                    id="pickupPostalCode"
                    value={pickupSearch.postalCode}
                    onChange={(e) => setPickupSearch(prev => ({ ...prev, postalCode: e.target.value }))}
                    placeholder="10115"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pickupCity">City</Label>
                  <Input
                    id="pickupCity"
                    value={pickupSearch.city}
                    onChange={(e) => setPickupSearch(prev => ({ ...prev, city: e.target.value }))}
                    placeholder="Berlin"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pickupCountry">Country</Label>
                  <Input
                    id="pickupCountry"
                    value={pickupSearch.countryCode}
                    onChange={(e) => setPickupSearch(prev => ({ ...prev, countryCode: e.target.value.toUpperCase() }))}
                    maxLength={2}
                  />
                </div>
              </div>

              <div className="grid grid-cols-4 gap-4">
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="pickupStreet">Street</Label>
                  <Input
                    id="pickupStreet"
                    value={pickupSearch.street}
                    onChange={(e) => setPickupSearch(prev => ({ ...prev, street: e.target.value }))}
                    placeholder="Musterstrasse"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pickupHouseNumber">No.</Label>
                  <Input
                    id="pickupHouseNumber"
                    value={pickupSearch.houseNumber}
                    onChange={(e) => setPickupSearch(prev => ({ ...prev, houseNumber: e.target.value }))}
                    placeholder="1"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pickupLocationType">Location Type</Label>
                  <Select
                    value={pickupSearch.locationType}
                    onValueChange={(value: 'branch' | 'locker' | 'retail') => setPickupSearch(prev => ({ ...prev, locationType: value }))}
                  >
                    <SelectTrigger id="pickupLocationType">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="branch">Branch</SelectItem>
                      <SelectItem value="locker">Locker</SelectItem>
                      <SelectItem value="retail">Retail</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex justify-between gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleSearchPickupLocations}
                  disabled={loadingPickupLocations || loading || loadingOrder}
                >
                  {loadingPickupLocations ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Searching...
                    </>
                  ) : (
                    'Search Pickup Locations'
                  )}
                </Button>

                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleApplyPickupLocation}
                  disabled={!selectedPickupLocationId || loading || loadingOrder}
                >
                  Use Selected Pickup Point
                </Button>
              </div>

              {pickupLocations.length > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="pickupLocationSelection">Available Pickup Locations</Label>
                  <Select
                    value={selectedPickupLocationId}
                    onValueChange={setSelectedPickupLocationId}
                  >
                    <SelectTrigger id="pickupLocationSelection">
                      <SelectValue placeholder="Select pickup location" />
                    </SelectTrigger>
                    <SelectContent>
                      {pickupLocations.map((location) => (
                        <SelectItem key={location.id} value={location.id}>
                          {location.name} - {location.address?.postalCode} {location.address?.city}
                          {location.distance > 0 ? ` (${location.distance} km)` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* Service Type */}
            <div className="space-y-2">
              <Label htmlFor="serviceType">DHL Service Type</Label>
              <Select
                value={formData.serviceType}
                onValueChange={(value) => setFormData(prev => ({ ...prev, serviceType: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="P">DHL Paket (Domestic)</SelectItem>
                  <SelectItem value="N">DHL Express (International)</SelectItem>
                  <SelectItem value="Y">DHL Economy Select</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Shipper Details */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold">Shipper Information</h3>
              </div>
              <Separator />
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="shipperCompany">Company Name</Label>
                  <Input
                    id="shipperCompany"
                    value={formData.shipperCompany}
                    onChange={(e) => setFormData(prev => ({ ...prev, shipperCompany: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="shipperName">Contact Name</Label>
                  <Input
                    id="shipperName"
                    value={formData.shipperName}
                    onChange={(e) => setFormData(prev => ({ ...prev, shipperName: e.target.value }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="shipperEmail">Email</Label>
                  <Input
                    id="shipperEmail"
                    type="email"
                    value={formData.shipperEmail}
                    onChange={(e) => setFormData(prev => ({ ...prev, shipperEmail: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="shipperPhone">Phone</Label>
                  <Input
                    id="shipperPhone"
                    value={formData.shipperPhone}
                    onChange={(e) => setFormData(prev => ({ ...prev, shipperPhone: e.target.value }))}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="shipperAddress">Address</Label>
                <Input
                  id="shipperAddress"
                  value={formData.shipperAddress}
                  onChange={(e) => setFormData(prev => ({ ...prev, shipperAddress: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="shipperCity">City</Label>
                  <Input
                    id="shipperCity"
                    value={formData.shipperCity}
                    onChange={(e) => setFormData(prev => ({ ...prev, shipperCity: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="shipperPostalCode">Postal Code</Label>
                  <Input
                    id="shipperPostalCode"
                    value={formData.shipperPostalCode}
                    onChange={(e) => setFormData(prev => ({ ...prev, shipperPostalCode: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="shipperCountry">Country Code</Label>
                  <Input
                    id="shipperCountry"
                    value={formData.shipperCountry}
                    onChange={(e) => setFormData(prev => ({ ...prev, shipperCountry: e.target.value.toUpperCase() }))}
                    maxLength={2}
                  />
                </div>
              </div>
            </div>

            {/* Shipping Cost */}
            <div className="space-y-2">
              <Label htmlFor="shippingCost">Shipping Cost (€)</Label>
              <Input
                id="shippingCost"
                type="number"
                step="0.01"
                min="0"
                value={formData.shippingCost}
                onChange={(e) => setFormData(prev => ({ ...prev, shippingCost: parseFloat(e.target.value) }))}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading || loadingOrder}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={loading || loadingOrder}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating Label...
              </>
            ) : (
              <>
                <Package className="h-4 w-4 mr-2" />
                Create Shipping Label
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
