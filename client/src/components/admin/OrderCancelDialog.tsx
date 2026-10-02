import { useEffect, useState } from "react"
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
import { updateOrderStatus } from "@/api/adminOrders"
import { AlertTriangle, Lock, RotateCcw, XCircle } from "lucide-react"

/**
 * "Auftrag stornieren?" (HIST-14) - EIN Dialog für alle Stellen, an denen Personal einen
 * Reparaturauftrag storniert (Auftragsdetail-Statusmenü, Auftragsliste, Plantafel).
 *
 * - Grund ist Pflicht (der Server lehnt Storno ohne Grund mit 400 ab) und bleibt intern.
 * - Hinweis: Rechnungen und Zahlungen werden weder storniert noch erstattet.
 * - Laufende Reparatur-/Template-Workflows hält der Server an (Zeiterfassung stoppt).
 *
 * Verwendung:
 *   <OrderCancelDialog open={open} onOpenChange={setOpen} orderId={id} orderNumber={order.orderNumber}
 *     onCancelled={() => refreshOrder()} />
 *
 * mode="reopen" ("Storno aufheben", nur Admin): derselbe Dialog mit Pflichtgrund; der Auftrag wird
 * als "Ausstehend" wieder geöffnet, angehaltene Workflows bleiben angehalten.
 */
interface OrderCancelDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  orderId: string
  orderNumber?: string
  onCancelled?: (result: any) => void
  mode?: "cancel" | "reopen"
}

export function OrderCancelDialog({ open, onOpenChange, orderId, orderNumber, onCancelled, mode = "cancel" }: OrderCancelDialogProps) {
  const isReopen = mode === "reopen"
  const { toast } = useToast()
  const [reason, setReason] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setReason("")
      setError(null)
    }
  }, [open])

  const handleConfirm = async () => {
    const trimmed = reason.trim()
    if (!trimmed) {
      setError(isReopen ? "Bitte einen Grund für das Aufheben der Stornierung angeben." : "Bitte einen Grund für die Stornierung angeben.")
      return
    }
    if (isReopen) {
      try {
        setSaving(true)
        setError(null)
        const result = await updateOrderStatus(orderId, "pending", trimmed, { reopen: true })
        toast({ title: "Stornierung aufgehoben", description: "Der Auftrag ist wieder „Ausstehend“. Angehaltene Workflows bitte bewusst fortsetzen." })
        onOpenChange(false)
        onCancelled?.(result)
      } catch (reopenError: any) {
        setError(reopenError?.message || "Die Stornierung konnte nicht aufgehoben werden.")
      } finally {
        setSaving(false)
      }
      return
    }
    try {
      setSaving(true)
      setError(null)
      // updateOrderStatus sendet den Grund als `note`; der Server übernimmt ihn als Verlaufsgrund.
      const result = await updateOrderStatus(orderId, "cancelled", trimmed)
      const effects = result?.cancelEffects || {}
      const paused: string[] = []
      if (effects.repairWorkflowPaused) paused.push("Reparatur pausiert")
      if (Array.isArray(effects.templateWorkflowsPaused) && effects.templateWorkflowsPaused.length) {
        paused.push(`${effects.templateWorkflowsPaused.length} Workflow(s) angehalten`)
      }
      toast({
        title: "Auftrag storniert",
        description: `${result?.message || "Der Auftrag wurde storniert."}${paused.length ? ` ${paused.join(", ")}.` : ""}`,
      })
      ;(Array.isArray(result?.warnings) ? result.warnings : []).forEach((warning: string) => {
        toast({ title: "Hinweis", description: warning, variant: "destructive" })
      })
      onOpenChange(false)
      onCancelled?.(result)
    } catch (cancelError: any) {
      setError(cancelError?.message || "Der Auftrag konnte nicht storniert werden.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(value) => { if (!saving) onOpenChange(value) }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-800">
            {isReopen
              ? <RotateCcw className="h-5 w-5 text-blue-700" aria-hidden="true" />
              : <XCircle className="h-5 w-5 text-red-600" aria-hidden="true" />}
            {isReopen ? "Stornierung aufheben?" : "Auftrag stornieren?"}
          </DialogTitle>
          <DialogDescription>
            {isReopen
              ? `${orderNumber ? `Auftrag ${orderNumber}` : "Der Auftrag"} wird wieder geöffnet (Status „Ausstehend“). Angehaltene Workflows bleiben angehalten und werden bewusst fortgesetzt.`
              : `${orderNumber ? `Auftrag ${orderNumber} wird storniert.` : "Der Auftrag wird storniert."} Laufende Reparatur-Workflows werden angehalten.`}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
            <span>{isReopen
              ? "Rechnungen, Zahlungen und Labels werden dadurch nicht verändert."
              : "Rechnungen und Zahlungen werden dadurch weder storniert noch erstattet. Bitte bei Bedarf in der Rechnungsverwaltung bearbeiten."}</span>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="order-cancel-reason" className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-700">
              Grund <span className="text-destructive">*</span>
              <span className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                <Lock className="h-3 w-3" aria-hidden="true" /> Intern – nur für das Team
              </span>
            </Label>
            <Textarea
              id="order-cancel-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder={isReopen ? "z. B. Storno versehentlich ausgelöst, Kunde möchte doch reparieren" : "z. B. Kunde hat den Auftrag zurückgezogen"}
              className="min-h-[80px] resize-none text-sm"
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "order-cancel-error" : undefined}
              disabled={saving}
            />
            {error && <p id="order-cancel-error" className="text-xs text-red-700">{error}</p>}
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Abbrechen</Button>
          <Button onClick={handleConfirm} disabled={saving || !reason.trim()} className={isReopen ? "bg-[#1a2a5e] hover:bg-[#0f1d45] text-white" : "bg-red-600 hover:bg-red-700 text-white"}>
            {isReopen ? (saving ? "Wird wieder geöffnet …" : "Stornierung aufheben") : (saving ? "Wird storniert …" : "Auftrag stornieren")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
