import { useEffect, useMemo, useRef, useState } from "react"
import { Link, useLocation, useSearchParams } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/useToast"
import { getAdminOrders, AdminOrder } from "@/api/adminOrders"
import api from "@/api/api"
import { formatEUR } from "@/lib/utils"
import { buildOrderDetailsState, getOrderDetailsPath } from "@/lib/orderDetailsNavigation"
import { rememberListScroll, restoreListScroll } from "@/lib/listScrollMemory"
import {
  Package,
  Search,
  Filter,
  Clock,
  CheckCircle,
  AlertTriangle,
  AlertCircle,
  MessageSquareWarning,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  X
} from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

/**
 * "Reparaturaufträge" (/admin/orders): ein Auftrag (ORD-…) je Gerät.
 *
 * 01.10.2026 (ADMUX-6, HIST-2/HIST-18):
 *  - Gast-Aufträge und Aufträge gelöschter Kunden bringen die Seite nicht mehr zum Absturz
 *    (customerId ist bei Gästen leer).
 *  - Die bis zu 100 doppelten "Auftragsdetails"-Karten mit rohem Verlauf (englische Schlüssel)
 *    unter der Tabelle entfallen: das Auftragsdetail /orders/:id ist die EINE Detailseite und
 *    zeigt den Verlauf mit deutschen Titeln (GET /api/orders/:id/history).
 *  - Der tote Bearbeiten-Stift entfällt; "Auftrag öffnen" ist ein echter Link (Tastatur).
 *  - Statuswechsel nur noch im Auftragsdetail (dort mit Verlauf, Grund und Kundenbenachrichtigung);
 *    der Inline-Statusumschalter ohne Grund/Rückfrage entfällt.
 *  - Suche, Filter und Seite stehen in der URL und bleiben beim Zurückkehren erhalten.
 */

// Antwort von GET /api/repair-workflows/admin/awaiting-customer-feedback
interface AwaitingFeedbackEntry {
  orderId: string
  since?: string | null
  overdue?: boolean
  reasons: Array<{ type: string; label: string; detail?: string; since?: string | null }>
}

interface OrderStats {
  pending?: number
  inProgress?: number
  qualityCheck?: number
  completed?: number
  // Additiv (OrderService.getOrderStats): alle Aufträge / Priorität Hoch oder Dringend.
  total?: number
  highOrUrgent?: number
}

const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: "Ausstehend",
  "diagnostic-assessment": "Diagnosebewertung",
  "in-progress": "In Bearbeitung",
  paused: "Pausiert",
  "quality-check": "Qualitätsprüfung",
  "ready-for-pickup": "Reparatur abgeschlossen",
  completed: "Abgeschlossen",
  cancelled: "Storniert",
}

const ORDER_STATUS_CLASSES: Record<string, string> = {
  pending: "bg-slate-100 text-slate-800 border-slate-300",
  "diagnostic-assessment": "bg-purple-100 text-purple-800 border-purple-300",
  "in-progress": "bg-blue-100 text-blue-800 border-blue-300",
  paused: "bg-gray-100 text-gray-700 border-gray-300",
  "quality-check": "bg-cyan-100 text-cyan-800 border-cyan-300",
  "ready-for-pickup": "bg-teal-100 text-teal-800 border-teal-300",
  completed: "bg-green-100 text-green-800 border-green-300",
  cancelled: "bg-red-100 text-red-800 border-red-300",
}

const PRIORITY_LABELS: Record<string, string> = {
  low: "Niedrig",
  normal: "Normal",
  high: "Hoch",
  urgent: "Dringend",
}

// Order.paymentStatus wird serverseitig aus den Belegen/Zahlungen abgeleitet
// (FinancialService.syncOrderPaymentTracking) - hier nur anzeigen, nie nachrechnen.
const PAYMENT_STATUS_LABELS: Record<string, { label: string; className: string }> = {
  pending: { label: "Offen", className: "bg-slate-100 text-slate-700 border-slate-300" },
  partial: { label: "Teilbezahlt", className: "bg-amber-100 text-amber-800 border-amber-300" },
  paid: { label: "Bezahlt", className: "bg-emerald-100 text-emerald-800 border-emerald-300" },
  refunded: { label: "Erstattet", className: "bg-violet-100 text-violet-800 border-violet-300" },
}

// Serverseitige Seiten: Suche, Status, Priorität und "Warten auf Kundenrückmeldung" filtern ALLE
// Aufträge (GET /api/admin/orders), nicht nur die zuletzt geladenen.
const PAGE_SIZE = 25
const LIST_SCROLL_KEY = 'adminOrdersListScroll'

type AnyOrder = AdminOrder & {
  customerId?: (AdminOrder['customerId'] & { firstName?: string; lastName?: string }) | null
  guestInfo?: { email?: string; firstName?: string; lastName?: string; isGuest?: boolean }
  customerEmail?: string
}

/** Kundenanzeige null-sicher: registrierter Kunde, sonst Gastangaben, sonst "Gast". */
const getOrderCustomer = (order: AnyOrder) => {
  const customer = order.customerId
  if (customer && typeof customer === 'object') {
    const name = customer.name || [customer.firstName, customer.lastName].filter(Boolean).join(' ') || customer.email || 'Kunde'
    return { name, email: customer.email || '', isGuest: false }
  }
  const guestName = [order.guestInfo?.firstName, order.guestInfo?.lastName].filter(Boolean).join(' ')
  const email = order.guestInfo?.email || order.customerEmail || ''
  return { name: guestName || email || 'Gast', email, isGuest: true }
}

const getStaffNames = (order: AnyOrder) => (Array.isArray(order.assignedStaff) ? order.assignedStaff : [])
  .map((staff: any) => staff?.name || (staff?.staffId && typeof staff.staffId === 'object' ? staff.staffId.name : '') || '')
  .filter(Boolean)

const formatDate = (value?: string) => {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('de-DE')
}

export function OrderManagement() {
  const { t } = useTranslation()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const [orders, setOrders] = useState<AnyOrder[]>([])
  // Treffer der aktuellen Filter laut Server (nicht nur die geladene Seite).
  const [totalOrders, setTotalOrders] = useState(0)
  const [serverTotalPages, setServerTotalPages] = useState(1)
  const [stats, setStats] = useState<OrderStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [initialLoadDone, setInitialLoadDone] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)
  const [searchTerm, setSearchTerm] = useState(() => searchParams.get('q') || "")
  const [debouncedSearch, setDebouncedSearch] = useState(() => (searchParams.get('q') || "").trim())
  const [statusFilter, setStatusFilter] = useState(() => searchParams.get('status') || "all")
  const [priorityFilter, setPriorityFilter] = useState(() => searchParams.get('prio') || "all")
  const [feedbackFilter, setFeedbackFilter] = useState<"all" | "awaiting">(() => (searchParams.get('rueckmeldung') === 'offen' ? 'awaiting' : 'all'))
  const [page, setPage] = useState(() => Math.max(1, parseInt(searchParams.get('seite') || '1', 10) || 1))
  const [awaitingByOrder, setAwaitingByOrder] = useState<Record<string, AwaitingFeedbackEntry>>({})
  const [awaitingTotal, setAwaitingTotal] = useState<number | null>(null)
  const [awaitingState, setAwaitingState] = useState<'loading' | 'ready' | 'error'>('loading')
  const scrollRestoredRef = useRef(false)
  const { toast } = useToast()

  // Filter-Schluessel: aendert er sich gegenueber dem letzten Abruf, beginnt die Liste bei Seite 1.
  // Vergleich mit dem VORHERIGEN Wert (statt "erster Lauf"-Ref) - so setzt weder das Wiederherstellen
  // aus der URL noch der doppelte Effektlauf unter React.StrictMode die gemerkte Seite zurueck.
  const filterKey = JSON.stringify([debouncedSearch, statusFilter, priorityFilter, feedbackFilter])
  const lastFilterKeyRef = useRef(filterKey)
  const awaitingIds = useMemo(() => Object.keys(awaitingByOrder).sort(), [awaitingByOrder])
  const awaitingIdsKey = feedbackFilter === 'awaiting' ? awaitingIds.join(',') : ''
  // Der Ladezustand der Rückmeldungsliste löst nur beim Filter "Warten auf Kundenrückmeldung" einen Abruf aus.
  const awaitingGate = feedbackFilter === 'awaiting' ? awaitingState : 'unused'

  useEffect(() => {
    if (searchTerm.trim() === debouncedSearch) return
    const timer = window.setTimeout(() => setDebouncedSearch(searchTerm.trim()), 400)
    return () => window.clearTimeout(timer)
  }, [searchTerm])

  // "Warten auf Kundenrückmeldung" kommt vom Server (nur echte Rückfragen, keine normalen
  // Nachrichten) und gilt für ALLE offenen Aufträge. Ein Fehler hier blockiert die Liste nicht.
  useEffect(() => {
    let cancelled = false
    setAwaitingState('loading')
    api.get('/api/repair-workflows/admin/awaiting-customer-feedback')
      .then((awaitingResponse) => {
        if (cancelled) return
        const entries: AwaitingFeedbackEntry[] = awaitingResponse.data?.orders || []
        setAwaitingByOrder(Object.fromEntries(entries.map((entry) => [String(entry.orderId), entry])))
        setAwaitingTotal(entries.length)
        setAwaitingState('ready')
      })
      .catch((awaitingError) => {
        console.error("Error fetching awaiting customer feedback:", awaitingError)
        if (cancelled) return
        setAwaitingByOrder({})
        setAwaitingTotal(null)
        setAwaitingState('error')
      })
    return () => { cancelled = true }
  }, [reloadToken])

  // Aktuelle Seite mit den aktuellen Filtern vom Server laden.
  useEffect(() => {
    if (lastFilterKeyRef.current !== filterKey) {
      lastFilterKeyRef.current = filterKey
      if (page !== 1) {
        setPage(1)
        return
      }
    }
    if (feedbackFilter === 'awaiting' && awaitingState === 'loading') {
      return
    }
    let cancelled = false
    const fetchOrders = async () => {
      try {
        setLoading(true)
        if (feedbackFilter === 'awaiting' && awaitingState === 'error') {
          throw new Error('Die Liste „Warten auf Kundenrückmeldung“ konnte nicht geladen werden.')
        }
        const response = await getAdminOrders({
          page,
          limit: PAGE_SIZE,
          search: debouncedSearch || undefined,
          status: statusFilter !== 'all' ? statusFilter : undefined,
          priority: priorityFilter !== 'all' ? priorityFilter : undefined,
          ...(feedbackFilter === 'awaiting' ? { ids: awaitingIds } : {}),
        })
        if (cancelled) return
        const ordersData: AnyOrder[] = (response as any).orders || []
        const totalPages = Math.max(1, Number((response as any).totalPages) || 1)
        setOrders(ordersData)
        setTotalOrders(Number((response as any).totalOrders) || 0)
        setServerTotalPages(totalPages)
        setStats((response as any).stats || null)
        setLoadError(null)
        // Gemerkte Seite gibt es nicht mehr (weniger Treffer): auf die letzte vorhandene Seite.
        if (page > totalPages) setPage(totalPages)
      } catch (error: any) {
        console.error("Error fetching orders:", error)
        if (cancelled) return
        setOrders([])
        setLoadError(error?.message && feedbackFilter === 'awaiting' && awaitingState === 'error'
          ? error.message
          : "Reparaturaufträge konnten nicht geladen werden.")
        toast({
          title: t('common.error'),
          description: t('orderManagement.failedToLoadOrders'),
          variant: "destructive"
        })
      } finally {
        if (!cancelled) {
          setLoading(false)
          setInitialLoadDone(true)
        }
      }
    }
    fetchOrders()
    return () => { cancelled = true }
  }, [filterKey, page, reloadToken, awaitingIdsKey, awaitingGate])

  // Scrollposition nach dem ersten erfolgreichen Laden wiederherstellen (Rückkehr aus dem Detail).
  useEffect(() => {
    if (loading || scrollRestoredRef.current) return
    scrollRestoredRef.current = true
    restoreListScroll(LIST_SCROLL_KEY, location.search)
  }, [loading])

  const currentPage = Math.min(page, serverTotalPages)
  const visibleOrders = orders

  // Listenzustand -> URL (replace).
  useEffect(() => {
    const next = new URLSearchParams(searchParams)
    const put = (key: string, value: string, defaultValue: string) => {
      if (value && value !== defaultValue) next.set(key, value)
      else next.delete(key)
    }
    put('q', debouncedSearch, '')
    put('status', statusFilter, 'all')
    put('prio', priorityFilter, 'all')
    put('rueckmeldung', feedbackFilter === 'awaiting' ? 'offen' : '', '')
    put('seite', String(page), '1')
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true })
    }
  }, [debouncedSearch, statusFilter, priorityFilter, feedbackFilter, page])

  const hasActiveFilters = Boolean(searchTerm || statusFilter !== 'all' || priorityFilter !== 'all' || feedbackFilter !== 'all')
  const detailState = () => buildOrderDetailsState(location, { label: 'Zurück zu den Reparaturaufträgen' })
  const rememberListPosition = () => rememberListScroll(LIST_SCROLL_KEY, location.search)

  const statCards: Array<{ key: string; label: string; value: number | string; icon: any; className: string; onClick?: () => void; active?: boolean }> = [
    { key: 'all', label: 'Aufträge gesamt', value: stats?.total ?? (hasActiveFilters ? '–' : totalOrders), icon: Package, className: 'from-blue-50 to-blue-100 border-blue-200 text-blue-900' },
    { key: 'in-progress', label: 'In Bearbeitung', value: stats?.inProgress ?? '–', icon: Clock, className: 'from-orange-50 to-orange-100 border-orange-200 text-orange-900', onClick: () => setStatusFilter(statusFilter === 'in-progress' ? 'all' : 'in-progress'), active: statusFilter === 'in-progress' },
    { key: 'completed', label: 'Abgeschlossen', value: stats?.completed ?? '–', icon: CheckCircle, className: 'from-green-50 to-green-100 border-green-200 text-green-900', onClick: () => setStatusFilter(statusFilter === 'completed' ? 'all' : 'completed'), active: statusFilter === 'completed' },
    { key: 'awaiting', label: 'Warten auf Kundenrückmeldung', value: awaitingTotal ?? '–', icon: MessageSquareWarning, className: 'from-amber-50 to-amber-100 border-amber-200 text-amber-900', onClick: () => setFeedbackFilter(feedbackFilter === 'awaiting' ? 'all' : 'awaiting'), active: feedbackFilter === 'awaiting' },
    { key: 'high-urgent', label: 'Hoch und Dringend', value: stats?.highOrUrgent ?? '–', icon: AlertTriangle, className: 'from-red-50 to-red-100 border-red-200 text-red-900', onClick: () => setPriorityFilter(priorityFilter === 'high-urgent' ? 'all' : 'high-urgent'), active: priorityFilter === 'high-urgent' },
  ]

  // Ganzseitiger Ladezustand nur beim allerersten Laden - spaeter bleiben Filter/Suche stehen
  // (sonst verliert das Suchfeld bei 0 Treffern beim naechsten Tastendruck den Fokus).
  if (loading && !initialLoadDone) {
    return (
      <div className="space-y-6" aria-busy="true">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Package className="h-7 w-7" />
          Reparaturaufträge
        </h1>
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">Reparaturaufträge werden geladen …</CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Package className="h-7 w-7" />
          Reparaturaufträge
        </h1>
        <p className="text-muted-foreground">
          Ein Auftrag (ORD-…) je Gerät. Kundenbuchungen mit Zahlung und Einsendung finden Sie unter{' '}
          <Link to="/admin/bookings" className="font-medium underline underline-offset-2">Buchungen</Link>.
        </p>
      </div>

      {/* Kennzahlen (klickbar = Filter) */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
        {statCards.map((card) => {
          const Icon = card.icon
          const content = (
            <>
              <div className="flex items-start justify-between gap-2">
                <span className="text-sm font-medium">{card.label}</span>
                <Icon className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
              </div>
              <div className="mt-1 text-2xl font-bold">{card.value}</div>
            </>
          )
          return card.onClick ? (
            <button
              key={card.key}
              type="button"
              onClick={card.onClick}
              aria-pressed={Boolean(card.active)}
              className={`rounded-xl border bg-gradient-to-br p-4 text-left transition-shadow hover:shadow-md ${card.className} ${card.active ? 'ring-2 ring-offset-1 ring-[#1a2a5e]' : ''}`}
            >
              {content}
            </button>
          ) : (
            <div key={card.key} className={`rounded-xl border bg-gradient-to-br p-4 ${card.className}`}>{content}</div>
          )
        })}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-5">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <Input
                placeholder="Auftragsnummer, Kunde, E-Mail oder Gerät suchen …"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                aria-label="Reparaturaufträge durchsuchen"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-48" aria-label="Reparaturstatus filtern">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Alle Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Status</SelectItem>
                  {Object.entries(ORDER_STATUS_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="w-48" aria-label="Priorität filtern">
                  <SelectValue placeholder="Alle Prioritäten" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Prioritäten</SelectItem>
                  <SelectItem value="high-urgent">Hoch und Dringend</SelectItem>
                  {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={feedbackFilter} onValueChange={(value) => setFeedbackFilter(value as "all" | "awaiting")}>
                <SelectTrigger className="w-60" aria-label="Kundenrückmeldung filtern">
                  <SelectValue placeholder="Kundenrückmeldung" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Aufträge</SelectItem>
                  <SelectItem value="awaiting">Warten auf Kundenrückmeldung</SelectItem>
                </SelectContent>
              </Select>

              {hasActiveFilters && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearchTerm('')
                    setStatusFilter('all')
                    setPriorityFilter('all')
                    setFeedbackFilter('all')
                  }}
                >
                  <X className="h-4 w-4 mr-1" /> Filter zurücksetzen
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Orders Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Auftragsverzeichnis</CardTitle>
          <CardDescription aria-live="polite">
            {hasActiveFilters
              ? `${totalOrders} Treffer für diese Filter (alle Aufträge, neueste zuerst).`
              : `${totalOrders} Aufträge (neueste zuerst).`}
            {loading ? ' Wird geladen …' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadError && orders.length === 0 ? (
            <div className="py-8 text-center" role="alert">
              <AlertCircle className="h-10 w-10 mx-auto mb-3 text-red-500" aria-hidden="true" />
              <p className="text-sm">{loadError}</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => setReloadToken((value) => value + 1)}>
                <RefreshCw className="h-4 w-4 mr-1" /> Erneut versuchen
              </Button>
            </div>
          ) : (
          <div className="w-full overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Auftrag</TableHead>
                <TableHead>Kunde / Gerät</TableHead>
                <TableHead>Reparaturstatus</TableHead>
                <TableHead>Zahlung</TableHead>
                <TableHead className="hidden lg:table-cell">Zugewiesen</TableHead>
                <TableHead className="text-right">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                    <p className="text-muted-foreground">
                      {loading
                        ? "Wird geladen …"
                        : feedbackFilter === "awaiting" && !searchTerm && statusFilter === 'all' && priorityFilter === 'all'
                        ? "Kein Auftrag wartet auf eine Kundenrückmeldung."
                        : hasActiveFilters ? "Keine Aufträge für diese Filter gefunden." : "Noch keine Reparaturaufträge vorhanden."}
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                visibleOrders.map((order) => {
                  const customer = getOrderCustomer(order)
                  const staffNames = getStaffNames(order)
                  const awaiting = awaitingByOrder[order._id]
                  const services = Array.isArray(order.services) ? order.services.filter(Boolean) : []
                  // Storniert ohne Zahlung: kein "Offen" (Rechnungen bleiben beim Storno bestehen, daher neutral) - wie im Auftragsdetail.
                  const payment = order.status === 'cancelled' && ['pending', 'unpaid'].includes(String(order.paymentStatus || ''))
                    ? { label: 'Storniert', className: 'bg-slate-50 text-slate-600 border-slate-300' }
                    : PAYMENT_STATUS_LABELS[order.paymentStatus]
                  return (
                    <TableRow key={order._id} className="hover:bg-muted/50 align-top">
                      <TableCell className="align-top">
                        <div className="flex flex-col gap-1">
                          <span className="font-semibold whitespace-nowrap">{order.orderNumber || `#${String(order._id).slice(-8).toUpperCase()}`}</span>
                          <span className="text-xs text-muted-foreground">{formatDate(order.createdAt)}</span>
                          {(order.priority === 'urgent' || order.priority === 'high') && (
                            <Badge variant="outline" className={`w-fit text-xs ${order.priority === 'urgent' ? 'border-red-300 bg-red-50 text-red-800' : 'border-orange-300 bg-orange-50 text-orange-800'}`}>
                              {PRIORITY_LABELS[order.priority]}
                            </Badge>
                          )}
                          {awaiting && (
                            <Badge
                              variant="outline"
                              className="w-fit border-amber-300 bg-amber-50 text-amber-800 text-xs"
                              title={awaiting.reasons.map((reason) => reason.detail ? `${reason.label}: ${reason.detail}` : reason.label).join("\n")}
                            >
                              Wartet auf Kunde
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="align-top max-w-[260px]">
                        <div className="min-w-0">
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="font-medium truncate" title={customer.name}>{customer.name}</span>
                            {customer.isGuest && <Badge variant="outline" className="text-xs px-1.5 py-0 flex-shrink-0">Gast</Badge>}
                          </div>
                          {customer.email && <p className="text-xs text-muted-foreground truncate" title={customer.email}>{customer.email}</p>}
                          <p className="text-sm mt-1 truncate" title={`${order.deviceBrand || ''} ${order.deviceModel || ''}`}>
                            {[order.deviceBrand, order.deviceModel].filter(Boolean).join(' ') || order.deviceType || 'Gerät'}
                          </p>
                          {services.length > 0 && (
                            <p className="text-xs text-muted-foreground truncate" title={services.join(', ')}>{services.join(', ')}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="flex flex-col gap-1">
                          <Badge variant="outline" className={`w-fit ${ORDER_STATUS_CLASSES[order.status] || 'bg-gray-100 text-gray-700 border-gray-300'}`}>
                            {ORDER_STATUS_LABELS[order.status] || order.status}
                          </Badge>
                          <span className="text-xs text-muted-foreground">Fortschritt {Number(order.progress) || 0} %</span>
                        </div>
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="flex flex-col gap-1">
                          {payment ? (
                            <Badge variant="outline" className={`w-fit ${payment.className}`}>{payment.label}</Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">Zahlungsstand unbekannt</span>
                          )}
                          <span className="text-sm font-medium whitespace-nowrap">{formatEUR(Number(order.totalCost) || 0)}</span>
                        </div>
                      </TableCell>
                      <TableCell className="align-top hidden lg:table-cell">
                        {staffNames.length > 0
                          ? <span className="text-sm">{staffNames.join(', ')}</span>
                          : <span className="text-xs text-muted-foreground">Nicht zugewiesen</span>}
                      </TableCell>
                      <TableCell className="align-top text-right">
                        <Button asChild variant="outline" size="sm">
                          <Link to={getOrderDetailsPath(order._id)} state={detailState()} onClick={rememberListPosition} title={`Auftrag ${order.orderNumber || ''} öffnen`}>
                            Auftrag öffnen
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
          </div>
          )}

          {/* Seiten (serverseitig) */}
          {totalOrders > 0 && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-3">
              <p className="text-sm text-muted-foreground">
                {`Zeige ${(currentPage - 1) * PAGE_SIZE + 1}–${Math.min(currentPage * PAGE_SIZE, totalOrders)} von ${totalOrders}`}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setPage(Math.max(1, currentPage - 1))} disabled={loading || currentPage <= 1}>
                  <ChevronLeft className="h-4 w-4 mr-1" /> Zurück
                </Button>
                <span className="text-sm">Seite {currentPage} von {serverTotalPages}</span>
                <Button variant="outline" size="sm" onClick={() => setPage(Math.min(serverTotalPages, currentPage + 1))} disabled={loading || currentPage >= serverTotalPages}>
                  Weiter <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
