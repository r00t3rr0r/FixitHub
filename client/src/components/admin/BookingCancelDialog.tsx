import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/useToast"
import { cancelBooking } from "@/api/bookings"
import { getOrderDetailsPath } from "@/lib/orderDetailsNavigation"
import { AlertTriangle, Lock, XCircle } from "lucide-react"

/**
 * "Buchung stornieren?" (ORD-1) - EIN Dialog für den Buchungs-Storno (Aktionsmenü der Buchungsliste
 * und Statusauswahl "Storniert" im Buchungsdetail).
 *
 * - Grund ist Pflicht und bleibt intern (Server: 400 CANCEL_REASON_REQUIRED).
 * - Hat die Buchung noch offene Aufträge, lehnt der Server mit 409 ab und nennt sie; die Aufträge
 *   werden einzeln mit "Auftrag stornieren" (OrderCancelDialog) storniert - dabei hält der Server
 *   laufende Reparaturen an. So läuft nie ein Workflow einer stornierten Buchung weiter.
 * - Rechnungen und Zahlungen werden weder storniert noch erstattet.
 */
interface BookingCancelDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  bookingId: string
  bookingNumber?: string
  onCancelled?: () => void
}

type OpenOrder = { _id: string; orderNumber: string; status: string }

export function BookingCancelDialog({ open, onOpenChange, bookingId, bookingNumber, onCancelled }: BookingCancelDialogProps) {
  const { toast } = useToast()
  const [reason, setReason] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [openOrders, setOpenOrders] = useState<OpenOrder[]>([])

  useEffect(() => {
    if (open) {
      setReason("")
      setError(null)
      setOpenOrders([])
    }
  }, [open])

  const handleConfirm = async () => {
    const trimmed = reason.trim()
    if (!trimmed) {
      setError("Bitte einen Grund für die Stornierung angeben.")
      return
    }
    try {
      setSaving(true)
      setError(null)
      setOpenOrders([])
      await cancelBooking(bookingId, trimmed)
      toast({ title: "Buchung storniert", description: `${bookingNumber ? `Buchung ${bookingNumber}` : "Die Buchung"} wurde storniert.` })
      onOpenChange(false)
      onCancelled?.()
    } catch (cancelError: any) {
      setError(cancelError?.message || "Die Buchung konnte nicht storniert werden.")
      setOpenOrders(Array.isArray(cancelError?.openOrders) ? cancelError.openOrders : [])
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(value) => { if (!saving) onOpenChange(value) }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-800">
            <XCircle className="h-5 w-5 text-red-600" aria-hidden="true" />
            Buchung stornieren?
          </DialogTitle>
          <DialogDescription>
            {bookingNumber ? `Buchung ${bookingNumber} wird storniert.` : "Die Buchung wird storniert."} Der Kunde erhält eine Storno-E-Mail (ohne den internen Grund).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
            <span>Offene Aufträge der Buchung müssen vorher einzeln storniert werden. Rechnungen und Zahlungen werden weder storniert noch erstattet.</span>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="booking-cancel-reason" className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-700">
              Grund <span className="text-destructive">*</span>
              <span className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                <Lock className="h-3 w-3" aria-hidden="true" /> Intern – nur für das Team
              </span>
            </Label>
            <Textarea
              id="booking-cancel-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="z. B. Kunde hat die Buchung zurückgezogen"
              className="min-h-[80px] resize-none text-sm"
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "booking-cancel-error" : undefined}
              disabled={saving}
            />
            {error && (
              <div id="booking-cancel-error" role="alert" className="space-y-1 text-xs text-red-700">
                <p>{error}</p>
                {openOrders.length > 0 && (
                  <ul className="list-disc pl-4">
                    {openOrders.map((order) => (
                      <li key={order._id}>
                        <Link to={getOrderDetailsPath(order._id)} className="underline underline-offset-2" onClick={() => onOpenChange(false)}>
                          {order.orderNumber || "Auftrag"} öffnen
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Abbrechen</Button>
          <Button onClick={handleConfirm} disabled={saving || !reason.trim()} className="bg-red-600 hover:bg-red-700 text-white">
            {saving ? "Wird storniert …" : "Buchung stornieren"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
