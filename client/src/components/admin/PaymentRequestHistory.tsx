import { useCallback, useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/useToast"
import { formatEUR } from "@/lib/utils"
import {
  getPaymentRequests,
  resendPaymentRequest,
  FinancialApiError,
  type PaymentRequestRecord,
} from "@/api/financial"
import { Loader2, Mail, RefreshCw, Send } from "lucide-react"

/**
 * FIN-11: Verlauf der Zahlungsaufforderungen einer Buchung mit kontrolliertem
 * "Zahlungsaufforderung erneut senden". Die Bestätigung erscheint INLINE (kein zweiter,
 * verschachtelter Dialog) und zeigt Empfänger, Betrag, Rechnung und die bisherigen
 * Aufforderungen. Innerhalb von 24 h nach einer vom Mailserver angenommenen Aufforderung
 * sendet der Server nur mit ausdrücklicher Bestätigung (force) erneut.
 * Nur für Administratoren (der Server-Endpunkt ist admin-only).
 */

const COOLDOWN_MS = 24 * 60 * 60 * 1000

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  pending: { label: "Wird gesendet", className: "bg-yellow-100 text-yellow-800" },
  accepted_by_provider: { label: "Vom Mailserver angenommen", className: "bg-green-100 text-green-800" },
  failed: { label: "Fehlgeschlagen", className: "bg-red-100 text-red-800" },
}

const formatDateTime = (value?: string) =>
  value ? new Date(value).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"

export function PaymentRequestHistory({ bookingId, open }: { bookingId: string; open: boolean }) {
  const { toast } = useToast()
  const [requests, setRequests] = useState<PaymentRequestRecord[]>([])
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error" | "unavailable">("idle")
  const [errorText, setErrorText] = useState("")
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [overrideCooldown, setOverrideCooldown] = useState(false)
  const [sending, setSending] = useState(false)

  const load = useCallback(async () => {
    if (!bookingId) return
    try {
      setState("loading")
      const result = await getPaymentRequests(bookingId)
      if (!result.available) {
        setRequests([])
        setState("unavailable")
        return
      }
      const sorted = [...result.requests].sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime())
      setRequests(sorted)
      setState("ready")
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "")
      setState("error")
    }
  }, [bookingId])

  useEffect(() => {
    if (open) {
      setConfirmId(null)
      setOverrideCooldown(false)
      void load()
    }
  }, [open, load])

  const selected = useMemo(() => requests.find((request) => request._id === confirmId) || null, [requests, confirmId])

  // Letzte vom Mailserver angenommene Aufforderung fuer dasselbe Ziel (Rechnung bzw. Buchung).
  const lastAcceptedForSelected = useMemo(() => {
    if (!selected) return null
    const sameTarget = (request: PaymentRequestRecord) => (selected.targetType === "invoice" && selected.invoiceId
      ? request.invoiceId === selected.invoiceId
      : true)
    return requests.find((request) => request.status === "accepted_by_provider" && sameTarget(request)) || null
  }, [requests, selected])

  const withinCooldown = Boolean(
    lastAcceptedForSelected && Date.now() - new Date(lastAcceptedForSelected.requestedAt).getTime() < COOLDOWN_MS
  )

  const handleResend = async () => {
    if (!selected || sending) return
    if (withinCooldown && !overrideCooldown) return
    try {
      setSending(true)
      const result = await resendPaymentRequest(selected._id, { force: withinCooldown && overrideCooldown })
      const accepted = result?.status === "accepted_by_provider" || result?.success
      toast({
        title: accepted ? "Zahlungsaufforderung erneut gesendet" : "Zahlungsaufforderung nicht versendet",
        description: accepted
          ? `An ${result?.recipientEmail || selected.recipientEmail || "den Kunden"} – vom Mailserver angenommen (keine Zustellbestätigung).`
          : (result?.error || result?.message || "Der Versand ist fehlgeschlagen."),
        variant: accepted ? undefined : "destructive",
      })
      setConfirmId(null)
      setOverrideCooldown(false)
      await load()
    } catch (error) {
      const apiError = error as FinancialApiError
      toast({
        title: apiError?.code === "PAYMENT_REQUEST_COOLDOWN" ? "Sperrfrist aktiv" : "Erneutes Senden fehlgeschlagen",
        description: apiError?.message || "Bitte erneut versuchen.",
        variant: "destructive",
      })
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-base font-semibold">
          <Mail className="h-4 w-4" aria-hidden="true" />
          Zahlungsaufforderungen
        </h3>
        <Button size="sm" variant="ghost" onClick={() => void load()} disabled={state === "loading"} aria-label="Zahlungsaufforderungen neu laden">
          <RefreshCw className={`h-4 w-4 ${state === "loading" ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {state === "loading" && <p className="text-sm text-muted-foreground">Zahlungsaufforderungen werden geladen …</p>}
      {state === "unavailable" && <p className="text-sm text-muted-foreground">Der Verlauf der Zahlungsaufforderungen ist derzeit nicht verfügbar.</p>}
      {state === "error" && (
        <div className="flex flex-wrap items-center gap-2 text-sm" role="alert">
          <span className="text-destructive">{errorText || "Die Zahlungsaufforderungen konnten nicht geladen werden."}</span>
          <Button size="sm" variant="outline" onClick={() => void load()}>Erneut versuchen</Button>
        </div>
      )}
      {state === "ready" && requests.length === 0 && (
        <p className="rounded-lg border p-3 text-sm text-muted-foreground">Für diese Buchung wurde noch keine Zahlungsaufforderung gesendet.</p>
      )}
      {state === "ready" && requests.length > 0 && (
        <ul className="space-y-2">
          {requests.map((request) => {
            const status = STATUS_LABELS[request.status] || { label: request.status, className: "bg-gray-100 text-gray-800" }
            return (
              <li key={request._id} className="rounded-lg border p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="space-y-0.5">
                    <p className="font-medium">
                      {formatDateTime(request.requestedAt)} · {typeof request.amount === "number" ? formatEUR(request.amount) : "Betrag unbekannt"}
                      {request.invoiceNumber ? ` · Rechnung ${request.invoiceNumber}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      An {request.recipientName ? `${request.recipientName} ` : ""}{request.recipientEmail ? `<${request.recipientEmail}>` : "unbekannten Empfänger"}
                    </p>
                    {request.error && <p className="text-xs text-red-700">Fehler: {request.error}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={status.className}>{status.label}</Badge>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => { setConfirmId(request._id); setOverrideCooldown(false) }}
                      disabled={sending}
                    >
                      Erneut senden …
                    </Button>
                  </div>
                </div>

                {confirmId === request._id && selected && (
                  <div className="mt-3 space-y-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-950" role="group" aria-label="Erneutes Senden bestätigen">
                    <p className="font-semibold">Zahlungsaufforderung erneut senden?</p>
                    <dl className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-1 text-xs">
                      <dt className="text-amber-800">Empfänger</dt>
                      <dd>{selected.recipientName ? `${selected.recipientName} ` : ""}{selected.recipientEmail || "Kunden-E-Mail laut Buchung"}</dd>
                      <dt className="text-amber-800">Betrag</dt>
                      <dd>{typeof selected.amount === "number" ? formatEUR(selected.amount) : "offener Betrag laut Server"}</dd>
                      <dt className="text-amber-800">Rechnung</dt>
                      <dd>{selected.invoiceNumber || "Buchung (alle offenen Rechnungen)"}</dd>
                      <dt className="text-amber-800">Bisherige Aufforderungen</dt>
                      <dd>
                        {requests.length} insgesamt
                        {lastAcceptedForSelected ? `, zuletzt angenommen am ${formatDateTime(lastAcceptedForSelected.requestedAt)}` : ""}
                      </dd>
                    </dl>
                    {withinCooldown && (
                      <div className="space-y-1 text-xs">
                        <p>
                          Innerhalb der letzten 24 Stunden wurde bereits eine Zahlungsaufforderung versendet. Ein erneuter Versand ist
                          normalerweise erst nach Ablauf der Sperrfrist möglich.
                        </p>
                        <label className="flex items-center gap-2 font-medium">
                          <input type="checkbox" checked={overrideCooldown} onChange={(event) => setOverrideCooldown(event.target.checked)} />
                          Sperrfrist bewusst übergehen und trotzdem senden
                        </label>
                      </div>
                    )}
                    <div className="flex flex-wrap justify-end gap-2 pt-1">
                      <Button size="sm" variant="outline" onClick={() => setConfirmId(null)} disabled={sending}>Abbrechen</Button>
                      <Button size="sm" onClick={() => void handleResend()} disabled={sending || (withinCooldown && !overrideCooldown)}>
                        {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                        Zahlungsaufforderung erneut senden
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
