/**
 * Rueckgabeweg eines fertig reparierten Auftrags (Status 'ready-for-pickup' = "Reparatur abgeschlossen").
 * Spiegel von server/utils/returnMethod.js - beide gleich halten.
 *
 * REGEL (aus dem Versandstand GET /api/orders/:id -> shipments, kein eigenes Feld "Liefermethode"):
 * - 'shipping': Versandlabel an den Kunden vorhanden (Auslieferung McRepair -> Kunde) ODER das Gerät
 *   kam per DHL-Einsendelabel (Einsendung Kunde -> McRepair: Label oder Sendungsnummer).
 * - 'pickup': Versandstand bekannt, aber nichts davon (z. B. vor Ort angenommen).
 * - 'unknown': kein Versandstand (Listen) -> neutral "Reparatur abgeschlossen".
 * Reparatur, Versand und Zahlung bleiben getrennt: "unterwegs"/"zugestellt" nur aus dem echten
 * Versandstatus der Auslieferung, nie eine Aussage über Zahlungen.
 */

export type ReturnMethod = 'shipping' | 'pickup' | 'unknown'

export interface ReturnMethodShipments {
  outbound?: { hasLabel?: boolean; trackingNumber?: string; status?: string } | null
  inbound?: { hasLabel?: boolean; trackingNumber?: string } | null
}

export const READY_NEUTRAL_LABEL = 'Reparatur abgeschlossen'
export const READY_PREPARING_LABEL = 'Reparatur abgeschlossen – Versand an Sie wird vorbereitet'
export const READY_PICKUP_LABEL = 'Reparatur abgeschlossen – Gerät liegt zur Abholung bereit'

const OUTBOUND_STATUS_TEXT: Record<string, string> = {
  pending: 'Versandlabel erstellt – Übergabe an DHL folgt',
  'label-created': 'Versandlabel erstellt – Übergabe an DHL folgt',
  shipped: 'An DHL übergeben – unterwegs zu Ihnen',
  'in-transit': 'Unterwegs zu Ihnen',
  'out-for-delivery': 'Heute in Zustellung',
  delivered: 'Zugestellt',
  failed: 'Zustellproblem – wir kümmern uns darum',
}

const hasOutbound = (shipments?: ReturnMethodShipments | null) =>
  Boolean(shipments?.outbound && (shipments.outbound.hasLabel || String(shipments.outbound.trackingNumber || '').trim()))

const hasInbound = (shipments?: ReturnMethodShipments | null) =>
  Boolean(shipments?.inbound && (shipments.inbound.hasLabel || String(shipments.inbound.trackingNumber || '').trim()))

export const resolveReturnMethod = (shipments?: ReturnMethodShipments | null): ReturnMethod => {
  if (!shipments) return 'unknown'
  return hasOutbound(shipments) || hasInbound(shipments) ? 'shipping' : 'pickup'
}

export interface ReadyStateView {
  method: ReturnMethod
  phase: 'outbound' | 'preparing' | 'pickup' | 'neutral'
  /** Kurzer Text für Statuschip/Liste */
  label: string
  /** Satz für Kunden-Karten */
  description: string
}

/** Anzeige für den Bereit-Zustand; null für jeden anderen Status. */
export const describeReadyState = (status?: string | null, shipments?: ReturnMethodShipments | null): ReadyStateView | null => {
  if (String(status || '') !== 'ready-for-pickup') return null
  const method = resolveReturnMethod(shipments)
  if (method === 'shipping') {
    if (hasOutbound(shipments)) {
      const outboundStatus = String(shipments?.outbound?.status || '')
      return {
        method,
        phase: 'outbound',
        label: OUTBOUND_STATUS_TEXT[outboundStatus] || OUTBOUND_STATUS_TEXT['label-created'],
        description: 'Ihre Reparatur ist abgeschlossen und das Versandlabel an Sie ist erstellt. Den aktuellen Stand sehen Sie in der Sendungsverfolgung.',
      }
    }
    return {
      method,
      phase: 'preparing',
      label: READY_PREPARING_LABEL,
      description: 'Ihre Reparatur ist abgeschlossen. Wir bereiten den Rückversand per DHL vor; sobald das Versandlabel erstellt ist, sehen Sie hier die Sendungsnummer.',
    }
  }
  if (method === 'pickup') {
    return {
      method,
      phase: 'pickup',
      label: READY_PICKUP_LABEL,
      description: 'Ihre Reparatur ist abgeschlossen. Bei Fragen zur Übergabe schreiben Sie uns im Nachrichtenbereich.',
    }
  }
  return {
    method,
    phase: 'neutral',
    label: READY_NEUTRAL_LABEL,
    description: 'Ihre Reparatur ist abgeschlossen. Wir informieren Sie über den Rückversand bzw. die Abholung.',
  }
}

/**
 * Kundentext der Fertig-Meldung (Reparatur abgeschlossen) je Rückgabeweg.
 * Spiegel von server/utils/returnMethod.js readyCustomerMessage - beide gleich halten.
 * subject z. B. "Ihres Geräts (Apple iPhone 15) zu Auftrag ORD-1".
 */
export const readyCustomerMessage = (method: ReturnMethod, subject: string) => {
  if (method === 'shipping') {
    return `Die Reparatur ${subject} ist abgeschlossen. Wir bereiten den Rückversand an Sie vor und informieren Sie, sobald das Paket an DHL übergeben ist.`
  }
  if (method === 'pickup') {
    return `Die Reparatur ${subject} ist abgeschlossen. Ihr Gerät liegt zur Abholung bei uns bereit.`
  }
  return `Die Reparatur ${subject} ist abgeschlossen. Wir informieren Sie über den Rückversand bzw. die Abholung.`
}
