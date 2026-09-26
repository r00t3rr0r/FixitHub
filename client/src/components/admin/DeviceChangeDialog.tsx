import { useState, useEffect, useRef } from "react"
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
  getCompatibleServices,
} from "@/api/adminOrders"
import { searchDevices } from "@/api/devices"
import {
  buildRepricingConfirmation,
  isRepricingConfirmationOutdated,
  type OrderRepricingOptions,
} from "@/api/orders"
import {
  ORDER_VALUE_NOT_RECONCILED,
  describeRepricingConsequence,
  readOrderServiceErrorCode,
  readReconciliationDetails,
  type OrderValueReconciliationDetails,
} from "@/api/orderServices"

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
  // The device the customer originally booked (differs from originalDevice once the
  // order has been corrected more than once).
  bookedDevice?: {
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
  paymentAdjustment?: {
    scope: 'booking' | 'order'
    orderValue: number
    paidAmount: number
    refundAmount: number
    additionalPaymentAmount: number
  } | null
  selectedServiceSwap?: {
    previousServiceName: string
    previousServicePrice: number
    newServiceName: string
    newServicePrice: number
    difference: number
    status: 'increase' | 'decrease' | 'no-change'
  }
  selectedServiceSwaps?: Array<{
    previousServiceName: string
    previousServicePrice: number
    newServiceName: string
    newServicePrice: number
    difference: number
    status: 'increase' | 'decrease' | 'no-change'
  }>
  requiresConfirmation: boolean
  changedAt: string
  changedBy: string
  // Hinweise des Servers (z. B. fehlgeschlagener Finanzabgleich) - die Änderung ist gespeichert.
  warnings?: string[]
}

interface CurrentOrderService {
  id: string
  name: string
  price: number
}

interface CompatibleService {
  _id: string
  name: string
  price: number
  category?: string
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
  currentServices: CurrentOrderService[]
  // Nach "Bestätigen": der Gerätewechsel ist gespeichert und bestätigt.
  onDeviceChanged?: (order: any) => void
  // Der Server speichert den Wechsel bereits bei "Neu berechnen". Schließt die
  // Mitarbeiterin den Dialog danach ohne Bestätigung (Abbrechen, X, Escape, Klick
  // neben den Dialog), muss die Seite den gespeicherten
  // Stand NEU LADEN (keine Erfolgsmeldung, keine Rohantwort von /change-device
  // einsetzen - die hat nicht die Form der Detailansicht).
  onRefreshRequested?: () => void
}

export function DeviceChangeDialog({
  open,
  onOpenChange,
  orderId,
  currentDevice,
  currentServices,
  onDeviceChanged,
  onRefreshRequested,
}: DeviceChangeDialogProps) {
  const { t } = useTranslation()
  const { toast } = useToast()

  const tr = (key: string, fallback: string) => {
    const value = t(key)
    return !value || value === key ? fallback : value
  }

  const [step, setStep] = useState<'select' | 'review' | 'confirm'>('select')
  const [deviceSearchQuery, setDeviceSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [selectedDevice, setSelectedDevice] = useState<any | null>(null)
  const [compatibleServices, setCompatibleServices] = useState<CompatibleService[]>([])
  const [selectedCurrentServiceId, setSelectedCurrentServiceId] = useState("")
  const [selectedReplacementServiceId, setSelectedReplacementServiceId] = useState("")
  const [serviceReplacementMap, setServiceReplacementMap] = useState<Record<string, string>>({})
  const [loadingCompatibleServices, setLoadingCompatibleServices] = useState(false)
  const [loading, setLoading] = useState(false)
  const [pricingChanges, setPricingChanges] = useState<PricingChangesSummary | null>(null)
  // Der Server speichert den Gerätewechsel bereits bei der Neuberechnung. Das hier
  // gemerkte Ergebnis sorgt dafür, dass die Seite auch bei "Abbrechen" den
  // gespeicherten Stand anzeigt statt eines veralteten Geräts.
  const [savedOrder, setSavedOrder] = useState<any | null>(null)
  const [confirming, setConfirming] = useState(false)
  // 409 ORDER_VALUE_NOT_RECONCILED: der gespeicherte Auftragswert passt nicht zu den
  // Positionen. Nichts wurde gespeichert; der Dialog zeigt die Abweichung und bietet die
  // ausdrückliche Bestätigung an (gebunden an genau diese Abweichung).
  const [repricingPrompt, setRepricingPrompt] = useState<{
    message: string
    details: OrderValueReconciliationDetails | null
    outdated: boolean
  } | null>(null)
  const [densityMode, setDensityMode] = useState<'standard' | 'kompakt'>('kompakt')
  const searchRequestIdRef = useRef(0)
  const wasOpenRef = useRef(false)

  // Reset dialog state when it opens
  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setStep('select')
      setDeviceSearchQuery("")
      setSearchResults([])
      setSelectedDevice(null)
      setCompatibleServices([])
      setSelectedCurrentServiceId(currentServices[0]?.id || "")
      setSelectedReplacementServiceId("")
      setServiceReplacementMap({})
      setPricingChanges(null)
      setSavedOrder(null)
      setRepricingPrompt(null)
      setDensityMode('kompakt')
    }

    wasOpenRef.current = open
  }, [open, currentServices])

  useEffect(() => {
    if (!open || step !== 'select' || !selectedDevice?.deviceType) {
      setCompatibleServices([])
      setSelectedReplacementServiceId("")
      return
    }

    let cancelled = false

    const loadCompatibleServices = async () => {
      try {
        setLoadingCompatibleServices(true)
        const response = await getCompatibleServices(selectedDevice.deviceType, {
          deviceBrand: selectedDevice.manufacturer,
          deviceModel: selectedDevice.name,
        })
        if (cancelled) return

        const services = ((response as any).services || []) as CompatibleService[]
        setCompatibleServices(services)

        setSelectedReplacementServiceId((previousValue) => {
          if (previousValue && services.some((service) => service._id === previousValue)) {
            return previousValue
          }
          return services[0]?._id || ""
        })
      } catch (error) {
        if (cancelled) return
        console.error("[DeviceChange] Error loading compatible services:", error)
        toast({
          title: "Fehler",
          description: error instanceof Error ? error.message : "Kompatible Services konnten nicht geladen werden.",
          variant: "destructive",
        })
      } finally {
        if (!cancelled) {
          setLoadingCompatibleServices(false)
        }
      }
    }

    loadCompatibleServices()

    return () => {
      cancelled = true
    }
  }, [open, step, selectedDevice, toast])

  useEffect(() => {
    if (!open || step !== 'select') return

    const query = deviceSearchQuery.trim()
    if (!query) {
      setSearchResults([])
      setLoading(false)
      return
    }

    const activeRequestId = ++searchRequestIdRef.current
    setLoading(true)

    const timer = setTimeout(async () => {
      try {
        console.log("[DeviceChange] Live-Suche nach Geräten:", query)
        const response = await searchDevices(query)

        // Nur das aktuellste Suchergebnis uebernehmen.
        if (activeRequestId !== searchRequestIdRef.current) return

        setSearchResults((response as any).devices || [])
      } catch (error) {
        if (activeRequestId !== searchRequestIdRef.current) return
        console.error("[DeviceChange] Fehler bei der Gerätesuche:", error)
        toast({
          title: "Fehler",
          description: "Die Live-Suche konnte nicht aktualisiert werden.",
          variant: "destructive",
        })
      } finally {
        if (activeRequestId === searchRequestIdRef.current) {
          setLoading(false)
        }
      }
    }, 140)

    return () => {
      clearTimeout(timer)
    }
  }, [deviceSearchQuery, open, step, toast])

  const handleSelectDevice = (device: any) => {
    setSelectedDevice(device)
    setSelectedReplacementServiceId("")
    setServiceReplacementMap({})
    setRepricingPrompt(null)
    console.log("[DeviceChange] Selected device:", device)
  }

  const assignServiceReplacement = () => {
    if (!selectedCurrentServiceId || !selectedReplacementServiceId) return
    setRepricingPrompt(null)
    setServiceReplacementMap((previousMap) => ({
      ...previousMap,
      [selectedCurrentServiceId]: selectedReplacementServiceId,
    }))
  }

  const removeServiceReplacement = (currentServiceId: string) => {
    setRepricingPrompt(null)
    setServiceReplacementMap((previousMap) => {
      const nextMap = { ...previousMap }
      delete nextMap[currentServiceId]
      return nextMap
    })
  }

  const selectedCurrentService = currentServices.find((service) => service.id === selectedCurrentServiceId) || null
  const hasCurrentServices = currentServices.length > 0

  const selectedServiceReplacements = Object.entries(serviceReplacementMap)
    .map(([oldOrderServiceId, newServiceId]) => {
      const existingService = currentServices.find((service) => service.id === oldOrderServiceId)
      const replacementService = compatibleServices.find((service) => service._id === newServiceId)

      if (!existingService || !replacementService) {
        return null
      }

      return {
        oldOrderServiceId,
        newServiceId,
        existingService,
        replacementService,
      }
    })
    .filter(Boolean) as Array<{
    oldOrderServiceId: string
    newServiceId: string
    existingService: CurrentOrderService
    replacementService: CompatibleService
  }>

  const selectedCurrentServicesTotal = selectedServiceReplacements.reduce(
    (sum, entry) => sum + (Number(entry.existingService.price) || 0),
    0
  )
  const selectedReplacementServicesTotal = selectedServiceReplacements.reduce(
    (sum, entry) => sum + (Number(entry.replacementService.price) || 0),
    0
  )

  const liveSwapDifference =
    selectedServiceReplacements.length > 0
      ? selectedReplacementServicesTotal - selectedCurrentServicesTotal
      : null

  const canProceedToRecalculation =
    Boolean(selectedDevice) &&
    (!hasCurrentServices || selectedServiceReplacements.length === currentServices.length)

  const formatCurrency = (value: number) =>
    (Number(value) || 0).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })

  const handleRecalculateServices = async (repricing?: OrderRepricingOptions) => {
    if (!selectedDevice) {
      toast({
        title: "Fehler",
        description: "Bitte wählen Sie zuerst ein Gerät aus.",
        variant: "destructive",
      })
      return
    }

    if (hasCurrentServices && selectedServiceReplacements.length !== currentServices.length) {
      toast({
        title: "Fehler",
        description: `Bitte ordnen Sie jeden bestehenden Reparaturservice genau einem neuen Reparaturservice zu (${selectedServiceReplacements.length}/${currentServices.length}).`,
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
        selectedDevice.deviceType,
        {
          ...(hasCurrentServices
            ? {
                serviceReplacements: selectedServiceReplacements.map(({ oldOrderServiceId, newServiceId }) => ({
                  oldOrderServiceId,
                  newServiceId,
                })),
              }
            : {}),
          ...(repricing || {}),
        }
      )

      setRepricingPrompt(null)
      setPricingChanges(result.pricingChangesSummary)
      setSavedOrder(result.order || null)
      setStep('review')

      toast({
        title: "Gerätewechsel gespeichert",
        description: "Gerät, Reparaturservices und Auftragswert wurden gespeichert. Bitte prüfen Sie die Preisänderung und bestätigen Sie anschließend.",
      })

      const warnings: string[] = result.warnings || result.pricingChangesSummary?.warnings || []
      if (warnings.length > 0) {
        toast({
          title: "Achtung",
          description: warnings.join(' '),
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("[DeviceChange] Error recalculating services:", error)
      if (readOrderServiceErrorCode(error) === ORDER_VALUE_NOT_RECONCILED) {
        // Nichts gespeichert: Abweichung im Dialog zeigen, Bestätigung anbieten.
        setRepricingPrompt({
          message: error instanceof Error ? error.message : "Der gespeicherte Auftragswert passt nicht zu den Positionen.",
          details: readReconciliationDetails(error),
          outdated: isRepricingConfirmationOutdated(error),
        })
        return
      }
      toast({
        title: "Fehler",
        description: error instanceof Error ? error.message : "Die Neuberechnung der Servicepreise ist fehlgeschlagen.",
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
        title: "Erfolg",
        description: "Geräteänderung bestätigt. Der Kunde wurde informiert.",
      })

      if (onDeviceChanged) {
        onDeviceChanged(result.order)
      }

      // Bereits über onDeviceChanged neu geladen - beim Schließen nicht ein zweites Mal.
      setSavedOrder(null)
      onOpenChange(false)
    } catch (error) {
      console.error("[DeviceChange] Error confirming device change:", error)
      toast({
        title: "Fehler",
        description: error instanceof Error ? error.message : "Die Bestätigung der Geräteänderung ist fehlgeschlagen.",
        variant: "destructive",
      })
    } finally {
      setConfirming(false)
    }
  }

  // JEDER Schließweg (Abbrechen, X, Escape, Klick neben den Dialog) läuft hierüber: wurde
  // der Wechsel bei "Neu berechnen" bereits gespeichert, muss die Seite den gespeicherten
  // Stand neu laden - sonst zeigt sie weiter das alte Gerät und den alten Auftragswert.
  const handleClose = () => {
    if (savedOrder) {
      // Seite neu laden lassen, ohne Erfolgsmeldung und ohne die Rohantwort einzusetzen.
      // Aufrufer ohne onRefreshRequested erhalten wie bisher onDeviceChanged
      // (OrderDetails lädt dort ebenfalls neu).
      if (onRefreshRequested) {
        onRefreshRequested()
      } else if (onDeviceChanged) {
        onDeviceChanged(savedOrder)
      }
    }
    setSavedOrder(null)
    setStep('select')
    setSelectedDevice(null)
    setPricingChanges(null)
    setRepricingPrompt(null)
    onOpenChange(false)
  }

  const handleDialogOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      onOpenChange(true)
      return
    }
    // Während gespeichert/bestätigt wird, nicht über X/Escape schließen (wie der
    // deaktivierte Abbrechen-Knopf).
    if (loading || confirming) return
    handleClose()
  }

  const stepNumber = step === 'select' ? 1 : step === 'review' ? 2 : 3

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className={`order-device-change-dialog order-device-change-dialog--${densityMode} !max-w-[1320px] w-[96vw] overflow-hidden p-0`}>
        <DialogHeader className="order-device-change-header">
          <DialogTitle className="order-device-change-title">
            <span className="order-device-change-title-icon" aria-hidden="true">
              <Smartphone className="h-5 w-5" />
            </span>
            {tr('orderDetails.changeDevice', 'Gerät ändern')}
          </DialogTitle>
          <DialogDescription className="order-device-change-description">
            {tr('orderDetails.changeDeviceDescription', 'Ändern Sie das Gerät dieses Auftrags und prüfen Sie die Preisaktualisierung vor der Bestätigung.')}
          </DialogDescription>
          <div className="order-device-change-density-controls" role="group" aria-label="Darstellungsmodus">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={`order-device-change-density-btn ${densityMode === 'standard' ? 'is-active' : ''}`}
              onClick={() => setDensityMode('standard')}
            >
              Standard
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={`order-device-change-density-btn ${densityMode === 'kompakt' ? 'is-active' : ''}`}
              onClick={() => setDensityMode('kompakt')}
            >
              Kompakt
            </Button>
          </div>
        </DialogHeader>

        <div className="order-device-change-stepper" aria-label="Schritte zur Geräteänderung">
          <div className={`order-device-change-step ${stepNumber >= 1 ? 'is-active' : ''}`}>
            <span>1</span>
            <p>{tr('orderDetails.searchDevice', 'Gerät wählen')}</p>
          </div>
          <div className={`order-device-change-step ${stepNumber >= 2 ? 'is-active' : ''}`}>
            <span>2</span>
            <p>{tr('orderDetails.services', 'Änderungen prüfen')}</p>
          </div>
          <div className={`order-device-change-step ${stepNumber >= 3 ? 'is-active' : ''}`}>
            <span>3</span>
            <p>{tr('orderDetails.confirm', 'Bestätigen')}</p>
          </div>
        </div>

        <div className="order-device-change-body">
          {/* Current Device Info */}
          <Card className="order-device-change-current-card">
            <CardHeader className="pb-2">
              <CardTitle className="order-device-change-section-title text-sm">
                {tr('orderDetails.currentDevice', 'Aktuelles Gerät')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="order-device-change-current-row">
                <span className="order-device-change-current-name">
                  {currentDevice.brand} {currentDevice.model}
                </span>
                <Badge variant="outline" className="order-device-change-type-badge">{currentDevice.type}</Badge>
              </div>
            </CardContent>
          </Card>

          {/* Step 1: Select Device */}
          {step === 'select' && (
            <div className="order-device-change-select-grid">
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="device-search" className="order-device-change-label">
                    {tr('orderDetails.searchDevice', 'Nach einem neuen Gerät suchen')}
                  </Label>
                  <Input
                    id="device-search"
                    className="order-device-change-input"
                    placeholder="z. B. iPhone 13 Pro, Samsung Galaxy S23..."
                    value={deviceSearchQuery}
                    onChange={(e) => {
                      setDeviceSearchQuery(e.target.value)
                    }}
                    aria-busy={loading}
                  />
                </div>

                {loading && (
                  <div className="flex items-center justify-center py-8">
                    <Loader className="h-6 w-6 animate-spin text-[#1a2a5e]" />
                  </div>
                )}

                {searchResults.length > 0 && (
                  <div className="order-device-change-results-wrap">
                    <Label className="order-device-change-results-label">
                      {searchResults.length} Treffer für "{deviceSearchQuery.trim()}"
                    </Label>
                    <div className="order-device-change-results-list">
                      {searchResults.map((device) => (
                        <button
                          type="button"
                          key={`${device.manufacturer}-${device.name}`}
                          className={`order-device-change-result-item ${selectedDevice?.name === device.name ? 'is-selected' : ''}`}
                          onClick={() => handleSelectDevice(device)}
                        >
                          <div>
                            <div className="order-device-change-result-name">
                              {device.manufacturer} {device.name}
                            </div>
                            <div className="order-device-change-result-type">
                              {device.deviceType}
                            </div>
                          </div>
                          {selectedDevice?.name === device.name && (
                            <CheckCircle className="h-5 w-5 text-[#38a169]" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {deviceSearchQuery && searchResults.length === 0 && !loading && (
                  <Alert className="order-device-change-empty-alert">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Keine Geräte gefunden. Bitte prüfen Sie einen anderen Suchbegriff.
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              <div className="order-device-change-side-panel">
                {hasCurrentServices && (
                  <Card className="order-device-change-side-card">
                    <CardHeader className="pb-2">
                      <CardTitle className="order-device-change-section-title text-sm">Service tauschen</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="space-y-2">
                        <Label className="order-device-change-label">Bisheriger Reparaturservice</Label>
                        <p className="order-device-change-side-subtitle">
                          {selectedCurrentService
                            ? `Ausgewählt: ${selectedCurrentService.name}`
                            : 'Wählen Sie einen bestehenden Service aus.'}
                        </p>
                        <div className="order-device-change-option-list">
                          {currentServices.map((service) => (
                            <button
                              key={service.id}
                              type="button"
                              className={`order-device-change-option-item ${selectedCurrentServiceId === service.id ? 'is-selected' : ''}`}
                              onClick={() => setSelectedCurrentServiceId(service.id)}
                            >
                              <span>{service.name}</span>
                              <strong>{formatCurrency(service.price)}</strong>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="order-device-change-label">
                          Neuer Reparaturservice
                          {selectedDevice ? ` (${selectedDevice.deviceType})` : ''}
                        </Label>

                        {!selectedDevice && (
                          <p className="order-device-change-side-empty">
                            Wählen Sie zuerst ein neues Gerät, um passende Services zu laden.
                          </p>
                        )}

                        {selectedDevice && loadingCompatibleServices && (
                          <div className="flex items-center gap-2 text-xs text-[#4a5568]">
                            <Loader className="h-4 w-4 animate-spin" />
                            Kompatible Services werden geladen...
                          </div>
                        )}

                        {selectedDevice && !loadingCompatibleServices && compatibleServices.length === 0 && (
                          <Alert className="order-device-change-empty-alert">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>
                              Für dieses Gerät wurden keine kompatiblen Reparaturservices gefunden.
                            </AlertDescription>
                          </Alert>
                        )}

                        {selectedDevice && !loadingCompatibleServices && compatibleServices.length > 0 && (
                          <div className="order-device-change-option-list">
                            {compatibleServices.map((service) => (
                              <button
                                key={service._id}
                                type="button"
                                className={`order-device-change-option-item ${selectedReplacementServiceId === service._id ? 'is-selected' : ''}`}
                                onClick={() => setSelectedReplacementServiceId(service._id)}
                              >
                                <div>
                                  <span>{service.name}</span>
                                  {service.category ? (
                                    <p className="order-device-change-option-meta">{service.category}</p>
                                  ) : null}
                                </div>
                                <strong>{formatCurrency(service.price)}</strong>
                              </button>
                            ))}
                          </div>
                        )}

                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={assignServiceReplacement}
                          disabled={!selectedCurrentServiceId || !selectedReplacementServiceId}
                        >
                          Zuordnung hinzufügen / aktualisieren
                        </Button>
                      </div>

                      <div className="space-y-2">
                        <Label className="order-device-change-label">Hinterlegte Zuordnungen</Label>
                        <p className="order-device-change-side-subtitle">
                          {selectedServiceReplacements.length}/{currentServices.length} Zuordnungen vollständig
                        </p>
                        {selectedServiceReplacements.length === 0 ? (
                          <p className="order-device-change-side-empty">
                            Noch keine Zuordnungen. Wählen Sie je Service einen passenden neuen Reparaturservice.
                          </p>
                        ) : (
                          <div className="order-device-change-option-list">
                            {selectedServiceReplacements.map(({ oldOrderServiceId, existingService, replacementService }) => (
                              <div key={`${oldOrderServiceId}-${replacementService._id}`} className="order-device-change-option-item is-selected">
                                <div>
                                  <span>{existingService.name}</span>
                                  <p className="order-device-change-option-meta">→ {replacementService.name}</p>
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                  <strong>{formatCurrency(replacementService.price - existingService.price)}</strong>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-auto p-0 text-xs"
                                    onClick={() => removeServiceReplacement(oldOrderServiceId)}
                                  >
                                    Entfernen
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                <Card className="order-device-change-side-card">
                  <CardHeader className="pb-2">
                    <CardTitle className="order-device-change-section-title text-sm">Auswahl</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {selectedDevice ? (
                      <div className="space-y-2">
                        <p className="order-device-change-side-title">
                          {selectedDevice.manufacturer} {selectedDevice.name}
                        </p>
                        <p className="order-device-change-side-subtitle">{selectedDevice.deviceType}</p>
                      </div>
                    ) : (
                      <p className="order-device-change-side-empty">
                        Wählen Sie ein Gerät aus der Liste, um fortzufahren.
                      </p>
                    )}

                    {liveSwapDifference !== null && hasCurrentServices && (
                      <div className="order-device-change-swap-preview">
                        <p className="order-device-change-swap-preview-label">Live-Gegenrechnung</p>
                        <div className="order-device-change-swap-preview-values">
                          <span>
                            {selectedServiceReplacements.length} Zuordnung(en) alt ({formatCurrency(selectedCurrentServicesTotal)})
                          </span>
                          <span>→</span>
                          <span>
                            neu ({formatCurrency(selectedReplacementServicesTotal)})
                          </span>
                        </div>
                        <p className={`order-device-change-swap-preview-diff ${liveSwapDifference > 0 ? 'is-increase' : liveSwapDifference < 0 ? 'is-decrease' : 'is-neutral'}`}>
                          Differenz: {liveSwapDifference > 0 ? '+' : ''}{formatCurrency(liveSwapDifference)}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="order-device-change-side-card is-muted">
                  <CardContent className="pt-4">
                    <p className="order-device-change-side-hint">
                      Tipp: Für die besten Treffer Marke und Modell kombinieren.
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* Step 2: Review Pricing Changes */}
          {step === 'review' && pricingChanges && (
            <div className="space-y-4">
              {(() => {
                const reviewSwaps = pricingChanges.selectedServiceSwaps?.length
                  ? pricingChanges.selectedServiceSwaps
                  : pricingChanges.selectedServiceSwap
                    ? [pricingChanges.selectedServiceSwap]
                    : []

                return (
              <Card className="order-device-change-info-card">
                <CardContent className="pt-5">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="mt-0.5 h-5 w-5 text-[#1a2a5e]" />
                    <div className="flex-1">
                      <p className="order-device-change-info-title">
                        Servicepreise werden aktualisiert
                      </p>
                      <p className="order-device-change-info-text">
                        Vor der finalen Bestätigung werden kompatible Services für dieses Gerät neu berechnet.
                      </p>
                    </div>
                  </div>

                  {reviewSwaps.length > 0 && (
                    <div className="order-device-change-review-swap">
                      <p className="order-device-change-review-swap-title">Gegenrechnung Reparaturservice</p>
                      {reviewSwaps.map((swap, idx) => (
                        <div key={`${swap.previousServiceName}-${swap.newServiceName}-${idx}`}>
                          <div className="order-device-change-review-swap-row">
                            <span>{swap.previousServiceName}</span>
                            <strong>{formatCurrency(swap.previousServicePrice)}</strong>
                          </div>
                          <div className="order-device-change-review-swap-row">
                            <span>{swap.newServiceName}</span>
                            <strong>{formatCurrency(swap.newServicePrice)}</strong>
                          </div>
                          <div className="order-device-change-review-swap-row is-total">
                            <span>Differenz</span>
                            <strong>
                              {swap.difference > 0 ? '+' : ''}
                              {formatCurrency(swap.difference)}
                            </strong>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
                )
              })()}

              {/* New Device Info */}
              <Card className="order-device-change-new-device-card">
                <CardHeader className="pb-2">
                  <CardTitle className="order-device-change-section-title text-sm">Neues Gerät</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="order-device-change-current-row">
                    <span className="order-device-change-current-name">
                      {pricingChanges.newDevice.brand} {pricingChanges.newDevice.model}
                    </span>
                    <Badge className="order-device-change-type-badge is-new">{pricingChanges.newDevice.type}</Badge>
                  </div>
                </CardContent>
              </Card>

              {/* Service Price Changes */}
              <div className="space-y-2">
                <Label className="order-device-change-section-title text-base font-semibold">Service-Preisveränderungen (Standardpreise brutto, vor Kundenrabatt)</Label>
                <div className="order-device-change-service-list">
                  {pricingChanges.serviceChanges.map((change, idx) => (
                    <Card key={idx} className="order-device-change-service-card">
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex-1">
                            <div className="order-device-change-service-name">{change.serviceName}</div>
                            <div className="order-device-change-service-prices">
                              {formatCurrency(change.originalPrice)} → {formatCurrency(change.newPrice)}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {change.status === 'increase' && (
                              <div className="order-device-change-diff increase">
                                <TrendingUp className="h-4 w-4" />
                                <span className="text-sm font-semibold">
                                  +{formatCurrency(Math.abs(change.difference))}
                                </span>
                              </div>
                            )}
                            {change.status === 'decrease' && (
                              <div className="order-device-change-diff decrease">
                                <TrendingDown className="h-4 w-4" />
                                <span className="text-sm font-semibold">
                                  −{formatCurrency(Math.abs(change.difference))}
                                </span>
                              </div>
                            )}
                            {change.status === 'no-change' && (
                              <span className="order-device-change-diff neutral">Keine Änderung</span>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              {/* Total Cost Summary */}
              <Card className="order-device-change-total-card">
                <CardHeader className="pb-2">
                  <CardTitle className="order-device-change-section-title text-sm">Änderung der Gesamtkosten</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[#636e85]">Auftragswert bisher (brutto):</span>
                    <span className="font-medium text-[#1a202c]">{formatCurrency(pricingChanges.totalCostBefore)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 border-t border-[#eceef3] pt-2">
                    <span className="text-[#636e85]">Auftragswert neu (brutto, nach Kundenrabatt):</span>
                    <span className="text-lg font-bold text-[#1a202c]">{formatCurrency(pricingChanges.totalCostAfter)}</span>
                  </div>
                  <div className="order-device-change-total-diff-row">
                    <span className="font-semibold text-[#1a202c]">Differenz:</span>
                    <div className="flex items-center gap-2">
                      {pricingChanges.totalCostStatus === 'increase' && (
                        <div className="order-device-change-diff increase">
                          <TrendingUp className="h-4 w-4" />
                          <span className="text-lg font-bold">
                            +{formatCurrency(pricingChanges.totalCostDifference)}
                          </span>
                        </div>
                      )}
                      {pricingChanges.totalCostStatus === 'decrease' && (
                        <div className="order-device-change-diff decrease">
                          <TrendingDown className="h-4 w-4" />
                          <span className="text-lg font-bold">
                            −{formatCurrency(Math.abs(pricingChanges.totalCostDifference))}
                          </span>
                        </div>
                      )}
                      {pricingChanges.totalCostStatus === 'no-change' && (
                        <span className="order-device-change-diff neutral">Keine Änderung</span>
                      )}
                    </div>
                  </div>
                  {pricingChanges.paymentAdjustment && (
                    <div className="space-y-1 border-t border-[#eceef3] pt-2 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[#636e85]">Bereits bezahlt:</span>
                        <span className="font-medium text-[#1a202c]">
                          {formatCurrency(pricingChanges.paymentAdjustment.paidAmount)}
                        </span>
                      </div>
                      {pricingChanges.paymentAdjustment.refundAmount > 0 && (
                        <div className="flex items-center justify-between gap-3 text-emerald-700">
                          <span className="font-semibold">Erstattung an Kunde:</span>
                          <span className="font-bold">
                            {formatCurrency(pricingChanges.paymentAdjustment.refundAmount)}
                          </span>
                        </div>
                      )}
                      {pricingChanges.paymentAdjustment.additionalPaymentAmount > 0 && (
                        <div className="flex items-center justify-between gap-3 text-amber-700">
                          <span className="font-semibold">Noch zu zahlen:</span>
                          <span className="font-bold">
                            {formatCurrency(pricingChanges.paymentAdjustment.additionalPaymentAmount)}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {pricingChanges.requiresConfirmation && (
                <Alert className="order-device-change-warning-alert">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Der Gerätewechsel ist bereits gespeichert. Aufgrund der Preisveränderung ist vor dem Fortfahren eine Kundenbestätigung erforderlich.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {/* Step 3: Confirmation */}
          {step === 'confirm' && (
            <div className="space-y-4">
              <Alert className="order-device-change-success-alert">
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  Die Geräteänderung ist bereit zur Bestätigung. Der Kunde wird automatisch informiert.
                </AlertDescription>
              </Alert>

              {pricingChanges && (
                <Card className="order-device-change-summary-card">
                  <CardHeader className="pb-2">
                    <CardTitle className="order-device-change-section-title text-sm">Zusammenfassung</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-[#636e85]">Altes Gerät:</span>
                      <span className="text-right font-semibold text-[#1a202c]">
                        {pricingChanges.originalDevice.brand} {pricingChanges.originalDevice.model}
                      </span>
                    </div>
                    {pricingChanges.bookedDevice
                      && `${pricingChanges.bookedDevice.brand} ${pricingChanges.bookedDevice.model}`
                         !== `${pricingChanges.originalDevice.brand} ${pricingChanges.originalDevice.model}` && (
                      <div className="flex items-start justify-between gap-3">
                        <span className="text-[#636e85]">Ursprünglich gebucht:</span>
                        <span className="text-right font-semibold text-[#1a202c]">
                          {pricingChanges.bookedDevice.brand} {pricingChanges.bookedDevice.model}
                        </span>
                      </div>
                    )}
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-[#636e85]">Neues Gerät:</span>
                      <span className="text-right font-semibold text-[#1a202c]">
                        {pricingChanges.newDevice.brand} {pricingChanges.newDevice.model}
                      </span>
                    </div>
                    <div className="flex items-start justify-between gap-3 border-t border-[#eceef3] pt-2">
                      <span className="text-[#636e85]">Änderung Gesamtkosten:</span>
                      <span className="text-right font-semibold text-[#1a202c]">
                        {pricingChanges.totalCostStatus === 'increase' ? '+' : ''}
                        {formatCurrency(pricingChanges.totalCostDifference)}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
          {step === 'select' && repricingPrompt && (
            <div role="alert" className="space-y-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              <p className="font-semibold">
                {repricingPrompt.outdated
                  ? 'Der Auftrag wurde inzwischen geändert – bitte die neue Abweichung prüfen'
                  : 'Gerätewechsel nicht gespeichert'}
              </p>
              <p>{repricingPrompt.message}</p>
              {repricingPrompt.details && (
                <dl className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs">
                  <dt>Gespeicherter Auftragswert</dt>
                  <dd className="text-right font-semibold">{formatCurrency(repricingPrompt.details.storedTotal)}</dd>
                  <dt>Positionen (Standardpreise brutto)</dt>
                  <dd className="text-right">{formatCurrency(repricingPrompt.details.positionsGross)}</dd>
                  <dt>Rabatt</dt>
                  <dd className="text-right">−{formatCurrency(repricingPrompt.details.discount)}</dd>
                  <dt>Positionen abzüglich Rabatt</dt>
                  <dd className="text-right">{formatCurrency(repricingPrompt.details.expectedTotal)}</dd>
                  <dt>Abweichung</dt>
                  <dd className="text-right font-semibold">
                    {repricingPrompt.details.difference > 0 ? '+' : repricingPrompt.details.difference < 0 ? '−' : ''}
                    {formatCurrency(Math.abs(repricingPrompt.details.difference))}
                  </dd>
                </dl>
              )}
              <p className="text-xs">{describeRepricingConsequence(repricingPrompt.details)}</p>
            </div>
          )}
        </div>

        <DialogFooter className="order-device-change-footer">
          <Button
            variant="outline"
            className="order-device-change-btn order-device-change-btn-secondary"
            onClick={handleClose}
            disabled={loading || confirming}
          >
            {tr('common.cancel', 'Abbrechen')}
          </Button>

          {step === 'select' && !repricingPrompt && (
            <Button
              className="order-device-change-btn order-device-change-btn-primary"
              onClick={() => void handleRecalculateServices()}
              disabled={!canProceedToRecalculation || loading || loadingCompatibleServices}
            >
              {loading ? 'Berechne neu...' : 'Gegenrechnung und Servicepreise berechnen'}
            </Button>
          )}

          {step === 'select' && repricingPrompt && (
            <Button
              variant="destructive"
              className="order-device-change-btn"
              onClick={() => void handleRecalculateServices(buildRepricingConfirmation(repricingPrompt.details))}
              disabled={!canProceedToRecalculation || loading || loadingCompatibleServices}
            >
              {loading ? 'Berechne neu...' : 'Neuberechnung bestätigen'}
            </Button>
          )}

          {step === 'review' && (
            <>
              <Button
                variant="outline"
                className="order-device-change-btn order-device-change-btn-secondary"
                onClick={() => {
                  setStep('select')
                  setSelectedDevice(null)
                }}
                disabled={loading}
              >
                {tr('common.back', 'Zurück')}
              </Button>
              <Button
                className="order-device-change-btn order-device-change-btn-primary"
                onClick={() => setStep('confirm')}
                disabled={loading}
              >
                Weiter zur Bestätigung
              </Button>
            </>
          )}

          {step === 'confirm' && (
            <>
              <Button
                variant="outline"
                className="order-device-change-btn order-device-change-btn-secondary"
                onClick={() => setStep('review')}
                disabled={confirming}
              >
                {tr('common.back', 'Zurück')}
              </Button>
              <Button
                className="order-device-change-btn order-device-change-btn-primary"
                onClick={handleConfirmDeviceChange}
                disabled={confirming}
              >
                {confirming ? 'Bestätige...' : 'Geräteänderung bestätigen'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
