/**
 * Uebergabe zwischen Checkout und Bestellbestaetigung (/order-success).
 *
 * Frueher wurde die komplette Checkout-Antwort (inkl. Base64-Label) als 'lastOrderData'
 * gespeichert und beim ersten Lesen geloescht - ein Neuladen zeigte eine leere Seite, und die
 * angemeldete Antwort hatte gar nicht die Felder, die die Seite las (DHL-1). Jetzt:
 *  - nur Kennungen (keine Betraege des Kunden-Checkouts, kein PDF) im tab-gebundenen
 *    sessionStorage; die Seite laedt alles Weitere vom Server (Besitzpruefung),
 *  - der Eintrag bleibt beim Lesen erhalten (Neuladen zeigt dieselbe Buchung),
 *  - adcellPending verhindert, dass die Affiliate-Konversion beim Neuladen erneut feuert (DHL-10).
 */

export interface LastCheckout {
  kind: 'account' | 'guest';
  bookingId: string | null;
  bookingNumber: string;
  orderIds: string[];
  orderNumbers: string[];
  orderCount: number;
  /** Nur Gast: Bruttobetrag der Buchung laut Serverantwort (fuer die Konversion). */
  totalAmount: number | null;
  bookingTrackingToken?: string | null;
  guestEmail?: string | null;
  adcellPending: boolean;
  createdAt: string;
}

const LAST_CHECKOUT_KEY = 'lastCheckout';
const ATTEMPT_KEY = 'checkoutAttemptId';

const safeSession = (): Storage | null => {
  try {
    return typeof window !== 'undefined' ? window.sessionStorage : null;
  } catch {
    return null;
  }
};

export const saveLastCheckout = (entry: Omit<LastCheckout, 'createdAt' | 'adcellPending'> & { adcellPending?: boolean }): void => {
  const storage = safeSession();
  if (!storage) return;
  try {
    const value: LastCheckout = { adcellPending: true, ...entry, createdAt: new Date().toISOString() };
    storage.setItem(LAST_CHECKOUT_KEY, JSON.stringify(value));
    // Altschluessel der frueheren Uebergabe entfernen (enthielt die komplette Antwort).
    storage.removeItem('lastOrderData');
  } catch {
    /* Speicher voll/gesperrt: die Seite faellt auf ?booking= zurueck */
  }
};

export const readLastCheckout = (): LastCheckout | null => {
  const storage = safeSession();
  if (!storage) return null;
  try {
    const raw = storage.getItem(LAST_CHECKOUT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || (parsed.kind !== 'account' && parsed.kind !== 'guest')) return null;
    return parsed as LastCheckout;
  } catch {
    return null;
  }
};

/** Konversion gilt als gesendet - beim Neuladen nicht erneut ausloesen. */
export const markAdcellSent = (): void => {
  const storage = safeSession();
  const current = readLastCheckout();
  if (!storage || !current) return;
  try {
    storage.setItem(LAST_CHECKOUT_KEY, JSON.stringify({ ...current, adcellPending: false }));
  } catch {
    /* ignorieren */
  }
};

/**
 * Idempotenzschluessel je Bezahlversuch: bleibt bis zum Erfolg erhalten, damit eine
 * Wiederholung nach verlorener Antwort dieselbe Buchung liefert statt einer zweiten (DHL-14).
 */
export const getOrCreateCheckoutAttemptId = (): string => {
  const storage = safeSession();
  try {
    const existing = storage?.getItem(ATTEMPT_KEY);
    if (existing && /^[A-Za-z0-9_-]{8,80}$/.test(existing)) return existing;
  } catch {
    /* ignorieren */
  }
  const random = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  const id = `co_${random}`.replace(/[^A-Za-z0-9_-]/g, '');
  try {
    storage?.setItem(ATTEMPT_KEY, id);
  } catch {
    /* ohne Speicher gilt der Schluessel nur fuer diesen Aufruf */
  }
  return id;
};

export const clearCheckoutAttemptId = (): void => {
  try {
    safeSession()?.removeItem(ATTEMPT_KEY);
  } catch {
    /* ignorieren */
  }
};
