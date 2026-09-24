import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useToast } from "@/hooks/useToast"
import {
  createShippingLabel,
  DEFAULT_DHL_PRODUCT,
  dhlShipperSettingsMessage,
  DHL_PRODUCTS,
  getDhlShipperSettings,
  normalizeDhlProduct,
  ShipmentData,
  splitStreetAndHouse,
  toShipperFormValues,
  type ShippingLabelError
} from "@/api/shipping"
import { getOrderById } from "@/api/orders"
import { AlertCircle, Package, Loader2, RotateCcw, User, Building2 } from "lucide-react"
import { Separator } from "@/components/ui/separator"

interface CreateShippingLabelDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  orderId: string
  onSuccess: () => void
}

interface LabelCreationError {
  message: string
  details: string[]
  retryable: boolean
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
  const [creationError, setCreationError] = useState<LabelCreationError | null>(null)
  // Why the Absender block may be empty – shown instead of silently leaving it blank.
  const [shipperNotice, setShipperNotice] = useState<string | null>(null)

  const [formData, setFormData] = useState<ShipmentData>({
    weight: 1.0,
    length: 20,
    width: 15,
    height: 10,
    serviceType: DEFAULT_DHL_PRODUCT,
    // Shipper defaults – no literals here. The real Absender comes from the DHL
    // integration (Systemkonfiguration → Integrationen) and is loaded when the dialog
    // opens; a hard-coded value would shadow the configured one on every label.
    shipperAddress: '',
    shipperCity: '',
    shipperPostalCode: '',
    shipperCountry: '',
    shipperEmail: '',
    shipperPhone: '',
    shipperCompany: '',
    shipperName: '',
    // Receiver fields - will be pre-filled from order
    receiverName: '',
    receiverAddress: '',
    receiverCity: '',
    receiverPostalCode: '',
    receiverCountry: 'DE',
    receiverEmail: '',
    receiverPhone: '',
    receiverNumber: '',
    deliveryType: 'address',
    packstationNumber: '',
    postNumber: '',
    shippingCost: 0,
    isCustomsDeclarable: false
  })

  const isPackstation = formData.deliveryType === 'packstation'

  // Load order details and pre-fill receiver information when dialog opens
  useEffect(() => {
    if (open && orderId) {
      setCreationError(null)
      setShipperNotice(null)
      loadOrderDetails()
      loadShipperDefaults()
    }
  }, [open, orderId])

  // The Absender is configuration, not a literal: read it from the active DHL
  // integration so staff see (and can correct) the address the label will really carry.
  // When the read fails (staff have no permission for the admin-only integrations
  // endpoint) say so visibly – an empty Absender block must never look intentional.
  const loadShipperDefaults = async () => {
    const result = await getDhlShipperSettings()
    if (result.status !== 'ok') {
      setShipperNotice(dhlShipperSettingsMessage(result))
      return
    }
    setShipperNotice(null)
    setFormData(prev => ({ ...prev, ...toShipperFormValues(result.settings) }))
  }

  const showValidationError = (message: string) => {
    setCreationError({ message, details: [], retryable: false })
    toast({ title: "Label konnte nicht erstellt werden", description: message, variant: "destructive" })
  }

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

      // The checkout stores street and house number in one combined field; DHL needs
      // them separately, so split here and let staff correct either part.
      const streetParts = splitStreetAndHouse(address?.street || '')

      setFormData(prev => ({
        ...prev,
        receiverName: customer?.name || '',
        receiverEmail: customer?.email || '',
        receiverPhone: customer?.phone || '',
        receiverAddress: streetParts.street,
        receiverCity: address?.city || '',
        receiverPostalCode: address?.zipCode || '',
        receiverCountry: address?.country || 'DE',
        receiverNumber: address?.number || streetParts.house || '',
        deliveryType: address?.deliveryType === 'packstation' ? 'packstation' : 'address',
        packstationNumber: address?.packstationNumber || '',
        postNumber: address?.postNumber || '',
        serviceType: normalizeDhlProduct(prev.serviceType)
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
    } catch (error: unknown) {
      console.error('Error loading order details:', error)
      toast({
        title: "Hinweis",
        description: "Empfängerdaten konnten nicht vorbefüllt werden. Bitte manuell eingeben.",
        variant: "destructive"
      })
    } finally {
      setLoadingOrder(false)
    }
  }

  const handleCreate = async () => {
    // Validate package dimensions
    if (!formData.weight || !formData.length || !formData.width || !formData.height) {
      showValidationError("Bitte alle Paketmaße und das Gewicht ausfüllen.")
      return
    }

    // Validate receiver address fields
    if (isPackstation) {
      if (!/^\d{3}$/.test((formData.packstationNumber || '').trim())) {
        showValidationError("Packstationsnummer ungültig. Erwartet werden genau 3 Ziffern.")
        return
      }
      if (!/^\d{6,10}$/.test((formData.postNumber || '').trim())) {
        showValidationError("Postnummer ungültig. Erwartet werden 6 bis 10 Ziffern.")
        return
      }
    } else {
      if (!formData.receiverAddress || !formData.receiverAddress.trim()) {
        showValidationError("Empfängeradresse unvollständig: Straße fehlt.")
        return
      }

      if (!formData.receiverNumber || !formData.receiverNumber.trim()) {
        showValidationError("Empfängeradresse unvollständig: Hausnummer fehlt.")
        return
      }
    }

    if (!formData.receiverCity || !formData.receiverCity.trim()) {
      showValidationError("Empfängeradresse unvollständig: Ort fehlt.")
      return
    }

    if (!formData.receiverPostalCode || !formData.receiverPostalCode.trim()) {
      showValidationError("Empfängeradresse unvollständig: PLZ fehlt.")
      return
    }

    if (!formData.receiverCountry || !formData.receiverCountry.trim()) {
      showValidationError("Empfängeradresse unvollständig: Land fehlt.")
      return
    }

    // The Absender may stay empty (the server then uses the configured shop address),
    // but a street typed WITHOUT a house number must not be silently completed with the
    // configured house number – street and house number belong to the same address.
    const shipperStreetInput = (formData.shipperAddress || '').trim()
    if (shipperStreetInput && !splitStreetAndHouse(shipperStreetInput).house) {
      showValidationError(
        "Absenderadresse unvollständig: Hausnummer fehlt. Bitte Straße und Hausnummer angeben (z. B. „Musterstraße 12“)."
      )
      return
    }

    setCreationError(null)
    setLoading(true)
    try {
      const product = normalizeDhlProduct(formData.serviceType)
      const result = await createShippingLabel(orderId, {
        ...formData,
        // Send the resolved product explicitly and always state the delivery type so the
        // server never has to guess it from the stored order.
        serviceType: product,
        product,
        deliveryType: isPackstation ? 'packstation' : 'address',
        ...(isPackstation ? { receiverAddress: '', receiverNumber: '' } : { packstationNumber: '', postNumber: '' })
      })

      toast({
        title: "Versandlabel erstellt",
        description: `Sendungsnummer: ${result.trackingNumber}`
      })

      onSuccess()
      onOpenChange(false)
    } catch (error: unknown) {
      console.error('Error creating shipping label:', error)
      const shippingError = error as ShippingLabelError
      const message = shippingError.message || "Versandlabel konnte nicht erstellt werden."
      setCreationError({
        message,
        details: shippingError.details || [],
        retryable: shippingError.retryable === true
      })
      toast({
        title: "Label konnte nicht erstellt werden",
        description: message,
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
            DHL-Versandlabel erstellen
          </DialogTitle>
          <DialogDescription>
            Versanddaten prüfen und DHL-Versandlabel erzeugen
          </DialogDescription>
        </DialogHeader>

        {loadingOrder ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-2 text-muted-foreground">Auftragsdaten werden geladen …</span>
          </div>
        ) : (
          <div className="grid gap-6 py-4">
            {/* Receiver Information */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold">Empfänger</h3>
              </div>
              <Separator />
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="receiverName">Name</Label>
                  <Input
                    id="receiverName"
                    value={formData.receiverName}
                    onChange={(e) => setFormData(prev => ({ ...prev, receiverName: e.target.value }))}
                    placeholder="Max Mustermann"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="receiverEmail">E-Mail</Label>
                  <Input
                    id="receiverEmail"
                    type="email"
                    value={formData.receiverEmail}
                    onChange={(e) => setFormData(prev => ({ ...prev, receiverEmail: e.target.value }))}
                    placeholder="max@beispiel.de"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="receiverPhone">Telefon</Label>
                <Input
                  id="receiverPhone"
                  value={formData.receiverPhone}
                  onChange={(e) => setFormData(prev => ({ ...prev, receiverPhone: e.target.value }))}
                  placeholder="+49 30 1234567"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="deliveryType">Zustellart *</Label>
                <Select
                  value={formData.deliveryType || 'address'}
                  onValueChange={(value) =>
                    setFormData(prev => ({ ...prev, deliveryType: value as ShipmentData['deliveryType'] }))
                  }
                >
                  <SelectTrigger id="deliveryType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="address">Hausadresse</SelectItem>
                    <SelectItem value="packstation">DHL Packstation</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {isPackstation ? (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="packstationNumber">Packstation-Nr. *</Label>
                    <Input
                      id="packstationNumber"
                      value={formData.packstationNumber || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, packstationNumber: e.target.value }))}
                      placeholder="123"
                      maxLength={3}
                      required
                    />
                    <p className="text-xs text-muted-foreground">Genau 3 Ziffern.</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="postNumber">Postnummer (DHL) *</Label>
                    <Input
                      id="postNumber"
                      value={formData.postNumber || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, postNumber: e.target.value }))}
                      placeholder="12345678"
                      maxLength={10}
                      required
                    />
                    <p className="text-xs text-muted-foreground">6 bis 10 Ziffern.</p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-4">
                  <div className="col-span-3 space-y-2">
                    <Label htmlFor="receiverAddress">Straße *</Label>
                    <Input
                      id="receiverAddress"
                      value={formData.receiverAddress}
                      onChange={(e) => setFormData(prev => ({ ...prev, receiverAddress: e.target.value }))}
                      placeholder="Musterstraße"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="receiverNumber">Hausnummer *</Label>
                    <Input
                      id="receiverNumber"
                      value={formData.receiverNumber}
                      onChange={(e) => setFormData(prev => ({ ...prev, receiverNumber: e.target.value }))}
                      placeholder="12a"
                      required
                    />
                  </div>
                </div>
              )}
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="receiverCity">Ort *</Label>
                  <Input
                    id="receiverCity"
                    value={formData.receiverCity}
                    onChange={(e) => setFormData(prev => ({ ...prev, receiverCity: e.target.value }))}
                    placeholder="Berlin"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="receiverPostalCode">PLZ *</Label>
                  <Input
                    id="receiverPostalCode"
                    value={formData.receiverPostalCode}
                    onChange={(e) => setFormData(prev => ({ ...prev, receiverPostalCode: e.target.value }))}
                    placeholder="10115"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="receiverCountry">Land *</Label>
                  <Input
                    id="receiverCountry"
                    value={formData.receiverCountry}
                    onChange={(e) => setFormData(prev => ({ ...prev, receiverCountry: e.target.value.toUpperCase() }))}
                    placeholder="DE"
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
                <h3 className="text-sm font-semibold">Paketmaße</h3>
              </div>
              <Separator />
              <div className="grid grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="weight">Gewicht (kg) *</Label>
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
                  <Label htmlFor="length">Länge (cm) *</Label>
                  <Input
                    id="length"
                    type="number"
                    min="1"
                    value={formData.length}
                    onChange={(e) => setFormData(prev => ({ ...prev, length: parseInt(e.target.value) }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="width">Breite (cm) *</Label>
                  <Input
                    id="width"
                    type="number"
                    min="1"
                    value={formData.width}
                    onChange={(e) => setFormData(prev => ({ ...prev, width: parseInt(e.target.value) }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="height">Höhe (cm) *</Label>
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

            {/* DHL product */}
            <div className="space-y-2">
              <Label htmlFor="serviceType">DHL-Produkt</Label>
              <Select
                value={normalizeDhlProduct(formData.serviceType)}
                onValueChange={(value) => setFormData(prev => ({ ...prev, serviceType: value }))}
              >
                <SelectTrigger id="serviceType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DHL_PRODUCTS.map((product) => (
                    <SelectItem key={product.code} value={product.code}>{product.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Shipper Details */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold">Absender</h3>
              </div>
              <Separator />
              {shipperNotice && (
                <Alert variant="destructive" aria-live="polite">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Absenderadresse konnte nicht vorbefüllt werden</AlertTitle>
                  <AlertDescription>{shipperNotice}</AlertDescription>
                </Alert>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="shipperCompany">Firma</Label>
                  <Input
                    id="shipperCompany"
                    value={formData.shipperCompany}
                    onChange={(e) => setFormData(prev => ({ ...prev, shipperCompany: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="shipperName">Ansprechpartner</Label>
                  <Input
                    id="shipperName"
                    value={formData.shipperName}
                    onChange={(e) => setFormData(prev => ({ ...prev, shipperName: e.target.value }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="shipperEmail">E-Mail</Label>
                  <Input
                    id="shipperEmail"
                    type="email"
                    value={formData.shipperEmail}
                    onChange={(e) => setFormData(prev => ({ ...prev, shipperEmail: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="shipperPhone">Telefon</Label>
                  <Input
                    id="shipperPhone"
                    value={formData.shipperPhone}
                    onChange={(e) => setFormData(prev => ({ ...prev, shipperPhone: e.target.value }))}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="shipperAddress">Straße und Hausnummer</Label>
                <Input
                  id="shipperAddress"
                  value={formData.shipperAddress}
                  onChange={(e) => setFormData(prev => ({ ...prev, shipperAddress: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="shipperCity">Ort</Label>
                  <Input
                    id="shipperCity"
                    value={formData.shipperCity}
                    onChange={(e) => setFormData(prev => ({ ...prev, shipperCity: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="shipperPostalCode">PLZ</Label>
                  <Input
                    id="shipperPostalCode"
                    value={formData.shipperPostalCode}
                    onChange={(e) => setFormData(prev => ({ ...prev, shipperPostalCode: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="shipperCountry">Land (ISO-2)</Label>
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
              <Label htmlFor="shippingCost">Versandkosten (€)</Label>
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
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading || loadingOrder}>
            Abbrechen
          </Button>
          <Button onClick={handleCreate} disabled={loading || loadingOrder}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Label wird erstellt …
              </>
            ) : (
              <>
                {creationError ? (
                  <RotateCcw className="h-4 w-4 mr-2" />
                ) : (
                  <Package className="h-4 w-4 mr-2" />
                )}
                {creationError ? "Erneut versuchen" : "Versandlabel erstellen"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
