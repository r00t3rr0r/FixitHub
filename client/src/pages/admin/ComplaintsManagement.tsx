import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useToast } from "@/hooks/useToast"
import {
  getAllComplaints,
  getComplaint,
  approveComplaint,
  rejectComplaint,
  acknowledgeComplaint,
  denyComplaint,
  Complaint,
} from "@/api/complaints"

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
  "resolved",
  "closed"
]

const STATUS_BADGE_CLASS: Record<string, string> = {
  pending_approval: "bg-amber-100 text-amber-800 border-amber-300",
  approved: "bg-blue-100 text-blue-800 border-blue-300",
  rejected: "bg-rose-100 text-rose-800 border-rose-300",
  acknowledged: "bg-emerald-100 text-emerald-800 border-emerald-300",
  denied: "bg-orange-100 text-orange-800 border-orange-300",
  new_repair: "bg-violet-100 text-violet-800 border-violet-300",
  resolved: "bg-green-100 text-green-800 border-green-300",
  closed: "bg-slate-200 text-slate-800 border-slate-300",
}

type ActionDialogType = "reject" | "ack" | "deny" | null

export function ComplaintsManagement() {
  const navigate = useNavigate()
  const [complaints, setComplaints] = useState<Complaint[]>([])
  const [rows, setRows] = useState<AdminComplaintRow[]>([])
  const [selectedComplaintId, setSelectedComplaintId] = useState("")
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState("")
  const [actionDialog, setActionDialog] = useState<ActionDialogType>(null)
  const [statusFilter, setStatusFilter] = useState("all")
  const [technicianFilter, setTechnicianFilter] = useState("")
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")
  const [rejectionReason, setRejectionReason] = useState("")
  const [ackTechnicianReason, setAckTechnicianReason] = useState("")
  const [denyTechnicianReason, setDenyTechnicianReason] = useState("")
  const [partialRefund, setPartialRefund] = useState("0")
  const [repairNotes, setRepairNotes] = useState("")
  const [additionalPartName, setAdditionalPartName] = useState("")
  const [additionalPartQuantity, setAdditionalPartQuantity] = useState("1")
  const [additionalPartCost, setAdditionalPartCost] = useState("0")
  const [offerAmount, setOfferAmount] = useState("0")
  const [offerDescription, setOfferDescription] = useState("")
  const { toast } = useToast()

  const resetActionForms = () => {
    setRejectionReason("")
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
        from: fromDate || undefined,
        to: toDate || undefined,
        limit: 200,
      })

      const items = (response as any).complaints || []
      const listRows = (response as any).rows || []
      setComplaints(items)
      setRows(listRows)

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
      toast({
        title: "Fehler",
        description: error?.message || "Reklamationen konnten nicht geladen werden.",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchComplaints()
  }, [])

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
    setActionDialog(dialogType)
  }

  const closeActionDialog = () => {
    setActionDialog(null)
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Reklamationen</CardTitle>
          <CardDescription>
            Alle Reklamationen mit Status, Bearbeiter und Zusatzkosten.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Status</SelectItem>
                {STATUS_OPTIONS.map((status) => (
                  <SelectItem key={status} value={status}>{status}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={technicianFilter || "all"} onValueChange={(value) => setTechnicianFilter(value === "all" ? "" : value)}>
              <SelectTrigger>
                <SelectValue placeholder="Techniker" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Techniker</SelectItem>
                {technicianOptions.map((name) => (
                  <SelectItem key={name} value={name}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />

            <div className="flex gap-2">
              <Button onClick={() => fetchComplaints()} disabled={loading}>Filtern</Button>
              <Button variant="outline" onClick={exportCsv}>CSV Export</Button>
            </div>
          </div>

          <div className="overflow-x-auto border rounded-md">
            <table className="w-full text-sm">
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
                  <tr
                    key={row._id}
                    className={`border-t cursor-pointer hover:bg-muted/30 ${selectedComplaintId === row._id ? "bg-muted/40" : ""}`}
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
                            onClick={(e) => {
                              e.stopPropagation()
                              navigate(`/orders/${row.complaintOrderId}`)
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
                      <Badge className={STATUS_BADGE_CLASS[row.status] || ""} variant="outline">
                        {row.status}
                      </Badge>
                    </td>
                    <td className="p-3">{new Date(row.createdAt).toLocaleDateString("de-DE")}</td>
                    <td className="p-3">{(row.extraCosts || 0).toFixed(2)} EUR</td>
                  </tr>
                ))}
                {!loading && !visibleRows.length && (
                  <tr>
                    <td colSpan={8} className="p-6 text-center text-muted-foreground">
                      Keine Reklamationen gefunden.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {selectedComplaint && (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              <Card className="xl:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    Reklamationsdetails
                    <Badge variant="outline">{selectedComplaint.complaintNumber}</Badge>
                  </CardTitle>
                  <CardDescription>
                    Auftrag {selectedOrderNumber} • Kunde {selectedCustomerName}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Status</p>
                      <Badge className={STATUS_BADGE_CLASS[selectedComplaint.status] || ""} variant="outline">
                        {selectedComplaint.status}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Zusatzkosten</p>
                      <p className="font-medium">{(selectedComplaint.extraCosts || 0).toFixed(2)} EUR</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Teilerstattung</p>
                      <p className="font-medium">{(selectedComplaint.partialRefund || 0).toFixed(2)} EUR</p>
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
                      <p className="text-xs text-muted-foreground">Techniker-Begruendung</p>
                      <p>{selectedComplaint.technicianReason}</p>
                    </div>
                  )}

                  {selectedComplaint.rejectionReason && (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Ablehnungsgrund (Admin)</p>
                      <p>{selectedComplaint.rejectionReason}</p>
                    </div>
                  )}

                  {selectedComplaint.shippingLabelUrl && (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Versandlabel</p>
                      <a
                        href={selectedComplaint.shippingLabelUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm text-blue-600 underline"
                      >
                        {selectedComplaint.shippingLabelUrl}
                      </a>
                    </div>
                  )}

                  {selectedComplaintOrderId && (
                    <div className="space-y-2 border rounded-md p-3 bg-muted/20">
                      <p className="text-xs text-muted-foreground">Reklamationsauftrag</p>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{selectedComplaintOrderNumber || selectedComplaintOrderId}</Badge>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/orders/${selectedComplaintOrderId}`)}
                        >
                          Reklamationsauftrag bearbeiten
                        </Button>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <p className="text-sm font-medium">Audit Trail</p>
                    <div className="max-h-60 overflow-y-auto border rounded-md divide-y">
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

              <Card>
                <CardHeader>
                  <CardTitle>Aktionen</CardTitle>
                  <CardDescription>Statusabhaengige Reklamationssteuerung</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {canApprove && (
                    <Button
                      className="w-full"
                      disabled={actionLoading === "approve"}
                      onClick={() => runAction("approve", () => approveComplaint(selectedComplaint._id), "Reklamation wurde genehmigt.")}
                    >
                      {actionLoading === "approve" ? "Bitte warten..." : "Admin: Genehmigen"}
                    </Button>
                  )}

                  {canReject && (
                    <Button
                      variant="destructive"
                      className="w-full"
                      onClick={() => openActionDialog("reject")}
                    >
                      Admin: Ablehnen
                    </Button>
                  )}

                  {canAcknowledge && (
                    <Button className="w-full" onClick={() => openActionDialog("ack")}>
                      Techniker: Anerkennen
                    </Button>
                  )}

                  {canDeny && (
                    <Button variant="outline" className="w-full" onClick={() => openActionDialog("deny")}>
                      Techniker: Ablehnen
                    </Button>
                  )}

                  {!canApprove && !canReject && !canAcknowledge && !canDeny && (
                    <p className="text-sm text-muted-foreground">
                      Fuer den aktuellen Status sind keine manuellen Aktionen verfuegbar.
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={actionDialog === "reject"} onOpenChange={(open) => !open && closeActionDialog()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Reklamation ablehnen</DialogTitle>
            <DialogDescription>Bitte den verpflichtenden Ablehnungsgrund hinterlegen.</DialogDescription>
          </DialogHeader>
          <Textarea
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            placeholder="rejection_reason"
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" onClick={closeActionDialog}>Abbrechen</Button>
            <Button
              variant="destructive"
              disabled={!selectedComplaint || !rejectionReason.trim() || actionLoading === "reject"}
              onClick={async () => {
                if (!selectedComplaint) return
                await runAction("reject", () => rejectComplaint(selectedComplaint._id, rejectionReason.trim()), "Reklamation wurde abgelehnt.")
                closeActionDialog()
              }}
            >
              {actionLoading === "reject" ? "Bitte warten..." : "Ablehnen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={actionDialog === "ack"} onOpenChange={(open) => !open && closeActionDialog()}>
        <DialogContent className="sm:max-w-2xl">
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
            <Button variant="outline" onClick={closeActionDialog}>Abbrechen</Button>
            <Button
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
        <DialogContent className="sm:max-w-lg">
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
            <Button variant="outline" onClick={closeActionDialog}>Abbrechen</Button>
            <Button
              variant="outline"
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
