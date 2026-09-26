import api from './api';
import type { OrderPricingSummary } from './orders';

// Preisaufstellung eines Auftrags - EINMAL vom Server berechnet
// (OrderService.buildOrderPricingSummary), Typ siehe ./orders.
export type { OrderPricingSummary };

// Antwort aller ändernden Aufrufe: der gespeicherte Auftrag, die neue Preisaufstellung
// und Warnungen (deutsch), z. B. wenn die Rechnung nicht synchronisiert werden konnte.
// Eine Warnung darf in der Oberfläche nie hinter einer Erfolgsmeldung verschwinden.
export interface OrderServiceMutationResponse {
  order?: unknown;
  pricing?: OrderPricingSummary;
  warnings?: string[];
}

export interface AvailableServiceForOrder {
  _id: string;
  name: string;
  description?: string;
  price: number;
  estimatedTime: number;
}

// ── Fehler ───────────────────────────────────────────────────────────────────
// Der Server liefert { error (deutsch), code?, details? }. Der Fehler behält code, details,
// status und response - der Dialog braucht code === 'ORDER_VALUE_NOT_RECONCILED' und die
// details, um die ausdrückliche Bestätigung der Neuberechnung anzubieten.
export const ORDER_VALUE_NOT_RECONCILED = 'ORDER_VALUE_NOT_RECONCILED';

// details der 409 ORDER_VALUE_NOT_RECONCILED (OrderService.getPricingConditionsForEdit).
// difference = gespeicherter Auftragswert − (Positionen − Rabatt); positiv: gespeichert liegt
// ÜBER den Positionen, negativ: darunter.
export interface OrderValueReconciliationDetails {
  storedTotal: number;
  positionsGross: number;
  discount: number;
  expectedTotal: number;
  difference: number;
}

export interface OrderServiceError extends Error {
  code?: string;
  status?: number;
  details?: OrderValueReconciliationDetails | Record<string, unknown>;
  response?: unknown;
}

const toError = (error: any): OrderServiceError => {
  const data = error?.response?.data || error?.data || {};
  const wrapped: OrderServiceError = new Error(
    data?.error || error?.message || 'Die Anfrage konnte nicht ausgeführt werden.'
  );
  wrapped.code = data?.code || error?.code || undefined;
  wrapped.status = error?.response?.status ?? error?.status;
  wrapped.details = data?.details || undefined;
  wrapped.response = error?.response;
  return wrapped;
};

export const readOrderServiceErrorCode = (error: any): string =>
  String(error?.code || error?.response?.data?.code || '');

// details der Abweichung, falls es eine 409 ORDER_VALUE_NOT_RECONCILED ist - sonst null.
export const readReconciliationDetails = (error: any): OrderValueReconciliationDetails | null => {
  if (readOrderServiceErrorCode(error) !== ORDER_VALUE_NOT_RECONCILED) return null;
  const details = error?.details || error?.response?.data?.details;
  if (!details || typeof details !== 'object') return null;
  const read = (value: unknown) => (Number.isFinite(Number(value)) ? Number(value) : 0);
  return {
    storedTotal: read(details.storedTotal),
    positionsGross: read(details.positionsGross),
    discount: read(details.discount),
    expectedTotal: read(details.expectedTotal),
    difference: read(details.difference),
  };
};

const formatEuro = (value: number) =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(Number(value) || 0);

// Bestätigungstext für eine Neuberechnung - richtig für BEIDE Richtungen der Abweichung:
// liegt der gespeicherte Wert über den Positionen, sinkt der Auftragswert; liegt er darunter,
// steigt er. Die Änderung selbst (neue/geänderte/entfernte Position) kommt jeweils hinzu.
export const describeRepricingConsequence = (details?: OrderValueReconciliationDetails | null): string => {
  const suffix = 'Der Auftragswert wird aus den Positionen und den Konditionen dieses Auftrags neu berechnet; '
    + 'die Abweichung wird in der Auftragshistorie festgehalten.';
  if (!details) return suffix;
  const difference = Math.round(Number(details.difference || 0) * 100) / 100;
  const amount = formatEuro(Math.abs(difference));
  const basis = `Gespeicherter Auftragswert ${formatEuro(details.storedTotal)}, Positionen ${formatEuro(details.positionsGross)} `
    + `abzüglich ${formatEuro(details.discount)} Rabatt = ${formatEuro(details.expectedTotal)}.`;
  if (difference > 0) {
    return `${basis} Bei der Neuberechnung sinkt der Auftragswert dadurch um ${amount} `
      + `(zusätzlich zu Ihrer Änderung) - der bisher darüber hinaus gespeicherte Betrag entfällt. ${suffix}`;
  }
  if (difference < 0) {
    return `${basis} Bei der Neuberechnung steigt der Auftragswert dadurch um ${amount} `
      + `(zusätzlich zu Ihrer Änderung) auf den Wert der Positionen abzüglich Rabatt. ${suffix}`;
  }
  return `${basis} ${suffix}`;
};

// Description: Get all services for an order (populated with full service details)
// Endpoint: GET /api/order-services/:orderId
// Request: {}
// Response: { services: Array<{ _id, serviceId, isManual, name, description, price, estimatedTime, notes }>,
//             pricing: OrderPricingSummary }
export const getOrderServices = async (orderId: string) => {
  try {
    const response = await api.get(`/api/order-services/${orderId}`);
    return response.data;
  } catch (error: any) {
    console.error(`Error fetching order services: ${error.message}`);
    throw toError(error);
  }
};

// Description: Aktive Katalogservices, die zum AKTUELLEN Gerät des Auftrags passen
//              (Marke, Modell, Gerätetyp) - serverseitig gefiltert und vollständig.
// Endpoint: GET /api/order-services/:orderId/available-services (Admin/Staff)
// Request: {}
// Response: { device: { brand, model, type }, services: Service[] }
export const getAvailableServicesForOrder = async (
  orderId: string
): Promise<{ device?: { brand?: string; model?: string; type?: string }; services: AvailableServiceForOrder[] }> => {
  try {
    const response = await api.get(`/api/order-services/${orderId}/available-services`);
    return {
      device: response.data?.device,
      services: Array.isArray(response.data?.services) ? response.data.services : [],
    };
  } catch (error: any) {
    console.error(`Error fetching available services for order: ${error.message}`);
    throw toError(error);
  }
};

// Description: Update an existing repair position in an order
// Endpoint: PUT /api/order-services/:orderId/:serviceId
// Request: { price?: number (Standardpreis brutto), estimatedTime?: number, notes?: string,
//            name?: string, description?: string (nur manuelle Positionen), reason?: string,
//            confirmRepricing?: boolean }
// Fehler:  OrderServiceError mit code/details (z. B. 409 ORDER_VALUE_NOT_RECONCILED)
// Response: { order: Order, pricing: OrderPricingSummary, warnings: string[] }
export const updateOrderService = async (
  orderId: string,
  serviceId: string,
  data: {
    price?: number;
    estimatedTime?: number;
    notes?: string;
    name?: string;
    description?: string;
    reason?: string;
    confirmRepricing?: boolean;
  }
): Promise<OrderServiceMutationResponse> => {
  try {
    const response = await api.put(
      `/api/order-services/${orderId}/${serviceId}`,
      data
    );
    console.log(`Service ${serviceId} updated in order ${orderId}`);
    return response.data;
  } catch (error: any) {
    console.error(`Error updating order service: ${error.message}`);
    throw toError(error);
  }
};

// Description: Add a repair position to an order - a catalogue service or a MANUAL line
// Endpoint: POST /api/order-services/:orderId
// Request: Katalog: { serviceId: string, price?, estimatedTime?, notes?, reason? }
//          Manuell: { isManual: true, name: string, description?, price (Standardpreis brutto),
//                     estimatedTime?, notes?, reason? } - ohne serviceId
//          beide: confirmRepricing?: boolean (nach ausdrücklicher Bestätigung)
// Response: { order: Order, pricing: OrderPricingSummary, warnings: string[] }
// Fehler:  OrderServiceError mit code/details (z. B. 409 ORDER_VALUE_NOT_RECONCILED)
export const addServiceToOrder = async (
  orderId: string,
  serviceId: string | null,
  options?: {
    price?: number;
    estimatedTime?: number;
    notes?: string;
    isManual?: boolean;
    name?: string;
    description?: string;
    reason?: string;
    confirmRepricing?: boolean;
  }
): Promise<OrderServiceMutationResponse> => {
  try {
    const isManual = options?.isManual === true;
    const payload: Record<string, unknown> = { ...options, isManual };
    if (options?.confirmRepricing !== true) delete payload.confirmRepricing;
    if (!isManual) {
      payload.serviceId = serviceId;
      // Name/Beschreibung gehören bei Katalogservices dem Katalog.
      delete payload.name;
      delete payload.description;
    }
    const response = await api.post(`/api/order-services/${orderId}`, payload);
    console.log(`${isManual ? 'Manual line' : `Service ${serviceId}`} added to order ${orderId}`);
    return response.data;
  } catch (error: any) {
    console.error(`Error adding service to order: ${error.message}`);
    throw toError(error);
  }
};

// Description: Remove a repair position from an order
// Endpoint: DELETE /api/order-services/:orderId/:serviceId
// Request: { reason?: string, confirmRepricing?: boolean }
// Response: { order: Order, pricing: OrderPricingSummary, warnings: string[] }
// Fehler:  OrderServiceError mit code/details (z. B. 409 ORDER_VALUE_NOT_RECONCILED)
export const removeServiceFromOrder = async (
  orderId: string,
  serviceId: string,
  options?: { reason?: string; confirmRepricing?: boolean }
): Promise<OrderServiceMutationResponse> => {
  try {
    const response = await api.delete(
      `/api/order-services/${orderId}/${serviceId}`,
      {
        data: {
          reason: options?.reason || '',
          ...(options?.confirmRepricing === true ? { confirmRepricing: true } : {}),
        },
      }
    );
    console.log(`Service ${serviceId} removed from order ${orderId}`);
    return response.data;
  } catch (error: any) {
    console.error(`Error removing service from order: ${error.message}`);
    throw toError(error);
  }
};

// ── Formular → API ───────────────────────────────────────────────────────────
// EINE Übersetzung der Eingaben aus RepairServiceDialog in den Serveraufruf, genutzt von
// OrderDetails (Admin- und Staff-Ansicht). Manuelle Positionen gehen OHNE serviceId und mit
// isManual/name/description; der Grund landet in der Auftragshistorie. Fehler werden
// geworfen (nicht geschluckt), damit der Dialog offen bleibt und sie anzeigt.
export interface RepairServiceFormInput {
  serviceId?: string | null;
  isManual?: boolean;
  name?: string;
  description?: string;
  /** STANDARD-/Listenpreis brutto; der Kundenrabatt wird auf Auftragsebene abgezogen. */
  price: number;
  estimatedTime: number;
  notes?: string;
  reason?: string;
  /** Nur nach ausdrücklicher Bestätigung einer 409 ORDER_VALUE_NOT_RECONCILED setzen. */
  confirmRepricing?: boolean;
}

export const addRepairServiceFromForm = (orderId: string, form: RepairServiceFormInput) => {
  const isManual = form.isManual === true;
  return addServiceToOrder(orderId, isManual ? null : String(form.serviceId || ''), {
    isManual,
    name: isManual ? String(form.name || '').trim() : undefined,
    description: isManual ? String(form.description || '') : undefined,
    price: form.price,
    estimatedTime: form.estimatedTime,
    notes: form.notes,
    reason: form.reason,
    confirmRepricing: form.confirmRepricing === true,
  });
};

export const updateRepairServiceFromForm = (
  orderId: string,
  lineId: string,
  form: RepairServiceFormInput,
  options: { isManualLine: boolean }
) =>
  updateOrderService(orderId, lineId, {
    price: form.price,
    estimatedTime: form.estimatedTime,
    notes: form.notes,
    // Bezeichnung/Beschreibung gehören nur bei manuellen Positionen der Position selbst;
    // bei Katalogservices bleibt der Katalogname maßgeblich.
    ...(options.isManualLine ? { name: String(form.name || '').trim(), description: String(form.description || '') } : {}),
    reason: form.reason,
    ...(form.confirmRepricing === true ? { confirmRepricing: true } : {}),
  });

// Warnungen einer Änderungsantwort (deutsch, vom Server) - leere Einträge entfernt.
export const getOrderServiceWarnings = (response?: OrderServiceMutationResponse | null): string[] =>
  (Array.isArray(response?.warnings) ? response!.warnings : [])
    .map((entry) => String(entry || '').trim())
    .filter(Boolean);
