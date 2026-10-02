/**
 * Rueckgabeweg eines fertig reparierten Auftrags (Status 'ready-for-pickup' = "Reparatur abgeschlossen").
 *
 * Es gibt kein eigenes Feld "Liefermethode". Der Weg ergibt sich aus dem Versandstand, den
 * DHLService.getOrderShipmentState liefert (dieselbe Lesesicht wie die Auftragsansicht):
 *
 *   REGEL (Client-Spiegel: client/src/lib/returnMethod.ts - beide gleich halten):
 *   - 'shipping' (Rueckversand), wenn
 *       a) ein Versandlabel an den Kunden existiert (Auslieferung McRepair -> Kunde:
 *          outbound.hasLabel oder outbound.trackingNumber), ODER
 *       b) das Geraet per DHL eingesendet wurde bzw. werden sollte (Einsendung Kunde -> McRepair:
 *          inbound.hasLabel oder inbound.trackingNumber) - wer einsendet, bekommt es zurueckgeschickt.
 *   - 'pickup' (Abholung), wenn der Versandstand bekannt ist und keines davon zutrifft
 *       (z. B. vor Ort angenommene manuelle Reparatur ohne Label).
 *   - 'unknown', wenn kein Versandstand vorliegt (Listen ohne Versanddaten, Lesefehler):
 *       neutrale Formulierung "Reparatur abgeschlossen" - nie "abholbereit", nie "versendet".
 *
 * Reparatur, Versand und Zahlung bleiben getrennt: kein Text hier behauptet eine Zahlung, und
 * "zugestellt"/"unterwegs" kommt nur aus dem echten Versandstatus der Auslieferung.
 */

const NEUTRAL_LABEL = 'Reparatur abgeschlossen';
const PREPARING_LABEL = 'Reparatur abgeschlossen – Versand an Sie wird vorbereitet';
const PICKUP_LABEL = 'Reparatur abgeschlossen – Gerät liegt zur Abholung bereit';

// Versandstatus der AUSLIEFERUNG (Order.shippingStatus) -> Kundentext.
const OUTBOUND_STATUS_TEXT = {
  pending: 'Versandlabel erstellt – Übergabe an DHL folgt',
  'label-created': 'Versandlabel erstellt – Übergabe an DHL folgt',
  shipped: 'An DHL übergeben – unterwegs zu Ihnen',
  'in-transit': 'Unterwegs zu Ihnen',
  'out-for-delivery': 'Heute in Zustellung',
  delivered: 'Zugestellt',
  failed: 'Zustellproblem – wir kümmern uns darum',
};

const text = (value) => String(value || '').trim();

function hasOutbound(shipments) {
  const outbound = shipments && shipments.outbound;
  return Boolean(outbound && (outbound.hasLabel || text(outbound.trackingNumber)));
}

function hasInbound(shipments) {
  const inbound = shipments && shipments.inbound;
  return Boolean(inbound && (inbound.hasLabel || text(inbound.trackingNumber)));
}

/** 'shipping' | 'pickup' | 'unknown' (siehe REGEL oben). */
function resolveReturnMethod(shipments) {
  if (!shipments || typeof shipments !== 'object') return 'unknown';
  if (hasOutbound(shipments) || hasInbound(shipments)) return 'shipping';
  return 'pickup';
}

/**
 * Anzeige fuer den Bereit-Zustand. Fuer andere Status: null (der Aufrufer nutzt sein Statuslabel).
 * @returns {{ method, phase: 'outbound'|'preparing'|'pickup'|'neutral', label }}
 */
function describeReadyState(status, shipments) {
  if (String(status || '') !== 'ready-for-pickup') return null;
  const method = resolveReturnMethod(shipments);
  if (method === 'shipping') {
    if (hasOutbound(shipments)) {
      const outboundStatus = text(shipments.outbound.status);
      return { method, phase: 'outbound', label: OUTBOUND_STATUS_TEXT[outboundStatus] || OUTBOUND_STATUS_TEXT['label-created'] };
    }
    return { method, phase: 'preparing', label: PREPARING_LABEL };
  }
  if (method === 'pickup') return { method, phase: 'pickup', label: PICKUP_LABEL };
  return { method, phase: 'neutral', label: NEUTRAL_LABEL };
}

/** Kundentext der Fertig-Meldung; subject z. B. "Ihres Geräts (Apple iPhone 15) zu Auftrag ORD-1". */
function readyCustomerMessage(method, subject) {
  if (method === 'shipping') {
    return `Die Reparatur ${subject} ist abgeschlossen. Wir bereiten den Rückversand an Sie vor und informieren Sie, sobald das Paket an DHL übergeben ist.`;
  }
  if (method === 'pickup') {
    return `Die Reparatur ${subject} ist abgeschlossen. Ihr Gerät liegt zur Abholung bei uns bereit.`;
  }
  return `Die Reparatur ${subject} ist abgeschlossen. Wir informieren Sie über den Rückversand bzw. die Abholung.`;
}

/** Rueckgabeweg aus dem gespeicherten Versandstand lesen; jeder Lesefehler -> 'unknown' (neutral). */
async function resolveReturnMethodForOrder(orderId) {
  try {
    const DHLService = require('../services/dhlService'); // eslint-disable-line global-require
    const state = await DHLService.getOrderShipmentState(orderId);
    return resolveReturnMethod(state && state.shipments);
  } catch (error) {
    return 'unknown';
  }
}

module.exports = {
  NEUTRAL_LABEL,
  PREPARING_LABEL,
  PICKUP_LABEL,
  OUTBOUND_STATUS_TEXT,
  resolveReturnMethod,
  describeReadyState,
  readyCustomerMessage,
  resolveReturnMethodForOrder,
};
