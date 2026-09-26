import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useToast } from "@/hooks/useToast"
import { getAdminOrders, updateOrderStatus, AdminOrder } from "@/api/adminOrders"
import api from "@/api/api"
import {
  Package,
  Search,
  Filter,
  Eye,
  Edit,
  Clock,
  CheckCircle,
  AlertTriangle,
  Calendar,
  User,
  Phone,
  Mail,
  Wrench,
  MessageSquareWarning
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

// Antwort von GET /api/repair-workflows/admin/awaiting-customer-feedback
interface AwaitingFeedbackEntry {
  orderId: string
  since?: string | null
  overdue?: boolean
  reasons: Array<{ type: string; label: string; detail?: string; since?: string | null }>
}

const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: "Ausstehend",
  "diagnostic-assessment": "Diagnose",
  "in-progress": "In Bearbeitung",
  paused: "Pausiert",
  "quality-check": "Qualitätsprüfung",
  "ready-for-pickup": "Abholbereit",
  completed: "Abgeschlossen",
  cancelled: "Storniert",
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

const formatEuro = (amount: number) =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(Number(amount) || 0)

export function OrderManagement() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [orders, setOrders] = useState<AdminOrder[]>([])
  const [filteredOrders, setFilteredOrders] = useState<AdminOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [priorityFilter, setPriorityFilter] = useState("all")
  const [feedbackFilter, setFeedbackFilter] = useState<"all" | "awaiting">("all")
  const [awaitingByOrder, setAwaitingByOrder] = useState<Record<string, AwaitingFeedbackEntry>>({})
  const [updating, setUpdating] = useState<string | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        console.log("Fetching admin orders...")
        const response = await getAdminOrders({ page: 1, limit: 100 })
        const ordersData = (response as any).orders || []
        setOrders(ordersData)
        setFilteredOrders(ordersData)

        // "Warten auf Kundenrückmeldung" kommt vom Server (nur echte Rückfragen,
        // keine normalen Nachrichten). Ein Fehler hier darf die Liste nicht blockieren.
        if (ordersData.length > 0) {
          try {
            const awaitingResponse = await api.get('/api/repair-workflows/admin/awaiting-customer-feedback', {
              params: { orderIds: ordersData.map((order: AdminOrder) => order._id).join(',') },
            })
            const entries: AwaitingFeedbackEntry[] = awaitingResponse.data?.orders || []
            setAwaitingByOrder(Object.fromEntries(entries.map((entry) => [String(entry.orderId), entry])))
          } catch (awaitingError) {
            console.error("Error fetching awaiting customer feedback:", awaitingError)
            setAwaitingByOrder({})
          }
        } else {
          setAwaitingByOrder({})
        }
      } catch (error) {
        console.error("Error fetching orders:", error)
        toast({
          title: t('common.error'),
          description: t('orderManagement.failedToLoadOrders'),
          variant: "destructive"
        })
      } finally {
        setLoading(false)
      }
    }

    fetchOrders()
  }, [toast])

  useEffect(() => {
    let filtered = orders

    if (searchTerm) {
      filtered = filtered.filter(order =>
        order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.customerId.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.customerId.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.deviceBrand.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.deviceModel.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter(order => order.status === statusFilter)
    }

    if (priorityFilter !== "all") {
      filtered = filtered.filter(order => order.priority === priorityFilter)
    }

    if (feedbackFilter === "awaiting") {
      filtered = filtered.filter(order => Boolean(awaitingByOrder[order._id]))
    }

    setFilteredOrders(filtered)
  }, [orders, searchTerm, statusFilter, priorityFilter, feedbackFilter, awaitingByOrder])

  const handleStatusUpdate = async (orderId: string, newStatus: string) => {
    try {
      setUpdating(orderId)
      await updateOrderStatus(orderId, newStatus)

      setOrders(orders.map(order =>
        order._id === orderId ? { ...order, status: newStatus as any } : order
      ))

      toast({
        title: "Erfolg",
        description: "Auftragsstatus wurde aktualisiert."
      })
    } catch (error: any) {
      toast({
        title: "Fehler",
        description: error.message || "Auftragsstatus konnte nicht aktualisiert werden.",
        variant: "destructive"
      })
    } finally {
      setUpdating(null)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500 text-white'
      case 'in-progress':
        return 'bg-blue-500 text-white'
      case 'quality-check':
        return 'bg-yellow-500 text-black'
      case 'ready-for-pickup':
        return 'bg-purple-500 text-white'
      case 'pending':
        return 'bg-gray-500 text-white'
      case 'cancelled':
        return 'bg-red-500 text-white'
      default:
        return 'bg-gray-500 text-white'
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-600 text-white'
      case 'high':
        return 'bg-orange-500 text-white'
      case 'normal':
        return 'bg-blue-500 text-white'
      case 'low':
        return 'bg-gray-500 text-white'
      default:
        return 'bg-gray-500 text-white'
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-muted rounded w-48 animate-pulse"></div>
        <Card className="animate-pulse">
          <CardHeader>
            <div className="h-6 bg-muted rounded w-1/3"></div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-16 bg-muted rounded"></div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Package className="h-8 w-8" />
          Auftragsverwaltung
        </h1>
        <p className="text-muted-foreground">
          Alle Reparaturaufträge der Plattform überwachen und verwalten
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-300">
              Aufträge gesamt
            </CardTitle>
            <Package className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
              {orders.length}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900 border-orange-200 dark:border-orange-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-orange-700 dark:text-orange-300">
              In Bearbeitung
            </CardTitle>
            <Clock className="h-4 w-4 text-orange-600 dark:text-orange-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-900 dark:text-orange-100">
              {orders.filter(o => o.status === 'in-progress').length}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200 dark:border-green-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-green-700 dark:text-green-300">
              Abgeschlossen
            </CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-900 dark:text-green-100">
              {orders.filter(o => o.status === 'completed').length}
            </div>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950 dark:to-amber-900 border-amber-200 dark:border-amber-800"
          onClick={() => setFeedbackFilter(feedbackFilter === "awaiting" ? "all" : "awaiting")}
          title="Nach „Warten auf Kundenrückmeldung“ filtern"
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-amber-700 dark:text-amber-300">
              Warten auf Kundenrückmeldung
            </CardTitle>
            <MessageSquareWarning className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-900 dark:text-amber-100">
              {orders.filter(o => Boolean(awaitingByOrder[o._id])).length}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950 dark:to-red-900 border-red-200 dark:border-red-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-red-700 dark:text-red-300">
              Dringende Aufträge
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-900 dark:text-red-100">
              {orders.filter(o => o.priority === 'urgent').length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Aufträge nach Nummer, Kunde oder Gerät suchen …"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Alle Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Status</SelectItem>
                  <SelectItem value="pending">Ausstehend</SelectItem>
                  <SelectItem value="in-progress">In Bearbeitung</SelectItem>
                  <SelectItem value="quality-check">Qualitätsprüfung</SelectItem>
                  <SelectItem value="ready-for-pickup">Abholbereit</SelectItem>
                  <SelectItem value="completed">Abgeschlossen</SelectItem>
                  <SelectItem value="cancelled">Storniert</SelectItem>
                </SelectContent>
              </Select>

              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Alle Prioritäten" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Prioritäten</SelectItem>
                  <SelectItem value="low">Niedrig</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">Hoch</SelectItem>
                  <SelectItem value="urgent">Dringend</SelectItem>
                </SelectContent>
              </Select>

              <Select value={feedbackFilter} onValueChange={(value) => setFeedbackFilter(value as "all" | "awaiting")}>
                <SelectTrigger className="w-60">
                  <SelectValue placeholder="Kundenrückmeldung" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Aufträge</SelectItem>
                  <SelectItem value="awaiting">Warten auf Kundenrückmeldung</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Orders Table */}
      <Card>
        <CardHeader>
          <CardTitle>Auftragsverzeichnis</CardTitle>
          <CardDescription>
            Die neuesten 100 Reparaturaufträge mit Verwaltungsfunktionen
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Auftrag</TableHead>
                <TableHead>Kunde</TableHead>
                <TableHead>Gerät</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Priorität</TableHead>
                <TableHead>Zugewiesen</TableHead>
                <TableHead>Gesamt</TableHead>
                <TableHead>Zahlung</TableHead>
                <TableHead>Erstellt</TableHead>
                <TableHead className="text-right">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8">
                    <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                    <p className="text-muted-foreground">
                      {feedbackFilter === "awaiting" ? "Keine Aufträge warten auf eine Kundenrückmeldung" : "Keine Aufträge gefunden"}
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredOrders.map((order) => (
                  <TableRow
                    key={order._id}
                    onClick={() => {
                      console.log('Table row clicked, navigating to order details:', order._id);
                      navigate(`/orders/${order._id}`);
                    }}
                    className="cursor-pointer hover:bg-muted/50"
                  >
                    <TableCell>
                      <div>
                        <p className="font-medium">{order.orderNumber}</p>
                        <p className="text-sm text-muted-foreground">
                          Fortschritt: {order.progress}%
                        </p>
                        {awaitingByOrder[order._id] && (
                          <Badge
                            variant="outline"
                            className="mt-1 border-amber-300 bg-amber-50 text-amber-800"
                            title={awaitingByOrder[order._id].reasons.map((reason) => reason.detail ? `${reason.label}: ${reason.detail}` : reason.label).join("\n")}
                          >
                            Wartet auf Kundenrückmeldung
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="w-8 h-8">
                          <AvatarImage src={order.customerId.avatar} />
                          <AvatarFallback>
                            {order.customerId.name.split(' ').map(n => n[0]).join('')}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{order.customerId.name}</p>
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {order.customerId.email}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{order.deviceBrand} {order.deviceModel}</p>
                        <p className="text-sm text-muted-foreground">
                          {order.services.join(', ')}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Select
                        value={order.status}
                        onValueChange={(value) => handleStatusUpdate(order._id, value)}
                        disabled={updating === order._id}
                      >
                        <SelectTrigger className="w-36">
                          <SelectValue>
                            <Badge className={getStatusColor(order.status)}>
                              {ORDER_STATUS_LABELS[order.status] || order.status}
                            </Badge>
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Ausstehend</SelectItem>
                          <SelectItem value="in-progress">In Bearbeitung</SelectItem>
                          <SelectItem value="quality-check">Qualitätsprüfung</SelectItem>
                          <SelectItem value="ready-for-pickup">Abholbereit</SelectItem>
                          <SelectItem value="completed">Abgeschlossen</SelectItem>
                          <SelectItem value="cancelled">Storniert</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Badge className={getPriorityColor(order.priority)}>
                        {PRIORITY_LABELS[order.priority] || order.priority}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex -space-x-2">
                        {order.assignedStaff.map((staff) => (
                          <Avatar key={staff._id} className="w-6 h-6 border-2 border-background">
                            <AvatarImage src={staff.avatar} />
                            <AvatarFallback className="text-xs">
                              {staff.name.split(' ').map(n => n[0]).join('')}
                            </AvatarFallback>
                          </Avatar>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">{formatEuro(order.totalCost)}</span>
                    </TableCell>
                    <TableCell>
                      {PAYMENT_STATUS_LABELS[order.paymentStatus] ? (
                        <Badge variant="outline" className={PAYMENT_STATUS_LABELS[order.paymentStatus].className}>
                          {PAYMENT_STATUS_LABELS[order.paymentStatus].label}
                        </Badge>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {new Date(order.createdAt).toLocaleDateString('de-DE')}
                      </div>
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            console.log('Eye button clicked, navigating to order details:', order._id);
                            navigate(`/orders/${order._id}`);
                          }}
                          title="Auftragsdetails anzeigen"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Auftrag bearbeiten"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Order Details */}
      <div className="space-y-6">
        {filteredOrders.map((order) => (
          <Card key={order._id}>
            <CardHeader>
              <CardTitle>Auftragsdetails {order.orderNumber}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-4">
                {/* Customer Info */}
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-2xl p-6">
                  <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Kundeninformationen
                  </h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="flex items-center gap-3">
                      <Avatar className="w-12 h-12">
                        <AvatarImage src={order.customerId.avatar} />
                        <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-500 text-white">
                          {order.customerId.name.split(' ').map(n => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-semibold">{order.customerId.name}</p>
                        <p className="text-sm text-slate-500">{order.customerId.email}</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <p className="flex items-center gap-2 text-sm">
                        <Phone className="h-4 w-4 text-slate-400" />
                        {order.customerId.phone}
                      </p>
                      <p className="flex items-center gap-2 text-sm">
                        <Mail className="h-4 w-4 text-slate-400" />
                        {order.customerId.email}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Device & Services */}
                <div className="bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20 rounded-2xl p-6">
                  <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                    <Wrench className="h-5 w-5" />
                    Gerät &amp; Leistungen
                  </h3>
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-gradient-to-br from-emerald-500 to-green-500 rounded-xl">
                        <Wrench className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <p className="font-bold text-lg">{order.deviceBrand} {order.deviceModel}</p>
                        <p className="text-slate-600 dark:text-slate-400">{order.deviceType}</p>
                      </div>
                    </div>
                    <div>
                      <p className="font-semibold mb-2">Leistungen:</p>
                      <div className="flex flex-wrap gap-2">
                        {order.services.map((service, index) => (
                          <Badge key={index} variant="outline" className="bg-white/50">
                            {service}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Timeline */}
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-2xl p-6">
                  <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Auftragsverlauf
                  </h3>
                  <div className="space-y-4">
                    {order.timeline.map((event, index) => (
                      <div key={event._id} className="flex items-start gap-4">
                        <div className="flex flex-col items-center">
                          <div className="w-3 h-3 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"></div>
                          {index < order.timeline.length - 1 && (
                            <div className="w-px h-8 bg-slate-200 dark:bg-slate-600 mt-2"></div>
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold">{event.status}</p>
                          <p className="text-sm text-slate-600 dark:text-slate-400">{event.description}</p>
                          <p className="text-xs text-slate-500 mt-1">
                            {new Date(event.completedAt).toLocaleString('de-DE')} • {event.staffName}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Staff Notes */}
                {order.staffNotes.length > 0 && (
                  <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-2xl p-6">
                    <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                      <Edit className="h-5 w-5" />
                      Mitarbeiternotizen
                    </h3>
                    <div className="space-y-3">
                      {order.staffNotes.map((note) => (
                        <div key={note._id} className="bg-white/50 dark:bg-slate-700/30 rounded-xl p-4">
                          <div className="flex items-center justify-between mb-2">
                            <p className="font-semibold">{note.staffName}</p>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">{note.type}</Badge>
                              <span className="text-xs text-slate-500">
                                {new Date(note.createdAt).toLocaleString('de-DE')}
                              </span>
                            </div>
                          </div>
                          <p className="text-slate-700 dark:text-slate-300">{note.note}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}