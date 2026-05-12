import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/useToast"
import { createBookingShippingLabel, lookupPickupLocationsForBooking, getBooking } from "@/api/bookings"
import { ShipmentData, PickupLocation as ShippingPickupLocation } from "@/api/shipping"
import { Package, Loader2, User, Building2 } from "lucide-react"
import { Separator } from "@/components/ui/separator"

interface CreateBookingShippingLabelDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  bookingId: string
  onSuccess: () => void
}

interface ShipmentFormData {
  weight: number
  length: number
  width: number
  height: number
  serviceType: string
  shipperAddress: string
  shipperCity: string
  shipperPostalCode: string
  shipperCountry: string
  shipperEmail: string
  shipperPhone: string
  shipperCompany: string
  shipperName: string
  receiverName: string
  receiverAddress: string
  receiverCity: string
  receiverPostalCode: string
  receiverCountry: string
  receiverEmail: string
  receiverPhone: string
  receiverNumber: string
  shippingCost: number
  isCustomsDeclarable: boolean
}

export function CreateBookingShippingLabelDialog({
  open,
  onOpenChange,
  bookingId,
  onSuccess
}: CreateBookingShippingLabelDialogProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [loadingBooking, setLoadingBooking] = useState(false)
  const [loadingPickupLocations, setLoadingPickupLocations] = useState(false)
  const [pickupLocations, setPickupLocations] = useState<ShippingPickupLocation[]>([])
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

  const [formData, setFormData] = useState<ShipmentFormData>({
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
    // Receiver fields - will be pre-filled from booking
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

  const loadBookingDetails = async () => {
    setLoadingBooking(true)
    try {
      const response = await getBooking(bookingId)
      const booking = response.booking

      console.log('Loaded booking for shipping label:', booking)

      // Pre-fill receiver information from booking data
      const customer = booking.customerId
      const customerEmail = customer?.email || booking.guestInfo?.email || ''
      const customerName = customer?.name || `${booking.guestInfo?.firstName || ''} ${booking.guestInfo?.lastName || ''}`.trim() || 'Customer'
      const customerPhone = customer?.phone || booking.guestInfo?.phone || ''

      setFormData(prev => ({
        ...prev,
        receiverName: customerName,
        receiverEmail: customerEmail,
        receiverPhone: customerPhone,
        receiverAddress: customer?.invoiceAddress?.street || booking.guestInfo?.billingAddress?.street || '',
        receiverCity: customer?.invoiceAddress?.city || booking.guestInfo?.billingAddress?.city || '',
        receiverPostalCode: customer?.invoiceAddress?.zipCode || booking.guestInfo?.billingAddress?.zipCode || '',
        receiverCountry: customer?.invoiceAddress?.country || booking.guestInfo?.billingAddress?.country || 'NL',
      }))
    } catch (error) {
      toast({
        title: "Error",
        description: "Booking details could not be loaded",
        variant: "destructive"
      })
      console.error('Error loading booking:', error)
    } finally {
      setLoadingBooking(false)
    }
  }

  // Load booking details and pre-fill receiver information when dialog opens
  useEffect(() => {
    if (open && bookingId) {
      loadBookingDetails()
      setPickupLocations([])
      setSelectedPickupLocationId('')
    }
  }, [open, bookingId, toast])

  const handlePickupSearch = async () => {
    if (!pickupSearch.postalCode && !pickupSearch.city) {
      toast({
        title: "Error",
        description: "Please enter postal code or city",
        variant: "destructive"
      })
      return
    }

    setLoadingPickupLocations(true)
    try {
      const result = await lookupPickupLocationsForBooking(bookingId, pickupSearch)
      setPickupLocations(result.locations || [])
      if ((result.locations || []).length === 0) {
        toast({
          title: "Info",
          description: "No pickup locations found for the specified criteria",
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to lookup pickup locations",
        variant: "destructive"
      })
      console.error('Error looking up pickup locations:', error)
    } finally {
      setLoadingPickupLocations(false)
    }
  }

  const handleSelectPickupLocation = (locationId: string) => {
    setSelectedPickupLocationId(locationId)
  }

  const handleSubmit = async () => {
    if (!formData.receiverName) {
      toast({ title: "Error", description: "Receiver name is required", variant: "destructive" })
      return
    }
    if (!formData.receiverAddress) {
      toast({ title: "Error", description: "Receiver address is required", variant: "destructive" })
      return
    }
    if (!formData.receiverCity) {
      toast({ title: "Error", description: "Receiver city is required", variant: "destructive" })
      return
    }
    if (!formData.receiverPostalCode) {
      toast({ title: "Error", description: "Receiver postal code is required", variant: "destructive" })
      return
    }

    setLoading(true)
    try {
      let shipmentPayload: any = {
        weight: formData.weight,
        length: formData.length,
        width: formData.width,
        height: formData.height,
        serviceType: formData.serviceType,
        shipperName: formData.shipperName,
        shipperAddress: formData.shipperAddress,
        shipperCity: formData.shipperCity,
        shipperPostalCode: formData.shipperPostalCode,
        shipperCountry: formData.shipperCountry,
        shipperEmail: formData.shipperEmail,
        shipperPhone: formData.shipperPhone,
        receiverName: formData.receiverName,
        receiverAddress: formData.receiverAddress,
        receiverCity: formData.receiverCity,
        receiverPostalCode: formData.receiverPostalCode,
        receiverCountry: formData.receiverCountry,
        receiverEmail: formData.receiverEmail,
        receiverPhone: formData.receiverPhone,
        receiverNumber: formData.receiverNumber,
        shippingCost: formData.shippingCost,
        isCustomsDeclarable: formData.isCustomsDeclarable
      }

      // Add pickup payload if a location was selected
      if (selectedPickupLocationId && pickupLocations.length > 0) {
        const selectedLocation = pickupLocations.find(loc => loc.locationId === selectedPickupLocationId)
        if (selectedLocation) {
          shipmentPayload.parcelDePickupPayload = {
            postalCode: selectedLocation.postalCode,
            city: selectedLocation.city,
            countryCode: selectedLocation.countryCode || 'DE',
            street: selectedLocation.street || '',
            houseNumber: selectedLocation.houseNumber || '',
            locationId: selectedLocation.locationId,
            locationName: selectedLocation.name,
            locationType: pickupSearch.locationType
          }
        }
      }

      const response = await createBookingShippingLabel(bookingId, shipmentPayload)

      toast({
        title: "Success",
        description: "Shipping label created successfully"
      })

      onOpenChange(false)
      onSuccess()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create shipping label",
        variant: "destructive"
      })
      console.error('Error creating shipping label:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Shipping Label for Booking</DialogTitle>
          <DialogDescription>
            Configure and create a DHL Parcel DE shipping label for this booking
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Loading State */}
          {loadingBooking && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
              <span className="ml-2">Loading booking details...</span>
            </div>
          )}

          {!loadingBooking && (
            <>
              {/* Receiver Information Section */}
              <div className="space-y-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-950">
                <h4 className="font-semibold flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Receiver (Booking Customer)
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Receiver Name</Label>
                    <Input
                      value={formData.receiverName}
                      onChange={(e) => setFormData({ ...formData, receiverName: e.target.value })}
                      placeholder="Receiver name"
                    />
                  </div>
                  <div>
                    <Label>Email</Label>
                    <Input
                      value={formData.receiverEmail}
                      onChange={(e) => setFormData({ ...formData, receiverEmail: e.target.value })}
                      placeholder="Email"
                      type="email"
                    />
                  </div>
                  <div>
                    <Label>Phone</Label>
                    <Input
                      value={formData.receiverPhone}
                      onChange={(e) => setFormData({ ...formData, receiverPhone: e.target.value })}
                      placeholder="Phone"
                    />
                  </div>
                  <div>
                    <Label>Country Code</Label>
                    <Input
                      value={formData.receiverCountry}
                      onChange={(e) => setFormData({ ...formData, receiverCountry: e.target.value })}
                      placeholder="NL"
                      maxLength={2}
                    />
                  </div>
                  <div className="col-span-2">
                    <Label>Street Address</Label>
                    <Input
                      value={formData.receiverAddress}
                      onChange={(e) => setFormData({ ...formData, receiverAddress: e.target.value })}
                      placeholder="Street address"
                    />
                  </div>
                  <div>
                    <Label>City</Label>
                    <Input
                      value={formData.receiverCity}
                      onChange={(e) => setFormData({ ...formData, receiverCity: e.target.value })}
                      placeholder="City"
                    />
                  </div>
                  <div>
                    <Label>Postal Code</Label>
                    <Input
                      value={formData.receiverPostalCode}
                      onChange={(e) => setFormData({ ...formData, receiverPostalCode: e.target.value })}
                      placeholder="Postal code"
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Pickup Location Search */}
              <div className="space-y-3 p-3 rounded-lg bg-green-50 dark:bg-green-950">
                <h4 className="font-semibold flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  DHL Pickup Location (Optional)
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Postal Code</Label>
                    <Input
                      value={pickupSearch.postalCode}
                      onChange={(e) => setPickupSearch({ ...pickupSearch, postalCode: e.target.value })}
                      placeholder="Postal code"
                    />
                  </div>
                  <div>
                    <Label>City</Label>
                    <Input
                      value={pickupSearch.city}
                      onChange={(e) => setPickupSearch({ ...pickupSearch, city: e.target.value })}
                      placeholder="City"
                    />
                  </div>
                  <div>
                    <Label>Location Type</Label>
                    <Select
                      value={pickupSearch.locationType}
                      onValueChange={(value) => setPickupSearch({ ...pickupSearch, locationType: value as 'branch' | 'locker' | 'retail' })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="branch">Branch</SelectItem>
                        <SelectItem value="locker">Locker</SelectItem>
                        <SelectItem value="retail">Retail</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Radius (km)</Label>
                    <Input
                      type="number"
                      value={pickupSearch.radius}
                      onChange={(e) => setPickupSearch({ ...pickupSearch, radius: parseInt(e.target.value) || 15 })}
                      min="1"
                      max="100"
                    />
                  </div>
                </div>
                <Button
                  onClick={handlePickupSearch}
                  disabled={loadingPickupLocations}
                  variant="outline"
                  className="w-full"
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

                {/* Pickup Locations List */}
                {pickupLocations.length > 0 && (
                  <div className="mt-3 space-y-2 max-h-40 overflow-y-auto">
                    {pickupLocations.map((location) => (
                      <div
                        key={location.locationId}
                        onClick={() => handleSelectPickupLocation(location.locationId)}
                        className={`p-2 border rounded-lg cursor-pointer transition-colors ${
                          selectedPickupLocationId === location.locationId
                            ? 'bg-blue-100 dark:bg-blue-900 border-blue-500'
                            : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                        }`}
                      >
                        <p className="font-semibold text-sm">{location.name}</p>
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          {location.street} {location.houseNumber}, {location.postalCode} {location.city}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Separator />

              {/* Shipment Details */}
              <div className="space-y-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-900">
                <h4 className="font-semibold flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Shipment Details
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Weight (kg)</Label>
                    <Input
                      type="number"
                      value={formData.weight}
                      onChange={(e) => setFormData({ ...formData, weight: parseFloat(e.target.value) || 1 })}
                      min="0.1"
                      step="0.1"
                    />
                  </div>
                  <div>
                    <Label>Service Type</Label>
                    <Select value={formData.serviceType} onValueChange={(value) => setFormData({ ...formData, serviceType: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="P">Parcel</SelectItem>
                        <SelectItem value="E">Express</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Shipping Cost (€)</Label>
                    <Input
                      type="number"
                      value={formData.shippingCost}
                      onChange={(e) => setFormData({ ...formData, shippingCost: parseFloat(e.target.value) || 0 })}
                      min="0"
                      step="0.01"
                    />
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || loadingBooking}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              'Create Shipping Label'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
