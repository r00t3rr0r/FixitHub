import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useToast } from "@/hooks/useToast"
import { createBookingShippingLabel, getBooking } from "@/api/bookings"
import type { ShippingLabelError } from "@/api/shipping"
import { AlertCircle, Loader2, Package, RotateCcw, User } from "lucide-react"

interface CreateBookingShippingLabelDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  bookingId: string
  onSuccess: () => void
}

interface BookingShipmentData {
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

interface LabelCreationError {
  message: string
  details: string[]
  retryable: boolean
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
  const [creationError, setCreationError] = useState<LabelCreationError | null>(null)

  const [formData, setFormData] = useState<BookingShipmentData>({
    weight: 1.0,
    length: 20,
    width: 15,
    height: 10,
    serviceType: "P",
    shipperAddress: "Company Street 1",
    shipperCity: "Berlin",
    shipperPostalCode: "10115",
    shipperCountry: "DE",
    shipperEmail: "info@mcrepair.de",
    shipperPhone: "+49 30 1234567",
    shipperCompany: "McRepair.de",
    shipperName: "McRepair.de Logistics",
    receiverName: "",
    receiverAddress: "",
    receiverCity: "",
    receiverPostalCode: "",
    receiverCountry: "NL",
    receiverEmail: "",
    receiverPhone: "",
    receiverNumber: "1",
    shippingCost: 0,
    isCustomsDeclarable: false,
  })

  useEffect(() => {
    if (open && bookingId) {
      setCreationError(null)
      loadBookingDetails()
    }
  }, [open, bookingId])

  const loadBookingDetails = async () => {
    setLoadingBooking(true)
    try {
      const response = await getBooking(bookingId)
      const booking = response?.booking || {}
      const customer = booking?.customerId || {}
      const shippingAddress = booking?.shippingAddress || booking?.deliveryAddress || null
      const invoiceAddress = customer?.invoiceAddress || null
      const address = shippingAddress || invoiceAddress || {}

      setFormData((prev) => ({
        ...prev,
        receiverName: customer?.name || `${customer?.firstName || ""} ${customer?.lastName || ""}`.trim(),
        receiverEmail: customer?.email || "",
        receiverPhone: customer?.phone || "",
        receiverAddress: address?.street || "",
        receiverCity: address?.city || "",
        receiverPostalCode: address?.zipCode || address?.postalCode || "",
        receiverCountry: address?.country || "NL",
      }))
    } catch (error: unknown) {
      console.error('Error loading booking details:', error)
      toast({
        title: "Warning",
        description: "Could not pre-fill receiver information. Please enter manually.",
        variant: "destructive",
      })
    } finally {
      setLoadingBooking(false)
    }
  }

  const handleCreate = async () => {
    if (!formData.weight || !formData.length || !formData.width || !formData.height) {
      setCreationError({ message: "Bitte alle Paketmaße und das Gewicht ausfüllen.", details: [], retryable: false })
      toast({
        title: "Error",
        description: "Please fill in all package dimensions",
        variant: "destructive",
      })
      return
    }

    if (!formData.receiverAddress?.trim() || !formData.receiverCity?.trim() || !formData.receiverPostalCode?.trim() || !formData.receiverCountry?.trim()) {
      setCreationError({ message: "Empfängeradresse unvollständig: Straße, Ort, PLZ und Land sind erforderlich.", details: [], retryable: false })
      toast({
        title: "Error",
        description: "Receiver address, city, postal code and country are required",
        variant: "destructive",
      })
      return
    }

    setCreationError(null)
    setLoading(true)
    try {
      const result = await createBookingShippingLabel(bookingId, formData)
      toast({
        title: "Success",
        description: `Shipping label created! Tracking: ${result?.trackingNumber || "-"}`,
      })
      onSuccess()
      onOpenChange(false)
    } catch (error: unknown) {
      const shippingError = error as ShippingLabelError
      const message = shippingError.message || "Versandlabel konnte nicht erstellt werden."
      setCreationError({
        message,
        details: shippingError.details || [],
        retryable: shippingError.retryable === true,
      })
      toast({
        title: "Label konnte nicht erstellt werden",
        description: message,
        variant: "destructive",
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
            Create Booking Shipping Label
          </DialogTitle>
          <DialogDescription>
            Configure shipment details and generate a DHL shipping label for this booking
          </DialogDescription>
        </DialogHeader>

        {loadingBooking ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-2 text-muted-foreground">Loading booking details...</span>
          </div>
        ) : (
          <div className="grid gap-6 py-4">
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
                    onChange={(e) => setFormData((prev) => ({ ...prev, receiverName: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="receiverEmail">Email</Label>
                  <Input
                    id="receiverEmail"
                    type="email"
                    value={formData.receiverEmail}
                    onChange={(e) => setFormData((prev) => ({ ...prev, receiverEmail: e.target.value }))}
                  />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="receiverAddress">Street Address</Label>
                  <Input
                    id="receiverAddress"
                    value={formData.receiverAddress}
                    onChange={(e) => setFormData((prev) => ({ ...prev, receiverAddress: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="receiverCity">City</Label>
                  <Input
                    id="receiverCity"
                    value={formData.receiverCity}
                    onChange={(e) => setFormData((prev) => ({ ...prev, receiverCity: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="receiverPostalCode">Postal Code</Label>
                  <Input
                    id="receiverPostalCode"
                    value={formData.receiverPostalCode}
                    onChange={(e) => setFormData((prev) => ({ ...prev, receiverPostalCode: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="receiverCountry">Country</Label>
                  <Input
                    id="receiverCountry"
                    value={formData.receiverCountry}
                    onChange={(e) => setFormData((prev) => ({ ...prev, receiverCountry: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="receiverPhone">Phone</Label>
                  <Input
                    id="receiverPhone"
                    value={formData.receiverPhone}
                    onChange={(e) => setFormData((prev) => ({ ...prev, receiverPhone: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-semibold">Package Details</h3>
              <Separator />
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="weight">Weight (kg)</Label>
                  <Input
                    id="weight"
                    type="number"
                    min="0"
                    step="0.1"
                    value={formData.weight}
                    onChange={(e) => setFormData((prev) => ({ ...prev, weight: Number(e.target.value) || 0 }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="serviceType">Service Type</Label>
                  <Select
                    value={formData.serviceType}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, serviceType: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select service type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="P">Parcel</SelectItem>
                      <SelectItem value="V01PAK">DHL Paket</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="length">Length (cm)</Label>
                  <Input
                    id="length"
                    type="number"
                    min="1"
                    value={formData.length}
                    onChange={(e) => setFormData((prev) => ({ ...prev, length: Number(e.target.value) || 0 }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="width">Width (cm)</Label>
                  <Input
                    id="width"
                    type="number"
                    min="1"
                    value={formData.width}
                    onChange={(e) => setFormData((prev) => ({ ...prev, width: Number(e.target.value) || 0 }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="height">Height (cm)</Label>
                  <Input
                    id="height"
                    type="number"
                    min="1"
                    value={formData.height}
                    onChange={(e) => setFormData((prev) => ({ ...prev, height: Number(e.target.value) || 0 }))}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {creationError && (
          <Alert variant="destructive" aria-live="assertive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Label konnte nicht erstellt werden</AlertTitle>
            <AlertDescription className="space-y-2">
              <p>{creationError.message}</p>
              {creationError.details.length > 0 && (
                <ul className="list-disc space-y-1 pl-5">
                  {creationError.details.map((detail) => <li key={detail}>{detail}</li>)}
                </ul>
              )}
              <p>
                {creationError.retryable
                  ? "Der Fehler ist möglicherweise vorübergehend. Versuchen Sie es erneut."
                  : "Prüfen Sie die Angaben und versuchen Sie es erneut."}
              </p>
            </AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={loading || loadingBooking}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Creating...
              </>
            ) : (
              <>
                {creationError && <RotateCcw className="h-4 w-4 mr-2" />}
                {creationError ? "Erneut versuchen" : "Create Shipping Label"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}