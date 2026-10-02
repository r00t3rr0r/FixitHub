// Gemeinsame Anzeige-Regeln für Reparaturanfragen (Kunde, Gast, Personal).

/** "Fairphone" + "Fairphone 5" => "Fairphone 5" (keine Dopplung bei Altbeständen). */
export function formatDeviceLabel(brand?: string | null, model?: string | null): string {
  const b = String(brand || "").trim()
  const m = String(model || "").trim()
  if (!b) return m
  if (!m) return b
  if (m.toLowerCase().startsWith(b.toLowerCase())) return m
  return `${b} ${m}`
}

/** Betrag immer de-DE mit Währung aus den Daten (Standard EUR): 89 => "89,00 €".
 *  Kein eigener Formatierer: der gemeinsame aus lib/utils (mit EUR-Fallback bei ungültigem Code). */
export { formatMoney } from "@/lib/utils"

export function formatDateDe(value?: string | Date | null, withTime = false): string {
  if (!value) return ""
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ""
  return withTime
    ? d.toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" })
}

export const REPAIR_REQUEST_STATUS_LABELS: Record<string, string> = {
  pending: "Ausstehend",
  reviewing: "In Prüfung",
  approved: "Kostenvoranschlag angenommen",
  rejected: "Abgelehnt",
  converted: "In Auftrag umgewandelt",
}

export const QUOTE_STATUS_LABELS: Record<string, string> = {
  draft: "Entwurf (nicht gesendet)",
  sent: "Gesendet – Antwort ausstehend",
  accepted: "Angenommen",
  declined: "Abgelehnt",
}

export function statusLabel(status?: string): string {
  return REPAIR_REQUEST_STATUS_LABELS[String(status || "")] || String(status || "")
}

/** Idempotenzschlüssel für eine Nachricht (Doppelklick/Enter erzeugt keine zweite Nachricht). */
export function newClientMessageId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof (crypto as any).randomUUID === "function") {
      return (crypto as any).randomUUID()
    }
  } catch {
    /* Fallback unten */
  }
  return `cm-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}
