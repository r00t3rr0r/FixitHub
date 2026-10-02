import { useEffect, useRef, useState } from "react"
import { CheckCircle, FileText, Loader2, XCircle } from "lucide-react"
import { formatDateDe, formatMoney } from "./repairRequestFormat"

export interface CustomerQuoteView {
  amount: number
  description?: string
  status: "draft" | "sent" | "accepted" | "declined"
  /** Version des veröffentlichten Kostenvoranschlags – wird bei der Antwort mitgeschickt. */
  version?: number
  publishedAt?: string | Date | null
  respondedAt?: string | Date | null
  legacy?: boolean
}

interface QuoteResponseCardProps {
  quote: CustomerQuoteView
  /** false, wenn die Anfrage abgeschlossen ist (umgewandelt/abgelehnt) – dann keine Buttons. */
  canRespond: boolean
  /**
   * seen = genau der Stand, den der Kunde gesehen und bestätigt hat. Der Server lehnt die Antwort
   * mit 409 (QUOTE_CHANGED) ab, wenn der Kostenvoranschlag inzwischen geändert wurde.
   */
  onRespond: (decision: "accept" | "decline", seen: { quoteVersion: number; amount: number }) => Promise<void>
}

/**
 * Kostenvoranschlag für Kunde und Gast: Betrag (inkl. MwSt.), Beschreibung, primär
 * "Kostenvoranschlag annehmen", sekundär "Ablehnen", jeweils mit Bestätigung.
 */
export function QuoteResponseCard({ quote, canRespond, onRespond }: QuoteResponseCardProps) {
  const [pending, setPending] = useState<"accept" | "decline" | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const seenVersion = useRef(quote.version ?? 0)

  // Neuer Stand vom Server (z. B. nach 409): offene Bestätigung verwerfen, Hinweis zeigen.
  useEffect(() => {
    const current = quote.version ?? 0
    if (current !== seenVersion.current) {
      seenVersion.current = current
      setPending(null)
      if (quote.status === "sent") setError("Der Kostenvoranschlag wurde aktualisiert. Bitte prüfen Sie den neuen Betrag.")
    }
  }, [quote.version, quote.status])

  const confirm = async () => {
    if (!pending || busy) return
    setBusy(true)
    setError("")
    try {
      await onRespond(pending, { quoteVersion: quote.version ?? 0, amount: Number(quote.amount) })
      setPending(null)
    } catch (err: any) {
      setError(err?.message || "Die Antwort konnte nicht gespeichert werden.")
    } finally {
      setBusy(false)
    }
  }

  const amountText = `${formatMoney(quote.amount)}${Number(quote.amount) === 0 ? " (kostenlos)" : ""}`
  const open = quote.status === "sent"

  return (
    <section
      aria-label="Kostenvoranschlag"
      className={`rounded-2xl border-2 p-4 sm:p-5 ${open ? "border-[#f5b800] bg-amber-50/60" : quote.status === "accepted" ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-slate-50"}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-600">
            <FileText className="h-4 w-4" aria-hidden="true" /> Kostenvoranschlag
          </p>
          <p className="mt-1 text-2xl font-extrabold text-[#1a2a5e]">{amountText}</p>
          <p className="text-xs text-slate-600">inkl. MwSt.{quote.publishedAt ? ` · gesendet am ${formatDateDe(quote.publishedAt)}` : ""}</p>
        </div>
        {open && canRespond && (
          <span className="inline-flex items-center rounded-full bg-[#f5b800] px-3 py-1 text-xs font-bold text-[#1a2a5e]">
            Antwort erforderlich
          </span>
        )}
      </div>

      {quote.description && <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-800">{quote.description}</p>}

      {open && canRespond && (
        <div className="mt-4 space-y-3">
          {!pending ? (
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => setPending("accept")}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[#1a2a5e] px-5 text-sm font-bold text-white hover:bg-[#0f1d45]"
              >
                <CheckCircle className="h-4 w-4" aria-hidden="true" /> Kostenvoranschlag annehmen
              </button>
              <button
                type="button"
                onClick={() => setPending("decline")}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
              >
                <XCircle className="h-4 w-4" aria-hidden="true" /> Ablehnen
              </button>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-300 bg-white p-3" role="alertdialog" aria-label="Antwort bestätigen">
              <p className="text-sm font-semibold text-slate-900">
                {pending === "accept"
                  ? `Kostenvoranschlag über ${amountText} verbindlich annehmen?`
                  : "Kostenvoranschlag ablehnen? Unser Team kann Ihnen danach ein neues Angebot senden."}
              </p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={confirm}
                  disabled={busy}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-[#1a2a5e] px-5 text-sm font-bold text-white disabled:opacity-60"
                >
                  {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                  {pending === "accept" ? "Ja, Kostenvoranschlag annehmen" : "Ja, ablehnen"}
                </button>
                <button
                  type="button"
                  onClick={() => setPending(null)}
                  disabled={busy}
                  className="inline-flex h-10 items-center justify-center rounded-full border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-700"
                >
                  Abbrechen
                </button>
              </div>
            </div>
          )}
          {error && <p className="text-sm font-medium text-red-700" role="alert">{error}</p>}
        </div>
      )}

      {quote.status === "accepted" && (
        <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-emerald-800">
          <CheckCircle className="h-4 w-4" aria-hidden="true" />
          Angenommen{quote.respondedAt ? ` am ${formatDateDe(quote.respondedAt)}` : ""} – wir melden uns mit den nächsten Schritten.
        </p>
      )}
      {quote.status === "declined" && (
        <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
          <XCircle className="h-4 w-4" aria-hidden="true" />
          Abgelehnt{quote.respondedAt ? ` am ${formatDateDe(quote.respondedAt)}` : ""}. Unser Team meldet sich bei Ihnen.
        </p>
      )}
    </section>
  )
}
