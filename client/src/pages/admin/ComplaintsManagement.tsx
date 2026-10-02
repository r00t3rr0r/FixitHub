import { useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { useLocation, useNavigate } from "react-router-dom"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/useToast"
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  ClipboardCheck,
  Lock,
  MessageSquare,
  RefreshCw,
  Send,
  ShieldCheck,
  Wrench,
  XCircle,
  type LucideIcon,
} from "lucide-react"
import "./ComplaintsManagement.css"
import {
  addComplaintComment,
  getAllComplaints,
  getComplaint,
  approveComplaint,
  acknowledgeComplaint,
  denyComplaint,
  Complaint,
} from "@/api/complaints"
import { buildOrderDetailsState, getOrderDetailsPath } from "@/lib/orderDetailsNavigation"
import { formatEUR } from "@/lib/utils"
import { ComplaintLabelDownloadButton } from "@/components/complaints/ComplaintLabelDownloadButton"

// Die API liefert das Label nie als Daten (nur hasShippingLabel + Sendungsnummer).
type ComplaintWithLabel = Complaint & { hasShippingLabel?: boolean; shippingTrackingNumber?: string | null }

const ROLE_LABELS: Record<string, string> = { customer: "Kunde", staff: "Mitarbeiter", admin: "Admin" }

interface AdminComplaintRow {
  _id: string
  complaintNumber: string
  orderId?: string
  orderNumber: string
  complaintOrderId?: string
  complaintOrderNumber?: string
  customer: string
  processor: string
  status: string
  createdAt: string
  extraCosts: number
  partialRefund: number
}

const STATUS_OPTIONS = [
  "pending_approval",
  "approved",
  "rejected",
  "acknowledged",
  "denied",
  "new_repair",
  "awaiting_payment",
  "resolved",
  "closed"
]

const STATUS_META: Record<string, { label: string; icon: LucideIcon; className: string }> = {
  pending_approval: {
    label: "Wartet auf Freigabe",
    icon: AlertTriangle,
    className: "complaints-status-pending",
  },
  approved: {
    label: "Zur Prüfung eingesendet",
    icon: ShieldCheck,
    className: "complaints-status-approved",
  },
  rejected: {
    label: "Abgelehnt",
    icon: XCircle,
    className: "complaints-status-rejected",
  },
  acknowledged: {
    label: "Anerkannt",
    icon: CheckCircle2,
    className: "complaints-status-acknowledged",
  },
  denied: {
    label: "Reklamation abgelehnt",
    icon: Ban,
    className: "complaints-status-denied",
  },
  new_repair: {
    label: "Neuer Reparaturauftrag",
    icon: Wrench,
    className: "complaints-status-new-repair",
  },
  awaiting_payment: {
    label: "Wartet auf Zahlung",
    icon: AlertTriangle,
    className: "complaints-status-pending",
  },
  resolved: {
    label: "Geloest",
    icon: ClipboardCheck,
    className: "complaints-status-resolved",
  },
  closed: {
    label: "Geschlossen",
    icon: Ban,
    className: "complaints-status-closed",
  },
}

type ActionDialogType = "reject" | "ack" | "deny" | null

export function ComplaintsManagement() {
  const { t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  const [complaints, setComplaints] = useState<Complaint[]>([])
  const [rows, setRows] = useState<AdminComplaintRow[]>([])
  const [selectedComplaintId, setSelectedComplaintId] = useState("")
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState("")
  const [actionDialog, setActionDialog] = useState<ActionDialogType>(null)
  // Filter aus der URL (Dashboard-Links, z. B. ?status=offen&priority=high-urgent): wirklich angewendet,
  // die Gesamtzahl kommt vom Server (gleiche Regel wie der Dashboard-Zähler).
  const [statusFilter, setStatusFilter] = useState(() => new URLSearchParams(location.search).get("status") || "all")
  const [priorityFilter, setPriorityFilter] = useState(() => new URLSearchParams(location.search).get("priority") || "")
  const [listTotal, setListTotal] = useState<number | null>(null)
  const [technicianFilter, setTechnicianFilter] = useState("")
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")
  const [ackTechnicianReason, setAckTechnicianReason] = useState("")
  const [denyTechnicianReason, setDenyTechnicianReason] = useState("")
  const [partialRefund, setPartialRefund] = useState("0")
  const [repairNotes, setRepairNotes] = useState("")
  const [additionalPartName, setAdditionalPartName] = useState("")
  const [additionalPartQuantity, setAdditionalPartQuantity] = useState("1")
  const [additionalPartCost, setAdditionalPartCost] = useState("0")
  const [offerAmount, setOfferAmount] = useState("0")
  const [offerDescription, setOfferDescription] = useState("")
  const [complaintMessage, setComplaintMessage] = useState("")
  const [sendingComplaintMessage, setSendingComplaintMessage] = useState<"" | "customer" | "internal">("")
  const { toast } = useToast()

  const resetActionForms = () => {
    setAckTechnicianReason("")
    setDenyTechnicianReason("")
    setPartialRefund("0")
    setRepairNotes("")
    setAdditionalPartName("")
    setAdditionalPartQuantity("1")
    setAdditionalPartCost("0")
    setOfferAmount("0")
    setOfferDescription("")
  }

  const fetchComplaints = async (keepSelection = true) => {
    try {
      setLoading(true)
      const response = await getAllComplaints({
        status: statusFilter === "all" ? undefined : statusFilter,
        priority: priorityFilter || undefined,
        from: fromDate || undefined,
        to: toDate || undefined,
        limit: 200,
      })

      const items = (response as any).complaints || []
      const listRows = (response as any).rows || []
      setComplaints(items)
      setRows(listRows)
      setListTotal(typeof (response as any).total === "number" ? (response as any).total : null)
      setLoadError(null)

      if (!keepSelection) {
        setSelectedComplaintId("")
        setSelectedComplaint(null)
      }

      if (keepSelection && selectedComplaintId) {
        const existing = items.find((c: Complaint) => c._id === selectedComplaintId)
        if (existing) {
          await loadComplaintDetails(existing._id)
        }
      }
    } catch (error: any) {
      setLoadError(error?.message || "Reklamationen konnten nicht geladen werden.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchComplaints()
  }, [])

  // Prioritätsfilter (nur per Dashboard-Link gesetzt) entfernt -> sofort neu laden.
  const priorityFilterInitialRef = useRef(true)
  useEffect(() => {
    if (priorityFilterInitialRef.current) {
      priorityFilterInitialRef.current = false
      return
    }
    void fetchComplaints()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [priorityFilter])

  // Direktlink aus Benachrichtigungen: /admin/complaints?complaintId=<id> oeffnet die Reklamation.
  useEffect(() => {
    const complaintIdParam = new URLSearchParams(location.search).get("complaintId")
    if (complaintIdParam && complaintIdParam !== selectedComplaintId) {
      loadComplaintDetails(complaintIdParam)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search])

  useEffect(() => {
    const reopenComplaintId = (location.state as { reopenComplaintId?: string } | null)?.reopenComplaintId
    if (!reopenComplaintId) {
      return
    }

    loadComplaintDetails(reopenComplaintId)
  }, [location.state])

  const loadComplaintDetails = async (complaintId: string) => {
    try {
      const response = await getComplaint(complaintId)
      const detail = (response as any).complaint || null
      setSelectedComplaint(detail)
      setSelectedComplaintId(complaintId)
    } catch (error: any) {
      toast({
        title: "Fehler",
        description: error?.message || "Reklamationsdetails konnten nicht geladen werden.",
        variant: "destructive"
      })
    }
  }

  const runAction = async (actionKey: string, action: () => Promise<any>, successMessage: string) => {
    if (!selectedComplaint) return
    try {
      setActionLoading(actionKey)
      await action()
      toast({
        title: "Erfolgreich",
        description: successMessage
      })
      await loadComplaintDetails(selectedComplaint._id)
      await fetchComplaints()
    } catch (error: any) {
      toast({
        title: "Aktion fehlgeschlagen",
        description: error?.message || "Die Aktion konnte nicht ausgefuehrt werden.",
        variant: "destructive"
      })
    } finally {
      setActionLoading("")
    }
  }

  // Genehmigen: Label erstellen + Kunde benachrichtigen; Speichern und Benachrichtigung
  // werden getrennt gemeldet.
  const handleApprove = async () => {
    if (!selectedComplaint) return
    try {
      setActionLoading("approve")
      const result = await approveComplaint(selectedComplaint._id)
      const notification = (result as any)?.customerNotification
      const warnings: string[] = (result as any)?.warnings || []
      if (warnings.length > 0) {
        toast({ title: "Genehmigt – Benachrichtigung fehlgeschlagen", description: warnings.join(" "), variant: "destructive" })
      } else {
        const notified = notification?.inApp === "created" || notification?.email === "sent"
        toast({
          title: "Reklamation genehmigt",
          description: notified
            ? "DHL-Einsendelabel erstellt, Kunde benachrichtigt."
            : "DHL-Einsendelabel erstellt. Der Kunde hat Benachrichtigungen abgeschaltet oder wurde bereits informiert.",
        })
      }
      await loadComplaintDetails(selectedComplaint._id)
      await fetchComplaints()
    } catch (error: any) {
      toast({ title: "Genehmigung fehlgeschlagen", description: error?.message || "Die Reklamation konnte nicht genehmigt werden.", variant: "destructive" })
    } finally {
      setActionLoading("")
    }
  }

  const exportCsv = () => {
    const header = ["Rekla-Nr", "Auftragsnummer", "Kunde", "Bearbeiter", "Status", "Datum", "Zusatzkosten", "Teilerstattung"]
    const lines = rows.map((row) => [
      row.complaintNumber,
      row.orderNumber,
      row.customer,
      row.processor || "-",
      row.status,
      new Date(row.createdAt).toLocaleDateString("de-DE"),
      String(row.extraCosts || 0),
      String(row.partialRefund || 0)
    ])

    const csv = [header, ...lines]
      .map((line) => line.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(";"))
      .join("\n")

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `complaints-export-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const technicianOptions = useMemo(() => {
    const names = new Set<string>()
    complaints.forEach((complaint) => {
      const name = (complaint as any)?.technicianName || (complaint as any)?.assignedToName
      if (name) {
        names.add(String(name))
      }
    })
    return Array.from(names).sort((a, b) => a.localeCompare(b))
  }, [complaints])

  const visibleRows = useMemo(() => {
    return rows.filter((row) => {
      if (technicianFilter && row.processor !== technicianFilter) {
        return false
      }
      return true
    })
  }, [rows, technicianFilter])

  const selectedStatus = selectedComplaint?.status || ""

  const canApprove = selectedStatus === "pending_approval"
  const canReject = selectedStatus === "pending_approval"
  const canAcknowledge = selectedStatus === "approved"
  const canDeny = selectedStatus === "approved"

  const selectedCustomerName = selectedComplaint?.customerId
    ? `${selectedComplaint.customerId.firstName || ""} ${selectedComplaint.customerId.lastName || ""}`.trim() || selectedComplaint.customerId.email
    : "-"

  const selectedOrderNumber = (selectedComplaint as any)?.orderId?.orderNumber || "-"
  const selectedComplaintOrderId = typeof selectedComplaint?.newOrderId === "string"
    ? selectedComplaint.newOrderId
    : (selectedComplaint as any)?.newOrderId?._id || ""
  const selectedComplaintOrderNumber = typeof selectedComplaint?.newOrderId === "string"
    ? ""
    : (selectedComplaint as any)?.newOrderId?.orderNumber || ""

  const openActionDialog = (dialogType: ActionDialogType) => {
    resetActionForms()
    if (dialogType === "reject") {
      setDenyTechnicianReason(selectedComplaint?.technicianReason || "")
    }
    if (dialogType === "reject" && selectedComplaint?.repairOffer) {
      setOfferAmount(String(selectedComplaint.repairOffer.amount ?? 0))
      setOfferDescription(selectedComplaint.repairOffer.description || "")
    }
    setActionDialog(dialogType)
  }

  const closeActionDialog = () => {
    setActionDialog(null)
  }

  // Zwei getrennte Aktionen: Nachricht an den Kunden ODER interne Notiz (nur Team).
  const handleSendComplaintMessage = async (audience: "customer" | "internal") => {
    if (!selectedComplaint || !complaintMessage.trim()) {
      return
    }

    try {
      setSendingComplaintMessage(audience)
      const result = await addComplaintComment(selectedComplaint._id, complaintMessage.trim(), audience === "internal")
      await loadComplaintDetails(selectedComplaint._id)
      setComplaintMessage("")
      if (audience === "internal") {
        toast({ title: "Interne Notiz gespeichert", description: "Nur für das Team sichtbar – der Kunde wurde nicht benachrichtigt." })
      } else {
        const delivery = (result as any)?.customerNotification
        const failed = delivery && (delivery.email === "failed" || delivery.inApp === "failed")
        toast(failed
          ? { title: "Nachricht gespeichert – Benachrichtigung fehlgeschlagen", description: delivery.error || "Der Kunde konnte nicht per E-Mail informiert werden.", variant: "destructive" }
          : { title: "Nachricht an Kunden gesendet", description: "Der Kunde sieht die Nachricht in seiner Reklamation und wurde benachrichtigt." })
      }
    } catch (error: any) {
      toast({
        title: "Speichern fehlgeschlagen",
        description: error?.message || "Die Nachricht konnte nicht gespeichert werden.",
        variant: "destructive"
      })
    } finally {
      setSendingComplaintMessage("")
    }
  }

  const getStatusMeta = (status: string) => {
    return STATUS_META[status] || {
      label: status,
      icon: AlertTriangle,
      className: "complaints-status-closed",
    }
  }

  return (
    <div className="complaints-management space-y-6">
      <div className="complaints-page-header">
        <h1>Reklamationsmanagement</h1>
        <p>Intuitive Uebersicht fuer Reklamationen, Bearbeitungsstatus und direkte Kundenkommunikation.</p>
      </div>

      <Card className="complaints-shell-card">
        <CardHeader className="complaints-shell-header">
          <CardTitle>Reklamationen</CardTitle>
          <CardDescription>
            Alle Reklamationen mit Status, Bearbeiter und Zusatzkosten.
          </CardDescription>
        </CardHeader>
        <CardContent className="complaints-shell-content space-y-4">
          <div className="complaints-filter-grid grid grid-cols-1 md:grid-cols-5 gap-3">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="complaints-filter-trigger">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Status</SelectItem>
                <SelectItem value="offen">Alle offenen</SelectItem>
                {STATUS_OPTIONS.map((status) => (
                  <SelectItem key={status} value={status}>{STATUS_META[status]?.label || status}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={technicianFilter || "all"} onValueChange={(value) => setTechnicianFilter(value === "all" ? "" : value)}>
              <SelectTrigger className="complaints-filter-trigger">
                <SelectValue placeholder="Techniker" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Techniker</SelectItem>
                {technicianOptions.map((name) => (
                  <SelectItem key={name} value={name}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input className="complaints-filter-input" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            <Input className="complaints-filter-input" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />

            <div className="complaints-filter-actions flex gap-2">
              <Button className="complaints-primary-button" onClick={() => fetchComplaints()} disabled={loading}>Filtern</Button>
              <Button className="complaints-secondary-button" variant="outline" onClick={exportCsv}>CSV Export</Button>
            </div>
          </div>

          {(priorityFilter || listTotal !== null) && (
            <div className="flex flex-wrap items-center gap-2 text-sm text-slate-700" aria-live="polite">
              {listTotal !== null && <span>{listTotal} {listTotal === 1 ? "Reklamation" : "Reklamationen"} für diesen Filter{technicianFilter ? ` (davon ${visibleRows.length} beim gewählten Techniker)` : ""}</span>}
              {priorityFilter && (
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-800"
                  onClick={() => setPriorityFilter("")}
                  aria-label="Prioritätsfilter entfernen"
                >
                  Priorität: {priorityFilter === "high-urgent" ? "hoch oder dringend" : priorityFilter} ✕
                </button>
              )}
            </div>
          )}

          <div className="complaints-table-wrap overflow-x-auto border rounded-md">
            <table className="complaints-table w-full text-sm">
              <thead>
                <tr className="bg-muted/40 text-left">
                  <th className="p-3">Rekla-Nr.</th>
                  <th className="p-3">Auftragsnummer</th>
                  <th className="p-3">Rekla-Auftrag</th>
                  <th className="p-3">Kunde</th>
                  <th className="p-3">Bearbeiter</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Datum</th>
                  <th className="p-3">Zusatzkosten</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => (
                  (() => {
                    const statusMeta = getStatusMeta(row.status)
                    const StatusIcon = statusMeta.icon
                    return (
                  <tr
                    key={row._id}
                    className={`complaints-table-row border-t cursor-pointer hover:bg-muted/30 ${selectedComplaintId === row._id ? "bg-muted/40 is-selected" : ""}`}
                    onClick={() => loadComplaintDetails(row._id)}
                  >
                    <td className="p-3 font-medium">{row.complaintNumber}</td>
                    <td className="p-3">{row.orderNumber}</td>
                    <td className="p-3">
                      {row.complaintOrderId ? (
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{row.complaintOrderNumber || "-"}</span>
                          <Button
                            size="sm"
                            variant="outline"
                            className="complaints-secondary-button"
                            onClick={(e) => {
                              e.stopPropagation()
                              navigate(getOrderDetailsPath(row.complaintOrderId as string), {
                                state: buildOrderDetailsState(location, {
                                  label: t('common.back'),
                                  restoreState: { reopenComplaintId: row._id },
                                }),
                              })
                            }}
                          >
                            Details
                          </Button>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Noch nicht erstellt</span>
                      )}
                    </td>
                    <td className="p-3">{row.customer}</td>
                    <td className="p-3">{row.processor || '-'}</td>
                    <td className="p-3">
                      <Badge className={`complaints-status-badge ${statusMeta.className}`} variant="outline">
                        <StatusIcon className="h-3.5 w-3.5" />
                        <span>{statusMeta.label}</span>
                      </Badge>
                    </td>
                    <td className="p-3">{new Date(row.createdAt).toLocaleDateString("de-DE")}</td>
                    <td className="p-3">{formatEUR(row.extraCosts || 0)}</td>
                  </tr>
                    )
                  })()
                ))}
                {loading && !visibleRows.length && (
                  <tr>
                    <td colSpan={8} className="p-6 text-center text-muted-foreground">
                      Reklamationen werden geladen …
                    </td>
                  </tr>
                )}
                {!loading && loadError && (
                  <tr>
                    <td colSpan={8} className="p-6 text-center">
                      <div className="flex flex-col items-center gap-2" role="alert">
                        <span className="text-red-700 font-medium">Reklamationen konnten nicht geladen werden.</span>
                        <span className="text-xs text-muted-foreground">{loadError}</span>
                        <Button size="sm" variant="outline" onClick={() => fetchComplaints()}>
                          <RefreshCw className="h-3.5 w-3.5 mr-1" /> Erneut versuchen
                        </Button>
                      </div>
                    </td>
                  </tr>
                )}
                {!loading && !loadError && !visibleRows.length && (
                  <tr>
                    <td colSpan={8} className="p-6 text-center text-muted-foreground">
                      {rows.length ? "Keine Reklamation entspricht den gewählten Filtern." : "Noch keine Reklamationen vorhanden."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {selectedComplaint && (
            (() => {
              const selectedStatusMeta = getStatusMeta(selectedComplaint.status)
              const SelectedStatusIcon = selectedStatusMeta.icon
              return (
            <div className="complaints-detail-grid grid grid-cols-1 xl:grid-cols-3 gap-4">
              <Card className="xl:col-span-2 complaints-detail-card">
                <CardHeader className="complaints-section-header">
                  <CardTitle className="flex items-center gap-2">
                    Reklamationsdetails
                    <Badge variant="outline">{selectedComplaint.complaintNumber}</Badge>
                  </CardTitle>
                  <CardDescription>
                    Auftrag {selectedOrderNumber} • Kunde {selectedCustomerName}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 complaints-detail-content">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Status</p>
                      <Badge className={`complaints-status-badge ${selectedStatusMeta.className}`} variant="outline">
                        <SelectedStatusIcon className="h-3.5 w-3.5" />
                        <span>{selectedStatusMeta.label}</span>
                      </Badge>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Zusatzkosten</p>
                      <p className="font-medium">{formatEUR(selectedComplaint.extraCosts || 0)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Teilerstattung</p>
                      <p className="font-medium">{formatEUR(selectedComplaint.partialRefund || 0)}</p>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Reklamationsgrund</p>
                    <p>{selectedComplaint.complaintReason || "-"}</p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Beschreibung</p>
                    <p>{selectedComplaint.description || "-"}</p>
                  </div>

                  {selectedComplaint.technicianReason && (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">
                        {selectedComplaint.status === "pending_approval"
                          ? "Techniker-Ablehnung (wartet auf Admin-Freigabe)"
                          : "Techniker-Begruendung"}
                      </p>
                      <p>{selectedComplaint.technicianReason}</p>
                    </div>
                  )}

                  {selectedComplaint.rejectionReason && (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Ablehnungsgrund (Admin)</p>
                      <p>{selectedComplaint.rejectionReason}</p>
                    </div>
                  )}

                  {(selectedComplaint as ComplaintWithLabel).hasShippingLabel && (
                    <div className="space-y-2 border rounded-md p-3 bg-muted/20 complaints-sub-panel">
                      <p className="text-xs text-muted-foreground">DHL-Einsendelabel (Kunde → McRepair)</p>
                      <div className="flex flex-wrap items-center gap-3">
                        <ComplaintLabelDownloadButton
                          complaintId={selectedComplaint._id}
                          complaintNumber={selectedComplaint.complaintNumber}
                          variant="secondary"
                        />
                        {(selectedComplaint as ComplaintWithLabel).shippingTrackingNumber && (
                          <span className="text-sm">
                            Sendungsnummer: <strong>{(selectedComplaint as ComplaintWithLabel).shippingTrackingNumber}</strong>
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {selectedComplaintOrderId && (
                    <div className="space-y-2 border rounded-md p-3 bg-muted/20 complaints-sub-panel">
                      <p className="text-xs text-muted-foreground">Reklamationsauftrag</p>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{selectedComplaintOrderNumber || selectedComplaintOrderId}</Badge>
                        <Button
                          variant="outline"
                          size="sm"
                          className="complaints-secondary-button"
                          onClick={() => navigate(getOrderDetailsPath(selectedComplaintOrderId), {
                            state: buildOrderDetailsState(location, {
                              label: t('common.back'),
                              restoreState: selectedComplaint?._id ? { reopenComplaintId: selectedComplaint._id } : undefined,
                            }),
                          })}
                        >
                          Reklamationsauftrag bearbeiten
                        </Button>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <p className="text-sm font-medium">Audit Trail</p>
                    <div className="max-h-60 overflow-y-auto border rounded-md divide-y complaints-audit-trail">
                      {(selectedComplaint.complaintLogs || []).length > 0 ? (
                        (selectedComplaint.complaintLogs || []).map((log, index) => (
                          <div key={`${log.createdAt}-${index}`} className="p-3 text-xs">
                            <div className="flex justify-between gap-4">
                              <span className="font-medium">{log.action}</span>
                              <span className="text-muted-foreground">{new Date(log.createdAt).toLocaleString("de-DE")}</span>
                            </div>
                            <p className="text-muted-foreground mt-1">
                              {log.actorName} ({log.actorRole})
                              {log.fromStatus || log.toStatus ? ` • ${log.fromStatus || "-"} -> ${log.toStatus || "-"}` : ""}
                            </p>
                            {log.notes && <p className="mt-1">{log.notes}</p>}
                          </div>
                        ))
                      ) : (
                        <div className="p-3 text-sm text-muted-foreground">Keine Log-Eintraege vorhanden.</div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="complaints-actions-card">
                <CardHeader className="complaints-section-header">
                  <CardTitle>Aktionen</CardTitle>
                  <CardDescription>Statusabhaengige Reklamationssteuerung</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 complaints-actions-content">
                  {canApprove && (
                    <Button
                      className="w-full complaints-primary-button"
                      disabled={actionLoading === "approve"}
                      onClick={handleApprove}
                    >
                      {actionLoading === "approve" ? "Label wird erstellt …" : "Genehmigen & DHL-Einsendelabel erstellen"}
                    </Button>
                  )}

                  {canReject && (
                    <Button
                      variant="destructive"
                      className="w-full"
                      onClick={() => openActionDialog("reject")}
                    >
                      Admin: Ablehnen & Angebot senden
                    </Button>
                  )}

                  {canAcknowledge && (
                    <Button className="w-full complaints-primary-button" onClick={() => openActionDialog("ack")}>
                      Techniker: Anerkennen
                    </Button>
                  )}

                  {canDeny && (
                    <Button variant="outline" className="w-full complaints-secondary-button" onClick={() => openActionDialog("deny")}>
                      Techniker: Ablehnen
                    </Button>
                  )}

                  {!canApprove && !canReject && !canAcknowledge && !canDeny && (
                    <p className="text-sm text-muted-foreground">
                      Fuer den aktuellen Status sind keine manuellen Aktionen verfuegbar.
                    </p>
                  )}

                  <div className="complaints-communication-panel border rounded-xl p-3 space-y-3">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 complaints-communication-icon" />
                      <h4 className="font-medium text-sm">Nachrichten zur Reklamation</h4>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      „An Kunden“ sieht der Kunde in seiner Reklamation (mit Benachrichtigung). „Intern – nur für das Team“ sieht der Kunde nie.
                    </p>

                    <div className="complaints-communication-surface rounded-lg border bg-background">
                      <div className="complaints-thread-list max-h-72 overflow-y-auto divide-y">
                        {(selectedComplaint.comments || []).length > 0 ? (
                          (selectedComplaint.comments || []).map((comment) => (
                            <div key={comment._id} className="complaints-thread-item p-3 space-y-1">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 text-xs">
                                  <span className="font-semibold text-foreground">{comment.userName}</span>
                                  <Badge variant="outline" className="text-[10px] px-2 py-0 h-5">
                                    {ROLE_LABELS[comment.userRole] || comment.userRole}
                                  </Badge>
                                  {comment.isInternal ? (
                                    <Badge variant="outline" className="text-[10px] px-2 py-0 h-5 gap-1 complaints-internal-badge bg-slate-100 text-slate-700">
                                      <Lock className="h-3 w-3" /> Intern – nur für das Team
                                    </Badge>
                                  ) : comment.userRole !== "customer" ? (
                                    <Badge variant="outline" className="text-[10px] px-2 py-0 h-5 gap-1 bg-blue-50 text-blue-800 border-blue-200">
                                      <Send className="h-3 w-3" /> An Kunden
                                    </Badge>
                                  ) : null}
                                </div>
                                <span className="text-[11px] text-muted-foreground">
                                  {new Date(comment.createdAt).toLocaleString("de-DE")}
                                </span>
                              </div>
                              <p className="text-xs leading-relaxed whitespace-pre-wrap">{comment.comment}</p>
                            </div>
                          ))
                        ) : (
                          <div className="p-4 text-xs text-muted-foreground">
                            Noch keine Nachrichten zur Reklamation vorhanden.
                          </div>
                        )}
                      </div>

                      <div className="complaints-thread-composer p-3 border-t space-y-3">
                        <Label htmlFor="complaint-message-draft" className="text-xs text-muted-foreground">
                          Text
                        </Label>
                        <Textarea
                          id="complaint-message-draft"
                          value={complaintMessage}
                          onChange={(e) => setComplaintMessage(e.target.value)}
                          rows={3}
                          placeholder="Nachricht an den Kunden oder interne Notiz schreiben …"
                          className="text-sm"
                        />
                        <div className="flex flex-col gap-2">
                          <Button
                            className="complaints-primary-button justify-start"
                            size="sm"
                            onClick={() => handleSendComplaintMessage("customer")}
                            disabled={!complaintMessage.trim() || Boolean(sendingComplaintMessage)}
                          >
                            <Send className="h-3.5 w-3.5 mr-1" />
                            {sendingComplaintMessage === "customer" ? "Wird gesendet …" : "Nachricht an Kunden senden"}
                            <span className="ml-auto rounded bg-white/20 px-1.5 py-0.5 text-[10px] font-semibold">An Kunden</span>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="justify-start border-slate-300 bg-slate-50 text-slate-800 hover:bg-slate-100"
                            onClick={() => handleSendComplaintMessage("internal")}
                            disabled={!complaintMessage.trim() || Boolean(sendingComplaintMessage)}
                          >
                            <Lock className="h-3.5 w-3.5 mr-1" />
                            {sendingComplaintMessage === "internal" ? "Wird gespeichert …" : "Interne Notiz speichern"}
                            <span className="ml-auto rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold">Intern – nur für das Team</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="self-end text-xs text-muted-foreground"
                            onClick={() => setComplaintMessage("")}
                            disabled={!complaintMessage || Boolean(sendingComplaintMessage)}
                          >
                            Entwurf verwerfen
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
              )
            })()
          )}
        </CardContent>
      </Card>

      <Dialog open={actionDialog === "reject"} onOpenChange={(open) => !open && closeActionDialog()}>
        <DialogContent className="sm:max-w-xl complaints-dialog-surface">
          <DialogHeader>
            <DialogTitle>Reklamation ablehnen und Angebot senden</DialogTitle>
            <DialogDescription>Bitte das vom Techniker eskalierte Reparaturangebot prüfen und für den Kunden vervollständigen.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Ablehnungsgrund des Technikers</label>
              <Textarea
                value={denyTechnicianReason}
                onChange={(e) => setDenyTechnicianReason(e.target.value)}
                placeholder="Ablehnungsgrund des Technikers..."
                rows={3}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Angebotspreis (EUR)</label>
              <Input
                value={offerAmount}
                onChange={(e) => setOfferAmount(e.target.value)}
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Angebotsbeschreibung</label>
              <Textarea
                value={offerDescription}
                onChange={(e) => setOfferDescription(e.target.value)}
                placeholder="Beschreibung des Reparaturangebots..."
                rows={5}
              />
              <p className="text-xs text-muted-foreground">Das Angebot wird nach der Bestätigung an den Kunden übermittelt.</p>
            </div>
          </div>
          <DialogFooter>
            <Button className="complaints-secondary-button" variant="outline" onClick={closeActionDialog}>Abbrechen</Button>
            <Button
              variant="destructive"
              disabled={!selectedComplaint || !denyTechnicianReason.trim() || !offerDescription.trim() || actionLoading === "reject"}
              onClick={async () => {
                if (!selectedComplaint) return
                await runAction(
                  "reject",
                  () => denyComplaint(selectedComplaint._id, {
                    technician_reason: denyTechnicianReason.trim(),
                    offer_amount: Number(offerAmount || 0),
                    offer_description: offerDescription.trim(),
                  }),
                  "Reklamation wurde abgelehnt und das Angebot an den Kunden gesendet."
                )
                closeActionDialog()
              }}
            >
              {actionLoading === "reject" ? "Bitte warten..." : "Ablehnen und Angebot senden"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={actionDialog === "ack"} onOpenChange={(open) => !open && closeActionDialog()}>
        <DialogContent className="sm:max-w-2xl complaints-dialog-surface">
          <DialogHeader>
            <DialogTitle>Reklamation anerkennen</DialogTitle>
            <DialogDescription>Techniker-Begruendung und optionale Zusatzdaten erfassen.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Textarea
              value={ackTechnicianReason}
              onChange={(e) => setAckTechnicianReason(e.target.value)}
              placeholder="technician_reason"
              rows={3}
            />
            <Input
              value={partialRefund}
              onChange={(e) => setPartialRefund(e.target.value)}
              type="number"
              min="0"
              step="0.01"
              placeholder="partial_refund"
            />
            <Textarea
              value={repairNotes}
              onChange={(e) => setRepairNotes(e.target.value)}
              rows={3}
              placeholder="repair_notes"
            />
            <div className="grid grid-cols-3 gap-2">
              <Input
                value={additionalPartName}
                onChange={(e) => setAdditionalPartName(e.target.value)}
                placeholder="Teilname"
              />
              <Input
                value={additionalPartQuantity}
                onChange={(e) => setAdditionalPartQuantity(e.target.value)}
                type="number"
                min="1"
                step="1"
                placeholder="Menge"
              />
              <Input
                value={additionalPartCost}
                onChange={(e) => setAdditionalPartCost(e.target.value)}
                type="number"
                min="0"
                step="0.01"
                placeholder="Kosten"
              />
            </div>
          </div>
          <DialogFooter>
            <Button className="complaints-secondary-button" variant="outline" onClick={closeActionDialog}>Abbrechen</Button>
            <Button
              className="complaints-primary-button"
              disabled={!selectedComplaint || !ackTechnicianReason.trim() || actionLoading === "ack"}
              onClick={async () => {
                if (!selectedComplaint) return
                await runAction(
                  "ack",
                  () => acknowledgeComplaint(selectedComplaint._id, {
                    technician_reason: ackTechnicianReason.trim(),
                    additional_parts: additionalPartName.trim()
                      ? [{
                          name: additionalPartName.trim(),
                          quantity: Number(additionalPartQuantity || 1),
                          cost: Number(additionalPartCost || 0),
                        }]
                      : undefined,
                    partial_refund: Number(partialRefund || 0),
                    repair_notes: repairNotes.trim() || undefined,
                  }),
                  "Reklamation wurde als anerkannt markiert."
                )
                closeActionDialog()
              }}
            >
              {actionLoading === "ack" ? "Bitte warten..." : "Anerkennen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={actionDialog === "deny"} onOpenChange={(open) => !open && closeActionDialog()}>
        <DialogContent className="sm:max-w-lg complaints-dialog-surface">
          <DialogHeader>
            <DialogTitle>Reklamation ablehnen (Techniker)</DialogTitle>
            <DialogDescription>Begruendung und neues Reparaturangebot erfassen.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Textarea
              value={denyTechnicianReason}
              onChange={(e) => setDenyTechnicianReason(e.target.value)}
              placeholder="technician_reason"
              rows={3}
            />
            <Input
              value={offerAmount}
              onChange={(e) => setOfferAmount(e.target.value)}
              type="number"
              min="0"
              step="0.01"
              placeholder="offer_amount"
            />
            <Textarea
              value={offerDescription}
              onChange={(e) => setOfferDescription(e.target.value)}
              rows={3}
              placeholder="offer_description"
            />
          </div>
          <DialogFooter>
            <Button className="complaints-secondary-button" variant="outline" onClick={closeActionDialog}>Abbrechen</Button>
            <Button
              variant="outline"
              className="complaints-secondary-button"
              disabled={!selectedComplaint || !denyTechnicianReason.trim() || actionLoading === "deny"}
              onClick={async () => {
                if (!selectedComplaint) return
                await runAction(
                  "deny",
                  () => denyComplaint(selectedComplaint._id, {
                    technician_reason: denyTechnicianReason.trim(),
                    offer_amount: Number(offerAmount || 0),
                    offer_description: offerDescription.trim() || undefined,
                  }),
                  "Reklamation wurde abgelehnt und ein Angebot erstellt."
                )
                closeActionDialog()
              }}
            >
              {actionLoading === "deny" ? "Bitte warten..." : "Ablehnen und Angebot erstellen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
