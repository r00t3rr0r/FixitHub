import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Download,
  ExternalLink,
  FlaskConical,
  Loader2,
  Package,
  Printer,
  RefreshCw,
  Truck,
} from 'lucide-react'
import { useAdcellConfig } from '@/hooks/useAdcellConfig'
import { checkIsUserExcludedFromAdcell } from '@/api/marketingPromo'
import { SEO } from '@/components/SEO'
import { TopBar } from '@/components/home/TopBar'
import { McRepairNav } from '@/components/home/McRepairNav'
import { Footer } from '@/components/Footer'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/useToast'
import { formatMoney } from '@/lib/utils'
import { readLastCheckout, markAdcellSent, type LastCheckout } from '@/lib/lastCheckout'
import {
  createBookingInboundLabel,
  downloadInboundLabel,
  getBookingInboundLabel,
  printInboundLabel,
  type InboundLabelInfo,
  type InboundLabelView,
} from '@/api/bookings'
import { trackBooking } from '@/api/orderTracking'
import { downloadDataUrlPdf, labelFilename, printDataUrlPdf } from '@/api/labelPdf'

/**
 * Bestellbestaetigung nach dem Checkout (DHL-1, DHL-5, DHL-6, DHL-10).
 *
 * Angemeldet: /order-success?booking=<id> laedt den Einsendestatus vom Server
 * (GET /api/bookings/:id/inbound-label, Besitzpruefung) - auch nach dem Neuladen.
 * Gast: Kennungen aus sessionStorage ('lastCheckout') + Gast-Sendungsverfolgung (Token + E-Mail).
 * Betraege kommen immer vom Server bzw. aus der Serverantwort, nie aus der URL.
 */

const POLL_INTERVAL_MS = 3000
const POLL_MAX_MS = 60000
const DHL_TRACKING_URL = 'https://www.dhl.de/de/privatkunden/pakete-empfangen/verfolgen.html?piececode='

type LoadState =
  | { status: 'loading' }
  | { status: 'ready' }
  | { status: 'error'; message: string; httpStatus?: number }
  | { status: 'no-data' }

interface GuestView {
  bookingNumber: string
  totalCost: number | null
  currency: string
  paymentStatus: string
  billingStatus: string
  paymentMethod: string
  deviceCount: number
  orders: Array<{ orderNumber: string; device: string }>
  labelDataUrl: string
  trackingNumber: string
  placeholder: boolean
  trackingLink: string
  hasRepair: boolean
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  paypal: 'PayPal',
  card: 'Karte',
  invoice: 'Rechnung',
}

const describePayment = (paymentStatus?: string, billingStatus?: string, paymentMethod?: string): string => {
  const method = PAYMENT_METHOD_LABELS[String(paymentMethod || '')] || ''
  if (paymentStatus === 'paid' || billingStatus === 'paid') {
    return `Zahlung: bezahlt${method ? ` (${method})` : ''}`
  }
  if (paymentMethod === 'invoice') {
    return 'Zahlung ausstehend – Sie erhalten eine Rechnung.'
  }
  return `Zahlung ausstehend${method ? ` (${method})` : ''}`
}

const deviceCountText = (count: number) => (count === 1 ? '1 Gerät' : `${count} Geräte`)

export function OrderSuccessPage() {
  const { toast } = useToast()
  const [searchParams] = useSearchParams()
  const adcell = useAdcellConfig()
  const adcellFired = useRef(false)
  const [isExcludedFromTracking, setIsExcludedFromTracking] = useState<boolean | null>(null)

  // Uebergabe aus dem Checkout - bleibt beim Lesen erhalten (Neuladen zeigt dieselbe Buchung).
  const lastCheckout = useMemo<LastCheckout | null>(() => readLastCheckout(), [])
  const bookingIdParam = searchParams.get('booking') || ''
  const accountBookingId = /^[a-f0-9]{24}$/i.test(bookingIdParam)
    ? bookingIdParam
    : (!bookingIdParam && lastCheckout?.kind === 'account' && lastCheckout.bookingId ? lastCheckout.bookingId : '')
  const guestCheckout = !accountBookingId && lastCheckout?.kind === 'guest' ? lastCheckout : null

  const [loadState, setLoadState] = useState<LoadState>({ status: 'loading' })
  const [view, setView] = useState<InboundLabelView | null>(null)
  const [guestView, setGuestView] = useState<GuestView | null>(null)
  const [busyAction, setBusyAction] = useState<'' | 'download' | 'print' | 'create'>('')
  const [pollingExpired, setPollingExpired] = useState(false)
  const pollStartedAt = useRef<number | null>(null)

  useEffect(() => {
    checkIsUserExcludedFromAdcell()
      .then((excluded) => setIsExcludedFromTracking(Boolean(excluded)))
      .catch(() => setIsExcludedFromTracking(false))
  }, [])

  // ── Daten laden ──
  const loadAccount = useCallback(async (silent = false) => {
    if (!accountBookingId) return
    if (!silent) setLoadState({ status: 'loading' })
    try {
      const data = await getBookingInboundLabel(accountBookingId)
      setView(data)
      setLoadState({ status: 'ready' })
    } catch (error: any) {
      setLoadState({
        status: 'error',
        httpStatus: error?.status,
        message: error?.message || 'Ihre Buchung konnte nicht geladen werden.',
      })
    }
  }, [accountBookingId])

  const loadGuest = useCallback(async () => {
    if (!guestCheckout) return
    setLoadState({ status: 'loading' })
    if (!guestCheckout.bookingTrackingToken || !guestCheckout.guestEmail) {
      setLoadState({ status: 'ready' })
      return
    }
    try {
      const data = await trackBooking({ token: guestCheckout.bookingTrackingToken, email: guestCheckout.guestEmail })
      const booking = data?.booking || {}
      const orders: any[] = Array.isArray(data?.orders) ? data.orders : []
      const repairOrders = orders.filter((order: any) => order?.deviceType !== 'Shop Products')
      const labelDataUrl = typeof booking.shippingLabelUrl === 'string' ? booking.shippingLabelUrl : ''
      const trackingNumber = String(booking.trackingNumber || '')
      const trackingLink = `/track-order/booking?token=${encodeURIComponent(guestCheckout.bookingTrackingToken)}&email=${encodeURIComponent(guestCheckout.guestEmail)}`
      setGuestView({
        bookingNumber: booking.bookingNumber || guestCheckout.bookingNumber,
        totalCost: Number.isFinite(Number(booking.totalCost)) ? Number(booking.totalCost) : guestCheckout.totalAmount,
        currency: booking.currency || 'EUR',
        paymentStatus: booking.paymentStatus || '',
        billingStatus: booking.billingStatus || '',
        paymentMethod: booking.paymentMethod || '',
        deviceCount: repairOrders.length,
        orders: repairOrders.map((order: any) => ({
          orderNumber: order.orderNumber || '',
          device: `${order.deviceBrand || ''} ${order.deviceModel || ''}`.trim(),
        })),
        labelDataUrl,
        trackingNumber,
        placeholder: trackingNumber.startsWith('DHL-DUMMY-'),
        trackingLink,
        hasRepair: repairOrders.length > 0 || orders.length === 0,
      })
      setLoadState({ status: 'ready' })
    } catch (error: any) {
      setLoadState({
        status: 'error',
        message: error?.message || 'Ihre Buchung konnte nicht geladen werden.',
      })
    }
  }, [guestCheckout])

  useEffect(() => {
    if (accountBookingId) {
      void loadAccount()
    } else if (guestCheckout) {
      void loadGuest()
    } else {
      setLoadState({ status: 'no-data' })
    }
  }, [accountBookingId, guestCheckout, loadAccount, loadGuest])

  // ── Automatische Aktualisierung, solange das Label erstellt wird (max. ~60 s) ──
  const inbound: InboundLabelInfo | null = view?.inbound || null
  useEffect(() => {
    if (inbound?.state !== 'creating') {
      pollStartedAt.current = null
      return
    }
    if (pollStartedAt.current === null) pollStartedAt.current = Date.now()
    if (Date.now() - pollStartedAt.current > POLL_MAX_MS) {
      setPollingExpired(true)
      return
    }
    const timer = window.setTimeout(() => { void loadAccount(true) }, POLL_INTERVAL_MS)
    return () => window.clearTimeout(timer)
  }, [inbound?.state, view, loadAccount])

  // ── ADCELL: genau einmal je Checkout, mit Serverwerten (DHL-10) ──
  useEffect(() => {
    if (adcellFired.current || !adcell.enabled || isExcludedFromTracking !== false) return
    if (!lastCheckout?.adcellPending) return

    let referenz = ''
    let total = 0
    let orderCount = 0
    if (lastCheckout.kind === 'account') {
      if (!view?.booking || String(view.booking._id) !== String(lastCheckout.bookingId)) return
      referenz = view.booking.bookingNumber
      total = Number(view.booking.totalCost || 0)
      orderCount = view.orders.length
    } else {
      if (loadState.status === 'loading') return
      referenz = guestView?.bookingNumber || lastCheckout.bookingNumber || lastCheckout.orderNumbers[0] || ''
      total = Number(lastCheckout.totalAmount || 0)
      orderCount = lastCheckout.orderCount || lastCheckout.orderNumbers.length
    }
    if (!referenz) return

    adcellFired.current = true
    markAdcellSent()

    const { pid, eventId } = adcell
    const betrag = total.toFixed(2)
    if (adcell.conversionEnabled) {
      const script = document.createElement('script')
      script.type = 'text/javascript'
      script.async = true
      script.src = `https://t.adcell.com/t/track.js?pid=${pid}&eventid=${eventId}&referenz=${encodeURIComponent(referenz)}&betrag=${betrag}`
      document.body.appendChild(script)

      const img = document.createElement('img')
      img.src = `https://t.adcell.com/t/track?pid=${pid}&eventid=${eventId}&referenz=${encodeURIComponent(referenz)}&betrag=${betrag}`
      img.width = 1
      img.height = 1
      img.setAttribute('border', '0')
      img.setAttribute('aria-hidden', 'true')
      img.style.position = 'absolute'
      img.style.visibility = 'hidden'
      document.body.appendChild(img)
    }
    if (adcell.containerTagsEnabled) {
      const containerScript = document.createElement('script')
      containerScript.type = 'text/javascript'
      containerScript.async = true
      containerScript.src =
        `https://t.adcell.com/js/inlineretarget.js?method=checkout` +
        `&pid=${pid}` +
        `&basketId=${encodeURIComponent(referenz)}` +
        `&basketTotal=${betrag}` +
        `&basketProductCount=${orderCount}` +
        `&productIds=&productSeparator=,&quantities=`
      document.body.appendChild(containerScript)
    }
  }, [adcell, isExcludedFromTracking, lastCheckout, view, guestView, loadState.status])

  // ── Aktionen ──
  const showError = (message: string) => {
    toast({ title: 'Fehler', description: message, variant: 'destructive' })
  }

  const handleDownload = async () => {
    setBusyAction('download')
    try {
      if (inbound) {
        await downloadInboundLabel(inbound)
      } else if (guestView?.labelDataUrl) {
        await downloadDataUrlPdf(guestView.labelDataUrl, labelFilename('inbound', guestView.bookingNumber, guestView.placeholder))
      }
    } catch (error: any) {
      showError(error?.message || 'Das Einsendelabel konnte nicht heruntergeladen werden.')
    } finally {
      setBusyAction('')
    }
  }

  const handlePrint = async () => {
    setBusyAction('print')
    try {
      if (inbound) {
        await printInboundLabel(inbound)
      } else if (guestView?.labelDataUrl) {
        await printDataUrlPdf(guestView.labelDataUrl)
      }
    } catch (error: any) {
      showError(error?.message || 'Das Einsendelabel konnte nicht gedruckt werden.')
    } finally {
      setBusyAction('')
    }
  }

  const handleCreate = async () => {
    if (!accountBookingId) return
    setBusyAction('create')
    try {
      const data = await createBookingInboundLabel(accountBookingId)
      setView(data)
      setPollingExpired(false)
      toast({
        title: 'Einsendelabel',
        description: data?.inbound?.state === 'ready'
          ? 'Ihr DHL-Einsendelabel ist bereit.'
          : (data?.inbound?.message || 'Ihr Einsendelabel wurde angefordert.'),
      })
    } catch (error: any) {
      showError(error?.message || 'Das Einsendelabel konnte nicht erstellt werden.')
      void loadAccount(true)
    } finally {
      setBusyAction('')
    }
  }

  // ── Anzeige-Daten ──
  const headerBookingNumber = view?.booking?.bookingNumber || guestView?.bookingNumber || lastCheckout?.bookingNumber || ''
  const deviceCount = view?.booking?.deviceCount ?? guestView?.deviceCount ?? 0
  const totalCost = view?.booking ? view.booking.totalCost : (guestView?.totalCost ?? null)
  const currency = view?.booking?.currency || guestView?.currency || 'EUR'
  const paymentLine = view?.booking
    ? describePayment(view.booking.paymentStatus, view.booking.billingStatus, view.booking.paymentMethod)
    : guestView
      ? describePayment(guestView.paymentStatus, guestView.billingStatus, guestView.paymentMethod)
      : ''
  const repairOrders = (view?.orders || []).filter((order) => order.type === 'repair')
  const isGuest = Boolean(guestCheckout)
  const notNeeded = inbound?.state === 'not-needed' || (isGuest && guestView && !guestView.hasRepair)

  const subline = [
    headerBookingNumber ? `Buchung ${headerBookingNumber}` : '',
    deviceCount > 0 ? deviceCountText(deviceCount) : '',
    totalCost !== null && Number.isFinite(totalCost) ? `Gesamt ${formatMoney(totalCost, currency)}` : '',
  ].filter(Boolean).join(' · ')

  // ── Primaerkarte "Gerät an McRepair senden" ──
  const renderLabelActions = (placeholder: boolean) => (
    <div className="flex flex-col gap-2 sm:flex-row">
      <Button
        type="button"
        onClick={handleDownload}
        disabled={busyAction !== ''}
        className="h-11 w-full sm:w-auto font-semibold"
        style={{ backgroundColor: 'var(--accent-yellow)', color: 'var(--primary-blue)' }}
      >
        {busyAction === 'download' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <Download className="mr-2 h-4 w-4" aria-hidden="true" />}
        {placeholder ? 'Testlabel herunterladen' : 'DHL-Einsendelabel herunterladen'}
      </Button>
      <Button
        type="button"
        variant="outline"
        onClick={handlePrint}
        disabled={busyAction !== ''}
        className="h-11 w-full sm:w-auto font-semibold"
        style={{ borderColor: 'var(--primary-blue)', color: 'var(--primary-blue)' }}
      >
        {busyAction === 'print' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <Printer className="mr-2 h-4 w-4" aria-hidden="true" />}
        Label drucken
      </Button>
    </div>
  )

  const renderTrackingLine = (trackingNumber: string, placeholder: boolean) => {
    if (!trackingNumber) return null
    if (placeholder) {
      return <p className="text-sm text-gray-600">Testsendungsnummer {trackingNumber} – keine DHL-Sendungsverfolgung.</p>
    }
    return (
      <p className="text-sm text-gray-700">
        Sendungsnummer <span className="font-mono font-semibold">{trackingNumber}</span>
        {' · '}
        <a
          href={`${DHL_TRACKING_URL}${encodeURIComponent(trackingNumber)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold underline"
          style={{ color: 'var(--primary-blue)' }}
        >
          Sendung verfolgen <ExternalLink className="inline h-3 w-3" aria-hidden="true" />
        </a>
      </p>
    )
  }

  const placeholderBadge = (
    <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900" role="note">
      <FlaskConical className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
      <span><strong>Testlabel – nicht für den Versand verwenden.</strong> Im Testmodus werden keine echten DHL-Labels erzeugt.</span>
    </div>
  )

  const renderAccountInbound = () => {
    if (!inbound) return null
    switch (inbound.state) {
      case 'ready':
        return (
          <div className="space-y-3">
            {inbound.placeholder && placeholderBadge}
            <p className="text-sm text-gray-700">
              Drucken Sie das kostenlose DHL-Einsendelabel aus, verpacken Sie Ihr Gerät sicher und geben Sie das Paket in einer
              DHL-Filiale oder Packstation ab. Ein Paket für alle Geräte dieser Buchung.
            </p>
            {renderLabelActions(inbound.placeholder)}
            {renderTrackingLine(inbound.trackingNumber, inbound.placeholder)}
            <p className="text-xs text-gray-500">Sie finden das Label jederzeit in Ihrem Auftrag und unter „Buchungen“.</p>
          </div>
        )
      case 'registered':
        return (
          <div className="space-y-2">
            <p className="text-sm text-gray-700">{inbound.message}</p>
            {renderTrackingLine(inbound.trackingNumber, inbound.placeholder)}
          </div>
        )
      case 'creating':
        return (
          <div className="space-y-2">
            <Button type="button" disabled className="h-11 w-full sm:w-auto font-semibold">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              Ihr DHL-Einsendelabel wird erstellt …
            </Button>
            {pollingExpired && (
              <p className="text-sm text-gray-700">Das dauert länger als üblich. Das Label erscheint in Kürze in Ihrem Auftrag und unter „Buchungen“.</p>
            )}
          </div>
        )
      case 'review':
        return (
          <div className="flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
            <ClipboardList className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
            <span>{inbound.message}</span>
          </div>
        )
      case 'error':
      case 'none':
        return (
          <div className="space-y-3">
            {inbound.state === 'error' && (
              <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900">
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
                <span>{inbound.message}</span>
              </div>
            )}
            {inbound.state === 'none' && <p className="text-sm text-gray-700">{inbound.message}</p>}
            {inbound.canCreate && (
              <Button
                type="button"
                onClick={handleCreate}
                disabled={busyAction !== ''}
                className="h-11 w-full sm:w-auto font-semibold"
                style={{ backgroundColor: 'var(--accent-yellow)', color: 'var(--primary-blue)' }}
              >
                {busyAction === 'create'
                  ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                  : (inbound.state === 'error' ? <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" /> : <Package className="mr-2 h-4 w-4" aria-hidden="true" />)}
                {inbound.state === 'error' ? 'Erneut versuchen: DHL-Einsendelabel erstellen' : 'DHL-Einsendelabel erstellen'}
              </Button>
            )}
            {inbound.canCreate && <p className="text-xs text-gray-500">Das Label ist für Sie kostenlos.</p>}
          </div>
        )
      case 'cancelled':
        return <p className="text-sm text-gray-700">{inbound.message}</p>
      default:
        return null
    }
  }

  const renderGuestInbound = () => {
    if (!guestView) {
      return <p className="text-sm text-gray-700">Ihr Einsendelabel senden wir Ihnen per E-Mail, sobald es bereitsteht.</p>
    }
    if (!guestView.labelDataUrl) {
      return (
        <div className="space-y-2">
          <p className="text-sm text-gray-700">Ihr Einsendelabel senden wir Ihnen per E-Mail, sobald es bereitsteht.</p>
          {renderTrackingLine(guestView.trackingNumber, guestView.placeholder)}
        </div>
      )
    }
    return (
      <div className="space-y-3">
        {guestView.placeholder && placeholderBadge}
        <p className="text-sm text-gray-700">
          Drucken Sie das kostenlose DHL-Einsendelabel aus, verpacken Sie Ihr Gerät sicher und geben Sie das Paket in einer
          DHL-Filiale oder Packstation ab. Ein Paket für alle Geräte dieser Buchung.
        </p>
        {renderLabelActions(guestView.placeholder)}
        {renderTrackingLine(guestView.trackingNumber, guestView.placeholder)}
        <p className="text-xs text-gray-500">Das Label finden Sie auch im Anhang Ihrer Bestätigungs-E-Mail und in der Sendungsverfolgung.</p>
      </div>
    )
  }

  const renderBody = () => {
    if (loadState.status === 'loading') {
      return (
        <div className="flex items-center gap-2 text-sm text-gray-700" role="status">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Wird geladen …
        </div>
      )
    }
    if (loadState.status === 'error') {
      if (loadState.httpStatus === 401) {
        return (
          <div className="space-y-3">
            <p className="text-sm text-gray-700">Bitte melden Sie sich an, um Ihr Einsendelabel abzurufen.</p>
            <Button asChild className="h-11 w-full sm:w-auto font-semibold">
              <Link to={`/login?returnTo=${encodeURIComponent(`${window.location.pathname}${window.location.search}`)}`}>Anmelden</Link>
            </Button>
          </div>
        )
      }
      if (loadState.httpStatus === 403 || loadState.httpStatus === 404) {
        return <p className="text-sm text-gray-700">Buchung nicht gefunden. Ihre Buchungen finden Sie unter „Buchungen“.</p>
      }
      return (
        <div className="space-y-3">
          <p className="text-sm text-gray-700">Ihre Buchung konnte nicht geladen werden.</p>
          <Button type="button" variant="outline" onClick={() => (accountBookingId ? loadAccount() : loadGuest())} className="h-11">
            <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" /> Erneut versuchen
          </Button>
        </div>
      )
    }
    if (loadState.status === 'no-data') {
      return (
        <p className="text-sm text-gray-700">
          Ihre Bestellung ist eingegangen. Alle Details finden Sie in Ihrer Bestätigungs-E-Mail und – mit Kundenkonto – unter „Buchungen“.
        </p>
      )
    }
    return null
  }

  const showSendCard = loadState.status === 'ready' && !notNeeded
  const steps = [
    'Label drucken',
    'Gerät verpacken (ohne Zubehör, Displaysperre wie bei der Buchung angegeben)',
    'Paket bei DHL abgeben (Filiale oder Packstation)',
    'Wir melden uns nach der Eingangsprüfung',
  ]

  return (
    <div style={{ backgroundColor: 'var(--off-white)', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <SEO
        title="Bestellung eingegangen – McRepair.de"
        description="Vielen Dank für Ihre Bestellung bei McRepair.de. Hier finden Sie Ihr DHL-Einsendelabel und die nächsten Schritte."
        canonical="/order-success"
        noindex={true}
      />
      <TopBar />
      <McRepairNav />

      <section className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:py-12">
        <Card className="w-full border-0 shadow-xl" style={{ borderRadius: 'var(--radius-lg)' }}>
          <div
            className="flex items-start gap-4 p-5 sm:p-6"
            style={{
              background: 'linear-gradient(135deg, var(--primary-blue), var(--primary-blue-light))',
              borderTopLeftRadius: 'var(--radius-lg)',
              borderTopRightRadius: 'var(--radius-lg)',
            }}
          >
            <CheckCircle2 className="h-10 w-10 flex-shrink-0" style={{ color: '#22c55e' }} aria-hidden="true" />
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-white sm:text-2xl">Vielen Dank! Ihre Bestellung ist eingegangen.</h1>
              {subline && <p className="mt-1 break-words text-sm text-white/90">{subline}</p>}
              {paymentLine && <p className="mt-1 text-sm text-white/90">{paymentLine}</p>}
            </div>
          </div>

          <CardContent className="space-y-6 p-5 sm:p-6">
            {renderBody()}

            {showSendCard && (
              <section
                aria-labelledby="send-device-title"
                className="rounded-lg border-2 p-4 sm:p-5"
                style={{ borderColor: 'var(--accent-yellow)', backgroundColor: '#fffdf3' }}
              >
                <h2 id="send-device-title" className="mb-3 flex items-center gap-2 text-lg font-bold" style={{ color: 'var(--primary-blue)' }}>
                  <Truck className="h-5 w-5" aria-hidden="true" />
                  Nächster Schritt: Gerät an McRepair senden
                </h2>
                <div aria-live="polite">
                  {isGuest ? renderGuestInbound() : renderAccountInbound()}
                </div>
              </section>
            )}

            {loadState.status === 'ready' && notNeeded && (
              <p className="text-sm text-gray-700">
                Für Shop-Artikel ist keine Einsendung nötig. Wir senden Ihre Bestellung an Ihre Lieferadresse.
              </p>
            )}

            {showSendCard && inbound?.state !== 'cancelled' && (
              <div>
                <h2 className="mb-2 text-sm font-semibold" style={{ color: 'var(--primary-blue)' }}>So geht es weiter</h2>
                <ol className="space-y-2 text-sm" style={{ color: 'var(--gray-700)' }}>
                  {steps.map((step, index) => (
                    <li key={step} className="flex items-start gap-3">
                      <span
                        className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold"
                        style={{ backgroundColor: 'var(--primary-blue)', color: '#fff' }}
                        aria-hidden="true"
                      >
                        {index + 1}
                      </span>
                      <span className="pt-0.5">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* Auftraege der Buchung - direkte Links (nur mit Kundenkonto) */}
            {!isGuest && repairOrders.length > 0 && (
              <div>
                <h2 className="mb-2 text-sm font-semibold" style={{ color: 'var(--primary-blue)' }}>
                  {repairOrders.length === 1 ? 'Ihr Reparaturauftrag' : 'Ihre Reparaturaufträge'}
                </h2>
                <ul className="divide-y rounded-md border text-sm">
                  {repairOrders.map((order) => (
                    <li key={order.orderId} className="flex flex-wrap items-center justify-between gap-2 p-3">
                      <span className="min-w-0 break-words">
                        <span className="font-medium">{order.device || 'Gerät'}</span>
                        {order.orderNumber && <span className="text-gray-600"> – {order.orderNumber}</span>}
                      </span>
                      <Link
                        to={`/orders/${order.orderId}`}
                        className="font-semibold underline"
                        style={{ color: 'var(--primary-blue)' }}
                      >
                        {repairOrders.length === 1 && order.orderNumber ? `Zum Auftrag ${order.orderNumber}` : 'Auftrag öffnen'}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {isGuest && guestView && guestView.orders.length > 0 && (
              <div>
                <h2 className="mb-2 text-sm font-semibold" style={{ color: 'var(--primary-blue)' }}>Ihre Reparaturaufträge</h2>
                <ul className="divide-y rounded-md border text-sm">
                  {guestView.orders.map((order) => (
                    <li key={order.orderNumber || order.device} className="p-3">
                      <span className="font-medium">{order.device || 'Gerät'}</span>
                      {order.orderNumber && <span className="text-gray-600"> – {order.orderNumber}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex flex-col gap-2 border-t border-gray-200 pt-4 sm:flex-row sm:flex-wrap">
              {isGuest && guestView?.trackingLink ? (
                <Button asChild variant="outline" className="h-11 font-semibold" style={{ borderColor: 'var(--primary-blue)', color: 'var(--primary-blue)' }}>
                  <Link to={guestView.trackingLink}>Sendungsverfolgung öffnen</Link>
                </Button>
              ) : !isGuest ? (
                <Button asChild variant="outline" className="h-11 font-semibold" style={{ borderColor: 'var(--primary-blue)', color: 'var(--primary-blue)' }}>
                  <Link to="/bookings">Alle Buchungen</Link>
                </Button>
              ) : null}
              <Button asChild variant="ghost" className="h-11 font-semibold" style={{ color: 'var(--primary-blue)' }}>
                <Link to="/shop">Weiter einkaufen</Link>
              </Button>
            </div>

            <p className="text-center text-xs" style={{ color: 'var(--gray-600)' }}>
              Fragen zu Ihrer Bestellung?{' '}
              <Link to="/contact" className="font-semibold underline" style={{ color: 'var(--primary-blue)' }}>
                Kontakt aufnehmen
              </Link>
            </p>
          </CardContent>
        </Card>
      </section>

      <Footer />
    </div>
  )
}
