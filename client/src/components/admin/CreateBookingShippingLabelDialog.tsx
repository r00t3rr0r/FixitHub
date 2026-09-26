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
import {
  buildBookingLabelParties,
  DEFAULT_DHL_PRODUCT,
  dhlShipperSettingsMessage,
  DHL_PRODUCTS,
  dhlProductHint,
  getDhlShipperSettings,
  missingBookingLabelFields,
  normalizeDhlProduct,
  splitStreetAndHouse,
  toShipperFormValues,
  type BookingLabelParty,
  type ShippingLabelDirection,
  type ShippingLabelError
} from "@/api/shipping"
import { AlertCircle, ArrowLeftRight, Building2, Loader2, Package, RotateCcw, User } from "lucide-react"

interface CreateBookingShippingLabelDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  bookingId: string
  onSuccess: () => void
}

/**
 * The form holds the two PARTIES, not "Absender" and "Empfänger": which of them becomes
 * which is decided by the selected direction alone (see buildBookingLabelParties).
 * Naming the fields after the roles is what let the direction depend on the order in
 * which the address blocks were merged.
 */
interface BookingShipmentData {
  weight: number
  length: number
  width: number
  height: number
  serviceType: string
  /** Resolved DHL product code – wins over serviceType on the server. */
  product: string
  /** Shop-Anschrift – Konfiguration aus der aktiven DHL-Integration, kein Formularfeld. */
  shopAddress: string
  shopCity: string
  shopPostalCode: string
  shopCountry: string
  shopEmail: string
  shopPhone: string
  shopCompany: string
  shopName: string
  /** Kundenanschrift – aus der Buchung vorbefüllt und hier korrigierbar. */
  customerName: string
  customerAddress: string
  customerCity: string
  customerPostalCode: string
  customerCountry: string
  customerEmail: string
  customerPhone: string
  customerNumber: string
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
  // Why the configured Shop-Adresse could not be loaded – never swallowed, because this
  // dialog has no inputs for it and staff would otherwise see no reason for the refusal.
  const [shopNotice, setShopNotice] = useState<string | null>(null)
  // True when the settings could not be READ (staff have no access to the admin-only
  // integrations endpoint). The server then resolves the shop side from its own
  // configuration instead – see ShipmentData.shipperFromConfiguration /
  // receiverFromConfiguration.
  const [shopFromConfiguration, setShopFromConfiguration] = useState(false)
  // Das Buchungslabel ist ausschließlich das EINSENDELABEL (Kunde -> McRepair). Die
  // Auslieferung an den Kunden wird je Auftrag erstellt ("An Kunden versenden" in der
  // Auftragsansicht); der Server lehnt ein Rückweg-Label an der Buchung ab.
  const labelDirection: ShippingLabelDirection = "inbound"

  const [formData, setFormData] = useState<BookingShipmentData>({
    weight: 1.0,
    length: 20,
    width: 15,
    height: 10,
    serviceType: DEFAULT_DHL_PRODUCT,
    product: DEFAULT_DHL_PRODUCT,
    // No shop literals here. The real shop address is configuration and is loaded from
    // the active DHL integration when the dialog opens; when it cannot be read, the
    // server resolves it instead of the dialog inventing one.
    shopAddress: "",
    shopCity: "",
    shopPostalCode: "",
    shopCountry: "DE",
    shopEmail: "",
    shopPhone: "",
    shopCompany: "",
    shopName: "",
    customerName: "",
    customerAddress: "",
    customerCity: "",
    customerPostalCode: "",
    customerCountry: "DE",
    customerEmail: "",
    customerPhone: "",
    customerNumber: "",
    shippingCost: 0,
    isCustomsDeclarable: false,
  })

  useEffect(() => {
    if (open && bookingId) {
      setCreationError(null)
      setShopNotice(null)
      setShopFromConfiguration(false)
      loadBookingDetails()
      loadShopDefaults()
    }
  }, [open, bookingId])

  // The shop address is configuration, not a literal: read it from the active DHL
  // integration so the label carries the real shop address. A failed read (staff have no
  // permission for the admin-only integrations endpoint) is surfaced, never swallowed.
  const loadShopDefaults = async () => {
    const result = await getDhlShipperSettings()
    if (result.status === 'ok') {
      const shipper = toShipperFormValues(result.settings)
      setShopNotice(null)
      setShopFromConfiguration(false)
      setFormData((prev) => ({
        ...prev,
        shopCompany: shipper.shipperCompany,
        shopName: shipper.shipperName,
        shopAddress: shipper.shipperAddress,
        shopCity: shipper.shipperCity,
        shopPostalCode: shipper.shipperPostalCode,
        shopCountry: shipper.shipperCountry,
        shopEmail: shipper.shipperEmail,
        shopPhone: shipper.shipperPhone,
      }))
      return
    }
    if (result.status === 'not-configured') {
      // Really nothing configured – creating a label would produce a wrong address.
      setShopFromConfiguration(false)
      setShopNotice(dhlShipperSettingsMessage(result))
      return
    }
    // Could not READ the configuration (no permission / request failed). The server has
    // it and resolves the shop side itself; it refuses in German if it is incomplete.
    setShopFromConfiguration(true)
    setShopNotice(
      `${dhlShipperSettingsMessage(result)} Das Label wird mit der auf dem Server hinterlegten ` +
      "Shop-Adresse erstellt."
    )
  }

  const loadBookingDetails = async () => {
    setLoadingBooking(true)
    try {
      const response = await getBooking(bookingId)
      const booking = response?.booking || {}
      const customer = booking?.customerId || {}
      const shippingAddress = booking?.shippingAddress || booking?.deliveryAddress || null
      const invoiceAddress = customer?.invoiceAddress || null
      const address = shippingAddress || invoiceAddress || {}
      // DHL needs street and house number separately; the checkout stores them combined.
      const streetParts = splitStreetAndHouse(address?.street || "")

      setFormData((prev) => ({
        ...prev,
        customerName: customer?.name || `${customer?.firstName || ""} ${customer?.lastName || ""}`.trim(),
        customerEmail: customer?.email || "",
        customerPhone: customer?.phone || "",
        customerAddress: streetParts.street,
        customerNumber: streetParts.house || address?.number || "",
        customerCity: address?.city || "",
        customerPostalCode: address?.zipCode || address?.postalCode || "",
        customerCountry: address?.country || "DE",
      }))
    } catch (error: unknown) {
      console.error('Error loading booking details:', error)
      toast({
        title: "Hinweis",
        description: "Kundendaten konnten nicht vorbefüllt werden. Bitte manuell eingeben.",
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
        title: "Label konnte nicht erstellt werden",
        description: "Bitte alle Paketmaße und das Gewicht ausfüllen.",
        variant: "destructive",
      })
      return
    }

    // Die beiden PARTEIEN werden einmal gebaut; welche davon Absender und welche
    // Empfänger wird, entscheidet allein die gewählte Richtung.
    const customerParty: BookingLabelParty = {
      name: formData.customerName,
      street: formData.customerAddress,
      house: formData.customerNumber,
      city: formData.customerCity,
      postalCode: formData.customerPostalCode,
      country: formData.customerCountry,
      email: formData.customerEmail,
      phone: formData.customerPhone,
    }
    // Die Shop-Adresse wird als EIN kombiniertes "Straße und Hausnummer" gepflegt; die
    // Hausnummer wird daraus abgetrennt, niemals aus einer anderen Anschrift ergänzt.
    const shopParty: BookingLabelParty = {
      name: formData.shopCompany || formData.shopName,
      street: formData.shopAddress,
      house: "",
      city: formData.shopCity,
      postalCode: formData.shopPostalCode,
      country: formData.shopCountry,
      email: formData.shopEmail,
      phone: formData.shopPhone,
    }

    const missingCustomerFields = missingBookingLabelFields(customerParty)
    if (missingCustomerFields.length > 0) {
      const message =
        `Kundenadresse unvollständig (${missingCustomerFields.join(", ")}). ` +
        "DHL benötigt die Hausnummer in einem eigenen Feld."
      setCreationError({ message, details: [], retryable: false })
      toast({
        title: "Label konnte nicht erstellt werden",
        description: message,
        variant: "destructive",
      })
      return
    }

    // Die Shop-Anschrift ist Konfiguration. Konnte sie hier nicht GELESEN werden, löst der
    // Server sie selbst auf (und lehnt auf Deutsch ab, wenn sie dort unvollständig ist).
    // Ist sie lesbar, aber unvollständig, wird hier abgebrochen: eine falsche
    // Shop-Anschrift auf dem Label ist schlimmer als gar kein Label.
    const missingShopFields = shopFromConfiguration ? [] : missingBookingLabelFields(shopParty)
    if (missingShopFields.length > 0) {
      const message =
        `Shop-Adresse unvollständig (${missingShopFields.join(", ")}). ` +
        "Bitte die Shop-Adresse unter Systemkonfiguration → Integrationen → DHL vollständig hinterlegen " +
        "(Straße mit Hausnummer, PLZ und Ort)."
      setCreationError({ message, details: shopNotice ? [shopNotice] : [], retryable: false })
      toast({
        title: "Label konnte nicht erstellt werden",
        description: message,
        variant: "destructive",
      })
      return
    }

    setCreationError(null)
    setLoading(true)
    try {
      const product = normalizeDhlProduct(formData.serviceType)
      // Straße und Hausnummer reisen immer zusammen, und die Richtung wird EXPLIZIT
      // mitgeschickt: der Endpunkt baut seine eigenen Vorgaben aus `labelDirection` und
      // darf die Richtung nicht daraus ableiten, welche Blöcke hier mitkommen. Ist die
      // Shop-Adresse hier nicht lesbar, geht für diese Seite nur das Flag mit und der
      // Server setzt die konfigurierte Anschrift ein.
      const parties = buildBookingLabelParties({
        direction: labelDirection,
        customer: customerParty,
        shop: shopParty,
        shopFromConfiguration,
      })
      // State the delivery type explicitly so the customer's stored Packstation can never
      // be used for this label.
      const result = await createBookingShippingLabel(bookingId, {
        weight: formData.weight,
        length: formData.length,
        width: formData.width,
        height: formData.height,
        shippingCost: formData.shippingCost,
        isCustomsDeclarable: formData.isCustomsDeclarable,
        ...parties,
        serviceType: product,
        product,
        deliveryType: "address",
      })
      toast({
        title: "Einsendelabel erstellt",
        description: `Sendungsnummer: ${result?.trackingNumber || "-"}`,
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
            DHL-Versandlabel für Buchung erstellen
          </DialogTitle>
          <DialogDescription>
            Versanddaten prüfen und DHL-Versandlabel für diese Buchung erzeugen
          </DialogDescription>
        </DialogHeader>

        {loadingBooking ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-2 text-muted-foreground">Buchungsdaten werden geladen …</span>
          </div>
        ) : (
          <div className="grid gap-6 py-4">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <ArrowLeftRight className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold">Label-Art</h3>
              </div>
              <Separator />
              <div className="space-y-2">
                <p className="text-sm font-medium">Versand zum Reparaturbetrieb (Kunde → McRepair)</p>
                <p className="text-sm text-muted-foreground">
                  Absender ist der Kunde, Empfänger ist McRepair. Die Auslieferung des reparierten Geräts
                  an den Kunden wird je Auftrag über „An Kunden versenden“ erstellt – so wird ein fertiges
                  Gerät nie zusammen mit noch offenen Geräten derselben Buchung als versendet markiert.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold">
                  Kundenadresse (Absender)
                </h3>
              </div>
              <Separator />
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="customerName">Name</Label>
                  <Input
                    id="customerName"
                    value={formData.customerName}
                    onChange={(e) => setFormData((prev) => ({ ...prev, customerName: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customerEmail">E-Mail</Label>
                  <Input
                    id="customerEmail"
                    type="email"
                    value={formData.customerEmail}
                    onChange={(e) => setFormData((prev) => ({ ...prev, customerEmail: e.target.value }))}
                  />
                </div>
                <div className="col-span-2 grid grid-cols-4 gap-4">
                  <div className="col-span-3 space-y-2">
                    <Label htmlFor="customerAddress">Straße *</Label>
                    <Input
                      id="customerAddress"
                      value={formData.customerAddress}
                      onChange={(e) => setFormData((prev) => ({ ...prev, customerAddress: e.target.value }))}
                      placeholder="Musterstraße"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="customerNumber">Hausnummer *</Label>
                    <Input
                      id="customerNumber"
                      value={formData.customerNumber}
                      onChange={(e) => setFormData((prev) => ({ ...prev, customerNumber: e.target.value }))}
                      placeholder="12a"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customerCity">Ort</Label>
                  <Input
                    id="customerCity"
                    value={formData.customerCity}
                    onChange={(e) => setFormData((prev) => ({ ...prev, customerCity: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customerPostalCode">PLZ</Label>
                  <Input
                    id="customerPostalCode"
                    value={formData.customerPostalCode}
                    onChange={(e) => setFormData((prev) => ({ ...prev, customerPostalCode: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customerCountry">Land (ISO-2)</Label>
                  <Input
                    id="customerCountry"
                    value={formData.customerCountry}
                    onChange={(e) => setFormData((prev) => ({ ...prev, customerCountry: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customerPhone">Telefon</Label>
                  <Input
                    id="customerPhone"
                    value={formData.customerPhone}
                    onChange={(e) => setFormData((prev) => ({ ...prev, customerPhone: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            {/* Shop-Adresse – Konfiguration, kein Eingabefeld. Read-only, damit
                Mitarbeitende sehen, welche Anschrift auf dem Label steht (und warum
                sie gegebenenfalls fehlt). */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold">
                  Shop-Adresse (Empfänger, aus der DHL-Integration)
                </h3>
              </div>
              <Separator />
              {shopNotice ? (
                <Alert variant={shopFromConfiguration ? "default" : "destructive"} aria-live="polite">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>
                    {shopFromConfiguration
                      ? "Shop-Adresse wird vom Server übernommen"
                      : "Shop-Adresse konnte nicht geladen werden"}
                  </AlertTitle>
                  <AlertDescription>{shopNotice}</AlertDescription>
                </Alert>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {[
                    formData.shopCompany || formData.shopName,
                    formData.shopAddress,
                    [formData.shopPostalCode, formData.shopCity].filter((part) => part.trim()).join(" "),
                  ]
                    .filter((part) => part.trim())
                    .join(", ") ||
                    "Keine Shop-Adresse hinterlegt. Bitte unter Systemkonfiguration → Integrationen → DHL eintragen."}
                </p>
              )}
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-semibold">Paketdaten</h3>
              <Separator />
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="weight">Gewicht (kg)</Label>
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
                  <Label htmlFor="serviceType">DHL-Produkt</Label>
                  <Select
                    value={normalizeDhlProduct(formData.serviceType)}
                    onValueChange={(value) =>
                      setFormData((prev) => ({ ...prev, serviceType: value, product: value }))
                    }
                  >
                    <SelectTrigger id="serviceType">
                      <SelectValue placeholder="DHL-Produkt wählen" />
                    </SelectTrigger>
                    <SelectContent>
                      {DHL_PRODUCTS.map((product) => (
                        <SelectItem key={product.code} value={product.code}>{product.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">{dhlProductHint(formData.serviceType)}</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="length">Länge (cm)</Label>
                  <Input
                    id="length"
                    type="number"
                    min="1"
                    value={formData.length}
                    onChange={(e) => setFormData((prev) => ({ ...prev, length: Number(e.target.value) || 0 }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="width">Breite (cm)</Label>
                  <Input
                    id="width"
                    type="number"
                    min="1"
                    value={formData.width}
                    onChange={(e) => setFormData((prev) => ({ ...prev, width: Number(e.target.value) || 0 }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="height">Höhe (cm)</Label>
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
            Abbrechen
          </Button>
          <Button onClick={handleCreate} disabled={loading || loadingBooking}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Wird erstellt …
              </>
            ) : (
              <>
                {creationError?.retryable && <RotateCcw className="h-4 w-4 mr-2" />}
                {creationError?.retryable ? "Erneut versuchen" : "Einsendelabel erstellen"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}