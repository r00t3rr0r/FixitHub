import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/hooks/useToast"
import {
  allocateBookingPayment,
  createBookingPayment,
  deleteBookingPayment,
  getBookingPayments,
  importBookingPaypalPayments,
  removeBookingPaymentAllocation,
  type BookingPayment,
  type BookingPaymentMethod,
  type BookingPaymentOverview,
} from "@/api/bookingPayments"
import { AlertTriangle, ExternalLink, Link2, Loader2, Mail, Plus, RefreshCw, Trash2, Unlink } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { PaymentRequestHistory } from "@/components/admin/PaymentRequestHistory"

interface BookingPaymentsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  bookingId: string
  bookingNumber?: string
  onChanged?: () => void
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "Bar",
  bank_transfer: "Überweisung",
  sepa: "SEPA-Lastschrift",
  credit_card: "Kreditkarte",
  debit_card: "EC-/Debitkarte",
  paypal: "PayPal",
  invoice: "Rechnung",
  stripe: "Stripe",
  apple_pay: "Apple Pay",
  google_pay: "Google Pay",
}

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: "Offen",
  processing: "In Bearbeitung",
  completed: "Abgeschlossen",
  failed: "Fehlgeschlagen",
  refunded: "Erstattet",
  disputed: "Strittig",
}

// Belegstatus deutsch (FIN-11) statt des rohen Statuswerts.
const INVOICE_STATUS_LABELS: Record<string, string> = {
  draft: "Entwurf",
  pending_approval: "Freigabe ausstehend",
  sent: "Versendet",
  viewed: "Angesehen",
  partially_paid: "Teilweise bezahlt",
  paid: "Bezahlt",
  overdue: "Überfällig",
  cancelled: "Storniert",
  credited: "Gutgeschrieben",
}

const SOURCE_LABELS: Record<string, string> = {
  manual: "Manuell",
  gateway: "Gateway",
  checkout: "Checkout",
  paypal_import: "PayPal-Import",
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(Number(value || 0))

const formatDate = (value?: string) =>
  value ? new Date(value).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—"

const todayInputValue = () => new Date().toISOString().slice(0, 10)

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : "")

const statusVariant = (status: string) => {
  switch (status) {
    case "completed":
      return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
    case "pending":
    case "processing":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
    case "refunded":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
    case "failed":
    case "disputed":
      return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
  }
}

export function BookingPaymentsDialog({
  open,
  onOpenChange,
  bookingId,
  bookingNumber,
  onChanged,
}: BookingPaymentsDialogProps) {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { user } = useAuth()
  const isAdmin = (user as { role?: string } | null)?.role === "admin"

  const [overview, setOverview] = useState<BookingPaymentOverview | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [importing, setImporting] = useState(false)
  const [allocationDrafts, setAllocationDrafts] = useState<Record<string, { invoiceId: string; amount: string }>>({})

  const [form, setForm] = useState({
    paymentDate: todayInputValue(),
    amount: "",
    paymentMethod: "bank_transfer" as BookingPaymentMethod,
    invoiceId: "none",
    note: "",
  })

  const resetForm = useCallback(() => {
    setForm({
      paymentDate: todayInputValue(),
      amount: "",
      paymentMethod: "bank_transfer",
      invoiceId: "none",
      note: "",
    })
  }, [])

  const applyOverview = useCallback((data: BookingPaymentOverview) => {
    setOverview(data)
    setAllocationDrafts({})
  }, [])

  const loadOverview = useCallback(async () => {
    try {
      setLoading(true)
      const data = await getBookingPayments(bookingId)
      applyOverview(data)
    } catch (error) {
      toast({
        title: "Fehler",
        description: errorMessage(error) || "Zahlungen konnten nicht geladen werden",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [applyOverview, bookingId, toast])

  useEffect(() => {
    if (open && bookingId) {
      resetForm()
      loadOverview()
    }
  }, [open, bookingId, loadOverview, resetForm])

  const openInvoices = useMemo(
    () => (overview?.invoices || []).filter((invoice) => invoice.isOpen),
    [overview]
  )

  const validationError = useMemo(() => {
    const amount = Number(form.amount.replace(",", "."))
    if (!form.amount.trim()) return "Bitte geben Sie einen Betrag ein."
    if (!Number.isFinite(amount) || amount <= 0) return "Der Betrag muss größer als 0 sein."
    if (Math.round(amount * 100) / 100 !== amount) return "Der Betrag darf maximal zwei Nachkommastellen haben."
    if (!form.paymentDate) return "Bitte geben Sie ein Zahlungsdatum an."
    if (new Date(form.paymentDate) > new Date()) return "Das Zahlungsdatum darf nicht in der Zukunft liegen."
    if (form.note.length > 500) return "Der Hinweis darf maximal 500 Zeichen umfassen."

    if (form.invoiceId !== "none") {
      const invoice = overview?.invoices.find((entry) => entry._id === form.invoiceId)
      if (invoice && amount > invoice.openAmount + 0.01) {
        return `Der Betrag übersteigt den offenen Rechnungsbetrag (${formatCurrency(invoice.openAmount)}). Die Zahlung wird nur teilweise zugeordnet.`
      }
    }
    return ""
  }, [form, overview])

  const isBlockingError = Boolean(validationError) && !validationError.startsWith("Der Betrag übersteigt")

  const handleSubmit = async () => {
    if (isBlockingError) {
      toast({ title: "Eingabe prüfen", description: validationError, variant: "destructive" })
      return
    }

    try {
      setSaving(true)
      const data = await createBookingPayment(bookingId, {
        amount: Number(form.amount.replace(",", ".")),
        paymentDate: form.paymentDate,
        paymentMethod: form.paymentMethod,
        note: form.note,
        invoiceId: form.invoiceId === "none" ? undefined : form.invoiceId,
      })
      applyOverview(data)
      resetForm()
      onChanged?.()
      toast({ title: "Zahlung erfasst", description: "Die Zahlung wurde gespeichert." })
    } catch (error) {
      toast({ title: "Fehler", description: errorMessage(error) || "Zahlung konnte nicht gespeichert werden", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const handlePaypalImport = async () => {
    try {
      setImporting(true)
      const data = await importBookingPaypalPayments(bookingId)
      applyOverview(data)
      onChanged?.()
      const result = data.importResult
      toast({
        title: result?.warning ? "PayPal-Abgleich eingeschränkt" : "PayPal-Abgleich abgeschlossen",
        description: result?.warning
          || `${result?.imported || 0} neue, ${result?.updated || 0} aktualisierte und ${result?.linked || 0} verknüpfte Zahlungen.`,
        variant: result?.warning ? "destructive" : undefined,
      })
    } catch (error) {
      toast({ title: "Fehler", description: errorMessage(error) || "PayPal-Abgleich fehlgeschlagen", variant: "destructive" })
    } finally {
      setImporting(false)
    }
  }

  const handleAllocate = async (payment: BookingPayment) => {
    const draft = allocationDrafts[payment._id]
    if (!draft?.invoiceId) {
      toast({ title: "Rechnung wählen", description: "Bitte wählen Sie eine Rechnung für die Zuordnung.", variant: "destructive" })
      return
    }

    const parsedAmount = draft.amount.trim() ? Number(draft.amount.replace(",", ".")) : undefined
    if (parsedAmount !== undefined && (!Number.isFinite(parsedAmount) || parsedAmount <= 0)) {
      toast({ title: "Betrag prüfen", description: "Der Zuordnungsbetrag muss größer als 0 sein.", variant: "destructive" })
      return
    }
    if (parsedAmount !== undefined && parsedAmount > payment.unallocatedAmount + 0.01) {
      toast({
        title: "Betrag prüfen",
        description: `Maximal ${formatCurrency(payment.unallocatedAmount)} können zugeordnet werden.`,
        variant: "destructive",
      })
      return
    }

    try {
      setSaving(true)
      const data = await allocateBookingPayment(bookingId, payment._id, {
        invoiceId: draft.invoiceId,
        amount: parsedAmount,
      })
      applyOverview(data)
      onChanged?.()
      toast({ title: "Zuordnung gespeichert", description: "Die Zahlung wurde der Rechnung zugeordnet." })
    } catch (error) {
      toast({ title: "Fehler", description: errorMessage(error) || "Zuordnung fehlgeschlagen", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const handleRemoveAllocation = async (paymentId: string, allocationId: string) => {
    try {
      setSaving(true)
      const data = await removeBookingPaymentAllocation(bookingId, paymentId, allocationId)
      applyOverview(data)
      onChanged?.()
      toast({ title: "Zuordnung aufgehoben", description: "Die Zahlung ist wieder frei verfügbar." })
    } catch (error) {
      toast({ title: "Fehler", description: errorMessage(error) || "Zuordnung konnte nicht aufgehoben werden", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const handleDeletePayment = async (paymentId: string) => {
    try {
      setSaving(true)
      const data = await deleteBookingPayment(bookingId, paymentId)
      applyOverview(data)
      onChanged?.()
      toast({ title: "Zahlung gelöscht", description: "Die manuelle Zahlung wurde entfernt." })
    } catch (error) {
      toast({ title: "Fehler", description: errorMessage(error) || "Zahlung konnte nicht gelöscht werden", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const openInvoiceInFinance = (invoiceId: string) => {
    onOpenChange(false)
    navigate(`/admin/financial?tab=overview&highlightInvoiceId=${invoiceId}`)
  }

  // FIN-11: Zahlungsaufforderung ueber den Bestaetigungsdialog der Finanzverwaltung
  // (Empfaenger, Betrag, Rechnung, letzte Aufforderungen, 24-h-Sperre) - kein zweiter Versandweg.
  const openPaymentRequestInFinance = (invoiceId: string) => {
    onOpenChange(false)
    navigate(`/admin/financial?tab=invoices&highlightInvoiceId=${invoiceId}&action=paymentRequest`)
  }

  const summary = overview?.summary

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Zahlungen{bookingNumber ? ` – Buchung ${bookingNumber}` : ""}</DialogTitle>
          <DialogDescription>
            Zahlungen erfassen, eingegangene PayPal-Zahlungen abgleichen und Rechnungen zuordnen.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Always-visible balance overview: order value vs. payments vs. invoices */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-lg border bg-muted/30 p-4">
                <p className="text-xs uppercase tracking-wide text-foreground/60">Auftragswert</p>
                <p className="text-2xl font-bold">{formatCurrency(summary?.orderValue || 0)}</p>
                <p className="mt-1 text-xs text-foreground/60">
                  Nicht berechnet: {formatCurrency(summary?.notInvoicedTotal || 0)}
                </p>
              </div>
              <div className="rounded-lg border bg-muted/30 p-4">
                <p className="text-xs uppercase tracking-wide text-foreground/60">Eingegangene Zahlungen</p>
                <p className="text-2xl font-bold text-green-700 dark:text-green-400">
                  {formatCurrency(summary?.receivedTotal || 0)}
                </p>
                <p className="mt-1 text-xs text-foreground/60">
                  Nicht zugeordnet: {formatCurrency(summary?.unallocatedTotal || 0)}
                </p>
              </div>
              <div className="rounded-lg border bg-muted/30 p-4">
                <p className="text-xs uppercase tracking-wide text-foreground/60">Rechnungssumme</p>
                <p className="text-2xl font-bold">{formatCurrency(summary?.invoicedTotal || 0)}</p>
                <p className="mt-1 text-xs text-foreground/60">
                  Offen: {formatCurrency(summary?.invoiceOpenTotal || 0)}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Badge className={summary?.isFullyPaid ? statusVariant("completed") : statusVariant("pending")}>
                Saldo Auftrag: {formatCurrency(summary?.openOrderBalance || 0)}
              </Badge>
              {summary?.isOverpaid && (
                <Badge className={statusVariant("failed")}>
                  <AlertTriangle className="mr-1 h-3 w-3" />
                  Überzahlung
                </Badge>
              )}
              {(summary?.creditedTotal || 0) > 0 && (
                <Badge className={statusVariant("refunded")}>
                  Gutschriften: {formatCurrency(summary?.creditedTotal || 0)}
                </Badge>
              )}
              <div className="ml-auto flex gap-2">
                <Button variant="outline" size="sm" onClick={loadOverview} disabled={saving || importing}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Aktualisieren
                </Button>
                <Button variant="outline" size="sm" onClick={handlePaypalImport} disabled={importing || saving}>
                  {importing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                  Eingegangene PayPal-Zahlungen abgleichen
                </Button>
              </div>
            </div>

            <Separator />

            {/* Manual payment capture */}
            <div className="rounded-lg border p-4">
              <h3 className="mb-3 text-sm font-semibold">Zahlung manuell erfassen</h3>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                <div className="space-y-1">
                  <Label htmlFor="payment-date">Datum</Label>
                  <Input
                    id="payment-date"
                    type="date"
                    max={todayInputValue()}
                    value={form.paymentDate}
                    onChange={(event) => setForm((prev) => ({ ...prev, paymentDate: event.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="payment-amount">Betrag (EUR)</Label>
                  <Input
                    id="payment-amount"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0,00"
                    value={form.amount}
                    onChange={(event) => setForm((prev) => ({ ...prev, amount: event.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Zahlart</Label>
                  <Select
                    value={form.paymentMethod}
                    onValueChange={(value) => setForm((prev) => ({ ...prev, paymentMethod: value as BookingPaymentMethod }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Zahlart wählen" />
                    </SelectTrigger>
                    <SelectContent>
                      {(overview?.paymentMethods || []).map((method) => (
                        <SelectItem key={method} value={method}>
                          {PAYMENT_METHOD_LABELS[method] || method}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Rechnung (optional)</Label>
                  <Select
                    value={form.invoiceId}
                    onValueChange={(value) => setForm((prev) => ({ ...prev, invoiceId: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Keine Zuordnung" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Keine Zuordnung</SelectItem>
                      {openInvoices.map((invoice) => (
                        <SelectItem key={invoice._id} value={invoice._id}>
                          #{invoice.invoiceNumber} · offen {formatCurrency(invoice.openAmount)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="mt-3 space-y-1">
                <Label htmlFor="payment-note">Hinweis</Label>
                <Textarea
                  id="payment-note"
                  rows={2}
                  maxLength={500}
                  placeholder="Interner Hinweis zur Zahlung"
                  value={form.note}
                  onChange={(event) => setForm((prev) => ({ ...prev, note: event.target.value }))}
                />
              </div>

              <div className="mt-3 flex items-center gap-3">
                <Button onClick={handleSubmit} disabled={saving || isBlockingError}>
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                  Zahlung speichern
                </Button>
                {validationError && (
                  <p className={`text-sm ${isBlockingError ? "text-red-600" : "text-amber-600"}`}>{validationError}</p>
                )}
              </div>
            </div>

            {/* Invoices of the booking with direct link */}
            <div>
              <h3 className="mb-2 text-sm font-semibold">Rechnungen der Buchung</h3>
              {overview?.invoices.length ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Rechnung</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Fällig</TableHead>
                      <TableHead className="text-right">Summe</TableHead>
                      <TableHead className="text-right">Bezahlt</TableHead>
                      <TableHead className="text-right">Offen</TableHead>
                      <TableHead className="w-[120px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {overview.invoices.map((invoice) => (
                      <TableRow key={invoice._id} data-invoice-id={invoice._id}>
                        <TableCell className="font-medium">
                          #{invoice.invoiceNumber}
                          {invoice.isCreditNote && <Badge className="ml-2">Gutschrift</Badge>}
                        </TableCell>
                        <TableCell>
                          <Badge className={statusVariant(invoice.status === "paid" ? "completed" : invoice.status)}>
                            {INVOICE_STATUS_LABELS[invoice.status] || invoice.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatDate(invoice.dueDate)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(invoice.total)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(invoice.paidAmount)}</TableCell>
                        <TableCell className="text-right font-semibold">{formatCurrency(invoice.openAmount)}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          {!invoice.isCreditNote && Number(invoice.openAmount || 0) > 0.009
                            && !["cancelled", "credited", "draft"].includes(String(invoice.status || "")) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              title="Zahlungsaufforderung senden … (mit Bestätigung)"
                              aria-label={`Zahlungsaufforderung zu Rechnung ${invoice.invoiceNumber} senden`}
                              onClick={() => openPaymentRequestInFinance(invoice._id)}
                            >
                              <Mail className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Rechnung in der Finanzverwaltung öffnen"
                            aria-label={`Rechnung ${invoice.invoiceNumber} in der Finanzverwaltung öffnen`}
                            onClick={() => openInvoiceInFinance(invoice._id)}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="rounded-lg border p-4 text-sm text-foreground/60">
                  Für diese Buchung wurden noch keine Rechnungen erstellt.
                </p>
              )}
            </div>

            {/* Payments with allocation controls */}
            <div>
              <h3 className="mb-2 text-sm font-semibold">Zahlungseingänge</h3>
              {overview?.payments.length ? (
                <div className="space-y-3">
                  {overview.payments.map((payment) => {
                    const draft = allocationDrafts[payment._id] || { invoiceId: "", amount: "" }
                    const canAllocate = payment.status === "completed" && payment.unallocatedAmount > 0 && openInvoices.length > 0

                    return (
                      <div key={payment._id} className="rounded-lg border p-4" data-payment-id={payment._id}>
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-lg font-bold">{formatCurrency(payment.amount)}</span>
                              <Badge className={statusVariant(payment.status)}>
                                {PAYMENT_STATUS_LABELS[payment.status] || payment.status}
                              </Badge>
                              <Badge variant="outline">{PAYMENT_METHOD_LABELS[payment.paymentMethod] || payment.paymentMethod}</Badge>
                              {payment.source && <Badge variant="outline">{SOURCE_LABELS[payment.source] || payment.source}</Badge>}
                            </div>
                            <p className="mt-1 text-sm text-foreground/60">
                              {formatDate(payment.paymentDate)} · Transaktion: {payment.transactionId}
                            </p>
                            {payment.paypalCaptureId && (
                              <p className="text-xs text-foreground/60">PayPal-Transaktions-ID: {payment.paypalCaptureId}</p>
                            )}
                            {payment.note && <p className="mt-1 text-sm">{payment.note}</p>}
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-foreground/60">Zugeordnet</p>
                            <p className="font-semibold">{formatCurrency(payment.allocatedAmount)}</p>
                            <p className="text-xs text-foreground/60">
                              Frei: {formatCurrency(payment.unallocatedAmount)}
                            </p>
                            {payment.source === "manual" && payment.allocations.length === 0 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="mt-1 text-red-600"
                                disabled={saving}
                                onClick={() => handleDeletePayment(payment._id)}
                              >
                                <Trash2 className="mr-1 h-3 w-3" />
                                Löschen
                              </Button>
                            )}
                          </div>
                        </div>

                        {payment.allocations.length > 0 && (
                          <div className="mt-3 space-y-1">
                            {payment.allocations.map((allocation) => (
                              <div
                                key={allocation._id}
                                className="flex flex-wrap items-center gap-2 rounded border bg-muted/30 px-3 py-2 text-sm"
                              >
                                <Link2 className="h-3 w-3" />
                                <button
                                  type="button"
                                  className="font-medium underline underline-offset-2"
                                  onClick={() => openInvoiceInFinance(allocation.invoiceId)}
                                >
                                  Rechnung #{allocation.invoiceNumber}
                                </button>
                                <span>{formatCurrency(allocation.allocatedAmount)}</span>
                                <span className="text-foreground/60">{formatDate(allocation.allocatedAt)}</span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="ml-auto"
                                  disabled={saving}
                                  onClick={() => handleRemoveAllocation(payment._id, allocation._id)}
                                >
                                  <Unlink className="mr-1 h-3 w-3" />
                                  Aufheben
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}

                        {canAllocate && (
                          <div className="mt-3 flex flex-wrap items-end gap-2">
                            <div className="min-w-[220px] flex-1 space-y-1">
                              <Label>Nachträglich zuordnen</Label>
                              <Select
                                value={draft.invoiceId}
                                onValueChange={(value) =>
                                  setAllocationDrafts((prev) => ({
                                    ...prev,
                                    [payment._id]: { ...draft, invoiceId: value },
                                  }))
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Rechnung wählen" />
                                </SelectTrigger>
                                <SelectContent>
                                  {openInvoices.map((invoice) => (
                                    <SelectItem key={invoice._id} value={invoice._id}>
                                      #{invoice.invoiceNumber} · offen {formatCurrency(invoice.openAmount)}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="w-36 space-y-1">
                              <Label>Betrag</Label>
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder={formatCurrency(payment.unallocatedAmount)}
                                value={draft.amount}
                                onChange={(event) =>
                                  setAllocationDrafts((prev) => ({
                                    ...prev,
                                    [payment._id]: { ...draft, amount: event.target.value },
                                  }))
                                }
                              />
                            </div>
                            <Button size="sm" disabled={saving} onClick={() => handleAllocate(payment)}>
                              <Link2 className="mr-2 h-4 w-4" />
                              Zuordnen
                            </Button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="rounded-lg border p-4 text-sm text-foreground/60">
                  Für diese Buchung wurden noch keine Zahlungen erfasst.
                </p>
              )}
            </div>

            {/* FIN-11: Verlauf + "Zahlungsaufforderung erneut senden" (nur Admin, Server-Endpunkt admin-only) */}
            {isAdmin && (
              <>
                <Separator />
                <PaymentRequestHistory bookingId={bookingId} open={open} />
              </>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Schließen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
