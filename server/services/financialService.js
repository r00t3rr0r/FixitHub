const Payment = require('../models/Payment');
const PaymentAllocation = require('../models/PaymentAllocation');
const Invoice = require('../models/Invoice');
const InvoiceDocumentArchive = require('../models/InvoiceDocumentArchive');
const DunningRun = require('../models/DunningRun');
const Order = require('../models/Order');
const Booking = require('../models/Booking');
const Complaint = require('../models/Complaint');
const User = require('../models/User');
const SystemConfiguration = require('../models/SystemConfiguration');
const CalculationHelper = require('./calculationHelper');
const OrderRevisionService = require('./orderRevisionService');
const EmailService = require('./emailService');
const NotificationService = require('./notificationService');
const { Types } = require('mongoose');
const crypto = require('crypto');
const PaymentService = require('./paymentService');

// Fachlicher Fehler mit HTTP-Status und deutscher, UI-tauglicher Meldung.
function buildFinancialError(message, statusCode = 400, code = 'FINANCIAL_ERROR') {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

// Zeitfenster fuer die abgeleitete Idempotenz (Doppelklick / Retry des Clients).
const IDEMPOTENCY_WINDOW_MS = 5 * 60 * 1000;

// So lange wird ein PayPal-Erstattungsversuch mit unklarem Ergebnis automatisch mit
// SEINER PayPal-Request-Id erneut abgefragt. Bewusst kurz gewaehlt: PayPal erkennt eine
// Request-ID nur begrenzt wieder; danach wuerde derselbe Aufruf ggf. neu ausgefuehrt.
const REFUND_REQUEST_ID_REPLAY_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Baut den Idempotenzschluessel einer Zahlungserfassung.
 * Ein vom Aufrufer geschickter Schluessel gewinnt immer. Ohne Schluessel wird ein
 * Fingerabdruck aus Vorgang, Betrag, Zahlart, Datum und Verwendungszweck gebildet
 * und in ein Zeitfenster gebucht: derselbe Request innerhalb des Fensters ist ein
 * Duplikat, eine bewusst spaeter erneut erfasste identische Zahlung nicht.
 */
function buildPaymentIdempotencyKey(scope, fingerprintParts, explicitKey = null, bucketOffset = 0) {
  const cleanExplicit = String(explicitKey || '').trim();
  if (cleanExplicit) return `client:${scope}:${cleanExplicit.slice(0, 120)}`;

  const bucket = Math.floor(Date.now() / IDEMPOTENCY_WINDOW_MS) - bucketOffset;
  const fingerprint = crypto
    .createHash('sha1')
    .update(fingerprintParts.map((part) => String(part ?? '')).join('|'))
    .digest('hex')
    .slice(0, 24);
  return `auto:${scope}:${fingerprint}:${bucket}`;
}

/**
 * Sucht eine bereits erfasste Zahlung zum selben Idempotenzschluessel.
 * Es werden das aktuelle UND das vorherige Zeitfenster geprueft, damit ein
 * Doppelklick genau auf einer Fenstergrenze nicht durchrutscht.
 */
async function findDuplicatePayment(scope, fingerprintParts, explicitKey = null) {
  const keys = String(explicitKey || '').trim()
    ? [buildPaymentIdempotencyKey(scope, fingerprintParts, explicitKey)]
    : [
      buildPaymentIdempotencyKey(scope, fingerprintParts, null, 0),
      buildPaymentIdempotencyKey(scope, fingerprintParts, null, 1),
    ];
  const existing = await Payment.findOne({ idempotencyKey: { $in: keys } });
  return { keys, existing };
}

/**
 * PayPal-Erstattung mit UNKLAREM Ergebnis (Zeitueberschreitung, 5xx, Antwort ohne
 * Refund-ID). Ein solcher Eintrag bleibt 'pending' und muss abgeglichen werden, bevor
 * eine weitere PayPal-Erstattung derselben Zahlung ausgeloest wird. Altbestand ohne
 * Merker: ein ausstehender Gateway-Eintrag ohne Refund-ID ist ebenfalls ungeklaert.
 */
function isUnresolvedGatewayRefund(entry) {
  if (!entry || entry.status !== 'pending' || entry.mode !== 'gateway') return false;
  return entry.unresolved === true || !String(entry.reference || '').trim();
}

// Capture-ID einer PayPal-Zahlung (nie die Order-ID).
function resolvePaypalCaptureId(payment) {
  const captureId = String(
    payment?.metadata?.providerDetails?.captureId
    || payment?.metadata?.providerReference
    || ''
  ).trim();
  if (!captureId || captureId === String(payment?.metadata?.paypalOrderId || '')) return '';
  return captureId;
}

/**
 * PayPal-Request-Id eines Erstattungsversuchs. Deterministisch aus Schluessel und
 * Versuchsnummer: derselbe Versuch hat immer dieselbe ID (PayPal fuehrt ihn nur einmal
 * aus), ein neuer Versuch nach ENDGUELTIGER Ablehnung eine neue. Kurz genug fuer das
 * PayPal-Limit (108 Zeichen), damit ein Suffix nie abgeschnitten wird.
 */
function buildRefundRequestId(idempotencyKey, attempt = 1) {
  const hash = crypto.createHash('sha1').update(String(idempotencyKey || '')).digest('hex').slice(0, 32);
  return `mcr-refund-${hash}-${Math.max(1, Number(attempt) || 1)}`;
}

function parseDueDaysFromTerms(paymentTerms) {
  if (!paymentTerms) return null;

  const match = String(paymentTerms).match(/(\d+)/);
  if (!match) return null;

  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizePaymentDueDays(value, fallback = 7) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return fallback;
  return Math.min(14, Math.max(1, Math.floor(numericValue)));
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

// Mahnstufen (automatisch fortschaltbar). Die Stufe "Mahnung" ist die "1. Mahnung"
// der fachlichen Vorgabe - es gibt bewusst KEINE zusaetzliche Stufe dafuer.
// Inkasso (Stufe 4, 'collection') wird nie automatisch erreicht, nur manuell
// (activateCollection) und erst nach der Letzten Mahnung; danach steht die Automatik.
const DUNNING_STAGES = [
  { level: 1, stage: 'payment_reminder', trigger: 'payment_reminder', label: 'Zahlungserinnerung' },
  { level: 2, stage: 'dunning_notice', trigger: 'dunning_notice', label: 'Mahnung' },
  { level: 3, stage: 'final_notice', trigger: 'final_dunning_notice', label: 'Letzte Mahnung' }
];
const DUNNING_STAGE_LABELS = {
  none: 'Keine Mahnstufe',
  payment_reminder: 'Zahlungserinnerung',
  dunning_notice: 'Mahnung',
  final_notice: 'Letzte Mahnung',
  collection: 'Inkasso',
};
// Belegstatus mit mahnbarer Forderung (ausgestellt, nicht bezahlt/storniert/gutgeschrieben).
const DUNNING_RECEIVABLE_STATUSES = ['sent', 'viewed', 'partially_paid', 'overdue'];
// Karenz bis zur ersten Zahlungserinnerung und Abstand zwischen zwei Stufen (Tage).
const DUNNING_INTERVAL_DAYS = 7;
// Eine Sperre, die laenger besteht, gilt als verwaist (Prozessabbruch waehrend eines
// Schritts). Der automatische Lauf uebernimmt sie NIE (Versandergebnis unklar), nur ein
// ausdruecklicher Einzelschritt eines Bearbeiters.
const DUNNING_LOCK_STALE_MS = 10 * 60 * 1000;
// Storno: zwischen dem Speichern der Storno-Gutschrift und dem Abschluss des Originals
// liegt normalerweise nur ein Lese-/Schreibzugriff. Erst wenn ein Vorgang laenger als
// diese Karenz in 'processing' steht, gilt er als unterbrochen und darf von einem
// weiteren Aufruf abgeschlossen werden.
const CANCELLATION_COMPLETION_GRACE_MS = 30 * 1000;

function startOfLocalDay(value = new Date()) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function formatEuroDe(value) {
  return `${Number(value || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

function calculateDiscountAmount(subtotal, discountPercent) {
  const numericSubtotal = Number(subtotal);
  const numericDiscountPercent = Number(discountPercent);

  if (!Number.isFinite(numericSubtotal) || numericSubtotal <= 0) return 0;
  if (!Number.isFinite(numericDiscountPercent) || numericDiscountPercent <= 0) return 0;

  // Gemeinsame Regel mit Warenkorb und Auftrag (siehe CalculationHelper.percentOf).
  return CalculationHelper.percentOf(numericSubtotal, numericDiscountPercent);
}

/**
 * Steuersatz-Kontrakt: die API erwartet einen PROZENTWERT (19, 7, 0), keinen Faktor.
 * Uebergangsweise wird ein Wert echt zwischen 0 und 1 als alter Bruchwert (0.19)
 * erkannt und umgerechnet, damit ein alter Client-Bundle nicht 1/100 der MwSt bucht.
 */
function normalizeTaxRatePercent(value, fallbackPercent = CalculationHelper.DEFAULT_TAX_RATE) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue < 0) {
    const fallback = Number(fallbackPercent);
    return Number.isFinite(fallback) ? fallback : CalculationHelper.DEFAULT_TAX_RATE;
  }
  if (numericValue > 0 && numericValue < 1) {
    console.warn(`FinancialService: taxRate ${numericValue} looks like a legacy fraction, interpreting as ${numericValue * 100}%`);
    return CalculationHelper.round(numericValue * 100);
  }
  return numericValue;
}

// Korrekturarten, die KEINE Wertminderung der Rechnung sind, sondern die Rueckgabe
// bereits erhaltenen Geldes (Ueberzahlung). Sie duerfen weder den gutschreibbaren
// Rechnungswert verbrauchen noch als Auftragswertminderung gezaehlt werden.
const REFUND_CORRECTION_TYPES = ['partial_refund'];
// Vom Client setzbare Korrekturtypen (Invoice.correctionType-Enum ohne null).
const VALID_CORRECTION_TYPES = ['full_cancellation', 'partial_refund', 'price_adjustment'];

// Zahlungsziel (Net X). Skonto wird bewusst nicht mehr ausgewiesen - es wurde nie
// tatsaechlich gewaehrt und ist aus allen aktiven Flows entfernt.
// Der Wortlaut folgt immer der Frist (Invoice.formatPaymentTerms), nie einem zweiten
// Freitext.
function composePaymentTerms(financialProfile) {
  const days = Number(financialProfile?.paymentDueDays);
  if (Number.isFinite(days)) return Invoice.formatPaymentTerms(days);
  return String(financialProfile?.paymentTerms || '').trim() || Invoice.formatPaymentTerms(14);
}

// Geraetekennzeichnung fuer Rechnungspositionen: Marke/Modell, IMEI bzw. Seriennummer.
function buildDeviceLabel(order, fallbackDevice = '') {
  const base = String(
    fallbackDevice || `${order?.deviceBrand || ''} ${order?.deviceModel || ''}`.trim() || 'Gerät'
  ).trim();

  const identifiers = [];
  const imei = String(order?.imei || '').trim();
  const serialNumber = String(order?.serialNumber || '').trim();
  if (imei) identifiers.push(`IMEI: ${imei}`);
  if (serialNumber) identifiers.push(`SN: ${serialNumber}`);

  return identifiers.length > 0 ? `${base} (${identifiers.join(', ')})` : base;
}

/**
 * Baut die Rechnungspositionen eines Auftrags.
 * Jede Position traegt den echten Service-/Produktnamen plus Geraetekennzeichnung -
 * niemals interne IDs, ein ObjectId-Dump oder den Platzhalter "Service".
 * Alle Preise sind BRUTTO (siehe CalculationHelper).
 */
function buildInvoiceItemsFromOrder(order, options = {}) {
  if (!order) return [];

  const deviceLabel = buildDeviceLabel(order, options.deviceLabel);
  const items = [];

  if (order.deviceType === 'Shop Products' || (order.shopProducts || []).length > 0) {
    (order.shopProducts || []).forEach((product) => {
      const quantity = Number(product.quantity) || 1;
      const unitPrice = Number(product.priceAtOrder) || 0;
      const serviceName = product.productId?.name || 'Produkt';
      items.push({
        serviceName,
        description: serviceName,
        quantity,
        unitPrice,
        total: CalculationHelper.round(unitPrice * quantity),
        type: 'product'
      });
    });
  }

  (order.services || []).forEach((service) => {
    // Katalogname, sonst der gespeicherte Positionsname (manuelle Position ohne
    // serviceId) - eine manuelle Position muss auf Rechnung/PDF mit IHREM Namen stehen.
    const catalogName = typeof service === 'string' ? service : service?.serviceId?.name;
    const serviceName = catalogName || String(service?.name || '').trim() || 'Reparaturservice';
    const manualDescription = service?.isManual ? String(service?.description || '').trim() : '';
    items.push({
      serviceName,
      description: manualDescription
        ? `${deviceLabel} – ${serviceName}: ${manualDescription}`
        : `${deviceLabel} – ${serviceName}`,
      quantity: 1,
      unitPrice: Number(service?.price) || 0,
      total: CalculationHelper.round(Number(service?.price) || 0),
      type: 'service'
    });
  });

  (order.addOns || []).forEach((addon) => {
    const serviceName = addon?.name || 'Zusatzleistung';
    const price = Number(addon?.price) || 0;
    items.push({
      serviceName,
      description: `${deviceLabel} – ${serviceName}`,
      quantity: 1,
      unitPrice: price,
      total: CalculationHelper.round(price),
      type: 'addon'
    });
  });

  return items;
}

// Laedt Auftraege so, dass buildInvoiceItemsFromOrder echte Service-/Produktnamen sieht.
function findOrdersForInvoiceItems(filter) {
  return Order.find(filter)
    .setOptions({ skipAutoPopulate: true })
    .select('orderNumber status totalCost discount deviceType deviceBrand deviceModel imei serialNumber services shopProducts addOns bookingId')
    .populate('services.serviceId', 'name')
    .populate('shopProducts.productId', 'name');
}

/**
 * Dieselbe Leistung darf nicht auf zwei Rechnungen stehen. Blockiert, solange fuer
 * einen der Auftraege eine gueltige Rechnung existiert (nicht storniert, nicht
 * vollstaendig gutgeschrieben). Nach einer Voll-Gutschrift darf neu berechnet werden.
 */
async function assertOrdersNotYetInvoiced(orders = []) {
  const objectIds = orders
    .map((order) => toIdString(order?._id || order))
    .filter((id) => Types.ObjectId.isValid(id))
    .map((id) => new Types.ObjectId(id));
  if (objectIds.length === 0) return;

  const existing = await Invoice.findOne({
    isCreditNote: { $ne: true },
    status: { $nin: ['cancelled', 'credited'] },
    $or: [{ orderId: { $in: objectIds } }, { repairOrderIds: { $in: objectIds } }],
  })
    .setOptions({ skipAutoPopulate: true })
    .select('_id invoiceNumber orderId repairOrderIds')
    .lean();
  if (!existing) return;

  const hitIds = new Set([toIdString(existing.orderId), ...(existing.repairOrderIds || []).map(toIdString)]);
  const hitOrder = orders.find((order) => hitIds.has(toIdString(order?._id || order)));
  const orderLabel = hitOrder?.orderNumber ? `Auftrag ${hitOrder.orderNumber}` : 'diesen Auftrag';
  const error = buildFinancialError(
    `Für ${orderLabel} besteht bereits die Rechnung ${existing.invoiceNumber || existing._id}. `
    + 'Eine Leistung darf nicht zweimal berechnet werden – bitte die bestehende Rechnung verwenden '
    + 'oder sie zuerst vollständig gutschreiben.',
    409,
    'ORDER_ALREADY_INVOICED'
  );
  error.existingInvoice = { _id: String(existing._id), invoiceNumber: existing.invoiceNumber || null };
  throw error;
}

/**
 * Je Buchung hoechstens EINE gueltige Rechnung. Gezaehlt werden nur AKTIVE Rechnungen:
 * keine Gutschriften (auch die Storno-Gutschrift traegt die bookingId), keine stornierten
 * oder vollstaendig gutgeschriebenen Belege und keine verworfenen Entwuerfe (Status
 * 'cancelled'). Dieselbe Regel wie assertOrdersNotYetInvoiced - sonst ist der Korrekturweg
 * "Storno + neue Rechnung" (RECHNUNGSERSTELLUNG_SPEZIFIKATION.md) fuer Buchungen gesperrt.
 */
async function assertBookingNotYetInvoiced(bookingId) {
  const id = toIdString(bookingId);
  if (!id || !Types.ObjectId.isValid(id)) return;
  const existing = await Invoice.findOne({
    bookingId: new Types.ObjectId(id),
    isCreditNote: { $ne: true },
    status: { $nin: ['cancelled', 'credited'] },
  })
    .setOptions({ skipAutoPopulate: true })
    .select('_id invoiceNumber')
    .lean();
  if (!existing) return;
  const error = buildFinancialError(
    `Für diese Buchung besteht bereits die Rechnung ${existing.invoiceNumber || existing._id}. `
    + 'Für eine Korrektur bitte diese Rechnung zuerst stornieren.',
    409,
    'INVOICE_ALREADY_EXISTS'
  );
  error.existingInvoice = { _id: String(existing._id), invoiceNumber: existing.invoiceNumber || null };
  throw error;
}

/**
 * Speichert eine NEUE aktive Rechnung zusammen mit ihrem atomaren Anspruch auf Auftrag(e)
 * und Buchung (Invoice.activeBillingKeys, partieller Unique-Index). Die Pruefungen
 * assertOrdersNotYetInvoiced/assertBookingNotYetInvoiced sind nur Lesezugriffe - zwei
 * gleichzeitige "Rechnung erstellen" kamen beide daran vorbei. Jetzt entscheidet das
 * Einfuegen selbst: der Verlierer scheitert am Index (E11000) und bekommt dieselbe
 * deutsche 409 wie im sequentiellen Fall, mit der Nummer der bestehenden Rechnung.
 * Die im pre('save') bereits vergebene Belegnummer des Verlierers bleibt als Luecke
 * verbraucht; DocumentSequence vergibt sie nie ein zweites Mal.
 */
async function saveClaimedInvoice(invoice, { orders = [] } = {}) {
  const releasing = invoice.isCreditNote || ['cancelled', 'credited'].includes(String(invoice.status || ''));
  invoice.activeBillingKeys = releasing ? undefined : Invoice.buildActiveBillingKeys({
    orderId: invoice.orderId,
    repairOrderIds: invoice.repairOrderIds,
    bookingId: invoice.bookingId,
  });
  try {
    await invoice.save();
    return invoice;
  } catch (error) {
    if (!Invoice.isActiveBillingKeyConflict(error)) throw error;
    if (invoice.bookingId) await assertBookingNotYetInvoiced(invoice.bookingId);
    const orderRefs = orders.length > 0
      ? orders
      : [invoice.orderId, ...(invoice.repairOrderIds || [])].filter(Boolean);
    await assertOrdersNotYetInvoiced(orderRefs);
    // Der Gewinner ist inzwischen selbst storniert: kein Doppelbeleg, aber ein neuer Versuch ist moeglich.
    throw buildFinancialError(
      'Für diesen Auftrag bzw. diese Buchung wurde soeben parallel eine Rechnung erstellt. Bitte die Ansicht neu laden.',
      409,
      'INVOICE_ALREADY_EXISTS'
    );
  }
}

function normalizeBillingAddress(address) {
  if (!address || typeof address !== 'object') return null;

  const street = String(address.street || address.line1 || address.addressLine1 || '').trim();
  const city = String(address.city || address.town || '').trim();
  const zip = String(address.zip || address.zipCode || address.postalCode || address.postcode || '').trim();
  const state = String(address.state || address.province || '').trim();
  const country = String(address.country || '').trim();

  if (!street && !city && !zip && !state && !country) return null;

  return {
    street,
    city,
    zip,
    zipCode: zip,
    state,
    country,
  };
}

function normalizeShippingAddress(address) {
  if (!address || typeof address !== 'object') return null;

  const street = String(address.street || address.line1 || address.addressLine1 || '').trim();
  const city = String(address.city || address.town || '').trim();
  const zip = String(address.zip || address.zipCode || address.postalCode || address.postcode || '').trim();
  const state = String(address.state || address.province || '').trim();
  const country = String(address.country || '').trim();

  if (!street && !city && !zip && !state && !country) return null;

  return {
    street,
    city,
    zip,
    zipCode: zip,
    state,
    country,
  };
}

function resolveBillingAddressFromCustomer(customer) {
  if (!customer) return null;
  return normalizeBillingAddress(customer.invoiceAddress)
    || normalizeBillingAddress(customer.paymentAddress)
    || null;
}

function resolveBillingAddressFromOrder(order) {
  if (!order) return null;
  return normalizeBillingAddress(order.guestInfo?.billingAddress)
    || resolveBillingAddressFromCustomer(order.customerId)
    || null;
}

function resolveBillingAddressFromBooking(booking) {
  if (!booking) return null;
  return normalizeBillingAddress(booking.guestInfo?.billingAddress)
    || resolveBillingAddressFromCustomer(booking.customerId)
    || null;
}

function resolveShippingAddressFromCustomer(customer) {
  if (!customer) return null;
  return normalizeShippingAddress(customer.paymentAddress)
    || normalizeShippingAddress(customer.shippingAddress)
    || normalizeShippingAddress(customer.invoiceAddress)
    || null;
}

function resolveShippingAddressFromOrder(order) {
  if (!order) return null;
  return normalizeShippingAddress(order.guestInfo?.shippingAddress)
    || normalizeShippingAddress(order.shippingAddress)
    || resolveShippingAddressFromCustomer(order.customerId)
    || null;
}

function resolveShippingAddressFromBooking(booking) {
  if (!booking) return null;
  return normalizeShippingAddress(booking.guestInfo?.shippingAddress)
    || normalizeShippingAddress(booking.shippingAddress)
    || resolveShippingAddressFromCustomer(booking.customerId)
    || null;
}

// Ausgestellt = nicht mehr Entwurf/Freigabe. Nur ausgestellte Belege werden archiviert,
// storniert (statt verworfen) und sind fuer Kunden sichtbar.
const NOT_ISSUED_STATUSES = ['draft', 'pending_approval'];
function isIssuedStatus(status) {
  return Boolean(status) && !NOT_ISSUED_STATUSES.includes(String(status));
}
// Archivierte PDF-Fassungen: hoechstens so viele Historien-Eintraege (nur Metadaten)
// stehen im Rechnungsdokument; die Bytes liegen in InvoiceDocumentArchive.
const DOCUMENT_HISTORY_INLINE_LIMIT = 20;

function toBufferValue(raw) {
  if (!raw) return null;
  if (Buffer.isBuffer(raw)) return raw;
  // BSON Binary (lean-Abfragen): nur die belegten Bytes (length()), nicht die Kapazitaet.
  if (raw._bsontype === 'Binary' && typeof raw.read === 'function') return Buffer.from(raw.read(0, raw.length()));
  if (raw instanceof Uint8Array) return Buffer.from(raw.buffer, raw.byteOffset, raw.byteLength);
  return Buffer.from(raw);
}

// Bytes der aktuellen Fassung: aus der Archivsammlung (documentId) oder - Altbestand -
// inline aus documentArchive.data. Stimmt der Hash nicht, wird NICHT still neu erzeugt.
async function readArchivedDocumentBytes(archive = {}) {
  if (archive.documentId) {
    const stored = await InvoiceDocumentArchive.findById(archive.documentId).lean();
    const bytes = toBufferValue(stored?.data);
    if (!bytes || bytes.length === 0) {
      throw buildFinancialError('Das archivierte Rechnungsdokument ist nicht auffindbar. Bitte den Support informieren.', 500, 'DOCUMENT_ARCHIVE_MISSING');
    }
    if (archive.sha256 && crypto.createHash('sha256').update(bytes).digest('hex') !== archive.sha256) {
      throw buildFinancialError('Das archivierte Rechnungsdokument ist beschädigt (Prüfsumme weicht ab). Bitte den Support informieren.', 500, 'DOCUMENT_ARCHIVE_CORRUPT');
    }
    return bytes;
  }
  const inline = toBufferValue(archive.data);
  return inline && inline.length > 0 ? inline : null;
}

// Ausgestellt und noch wirksam: nur diese Belege koennen storniert werden.
const CANCELLABLE_INVOICE_STATUSES = ['sent', 'viewed', 'partially_paid', 'paid', 'overdue'];

// Valid invoice status transitions
const INVOICE_STATUS_TRANSITIONS = {
  draft:            ['pending_approval', 'sent', 'cancelled'],
  pending_approval: ['sent', 'draft', 'cancelled'],
  sent:             ['viewed', 'partially_paid', 'paid', 'overdue', 'cancelled'],
  viewed:           ['partially_paid', 'paid', 'overdue', 'cancelled'],
  partially_paid:   ['paid', 'overdue', 'cancelled'],
  paid:             ['credited'],
  overdue:          ['partially_paid', 'paid', 'cancelled'],
  cancelled:        ['credited'],
  credited:         []
};

// Belegstatus, deren ZAHLUNGSSTAND den Belegstatus fortschreiben darf.
// Grundlage sind die zuordnungsfaehigen Status aus dem PaymentService; 'draft' und
// 'pending_approval' fehlen dort bewusst: ein Beleg ohne Freigabe darf nicht ueber
// eingegangenes Geld nach 'paid'/'partially_paid' gedraengt werden - diesen Uebergang
// kennt INVOICE_STATUS_TRANSITIONS nicht und der Beleg waere danach unbeweglich.
// 'paid' kommt hinzu, damit eine entfernte oder erstattete Zahlung einen bereits
// bezahlten Beleg wieder oeffnen kann. 'cancelled' und 'credited' bleiben unberuehrt.
// Der BETRAG (paidAmount) wird in jedem Fall geschrieben: Geld wird immer verbucht,
// nur der Beleg wird nicht bewegt.
const PAYMENT_DERIVED_STATUS_WRITABLE = [...PaymentService.ALLOCATABLE_INVOICE_STATUSES, 'paid'];

// Deutsches Belegstatus-Label (Quelle: PaymentService). Meldungen, die den
// Bearbeiter erreichen, duerfen den rohen englischen Enum-Wert nicht zeigen -
// der technische Wert bleibt im Fehlercode und im Log.
const invoiceStatusLabelDe = PaymentService.invoiceStatusLabel;

// Default financial settings (fallback if no config exists)
const DEFAULT_FINANCIAL_SETTINGS = {
  defaults: {
    currency: 'EUR',
    locale: 'de-DE',
    taxRate: 19,
    paymentDueDays: 7,
    paymentTerms: 'Net 7',
    invoicePrefix: 'INV-',
    creditNotePrefix: 'CN-',
    defaultDiscount: 0,
    defaultPaymentMethod: 'credit_card'
  },
  discountPolicy: {
    allowManualDiscounts: true,
    maxDiscountPercent: 20,
    lateFeePercent: 5
  },
  invoiceMetadata: {
    sellerName: 'McRepair.de',
    sellerVatId: '',
    registrationNumber: '',
    issuerEmail: '',
    issuerPhone: '',
    invoiceFooter: '',
    legalFooter: ''
  },
  paymentPreferences: {
    partialPaymentsAllowed: true,
    autoAttachPdf: true,
    showTaxBreakdown: true,
    defaultVisualTheme: 'modern',
    accentColor: '#1a2a5e'
  }
};

const MANUAL_PAYMENT_METHODS = ['credit_card', 'sepa', 'paypal', 'cash'];

function normalizeTrackedPaymentMethod(value) {
  if (value == null || value === '') return null;
  const normalized = String(value).trim().toLowerCase();
  return MANUAL_PAYMENT_METHODS.includes(normalized) ? normalized : null;
}

function normalizeTrackedPaidAt(value) {
  if (value == null || value === '') return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function escapeRegExp(value) {
  return String(value ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Belegtyp-Ausschnitt der Rechnungsliste.
 * Akzeptiert beide Schreibweisen, die der Client schicken kann:
 *   scope=invoices|creditNotes|all   oder   isCreditNote=true|false
 * Ohne Angabe bleibt es beim bisherigen Verhalten (beides).
 */
function normalizeInvoiceScope(scope, isCreditNote) {
  const raw = String(scope ?? '').trim().toLowerCase();
  if (raw === 'invoices' || raw === 'invoice' || raw === 'regular') return 'invoices';
  if (raw === 'creditnotes' || raw === 'creditnote' || raw === 'credit_notes') return 'creditNotes';
  if (raw === 'all' || raw === 'both') return 'all';

  if (isCreditNote === true || isCreditNote === 'true' || isCreditNote === 1 || isCreditNote === '1') return 'creditNotes';
  if (isCreditNote === false || isCreditNote === 'false' || isCreditNote === 0 || isCreditNote === '0') return 'invoices';
  return 'all';
}

/**
 * Regex-Baustein fuer die Belegnummernsuche.
 * Trennzeichen werden weich behandelt ('INV 2026/42', 'inv-2026-42', '#INV-2026-42'
 * treffen dieselbe Nummer) und fuehrende Nullen der laufenden Nummer sind optional.
 * Deckt damit auch Altformate wie 'INV-1712345678-ab12cd' ab.
 */
function buildInvoiceNumberPattern(value) {
  const cleaned = String(value ?? '')
    .trim()
    .replace(/^#/, '')
    .replace(/[\s_/]+/g, '-')
    .replace(/-+/g, '-');
  if (!cleaned) return '';

  return cleaned
    .split('-')
    .filter(Boolean)
    .map((part) => (/^\d+$/.test(part) ? `0*${part}` : escapeRegExp(part)))
    .join('[-\\s_/]*');
}

// Safely extracts a Mongo id string from an ObjectId, populated doc, or plain id string.
function toIdString(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    // ObjectId zuerst: ein ObjectId liefert auf `_id` sich selbst zurueck, die
    // _id-Verzweigung wuerde sich daher endlos selbst aufrufen.
    if (typeof value.toHexString === 'function') return value.toHexString();
    if (value._id != null) return toIdString(value._id);
    if (value.id != null) return toIdString(value.id);
  }
  return String(value);
}

class FinancialService {
  // Helper: Load financial settings from SystemConfiguration
  static async getFinancialSettings() {
    try {
      const config = await SystemConfiguration.findOne().lean();
      if (!config || !config.financialSettings) {
        return DEFAULT_FINANCIAL_SETTINGS;
      }
      // Deep merge with defaults to ensure all fields exist
      return {
        defaults: { ...DEFAULT_FINANCIAL_SETTINGS.defaults, ...(config.financialSettings.defaults || {}) },
        discountPolicy: { ...DEFAULT_FINANCIAL_SETTINGS.discountPolicy, ...(config.financialSettings.discountPolicy || {}) },
        invoiceMetadata: { ...DEFAULT_FINANCIAL_SETTINGS.invoiceMetadata, ...(config.financialSettings.invoiceMetadata || {}) },
        paymentPreferences: { ...DEFAULT_FINANCIAL_SETTINGS.paymentPreferences, ...(config.financialSettings.paymentPreferences || {}) }
      };
    } catch (error) {
      console.error('FinancialService: Error loading financial settings, using defaults:', error.message);
      return DEFAULT_FINANCIAL_SETTINGS;
    }
  }

  static async resolveFinancialProfile({ customerId = null, customer = null } = {}) {
    const settings = await FinancialService.getFinancialSettings();

    const targetCustomerId = customerId
      || customer?._id
      || customer?.id
      || customer?.customerId
      || null;

    let resolvedCustomer = null;

    if (targetCustomerId) {
      resolvedCustomer = await User.findById(targetCustomerId)
        .populate('primaryCustomerGroupId', 'name key financeProfile')
        .lean();
    }

    const groupFinanceProfile = resolvedCustomer?.primaryCustomerGroupId?.financeProfile || {};
    const customerPaymentTerms = resolvedCustomer?.paymentTerms || '';
    const customerDueDays = resolvedCustomer?.paymentDueDays ?? parseDueDaysFromTerms(customerPaymentTerms);
    const taxMode = groupFinanceProfile.taxMode || 'default';
    const resolvedTaxRate = taxMode === 'tax_free' || taxMode === 'reverse_charge'
      ? 0
      : settings.defaults.taxRate;

    // EINE Zahlungsbedingung: die Frist in Tagen. Der Text wird daraus abgeleitet und
    // nicht mehr aus einem zweiten, unabhaengig gepflegten Freitextfeld gelesen - sonst
    // entsteht genau Sophies Widerspruch "faellig in 7 Tagen, Zahlungsziel: Net 30".
    // Ein Freitext wie 'Net 30' am Kunden dient nur noch als Quelle der Zahl, wenn
    // keine Frist gepflegt ist.
    const paymentDueDays = normalizePaymentDueDays(
      customerDueDays ?? groupFinanceProfile.paymentDueDays ?? parseDueDaysFromTerms(groupFinanceProfile.paymentTermsLabel)
        ?? settings.defaults.paymentDueDays ?? parseDueDaysFromTerms(settings.defaults.paymentTerms)
    );

    return {
      currency: groupFinanceProfile.currency || settings.defaults.currency,
      locale: settings.defaults.locale,
      taxRate: resolvedTaxRate,
      taxMode,
      paymentDueDays,
      paymentTerms: Invoice.formatPaymentTerms(paymentDueDays),
      // Kein invoicePrefix mehr: die Belegnummer kommt global aus DocumentSequence
      // ('INV-JJJJ-NNNN' / 'INV-CN-JJJJ-NNNN') und ist nicht mehr gruppenabhaengig.
      defaultDiscountPercent: typeof resolvedCustomer?.discount === 'number' && resolvedCustomer.discount > 0
        ? resolvedCustomer.discount
        : groupFinanceProfile.discountPercent ?? settings.defaults.defaultDiscount,
      defaultPaymentMethod: resolvedCustomer?.paymentMethod
        || (Array.isArray(groupFinanceProfile.allowedPaymentMethods) && groupFinanceProfile.allowedPaymentMethods[0])
        || settings.defaults.defaultPaymentMethod,
      creditLimit: groupFinanceProfile.creditLimit ?? 0,
      sellerVatId: settings.invoiceMetadata?.sellerVatId || 'DE318981969',
      invoiceMetadata: settings.invoiceMetadata || {},
      customer: resolvedCustomer,
      group: resolvedCustomer?.primaryCustomerGroupId || null,
    };
  }
  static mapPaymentMethodToGateway(paymentMethod) {
    if (paymentMethod === 'paypal') return 'paypal';
    if (paymentMethod === 'stripe') return 'stripe';
    return null;
  }

  // Customer Management
  static async searchCustomers(query) {
    console.log('FinancialService: Searching customers with query:', query);

    try {
      const searchRegex = new RegExp(String(query).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

      const customers = await User.find({
        $or: [
          { name: searchRegex },
          { firstName: searchRegex },
          { lastName: searchRegex },
          { email: searchRegex },
          { customerNumber: searchRegex }
        ],
        role: 'customer'
      })
      .select('name firstName lastName customerNumber email phone invoiceAddress paymentAddress company country vatId')
      .limit(10);

      console.log('FinancialService: Found', customers.length, 'customers');
      return customers;
    } catch (error) {
      console.error('FinancialService: Error searching customers:', error);
      throw error;
    }
  }

  // Payment Management
  static async getPayments(filters = {}) {
    console.log('FinancialService: Getting payments with filters:', filters);

    try {
      const query = {};

      // Apply filters
      if (filters.status) {
        query.status = filters.status;
      }

      if (filters.method) {
        query.paymentMethod = filters.method;
      }

      if (filters.dateFrom || filters.dateTo) {
        query.createdAt = {};
        if (filters.dateFrom) {
          query.createdAt.$gte = new Date(filters.dateFrom);
        }
        if (filters.dateTo) {
          query.createdAt.$lte = new Date(filters.dateTo);
        }
      }

      // Pagination
      const page = parseInt(filters.page) || 1;
      const limit = filters.limit ? parseInt(filters.limit) : 500;
      const skip = (page - 1) * limit;

      const [paymentSummary] = await Payment.aggregate([
        {
          $match: query,
        },
        {
          $facet: {
            items: [
              { $sort: { createdAt: -1 } },
              { $skip: skip },
              { $limit: limit },
            ],
            totalCount: [{ $count: 'count' }],
            totalAmount: [{ $group: { _id: null, totalAmount: { $sum: '$amount' } } }],
          },
        },
      ]);

      // Zuordnungsstand je Zahlung, damit die Zahlungsansicht eine Ueberzahlung
      // ("nicht zugeordnet / Erstattung offen") direkt zeigen kann.
      const rawPayments = paymentSummary?.items || [];
      const pageAllocations = rawPayments.length > 0
        ? await PaymentAllocation.find({ paymentId: { $in: rawPayments.map((payment) => payment._id) } })
          .select('paymentId allocatedAmount')
          .lean()
        : [];
      const allocatedByPayment = new Map();
      pageAllocations.forEach((allocation) => {
        const key = toIdString(allocation.paymentId);
        allocatedByPayment.set(key, CalculationHelper.round(Number(allocatedByPayment.get(key) || 0) + Number(allocation.allocatedAmount || 0)));
      });
      const payments = rawPayments.map((payment) => {
        const effectiveAmount = PaymentService.effectivePaymentAmount(payment);
        const allocatedAmount = CalculationHelper.round(Number(allocatedByPayment.get(toIdString(payment._id)) || 0));
        const refundsInProgress = CalculationHelper.round((payment.refunds || [])
          .filter((entry) => entry.status === 'pending')
          .reduce((sum, entry) => sum + Number(entry.amount || 0), 0));
        return {
          ...payment,
          // Je Erstattungseintrag die SERVER-Regel "ungeklaert" (isUnresolvedGatewayRefund):
          // auch ein ausstehender Anbieter-Eintrag OHNE Referenz (Altbestand, Abbruch
          // zwischen Reservierung und PayPal-Aufruf) blockiert weitere Erstattungen.
          refunds: (payment.refunds || []).map((entry) => ({ ...entry, unresolved: isUnresolvedGatewayRefund(entry) })),
          effectiveAmount,
          allocatedAmount,
          unallocatedAmount: PaymentService.isCountablePayment(payment)
            ? CalculationHelper.round(Math.max(0, effectiveAmount - allocatedAmount - refundsInProgress))
            : 0,
          refundsInProgress,
          unresolvedRefundAmount: CalculationHelper.round((payment.refunds || [])
            .filter(isUnresolvedGatewayRefund)
            .reduce((sum, entry) => sum + Number(entry.amount || 0), 0)),
        };
      });
      const totalPayments = paymentSummary?.totalCount?.[0]?.count || 0;
      const totalPages = Math.ceil(totalPayments / limit);
      const totalAmount = paymentSummary?.totalAmount?.[0]?.totalAmount || 0;

      console.log('FinancialService: Found', payments.length, 'payments');
      return {
        payments,
        totalPages,
        currentPage: page,
        totalAmount
      };
    } catch (error) {
      console.error('FinancialService: Error getting payments:', error);
      throw error;
    }
  }

  /**
   * Erstattet (einen Teil) einer Zahlung.
   *
   * Regeln:
   *  - Erstattungen sind KUMULATIV: refundAmount ist die Summe aller abgeschlossenen
   *    Erstattungsvorgaenge (Payment.refunds). Frueher ueberschrieb jede Teilerstattung
   *    die vorherige.
   *  - Idempotent: derselbe Vorgang (idempotencyKey bzw. Fingerabdruck im 5-Minuten-
   *    Fenster) wird genau einmal gebucht, auch bei Doppelklick oder Retry.
   *  - 'gateway' bedeutet eine ECHTE Erstattung beim Anbieter (derzeit nur PayPal).
   *    Frueher wurde im Gateway-Modus nur ein Status gesetzt, ohne den Anbieter
   *    aufzurufen - die Oberflaeche meldete Erfolg fuer Geld, das nie zurueckging.
   *    Eine ausstehende (PENDING) oder fehlgeschlagene Anbieter-Erstattung zaehlt NICHT
   *    als erstattet; bestaetigt wird sie ueber applyGatewayRefundUpdate (Webhook).
   *  - Eine Erstattung aendert keinen Beleg. Belegkorrektur (Gutschrift) und
   *    Zuordnung sind eigene Vorgaenge.
   */
  static async processRefund(paymentId, amount, reason, options = {}) {
    console.log('FinancialService: Processing refund for payment:', paymentId);

    if (!Types.ObjectId.isValid(String(paymentId || ''))) {
      throw buildFinancialError('Ungültige Zahlungs-ID.', 400, 'INVALID_PAYMENT_ID');
    }
    let payment = await Payment.findById(paymentId);
    if (!payment) throw buildFinancialError('Zahlung wurde nicht gefunden.', 404, 'PAYMENT_NOT_FOUND');

    const refundAmount = CalculationHelper.round(Number(amount));
    if (!Number.isFinite(refundAmount) || refundAmount <= 0) {
      throw buildFinancialError('Der Erstattungsbetrag muss größer als 0 sein.', 400, 'INVALID_AMOUNT');
    }
    const cleanReason = String(reason || '').trim().slice(0, 500);
    if (!cleanReason) {
      throw buildFinancialError('Bitte einen Grund für die Erstattung angeben.', 400, 'REASON_REQUIRED');
    }
    const mode = options.mode === 'manual' ? 'manual' : 'gateway';

    // Wiederholung desselben Vorgangs? Dann den bereits gebuchten Eintrag melden.
    // Ein ENDGUELTIG abgelehnter Versuch ('failed') blockiert den Schluessel nicht: die
    // Wiederholung wird ein neuer Versuch mit neuer PayPal-Request-Id. Ein Versuch mit
    // UNKLAREM Ergebnis wird dagegen mit SEINER Request-ID erneut abgefragt - PayPal
    // liefert dann das Ergebnis des ersten Aufrufs statt ein zweites Mal zu erstatten.
    const fingerprint = [toIdString(payment._id), refundAmount.toFixed(2), cleanReason, String(options.mode || '')];
    const keys = String(options.idempotencyKey || '').trim()
      ? [buildPaymentIdempotencyKey('refund', fingerprint, options.idempotencyKey)]
      : [
        buildPaymentIdempotencyKey('refund', fingerprint, null, 0),
        buildPaymentIdempotencyKey('refund', fingerprint, null, 1),
      ];
    const duplicate = (payment.refunds || []).find((entry) => keys.includes(entry.idempotencyKey) && entry.status !== 'failed');
    if (duplicate) {
      if (isUnresolvedGatewayRefund(duplicate)) {
        // Wiederholung DESSELBEN Auftrags: Abfrage, danach Wiederholung mit derselben Request-ID.
        return FinancialService.settleUnresolvedRefund(payment._id, duplicate._id, { duplicate: true, allowReplay: true });
      }
      return FinancialService.describeRefund(payment, duplicate, { duplicate: true });
    }

    if (payment.status !== 'completed') {
      throw buildFinancialError('Nur abgeschlossene Zahlungen können erstattet werden.', 409, 'PAYMENT_NOT_REFUNDABLE');
    }

    // Solange ein PayPal-Vorgang dieser Zahlung ein UNKLARES Ergebnis hat, wird WEDER eine
    // weitere PayPal-Erstattung NOCH eine manuelle Erstattung gebucht: der ungeklaerte
    // Vorgang kann bei PayPal noch abschliessen (Webhook) - eine zusaetzlich erfasste
    // "manuelle" Rueckzahlung desselben Geldes wuerde dann doppelt zaehlen.
    // Der alte Vorgang wird dabei NIE erneut ausgefuehrt (kein Geldfluss als Nebenwirkung
    // eines ANDEREN Auftrags); sein Stand wird beim Anbieter nur ABGEFRAGT.
    {
      const unresolved = (payment.refunds || []).filter(isUnresolvedGatewayRefund);
      let settledAsExecuted = null;
      for (const entry of unresolved) {
        const settled = await FinancialService.settleUnresolvedRefund(payment._id, entry._id, { throwOnReject: false, allowReplay: false });
        if (['completed', 'pending'].includes(settled.status) && !settled.indeterminate) settledAsExecuted = settled;
        if (settled.indeterminate) {
          throw buildFinancialError(
            `Eine frühere PayPal-Erstattung dieser Zahlung über ${formatEuroDe(CalculationHelper.round(Number(entry.amount || 0)))} ist noch ungeklärt `
            + '(PayPal hat nicht eindeutig geantwortet). Bitte zuerst im PayPal-Konto prüfen, ob diese Erstattung ausgeführt wurde, und den Vorgang '
            + 'bei der Zahlung über „Abgleichen“ klären (ausgeführt – mit PayPal-Erstattungs-ID – oder nicht ausgeführt). '
            + 'Bis dahin wird keine weitere Erstattung gebucht, auch keine manuelle: sonst würde dasselbe Geld doppelt gezählt, '
            + 'sobald PayPal den offenen Vorgang abschließt.',
            409,
            'REFUND_UNRESOLVED'
          );
        }
      }
      // Die fruehere Erstattung ist bei PayPal tatsaechlich ausgefuehrt worden. Haeufig ist
      // der neue Auftrag genau die Wiederholung dieser Erstattung (neuer Dialog) - dann
      // wuerde das Geld ein zweites Mal fliessen. Deshalb hier anhalten und den
      // Bearbeiter den bestaetigten Stand pruefen lassen; ein erneutes Ausloesen danach
      // ist eine bewusste, weitere Erstattung.
      if (settledAsExecuted) {
        throw buildFinancialError(
          `Eine frühere PayPal-Erstattung dieser Zahlung über ${formatEuroDe(settledAsExecuted.amount)} wurde soeben von PayPal als `
          + `${settledAsExecuted.status === 'completed' ? 'ausgeführt' : 'angenommen (ausstehend)'} bestätigt. `
          + 'Bitte den Stand prüfen – soll zusätzlich erstattet werden, den Vorgang danach erneut auslösen.',
          409,
          'REFUND_SETTLED_RECHECK'
        );
      }
      if (unresolved.length > 0) payment = await Payment.findById(payment._id);
    }

    const alreadyRefunded = CalculationHelper.round(Number(payment.refundAmount || 0));
    const inProgress = CalculationHelper.round((payment.refunds || [])
      .filter((entry) => entry.status === 'pending')
      .reduce((sum, entry) => sum + Number(entry.amount || 0), 0));
    const refundable = CalculationHelper.round(Math.max(0, Number(payment.amount || 0) - alreadyRefunded - inProgress));
    if (refundAmount > refundable + 0.01) {
      throw buildFinancialError(
        `Die Erstattung (${formatEuroDe(refundAmount)}) übersteigt den noch erstattbaren Betrag dieser Zahlung (${formatEuroDe(refundable)}`
        + `${inProgress > 0.009 ? `, davon ${formatEuroDe(inProgress)} bereits in Bearbeitung beim Zahlungsanbieter` : ''}).`,
        400,
        'REFUND_EXCEEDS_PAYMENT'
      );
    }

    const allocationRows = await PaymentAllocation.find({ paymentId: payment._id }).select('allocatedAmount').lean();
    const unallocatedBefore = CalculationHelper.round(Math.max(0,
      Number(payment.amount || 0) - alreadyRefunded - inProgress
      - allocationRows.reduce((sum, row) => sum + Number(row.allocatedAmount || 0), 0)));

    let provider = 'manual';
    let captureId = '';
    if (mode === 'gateway') {
      provider = options.gatewayProvider || FinancialService.mapPaymentMethodToGateway(payment.paymentMethod) || '';
      if (provider !== 'paypal') {
        throw buildFinancialError(
          'Für diese Zahlart ist keine automatische Erstattung über einen Zahlungsanbieter angebunden. '
          + 'Bitte die Rückzahlung selbst ausführen und hier als manuelle Erstattung erfassen.',
          400,
          'GATEWAY_REFUND_UNAVAILABLE'
        );
      }
      captureId = resolvePaypalCaptureId(payment);
      if (!captureId) {
        throw buildFinancialError(
          'Zu dieser PayPal-Zahlung ist keine Capture-ID gespeichert – eine Erstattung über PayPal ist nicht möglich. '
          + 'Bitte die Rückzahlung im PayPal-Konto ausführen und hier manuell erfassen.',
          400,
          'PAYPAL_CAPTURE_MISSING'
        );
      }
    }

    // Eintrag atomar anlegen. Die Bedingung auf die Anzahl der Eintraege serialisiert
    // parallele Erstattungen derselben Zahlung: der zweite Lauf findet einen
    // veraenderten Stand vor und prueft neu, statt ueber den Restbetrag zu buchen.
    const now = new Date();
    const entryId = new Types.ObjectId();
    const attempt = (payment.refunds || []).filter((item) => keys.includes(item.idempotencyKey) && item.status === 'failed').length + 1;
    const entry = {
      _id: entryId,
      idempotencyKey: keys[0],
      requestId: mode === 'gateway' ? buildRefundRequestId(keys[0], attempt) : '',
      attempt,
      unresolved: false,
      amount: refundAmount,
      status: mode === 'manual' ? 'completed' : 'pending',
      mode,
      provider,
      reference: mode === 'manual' ? String(options.gatewayReference || '').trim().slice(0, 120) : '',
      reason: cleanReason,
      recordedBy: options.recordedBy || undefined,
      createdAt: now,
      completedAt: mode === 'manual' ? now : undefined,
    };
    const currentCount = (payment.refunds || []).length;
    const update = {
      $push: { refunds: entry },
      $set: {
        refundReason: cleanReason,
        refundMode: mode,
        refundGatewayProvider: provider,
        updatedAt: now,
      },
    };
    if (mode === 'manual') {
      const total = CalculationHelper.round(alreadyRefunded + refundAmount);
      update.$set.refundAmount = total;
      update.$set.refundedAt = now;
      update.$set.refundGatewayReference = entry.reference;
      // Nur eine VOLLerstattung setzt den Status auf 'refunded'; bei einer
      // Teilerstattung bleibt der Rest gueltig und zaehlt weiter.
      if (total >= CalculationHelper.round(Number(payment.amount || 0)) - 0.01) update.$set.status = 'refunded';
    }
    const reserved = await Payment.findOneAndUpdate(
      {
        _id: payment._id,
        status: 'completed',
        refundAmount: payment.refundAmount == null ? { $in: [null, 0] } : payment.refundAmount,
        $expr: { $eq: [{ $size: { $ifNull: ['$refunds', []] } }, currentCount] },
        // Nur ein NICHT fehlgeschlagener Eintrag mit demselben Schluessel ist ein Duplikat.
        refunds: { $not: { $elemMatch: { idempotencyKey: { $in: keys }, status: { $ne: 'failed' } } } },
      },
      update,
      { new: true }
    );
    if (!reserved) {
      const latest = await Payment.findById(payment._id);
      const winner = (latest?.refunds || []).find((item) => keys.includes(item.idempotencyKey) && item.status !== 'failed');
      if (winner) return FinancialService.describeRefund(latest, winner, { duplicate: true });
      throw buildFinancialError(
        'Die Zahlung wurde parallel geändert. Bitte die Ansicht neu laden und die Erstattung erneut prüfen.',
        409,
        'REFUND_CONFLICT'
      );
    }

    let gatewayResult = null;
    if (mode === 'gateway') {
      gatewayResult = await FinancialService.runGatewayRefundAttempt(payment._id, entryId, {
        captureId,
        amount: refundAmount,
        requestId: entry.requestId,
        currency: payment.currency || 'EUR',
        note: cleanReason,
      });
      if (gatewayResult.outcome === 'rejected') {
        throw buildFinancialError(
          `${gatewayResult.message} Es wurde nichts als erstattet verbucht; die Erstattung kann nach Klärung erneut ausgelöst werden.`,
          502,
          'GATEWAY_REFUND_FAILED'
        );
      }
    }

    await FinancialService.syncAfterRefund(payment._id);
    const finalPayment = await Payment.findById(payment._id);
    const finalEntry = (finalPayment?.refunds || []).find((item) => String(item._id) === String(entryId));
    console.log('FinancialService: Refund recorded with status', finalEntry?.status);
    const described = FinancialService.describeRefund(finalPayment, finalEntry || entry, { duplicate: false });
    // Erstattung ueber den freien (nicht zugeordneten) Rest hinaus: das Geld fehlt nun
    // einer Rechnung. Das ist erlaubt (z.B. Kulanz), wird aber ausdruecklich gemeldet -
    // eine Wertkorrektur der Rechnung waere eine eigene Gutschrift.
    if (refundAmount > unallocatedBefore + 0.01) {
      described.warning = `Die Erstattung übersteigt den nicht zugeordneten Betrag dieser Zahlung (${formatEuroDe(unallocatedBefore)}). `
        + 'Die zugeordnete Rechnung ist dadurch wieder (teilweise) offen. Soll die Forderung sinken, ist zusätzlich eine Gutschrift nötig.';
    }
    return described;
  }

  /**
   * Fuehrt EINEN Aufruf der PayPal-Erstattung fuer einen bereits reservierten Eintrag
   * aus und schreibt das Ergebnis an diesen Eintrag.
   *
   * outcome:
   *  - 'completed'     PayPal hat erstattet -> genau einmal gebucht (completeRefundEntry)
   *  - 'pending'       PayPal hat angenommen, Geld noch nicht zurueck (Webhook schliesst ab)
   *  - 'rejected'      PayPal hat ENDGUELTIG abgelehnt -> Eintrag 'failed', nichts gebucht
   *  - 'indeterminate' Ergebnis unklar (Zeitueberschreitung/5xx) -> Eintrag bleibt
   *                    'pending' und wird als ungeklaert markiert; NIE 'failed'.
   */
  static async runGatewayRefundAttempt(paymentId, entryId, { captureId, amount, requestId, currency = 'EUR', note = '' } = {}) {
    const PaypalService = require('./paypalService');
    const now = new Date();
    let providerResult = null;
    try {
      providerResult = await PaypalService.refundCapture(captureId, amount, { requestId, currency, note });
    } catch (error) {
      const statusCode = Number(error?.statusCode) || 0;
      const outcome = error?.refundOutcome
        || (statusCode >= 400 && statusCode < 500 && ![408, 409].includes(statusCode) ? 'rejected' : 'indeterminate');
      if (outcome === 'rejected') {
        // Nur Meldungen aus dem PayPal-Dienst sind deutsch aufbereitet; alles andere
        // bekommt einen neutralen deutschen Satz (kein roher Code im UI-Text).
        const message = error?.refundOutcome ? String(error.message || '') : 'PayPal hat die Erstattung abgelehnt.';
        await Payment.updateOne(
          { _id: paymentId, refunds: { $elemMatch: { _id: entryId, status: 'pending' } } },
          {
            $set: {
              'refunds.$.status': 'failed',
              'refunds.$.unresolved': false,
              'refunds.$.lastCheckedAt': now,
              'refunds.$.error': `${message}${error?.providerCode ? ` [${error.providerCode}]` : ''}`.slice(0, 500),
            },
          }
        );
        return { outcome: 'rejected', message: message || 'PayPal hat die Erstattung abgelehnt.' };
      }
      await Payment.updateOne(
        { _id: paymentId, refunds: { $elemMatch: { _id: entryId, status: 'pending' } } },
        {
          $set: {
            'refunds.$.unresolved': true,
            'refunds.$.lastCheckedAt': now,
            'refunds.$.error': 'Ergebnis bei PayPal unklar (keine eindeutige Antwort) – Abgleich per Webhook oder Wiederholung mit derselben Anfrage-ID.',
          },
        }
      );
      return { outcome: 'indeterminate' };
    }

    const providerStatus = String(providerResult?.status || '').toUpperCase();
    const providerRefundId = String(providerResult?.id || '').trim();
    if (!providerRefundId) {
      // Antwort ohne Refund-ID: PayPal hat etwas getan, wir wissen nicht was.
      await Payment.updateOne(
        { _id: paymentId, refunds: { $elemMatch: { _id: entryId, status: 'pending' } } },
        { $set: { 'refunds.$.unresolved': true, 'refunds.$.lastCheckedAt': now, 'refunds.$.error': 'PayPal-Antwort ohne Erstattungs-ID – Abgleich erforderlich.' } }
      );
      return { outcome: 'indeterminate' };
    }
    await Payment.updateOne(
      { _id: paymentId, refunds: { $elemMatch: { _id: entryId } } },
      {
        $set: {
          'refunds.$.reference': providerRefundId,
          'refunds.$.unresolved': false,
          'refunds.$.lastCheckedAt': now,
          'refunds.$.error': '',
          refundGatewayReference: providerRefundId,
        },
      }
    );
    if (providerStatus === 'COMPLETED') {
      await FinancialService.completeRefundEntry(paymentId, entryId, providerRefundId);
      return { outcome: 'completed', refundId: providerRefundId };
    }
    if (['FAILED', 'CANCELLED'].includes(providerStatus)) {
      await Payment.updateOne(
        { _id: paymentId, refunds: { $elemMatch: { _id: entryId, status: 'pending' } } },
        { $set: { 'refunds.$.status': 'failed', 'refunds.$.error': providerStatus === 'FAILED' ? 'Von PayPal als fehlgeschlagen gemeldet' : 'Von PayPal abgebrochen' } }
      );
      return {
        outcome: 'rejected',
        message: `PayPal meldet die Erstattung als ${providerStatus === 'FAILED' ? 'fehlgeschlagen' : 'abgebrochen'}.`,
      };
    }
    // PENDING (oder unbekannt): bei PayPal angelegt, zaehlt erst nach Bestaetigung.
    return { outcome: 'pending', refundId: providerRefundId };
  }

  /**
   * Gleicht einen PayPal-Eintrag mit UNKLAREM Ergebnis ab: derselbe Aufruf mit
   * derselben PayPal-Request-Id. Hat PayPal beim ersten Mal erstattet, liefert es jetzt
   * dieses Ergebnis (keine zweite Erstattung); kam der erste Aufruf nie an, wird er
   * jetzt ausgefuehrt. Liefert die Antwort fuer Route/Client; `indeterminate` = weiter unklar.
   */
  static async settleUnresolvedRefund(paymentId, entryId, { duplicate = false, throwOnReject = true, allowReplay = false } = {}) {
    const payment = await Payment.findById(paymentId);
    const entry = (payment?.refunds || []).find((item) => String(item._id) === String(entryId));
    if (!payment || !entry) {
      throw buildFinancialError('Der Erstattungsvorgang wurde nicht gefunden.', 404, 'REFUND_NOT_FOUND');
    }
    if (!isUnresolvedGatewayRefund(entry)) {
      return FinancialService.describeRefund(payment, entry, { duplicate });
    }

    // 1. Nur LESEN: Stand beim Anbieter abfragen (keine Ausfuehrung).
    const queried = await FinancialService.queryGatewayRefundState(payment, entry);
    if (queried.state === 'completed' || queried.state === 'pending') {
      await Payment.updateOne(
        { _id: payment._id, refunds: { $elemMatch: { _id: entry._id, status: 'pending' } } },
        { $set: { 'refunds.$.reference': queried.refundId, 'refunds.$.unresolved': false, 'refunds.$.lastCheckedAt': new Date(), 'refunds.$.error': 'Per Abfrage bei PayPal geklärt', refundGatewayReference: queried.refundId } }
      );
      if (queried.state === 'completed') {
        const completed = await FinancialService.completeRefundEntry(payment._id, entry._id, queried.refundId);
        if (completed.applied) await FinancialService.syncAfterRefund(payment._id);
      }
      const fresh = await Payment.findById(payment._id);
      const freshEntry = (fresh?.refunds || []).find((item) => String(item._id) === String(entry._id)) || entry;
      const described = FinancialService.describeRefund(fresh, freshEntry, { duplicate });
      described.indeterminate = false;
      return described;
    }
    if (queried.state === 'failed') {
      await Payment.updateOne(
        { _id: payment._id, refunds: { $elemMatch: { _id: entry._id, status: 'pending' } } },
        { $set: { 'refunds.$.status': 'failed', 'refunds.$.unresolved': false, 'refunds.$.reference': queried.refundId, 'refunds.$.lastCheckedAt': new Date(), 'refunds.$.error': 'Laut PayPal fehlgeschlagen (per Abfrage geklärt)' } }
      );
      const fresh = await Payment.findById(payment._id);
      const freshEntry = (fresh?.refunds || []).find((item) => String(item._id) === String(entry._id)) || entry;
      const described = FinancialService.describeRefund(fresh, freshEntry, { duplicate });
      described.indeterminate = false;
      return described;
    }
    if (!allowReplay) {
      const fresh = await Payment.findById(payment._id);
      const freshEntry = (fresh?.refunds || []).find((item) => String(item._id) === String(entry._id)) || entry;
      const described = FinancialService.describeRefund(fresh, freshEntry, { duplicate });
      described.indeterminate = true;
      return described;
    }

    // 2. Nur bei ausdruecklicher Wiederholung DESSELBEN Auftrags (gleicher Dialog/Schluessel):
    // derselbe Aufruf mit derselben PayPal-Request-Id. PayPal liefert dann das Ergebnis des
    // ersten Aufrufs bzw. fuehrt genau diesen einen Auftrag aus - nie einen anderen.
    const captureId = resolvePaypalCaptureId(payment);
    const requestId = entry.requestId || String(entry.idempotencyKey || '').slice(0, 108);
    // Nur innerhalb des Fensters, in dem PayPal eine Request-ID sicher wiedererkennt.
    // Danach koennte derselbe Aufruf als NEUE Erstattung ausgefuehrt werden - dann bleibt
    // der Vorgang ungeklaert, bis Webhook oder Pruefung im PayPal-Konto ihn klaeren.
    const entryAge = Date.now() - new Date(entry.createdAt || 0).getTime();
    const replayAllowed = entryAge >= 0 && entryAge <= REFUND_REQUEST_ID_REPLAY_WINDOW_MS;
    let result = { outcome: 'indeterminate' };
    if (captureId && requestId && replayAllowed) {
      result = await FinancialService.runGatewayRefundAttempt(payment._id, entry._id, {
        captureId,
        amount: CalculationHelper.round(Number(entry.amount || 0)),
        requestId,
        currency: payment.currency || 'EUR',
        note: entry.reason || '',
      });
    }
    if (result.outcome === 'completed') await FinancialService.syncAfterRefund(payment._id);
    if (result.outcome === 'rejected' && throwOnReject) {
      throw buildFinancialError(
        `${result.message} Es wurde nichts als erstattet verbucht; die Erstattung kann erneut ausgelöst werden.`,
        502,
        'GATEWAY_REFUND_FAILED'
      );
    }

    const fresh = await Payment.findById(payment._id);
    const freshEntry = (fresh?.refunds || []).find((item) => String(item._id) === String(entry._id)) || entry;
    const described = FinancialService.describeRefund(fresh, freshEntry, { duplicate });
    described.indeterminate = result.outcome === 'indeterminate';
    return described;
  }

  /**
   * Stand eines ungeklaerten PayPal-Erstattungsversuchs NUR LESEND ermitteln: die
   * PayPal-Order der Zahlung (GET /v2/checkout/orders/{id}) listet alle Erstattungen.
   * Treffer nur, wenn GENAU EINE bisher keinem Eintrag zugeordnete Erstattung zu Betrag,
   * Hinweistext (note_to_payer = Grund) und Zeitfenster passt - sonst bleibt der Vorgang
   * ungeklaert (Abgleich durch den Bearbeiter). Fuehrt nie eine Erstattung aus.
   * @returns {Promise<{state: 'completed'|'pending'|'failed'|'not_found'|'ambiguous'|'unknown', refundId?: string}>}
   */
  static async queryGatewayRefundState(payment, entry) {
    const orderId = String(payment?.metadata?.paypalOrderId || payment?.metadata?.providerDetails?.orderId || '').trim();
    if (!orderId || String(entry?.provider || 'paypal') !== 'paypal') return { state: 'unknown' };
    let order = null;
    try {
      const PaypalService = require('./paypalService');
      order = await PaypalService.getOrder(orderId);
    } catch (error) {
      console.warn('FinancialService: PayPal-Order fuer Erstattungsabgleich nicht abrufbar:', error.message);
      return { state: 'unknown' };
    }
    if (!order) return { state: 'unknown' };
    const known = new Set((payment.refunds || []).map((item) => String(item.reference || '').trim()).filter(Boolean));
    const createdAt = new Date(entry.createdAt || 0).getTime();
    const reason = String(entry.reason || '').slice(0, 255);
    const candidates = (order.purchase_units || [])
      .flatMap((unit) => unit?.payments?.refunds || [])
      .filter((refund) => refund && refund.id && !known.has(String(refund.id)))
      .filter((refund) => Math.abs(Number(refund.amount?.value || 0) - Number(entry.amount || 0)) < 0.01)
      .filter((refund) => !refund.create_time || new Date(refund.create_time).getTime() >= createdAt - 5 * 60 * 1000)
      .filter((refund) => !refund.note_to_payer || !reason || String(refund.note_to_payer) === reason);
    if (candidates.length > 1) return { state: 'ambiguous' };
    if (candidates.length === 0) return { state: 'not_found' };
    const status = String(candidates[0].status || '').toUpperCase();
    if (status === 'COMPLETED') return { state: 'completed', refundId: String(candidates[0].id) };
    if (['FAILED', 'CANCELLED'].includes(status)) return { state: 'failed', refundId: String(candidates[0].id) };
    return { state: 'pending', refundId: String(candidates[0].id) };
  }

  /**
   * Manueller Abgleich eines UNGEKLAERTEN PayPal-Erstattungsversuchs durch einen
   * Administrator nach Pruefung im PayPal-Konto (falls weder Webhook noch Wiederholung
   * ihn klaeren konnten):
   *  - 'executed'     + PayPal-Refund-ID: die Erstattung ist erfolgt -> genau einmal buchen
   *  - 'not-executed' : bei PayPal keine Erstattung -> Eintrag 'failed', Betrag wieder frei
   */
  static async resolveUnresolvedRefund(paymentId, entryId, { resolution, providerRefundId = '', actorName = '' } = {}) {
    if (!Types.ObjectId.isValid(String(paymentId || '')) || !Types.ObjectId.isValid(String(entryId || ''))) {
      throw buildFinancialError('Ungültige Zahlungs- oder Erstattungs-ID.', 400, 'INVALID_ID');
    }
    const payment = await Payment.findById(paymentId);
    const entry = (payment?.refunds || []).find((item) => String(item._id) === String(entryId));
    if (!payment || !entry) throw buildFinancialError('Der Erstattungsvorgang wurde nicht gefunden.', 404, 'REFUND_NOT_FOUND');
    if (!isUnresolvedGatewayRefund(entry)) {
      throw buildFinancialError('Dieser Erstattungsvorgang ist nicht (mehr) ungeklärt.', 409, 'REFUND_NOT_UNRESOLVED');
    }
    const who = String(actorName || 'Administrator').slice(0, 80);

    if (resolution === 'executed') {
      const refundId = String(providerRefundId || '').trim();
      if (!/^[A-Za-z0-9-]{6,64}$/.test(refundId)) {
        throw buildFinancialError('Bitte die Erstattungs-ID aus dem PayPal-Konto angeben.', 422, 'PROVIDER_REFUND_ID_REQUIRED');
      }
      const clash = await Payment.findOne({ 'refunds.reference': refundId }).select('_id').lean();
      if (clash && String(clash._id) !== String(payment._id)) {
        throw buildFinancialError('Diese PayPal-Erstattungs-ID ist bereits einer anderen Zahlung zugeordnet.', 409, 'PROVIDER_REFUND_ID_IN_USE');
      }
      await Payment.updateOne(
        { _id: payment._id, refunds: { $elemMatch: { _id: entry._id, status: 'pending' } } },
        { $set: { 'refunds.$.reference': refundId, 'refunds.$.unresolved': false, 'refunds.$.error': `Per Abgleich bestätigt (${who})`, refundGatewayReference: refundId } }
      );
      const completed = await FinancialService.completeRefundEntry(payment._id, entry._id, refundId);
      if (completed.applied) await FinancialService.syncAfterRefund(payment._id);
    } else if (resolution === 'not-executed') {
      await Payment.updateOne(
        { _id: payment._id, refunds: { $elemMatch: { _id: entry._id, status: 'pending' } } },
        { $set: { 'refunds.$.status': 'failed', 'refunds.$.unresolved': false, 'refunds.$.error': `Laut Prüfung im PayPal-Konto nicht ausgeführt (${who})` } }
      );
      await FinancialService.syncAfterRefund(payment._id);
    } else {
      throw buildFinancialError('Unbekannte Abgleich-Entscheidung.', 422, 'INVALID_RESOLUTION');
    }

    const fresh = await Payment.findById(payment._id);
    const freshEntry = (fresh?.refunds || []).find((item) => String(item._id) === String(entry._id));
    return FinancialService.describeRefund(fresh, freshEntry, { duplicate: false });
  }

  // Einheitliche Antwort fuer Route/Client.
  static describeRefund(payment, entry, { duplicate = false } = {}) {
    return {
      _id: entry?._id ? String(entry._id) : '',
      paymentId: String(payment?._id || ''),
      amount: CalculationHelper.round(Number(entry?.amount || 0)),
      reason: entry?.reason || '',
      mode: entry?.mode || 'manual',
      status: entry?.status || 'pending',
      // true = PayPal hat nicht eindeutig geantwortet; der Vorgang wird per Webhook
      // oder Wiederholung abgeglichen und zaehlt bis dahin nicht als erstattet.
      indeterminate: isUnresolvedGatewayRefund(entry),
      gatewayProvider: entry?.provider || 'manual',
      gatewayReference: entry?.reference || '',
      processedAt: entry?.completedAt || entry?.createdAt || null,
      refundedTotal: CalculationHelper.round(Number(payment?.refundAmount || 0)),
      duplicate,
    };
  }

  /**
   * Schliesst einen ausstehenden Erstattungseintrag GENAU EINMAL ab: nur wenn der
   * Eintrag noch nicht 'completed' ist, wird sein Betrag auf refundAmount addiert.
   */
  static async completeRefundEntry(paymentId, entryId, reference = '') {
    const now = new Date();
    const updated = await Payment.findOneAndUpdate(
      { _id: paymentId, refunds: { $elemMatch: { _id: entryId, status: { $ne: 'completed' } } } },
      [
        {
          $set: {
            refundAmount: {
              $round: [{
                $add: [
                  { $ifNull: ['$refundAmount', 0] },
                  {
                    $sum: {
                      $map: {
                        input: { $filter: { input: '$refunds', as: 'r', cond: { $eq: ['$$r._id', entryId] } } },
                        as: 'r',
                        in: '$$r.amount',
                      },
                    },
                  },
                ],
              }, 2],
            },
            refunds: {
              $map: {
                input: '$refunds',
                as: 'r',
                in: {
                  $cond: [
                    { $eq: ['$$r._id', entryId] },
                    { $mergeObjects: ['$$r', { status: 'completed', completedAt: now, unresolved: false, ...(reference ? { reference } : {}) }] },
                    '$$r',
                  ],
                },
              },
            },
            refundedAt: now,
            updatedAt: now,
          },
        },
      ],
      { new: true }
    );
    if (!updated) return { applied: false };

    if (CalculationHelper.round(Number(updated.refundAmount || 0)) >= CalculationHelper.round(Number(updated.amount || 0)) - 0.01) {
      await Payment.updateOne({ _id: updated._id, status: 'completed' }, { $set: { status: 'refunded' } });
    }
    return { applied: true };
  }

  /**
   * Status einer Anbieter-Erstattung fortschreiben (Webhook oder Abgleich).
   * Idempotent ueber die Refund-ID des Anbieters: wiederholte oder verspaetete
   * Webhooks buchen denselben Betrag nie zweimal, und ein 'PENDING' zaehlt nie.
   */
  static async applyGatewayRefundUpdate({ provider = 'paypal', captureId = '', refundId = '', amount = 0, status = '', reason = '' } = {}) {
    const cleanRefundId = String(refundId || '').trim();
    const cleanCaptureId = String(captureId || '').trim();
    const normalizedStatus = (() => {
      const raw = String(status || '').toUpperCase();
      if (raw === 'COMPLETED') return 'completed';
      if (['FAILED', 'CANCELLED', 'DENIED'].includes(raw)) return 'failed';
      return 'pending';
    })();

    let payment = cleanRefundId ? await Payment.findOne({ 'refunds.reference': cleanRefundId }) : null;
    if (!payment && cleanCaptureId) {
      payment = await Payment.findOne({
        $or: [
          { 'metadata.providerDetails.captureId': cleanCaptureId },
          { 'metadata.providerReference': cleanCaptureId },
          { transactionId: cleanCaptureId },
        ],
      });
    }
    if (!payment) return { applied: false, reason: 'payment_not_found' };

    let entry = cleanRefundId ? (payment.refunds || []).find((item) => item.reference === cleanRefundId) : null;
    // Eigener, noch ohne Refund-ID ausstehender Eintrag mit demselben Betrag?
    if (!entry) {
      entry = (payment.refunds || []).find((item) => item.status === 'pending' && !item.reference
        && Math.abs(Number(item.amount || 0) - Number(amount || 0)) < 0.01);
      if (entry && cleanRefundId) {
        // PayPal kennt den Vorgang jetzt eindeutig: der Eintrag ist nicht mehr ungeklaert.
        await Payment.updateOne({ _id: payment._id, 'refunds._id': entry._id }, { $set: { 'refunds.$.reference': cleanRefundId, 'refunds.$.unresolved': false } });
      }
    }

    let applied = false;
    if (!entry) {
      // Erstattung wurde direkt beim Anbieter ausgeloest: als eigener Eintrag
      // uebernehmen (atomar gegen doppelte Zustellung ueber die Referenz).
      const value = CalculationHelper.round(Math.min(
        Math.max(0, Number(amount || 0)),
        Math.max(0, Number(payment.amount || 0) - Number(payment.refundAmount || 0))
      ));
      if (!(value > 0)) return { applied: false, reason: 'nothing_to_refund', paymentId: String(payment._id) };
      const newEntryId = new Types.ObjectId();
      const inserted = await Payment.findOneAndUpdate(
        { _id: payment._id, 'refunds.reference': { $ne: cleanRefundId || `__none_${newEntryId}` } },
        {
          $push: {
            refunds: {
              _id: newEntryId,
              amount: value,
              status: normalizedStatus === 'completed' ? 'pending' : normalizedStatus,
              mode: 'gateway',
              provider,
              reference: cleanRefundId,
              reason: String(reason || 'Erstattung beim Zahlungsanbieter').slice(0, 500),
              createdAt: new Date(),
            },
          },
          $set: { refundMode: 'gateway', refundGatewayProvider: provider, refundGatewayReference: cleanRefundId },
        },
        { new: true }
      );
      if (!inserted) return { applied: false, duplicate: true, paymentId: String(payment._id) };
      if (normalizedStatus === 'completed') {
        applied = (await FinancialService.completeRefundEntry(payment._id, newEntryId, cleanRefundId)).applied;
      }
    } else if (normalizedStatus === 'completed' && entry.status !== 'completed') {
      applied = (await FinancialService.completeRefundEntry(payment._id, entry._id, cleanRefundId)).applied;
    } else if (normalizedStatus === 'failed' && entry.status === 'pending') {
      await Payment.updateOne(
        { _id: payment._id, 'refunds._id': entry._id, 'refunds.status': 'pending' },
        { $set: { 'refunds.$.status': 'failed', 'refunds.$.unresolved': false, 'refunds.$.error': 'Vom Zahlungsanbieter abgelehnt' } }
      );
    }

    if (applied) await FinancialService.syncAfterRefund(payment._id);
    const refreshed = await Payment.findById(payment._id).lean();
    return {
      applied,
      duplicate: !applied && normalizedStatus === 'completed',
      paymentId: String(payment._id),
      refundAmount: CalculationHelper.round(Number(refreshed?.refundAmount || 0)),
    };
  }

  // Nach einer Erstattung: Belegstaende aus den Zuordnungen neu ableiten und den
  // Zahlungsstand der Buchung fortschreiben. Nicht fatal - das Geld ist gebucht.
  static async syncAfterRefund(paymentId) {
    try {
      const payment = await Payment.findById(paymentId).select('_id bookingId').lean();
      const invoiceIds = (await PaymentAllocation.find({ paymentId }).select('invoiceId').lean())
        .map((entry) => entry.invoiceId);
      if (invoiceIds.length > 0) await FinancialService.recalculateInvoicePaidAmounts(invoiceIds);
      if (payment?.bookingId) await FinancialService.applyBookingPaymentState(payment.bookingId);
    } catch (error) {
      console.error('FinancialService: derived state after refund not updated:', error);
    }
  }

  // Einheitlicher Zahlungsstand-Satz fuer Liste, Detail und Client.
  static toBalancePayload(balance) {
    if (!balance) {
      return { total: 0, credited: 0, receivable: 0, allocated: 0, open: 0, overpaid: 0, received: 0, refundPending: 0, refunded: 0, refundsInProgress: 0 };
    }
    return {
      total: balance.total,
      credited: balance.credited,
      receivable: balance.receivable,
      allocated: balance.allocated,
      open: balance.open,
      overpaid: balance.overpaid,
      received: balance.received,
      refundPending: balance.refundPending,
      refunded: balance.refunded,
      refundsInProgress: balance.refundsInProgress,
    };
  }

  // Invoice Management
  static async getInvoices(filters = {}) {
    console.log('FinancialService: Getting invoices with filters:', filters);

    try {
      const query = {};
      // Mehrere unabhaengige $or-Bedingungen (Auftrag, Belegnummer, Freitext) muessen
      // UND-verknuepft werden - ein zweites query.$or wuerde das erste ueberschreiben
      // und stillschweigend zu viele Belege liefern.
      const andClauses = [];

      // Apply filters
      if (filters.status) {
        query.status = filters.status;
      }

      // BELEGTYP (scope): Rechnungen, Gutschriften oder beides. Wird der Filter
      // ignoriert, bekommen die Rechnungs- und die Gutschriftenseite denselben
      // Ausschnitt und muessen clientseitig nachfiltern - mit dem Ergebnis, dass eine
      // Seite je nach Datenlage leer bleibt, obwohl es Belege gibt.
      const scope = normalizeInvoiceScope(filters.scope, filters.isCreditNote);
      if (scope === 'invoices') {
        // Altbestand kennt das Feld teils gar nicht: 'nicht true' statt '=== false'.
        query.isCreditNote = { $ne: true };
      } else if (scope === 'creditNotes') {
        query.isCreditNote = true;
      }

      if (filters.customerId) {
        query.customerId = filters.customerId;
      }

      if (filters.orderId) {
        const normalizedOrderId = String(filters.orderId).trim();
        if (normalizedOrderId) {
          const orderIdClauses = [
            { orderId: normalizedOrderId },
            { repairOrderIds: normalizedOrderId }
          ];

          if (Types.ObjectId.isValid(normalizedOrderId)) {
            const normalizedOrderObjectId = new Types.ObjectId(normalizedOrderId);
            orderIdClauses.push(
              { orderId: normalizedOrderObjectId },
              { repairOrderIds: normalizedOrderObjectId }
            );
          }

          andClauses.push({ $or: orderIdClauses });
        }
      }

      // BELEGNUMMER: verankerte Suche ab Wortanfang. Der eindeutige Index auf
      // invoiceNumber traegt ein '^'-Regex, ein freies Enthalten-Regex nicht.
      const invoiceNumberPattern = buildInvoiceNumberPattern(filters.invoiceNumber);
      if (invoiceNumberPattern) {
        andClauses.push({ invoiceNumber: { $regex: `^${invoiceNumberPattern}`, $options: 'i' } });
      }

      // FREITEXT: Belegnummer (auch Altformate wie 'INV-1712345678-ab12cd'), Kunde
      // und Kunden-E-Mail.
      const searchTerm = String(filters.search || '').trim();
      if (searchTerm) {
        const searchClauses = [];
        const numberPattern = buildInvoiceNumberPattern(searchTerm);
        if (numberPattern) {
          searchClauses.push({ invoiceNumber: { $regex: `^${numberPattern}`, $options: 'i' } });
          searchClauses.push({ invoiceNumber: { $regex: numberPattern, $options: 'i' } });
          // Reine Ziffernfolge: auch als laufende Nummer am Ende suchen, damit '42'
          // die INV-2026-0042 findet.
          if (/^\d+$/.test(searchTerm)) {
            searchClauses.push({ invoiceNumber: { $regex: `0*${searchTerm}$`, $options: 'i' } });
          }
        }
        const freeText = escapeRegExp(searchTerm);
        searchClauses.push({ customerName: { $regex: freeText, $options: 'i' } });
        searchClauses.push({ customerEmail: { $regex: freeText, $options: 'i' } });
        andClauses.push({ $or: searchClauses });
      }

      if (filters.bookingId) {
        const normalizedBookingId = String(filters.bookingId).trim();
        if (normalizedBookingId) {
          if (Types.ObjectId.isValid(normalizedBookingId)) {
            query.bookingId = new Types.ObjectId(normalizedBookingId);
          } else {
            query.bookingId = normalizedBookingId;
          }
        }
      }

      if (filters.isReverseCharge !== undefined && filters.isReverseCharge !== null && filters.isReverseCharge !== '') {
        query.isReverseCharge = filters.isReverseCharge === true || filters.isReverseCharge === 'true';
      }

      if (filters.zmRelevant !== undefined && filters.zmRelevant !== null && filters.zmRelevant !== '') {
        query.zmRelevant = filters.zmRelevant === true || filters.zmRelevant === 'true';
      }

      if (filters.dateFrom || filters.dateTo) {
        query.createdAt = {};
        if (filters.dateFrom) {
          query.createdAt.$gte = new Date(filters.dateFrom);
        }
        if (filters.dateTo) {
          query.createdAt.$lte = new Date(filters.dateTo);
        }
      }

      if (andClauses.length > 0) {
        query.$and = andClauses;
      }

      // Pagination (innerhalb des gefilterten Ausschnitts, nicht darueber hinaus)
      const page = Math.max(1, parseInt(filters.page) || 1);
      const limit = Math.min(500, Math.max(1, parseInt(filters.limit) || 10));
      const skip = (page - 1) * limit;

      const [invoiceSummary] = await Invoice.aggregate([
        {
          $match: query,
        },
        {
          $facet: {
            items: [
              { $sort: { createdAt: -1 } },
              { $skip: skip },
              { $limit: limit },
            ],
            totalCount: [{ $count: 'count' }],
            totalAmount: [{ $group: { _id: null, totalAmount: { $sum: '$total' } } }],
          },
        },
      ]);

      // Zahlungsstand je Beleg aus den GUELTIGEN Zuordnungen anreichern, damit die
      // Liste denselben Satz (total / allocated / open / overpaid) zeigt wie Detail-
      // und Auftragsansicht und der Client nichts nachrechnen muss.
      const rawInvoices = (invoiceSummary?.items || []).map((invoice) => ({ ...invoice }));
      const balancesByInvoice = await PaymentService.getInvoiceBalances(rawInvoices);
      const invoices = rawInvoices.map((invoice) => {
        const balance = balancesByInvoice.get(String(invoice._id));
        return {
          ...invoice,
          // status = Beleglebenslauf, paymentState = Zahlungsstand. Nie vermischen.
          paymentState: balance?.paymentState || 'open',
          balance: FinancialService.toBalancePayload(balance),
        };
      });
      const totalInvoices = invoiceSummary?.totalCount?.[0]?.count || 0;
      const totalPages = Math.ceil(totalInvoices / limit);
      const totalAmount = invoiceSummary?.totalAmount?.[0]?.totalAmount || 0;

      console.log('FinancialService: Found', invoices.length, 'invoices');
      return {
        invoices,
        // total/limit/scope sind additiv - die bisherigen Felder bleiben unveraendert,
        // damit bestehende Aufrufer nichts anpassen muessen.
        total: totalInvoices,
        limit,
        scope,
        totalPages,
        currentPage: page,
        totalAmount
      };
    } catch (error) {
      console.error('FinancialService: Error getting invoices:', error);
      throw error;
    }
  }

  static async createInvoice(invoiceData) {
    console.log('FinancialService: Creating invoice');

    try {
      // Clean the invoice data - remove empty strings for ObjectId fields
      const cleanedInvoiceData = { ...invoiceData };
      
      // If orderId is an empty string, remove it entirely
      if (cleanedInvoiceData.orderId === '') {
        delete cleanedInvoiceData.orderId;
      }
      
      // If customerId is an empty string, remove it entirely
      if (cleanedInvoiceData.customerId === '') {
        delete cleanedInvoiceData.customerId;
      }

      console.log('FinancialService: Cleaned invoice data:', cleanedInvoiceData);

      // Der Anspruch auf Auftrag/Buchung wird ausschliesslich serverseitig gesetzt.
      delete cleanedInvoiceData.activeBillingKeys;

      // If orderId is provided, validate order exists
      let linkedOrder = null;
      if (cleanedInvoiceData.orderId) {
        linkedOrder = await Order.findById(cleanedInvoiceData.orderId);
        if (!linkedOrder) {
          throw buildFinancialError('Auftrag wurde nicht gefunden.', 404, 'ORDER_NOT_FOUND');
        }
      }

      const financialProfile = await FinancialService.resolveFinancialProfile({
        customerId: cleanedInvoiceData.customerId || null,
      });

      // Get customer info if customerId is provided
      if (cleanedInvoiceData.customerId) {
        const customer = financialProfile.customer || await User.findById(cleanedInvoiceData.customerId);
        if (!customer) {
          throw buildFinancialError('Kunde wurde nicht gefunden.', 404, 'CUSTOMER_NOT_FOUND');
        }

        // Use customer info from database if not provided in request
        if (!cleanedInvoiceData.customerName) {
          cleanedInvoiceData.customerName = customer.name;
        }
        if (!cleanedInvoiceData.customerEmail) {
          cleanedInvoiceData.customerEmail = customer.email;
        }

        if (!cleanedInvoiceData.billingAddress) {
          cleanedInvoiceData.billingAddress = resolveBillingAddressFromCustomer(customer);
        }
      }

      if (!cleanedInvoiceData.billingAddress && cleanedInvoiceData.orderId) {
        const orderWithAddress = await Order.findById(cleanedInvoiceData.orderId)
          .populate('customerId', 'invoiceAddress paymentAddress')
          .select('guestInfo.billingAddress customerId')
          .lean();
        cleanedInvoiceData.billingAddress = resolveBillingAddressFromOrder(orderWithAddress);
      }

      if (!cleanedInvoiceData.billingAddress && cleanedInvoiceData.bookingId) {
        const bookingWithAddress = await Booking.findById(cleanedInvoiceData.bookingId)
          .populate('customerId', 'invoiceAddress paymentAddress')
          .select('guestInfo.billingAddress guestInfo.shippingAddress shippingAddress customerId')
          .lean();
        cleanedInvoiceData.billingAddress = resolveBillingAddressFromBooking(bookingWithAddress);
        if (!cleanedInvoiceData.shippingAddress) {
          cleanedInvoiceData.shippingAddress = resolveShippingAddressFromBooking(bookingWithAddress);
        }
      }

      if (!cleanedInvoiceData.shippingAddress && cleanedInvoiceData.orderId) {
        const orderWithShippingAddress = await Order.findById(cleanedInvoiceData.orderId)
          .populate('customerId', 'invoiceAddress paymentAddress shippingAddress')
          .select('guestInfo.shippingAddress shippingAddress customerId')
          .lean();
        cleanedInvoiceData.shippingAddress = resolveShippingAddressFromOrder(orderWithShippingAddress);
      }

      if (!cleanedInvoiceData.shippingAddress && cleanedInvoiceData.customerId) {
        const customerForShippingAddress = financialProfile.customer || await User.findById(cleanedInvoiceData.customerId)
          .select('invoiceAddress paymentAddress shippingAddress')
          .lean();
        cleanedInvoiceData.shippingAddress = resolveShippingAddressFromCustomer(customerForShippingAddress);
      }

      if (cleanedInvoiceData.bookingId) {
        await assertBookingNotYetInvoiced(cleanedInvoiceData.bookingId);
      }
      // Dieselbe Regel wie createInvoiceFromOrder: je Auftrag hoechstens eine aktive Rechnung.
      if (linkedOrder) {
        await assertOrdersNotYetInvoiced([linkedOrder]);
      }

      // Belegnummern sind nicht vom Aufrufer setzbar - sie kommen aus DocumentSequence.
      delete cleanedInvoiceData.invoiceNumber;
      delete cleanedInvoiceData.numberPrefix;

      if (!cleanedInvoiceData.dueDate && cleanedInvoiceData.dueDate !== false) {
        const dueDays = normalizePaymentDueDays(financialProfile.paymentDueDays);
        cleanedInvoiceData.dueDate = new Date(Date.now() + dueDays * 24 * 60 * 60 * 1000);
        cleanedInvoiceData.paymentDueDays = dueDays;
      }
      // Zahlungsziel-Text wird im Modell aus der Frist bzw. dem Datum abgeleitet; ein
      // mitgeschickter Freitext darf dem Datum nicht widersprechen.
      delete cleanedInvoiceData.paymentTerms;

      if (cleanedInvoiceData.dueDate) {
        cleanedInvoiceData.originalDueDate = new Date(cleanedInvoiceData.dueDate);
      }
      
      const isReverseCharge = Boolean(
        cleanedInvoiceData.isReverseCharge ||
        financialProfile.taxMode === 'reverse_charge'
      );

      if (isReverseCharge) {
        cleanedInvoiceData.isReverseCharge = true;
        cleanedInvoiceData.taxRate = 0;
        cleanedInvoiceData.tax = 0;
        cleanedInvoiceData.zmRelevant = true;
        if (!cleanedInvoiceData.reverseChargeNotice) {
          cleanedInvoiceData.reverseChargeNotice = 'Steuerschuldnerschaft des Leistungsempfängers / Reverse Charge';
        }
      }

      if (cleanedInvoiceData.customerVatId === undefined || cleanedInvoiceData.customerVatId === null) {
        cleanedInvoiceData.customerVatId = (financialProfile.customer?.vatId || '').trim();
      } else {
        cleanedInvoiceData.customerVatId = String(cleanedInvoiceData.customerVatId).trim();
      }

      if (!cleanedInvoiceData.sellerVatId) {
        cleanedInvoiceData.sellerVatId = (financialProfile.sellerVatId || 'DE318981969').trim();
      } else {
        cleanedInvoiceData.sellerVatId = String(cleanedInvoiceData.sellerVatId).trim();
      }

      // Positionspreise sind BRUTTO. Netto und MwSt werden vom Invoice-Modell aus dem
      // Brutto herausgerechnet; vom Client gelieferte Summen sind nicht vertrauenswuerdig.
      const hasItems = Array.isArray(cleanedInvoiceData.items) && cleanedInvoiceData.items.length > 0;
      const itemsGrossTotal = hasItems
        ? CalculationHelper.round(cleanedInvoiceData.items.reduce((sum, item) => sum + Number(item.total || 0), 0))
        : 0;

      if (hasItems) {
        delete cleanedInvoiceData.subtotal;
        delete cleanedInvoiceData.tax;
        delete cleanedInvoiceData.total;
      }

      if ((cleanedInvoiceData.discount === undefined || cleanedInvoiceData.discount === null) && itemsGrossTotal > 0) {
        if (cleanedInvoiceData.orderId || cleanedInvoiceData.bookingId) {
          // Rechnung zu einem Auftrag/einer Buchung: der Kundenrabatt ist dort bereits
          // ausgerechnet und festgehalten (order.discount bzw. booking.discount). Der
          // HEUTIGE Profilprozentsatz darf nicht erneut angewandt werden - das waere
          // dieselbe Fehlerklasse wie Sophies 36,06 statt 42,42.
          // Der festgehaltene Rabatt gehoert zu den POSITIONEN des Auftrags/der Buchung.
          // Nur wenn die uebergebenen Positionen genau diese sind (Listenbrutto =
          // festgehaltener Wert + Rabatt), wird er uebernommen. Andere Positionen (z.B.
          // eine Bearbeitungsgebuehr zum Auftrag) bekommen keinen automatischen Rabatt.
          let recordedDiscount = 0;
          let recordedListGross = 0;
          if (cleanedInvoiceData.orderId) {
            const orderForDiscount = await Order.findById(cleanedInvoiceData.orderId).setOptions({ skipAutoPopulate: true }).select('discount totalCost').lean();
            recordedDiscount = Number(orderForDiscount?.discount || 0);
            recordedListGross = CalculationHelper.round(Number(orderForDiscount?.totalCost || 0) + recordedDiscount);
          } else {
            const bookingForDiscount = await Booking.findById(cleanedInvoiceData.bookingId).setOptions({ skipAutoPopulate: true }).select('discount totalCost').lean();
            recordedDiscount = Number(bookingForDiscount?.discount || 0);
            recordedListGross = CalculationHelper.round(Number(bookingForDiscount?.totalCost || 0) + recordedDiscount);
          }
          const itemsAreRecordedPositions = Math.abs(itemsGrossTotal - recordedListGross) <= 0.01;
          cleanedInvoiceData.discount = itemsAreRecordedPositions
            ? CalculationHelper.round(Math.min(itemsGrossTotal, Math.max(0, recordedDiscount)))
            : 0;
        } else {
          // Freistehende manuelle Rechnung (Listenpreise von Hand): Profilprozentsatz.
          cleanedInvoiceData.discount = calculateDiscountAmount(itemsGrossTotal, financialProfile.defaultDiscountPercent);
        }
      }

      if (isReverseCharge) {
        cleanedInvoiceData.tax = 0;
      }

      if (!Number.isFinite(Number(cleanedInvoiceData.taxRate))) {
        cleanedInvoiceData.taxRate = isReverseCharge ? 0 : financialProfile.taxRate;
      }

      cleanedInvoiceData.status = 'sent';
      cleanedInvoiceData.sentAt = new Date();

      // Create invoice
      const invoice = new Invoice(cleanedInvoiceData);
      await saveClaimedInvoice(invoice, { orders: linkedOrder ? [linkedOrder] : [] });
      const finalized = await FinancialService.finalizeInvoiceCreation(invoice);

      console.log('FinancialService: Invoice created successfully with defaults applied');
      return finalized;
    } catch (error) {
      console.error('FinancialService: Error creating invoice:', error);
      throw error;
    }
  }

  /**
   * Kontrollierter Versand eines Belegs per E-Mail.
   *  - Ein Entwurf wird dabei EINMAL ausgestellt (Status 'sent'), danach archiviert.
   *  - Angehaengt wird das ARCHIVIERTE PDF (dieselbe Fassung wie beim Download).
   *  - Ein E-Mail-Fehler erzeugt keinen neuen Beleg und aendert weder Betrag noch Status;
   *    er wird in der Revisionsspur vermerkt und kann erneut ausgeloest werden.
   *  - Ein erneuter Versand (z.B. einer bezahlten Rechnung) aendert den Status NICHT.
   *  - Die persoenliche Nachricht wird als {{customMessage}} gerendert (auch bei
   *    gespeicherten Vorlagen ohne Platzhalter, siehe NotificationTemplateService).
   */
  static async sendInvoice(invoiceId, email, message, options = {}) {
    console.log('FinancialService: Sending invoice:', invoiceId);

    let invoice = await Invoice.findById(invoiceId);
    if (!invoice) {
      throw buildFinancialError('Rechnung wurde nicht gefunden.', 404, 'INVOICE_NOT_FOUND');
    }

    const recipientEmail = String(email || invoice.customerEmail || '').trim();
    if (!recipientEmail) {
      throw buildFinancialError('Für den Versand wird eine E-Mail-Adresse benötigt.', 400, 'RECIPIENT_REQUIRED');
    }
    if (invoice.cancellation?.kind === 'draft_discarded') {
      throw buildFinancialError('Ein verworfener Entwurf wird nicht versendet.', 409, 'INVOICE_DISCARDED');
    }
    if (['cancelled'].includes(invoice.status) && !invoice.isCreditNote) {
      throw buildFinancialError('Eine stornierte Rechnung wird nicht mehr versendet. Bitte die Storno-Gutschrift bzw. die neue Rechnung senden.', 409, 'INVOICE_CANCELLED');
    }

    const actorId = options.actorId || undefined;
    const actorName = String(options.actorName || '').slice(0, 80);

    // Entwurf: jetzt ausstellen (einmalig). Danach ist das Dokument unveraenderlich.
    if (!isIssuedStatus(invoice.status)) {
      await Invoice.updateOne(
        { _id: invoice._id, status: invoice.status },
        { $set: { status: 'sent' }, $push: { auditTrail: { at: new Date(), action: 'issued', actorId, actorName, detail: 'Beim Versand ausgestellt.' } } }
      );
      invoice = await Invoice.findById(invoice._id);
      await FinancialService.syncPaymentDerivedState(invoice, 'sendInvoice:issued');
    }

    const archived = await FinancialService.ensureInvoiceDocument(invoice._id, { reason: 'Versand', actorId, actorName });

    let referenceNumber = '-';
    if (invoice.bookingId) {
      const booking = await Booking.findById(invoice.bookingId).select('bookingNumber').lean();
      referenceNumber = booking?.bookingNumber || String(invoice.bookingId);
    } else if (invoice.orderId?.orderNumber) {
      referenceNumber = String(invoice.orderId.orderNumber);
    } else if (invoice.orderId) {
      const order = await Order.findById(invoice.orderId).select('orderNumber').lean();
      referenceNumber = order?.orderNumber || String(invoice.orderId);
    }

    const InvoicePdfService = require('./invoicePdfService');
    const customerName = String(invoice.customerName || '').trim() || 'Kunde';
    const invoiceAmount = Number(invoice.total || 0);
    const invoiceUrl = await EmailService.buildSystemUrl(`/invoices?invoiceId=${invoice._id}`);
    const safeInvoiceNumber = String(invoice.invoiceNumber || invoice._id).replace(/[^a-zA-Z0-9_-]/g, '_');
    const composedMessage = String(message || '').trim().slice(0, 5000);
    const methodLabel = InvoicePdfService.paymentMethodLabel(invoice.issueSnapshot?.paymentMethod || invoice.paymentMethod) || 'Überweisung';

    let emailResult;
    try {
      emailResult = await EmailService.sendTriggerEmail('invoice_created', recipientEmail, {
        companyName: process.env.COMPANY_NAME || 'McRepair.de',
        customerName,
        invoiceNumber: invoice.invoiceNumber,
        orderNumber: referenceNumber,
        invoiceAmount: `EUR ${invoiceAmount.toFixed(2)}`,
        dueDate: invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString('de-DE') : '-',
        paymentMethod: methodLabel,
        invoiceUrl,
        customMessage: composedMessage,
        supportEmail: process.env.SUPPORT_EMAIL || 'support@mcrepair.de',
        supportPhone: process.env.SUPPORT_PHONE || '+49 (0) 123/456789'
      }, {
        attachments: [{
          filename: `${invoice.isCreditNote ? 'Gutschrift' : 'Rechnung'}_${safeInvoiceNumber}.pdf`,
          content: archived.buffer,
          contentType: 'application/pdf'
        }]
      });
    } catch (error) {
      emailResult = { success: false, error: error.message };
    }

    if (!emailResult?.success) {
      await Invoice.updateOne({ _id: invoice._id }, {
        $push: { auditTrail: { at: new Date(), action: 'send_failed', actorId, actorName, detail: `E-Mail an ${recipientEmail} fehlgeschlagen: ${String(emailResult?.error || 'unbekannt').slice(0, 300)}` } }
      });
      const sendError = buildFinancialError(
        'Die Rechnung wurde NICHT versendet, weil der E-Mail-Versand fehlgeschlagen ist. '
        + 'Der Beleg bleibt unverändert; der Versand kann erneut ausgelöst werden.',
        502,
        'INVOICE_EMAIL_FAILED'
      );
      sendError.detail = String(emailResult?.error || '');
      throw sendError;
    }

    // Nur Versanddatum und Revisionsspur - der Status wird NICHT zurueckgesetzt
    // (eine bezahlte oder ueberfaellige Rechnung bleibt, was sie ist).
    const sentAt = new Date();
    await Invoice.updateOne({ _id: invoice._id }, {
      $set: { sentAt },
      $push: { auditTrail: { at: sentAt, action: 'sent', actorId, actorName, detail: `E-Mail an ${recipientEmail}${composedMessage ? ' mit persönlicher Nachricht' : ''} (PDF-Fassung ${archived.version}).` } }
    });

    try {
      await NotificationService.createNotification({
        userId: invoice.customerId,
        title: invoice.isCreditNote ? 'Neue Gutschrift verfügbar' : 'Neue Rechnung verfügbar',
        message: `Ihr Beleg ${invoice.invoiceNumber} wurde versendet.`,
        type: 'system',
        orderId: invoice.orderId || undefined,
        actionUrl: `/invoices?invoiceId=${invoice._id}`,
        metadata: {
          isInvoice: true,
          invoiceId: String(invoice._id),
          invoiceNumber: invoice.invoiceNumber
        }
      }, { sendEmail: false });
    } catch (error) {
      console.error('FinancialService: In-App-Benachrichtigung zum Rechnungsversand fehlgeschlagen:', error.message);
    }

    console.log('FinancialService: Invoice sent successfully');
    return {
      success: true,
      message: 'Rechnung wurde versendet.',
      recipientEmail,
      providerMessageId: emailResult?.messageId || '',
      customMessageDelivered: Boolean(composedMessage),
      documentVersion: archived.version,
      documentSha256: archived.sha256,
    };
  }

  // Financial Reports
  static async getFinancialReports(filters = {}) {
    console.log('FinancialService: Generating financial reports');

    try {
      const dateFrom = filters.dateFrom ? new Date(filters.dateFrom) : new Date(new Date().getFullYear(), 0, 1);
      const dateTo = filters.dateTo ? new Date(filters.dateTo) : new Date();

      // Get revenue data
      const revenueData = await Payment.aggregate([
        {
          $match: {
            status: 'completed',
            createdAt: { $gte: dateFrom, $lte: dateTo }
          }
        },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$amount' },
            count: { $sum: 1 }
          }
        }
      ]);

      // Get refund and dispute data
      const refundData = await Payment.aggregate([
        {
          $match: {
            status: { $in: ['refunded', 'disputed'] },
            createdAt: { $gte: dateFrom, $lte: dateTo }
          }
        },
        {
          $group: {
            _id: '$status',
            amount: { $sum: '$amount' }
          }
        }
      ]);

      // Get payment method breakdown
      const paymentMethodData = await Payment.aggregate([
        {
          $match: {
            status: 'completed',
            createdAt: { $gte: dateFrom, $lte: dateTo }
          }
        },
        {
          $group: {
            _id: '$paymentMethod',
            amount: { $sum: '$amount' },
            count: { $sum: 1 }
          }
        }
      ]);

      // Get monthly trends
      const monthlyTrends = await Payment.aggregate([
        {
          $match: {
            status: 'completed',
            createdAt: { $gte: new Date(dateTo.getFullYear() - 1, dateTo.getMonth(), 1), $lte: dateTo }
          }
        },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' }
            },
            revenue: { $sum: '$amount' },
            orders: { $sum: 1 }
          }
        },
        {
          $sort: { '_id.year': 1, '_id.month': 1 }
        },
        {
          $limit: 12
        }
      ]);

      const totalRevenue = revenueData.length > 0 ? revenueData[0].totalRevenue : 0;
      const refundAmount = refundData.find(r => r._id === 'refunded')?.amount || 0;
      const disputeAmount = refundData.find(r => r._id === 'disputed')?.amount || 0;

      // Calculate payment method breakdown with percentages
      const paymentMethodBreakdown = paymentMethodData.map(method => ({
        method: method._id.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
        amount: method.amount,
        percentage: totalRevenue > 0 ? (method.amount / totalRevenue) * 100 : 0
      }));

      // Format monthly trends
      const formattedTrends = monthlyTrends.map(trend => ({
        month: new Date(trend._id.year, trend._id.month - 1).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short'
        }),
        revenue: trend.revenue,
        orders: trend.orders,
        avgOrderValue: trend.orders > 0 ? trend.revenue / trend.orders : 0
      }));

      const report = {
        period: `${dateFrom.toLocaleDateString()} - ${dateTo.toLocaleDateString()}`,
        totalRevenue,
        totalExpenses: totalRevenue * 0.4, // Mock calculation
        netProfit: totalRevenue * 0.6, // Mock calculation
        grossMargin: 60.0, // Mock percentage
        orderRevenue: totalRevenue * 0.85, // Mock calculation
        addonRevenue: totalRevenue * 0.10, // Mock calculation
        productRevenue: totalRevenue * 0.05, // Mock calculation
        refundAmount,
        disputeAmount,
        paymentMethodBreakdown,
        monthlyTrends: formattedTrends
      };

      console.log('FinancialService: Financial report generated successfully');
      return report;
    } catch (error) {
      console.error('FinancialService: Error generating financial reports:', error);
      throw error;
    }
  }

  // Payment Gateway Management
  static async getPaymentGateways() {
    console.log('FinancialService: Getting payment gateways');

    try {
      const fs = require('fs');
      const path = require('path');

      // Base gateways with default configuration
      const gateways = [
        {
          _id: 'gateway1',
          name: 'Stripe',
          provider: 'stripe',
          isActive: true,
          configuration: {
            mode: 'test',
            test_publishable_key: 'pk_test_51...',
            test_secret_key: 'sk_test_51...',
            live_publishable_key: '',
            live_secret_key: '',
            account_id: 'acct_1A2B3C4D5E6F7G8H9',
            api_version: '2023-08-16',
            use_stripe_checkout: true,
            payment_mode: 'payment',
            capture_method: 'automatic',
            statement_descriptor: 'McRepair.de Repair',
            success_url: 'https://shop.de/stripe/success',
            cancel_url: 'https://shop.de/stripe/cancel',
            allowed_payment_methods: ['card', 'paypal', 'klarna'],
            allow_saved_payment_method: true,
            payment_method_config_id: '',
            automatic_payment_methods: true,
            billing_address_collection: 'auto',
            shipping_address_collection: false,
            customer_creation: 'if_required',
            webhook_url: 'https://api.de/stripe/webhook',
            webhook_endpoint_secret: 'whsec_test_...',
            webhook_tolerance_sec: 300,
            webhook_events: ['payment_intent.succeeded', 'charge.refunded'],
            webhooks_enabled: true,
            http_timeout_ms: 10000,
            http_max_retries: 2,
            idempotency_enabled: true,
            idempotency_key_source: 'orderId',
            logging_level: 'error',
            log_request_bodies: false,
            log_response_bodies: false,
            list_page_size_default: 50,
            list_max_page_size: 100,
            currency: 'EUR',
            processingFee: 2.9,
            fraudProtection: true,
            default_currency: 'EUR',
            amount_source: 'system'
          },
          supportedMethods: ['card', 'paypal', 'klarna', 'ideal'],
          countries: ['US', 'CA', 'GB', 'AU', 'DE', 'FR'],
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date()
        },
        {
          _id: 'gateway2',
          name: 'PayPal',
          provider: 'paypal',
          isActive: true,
          configuration: {
            publicKey: 'paypal_client_id',
            secretKey: 'paypal_client_secret',
            environment: 'sandbox',
            sandbox_client_id: 'Abc123...',
            sandbox_client_secret: 'Efg456...',
            live_client_id: '',
            live_client_secret: '',
            merchant_id: 'ABCDEF1234567',
            api_base_url_sandbox: 'https://api-m.sandbox.paypal.com',
            api_base_url_live: 'https://api-m.paypal.com',
            default_currency: 'EUR',
            allowed_currencies: ['EUR', 'USD'],
            payment_intent: 'CAPTURE',
            amount_source: 'system',
            send_breakdown: true,
            description_template: 'Bestellung {{orderId}}',
            invoice_id_source: 'orderId',
            return_url: 'https://shop.de/paypal/success',
            cancel_url: 'https://shop.de/paypal/cancel',
            button_enabled: true,
            button_layout: 'vertical',
            button_color: 'gold',
            button_shape: 'rect',
            button_label: 'paypal',
            locale: 'de-DE',
            funding_sources_allowed: ['paypal'],
            webhooks_enabled: true,
            webhook_url: 'https://api.de/paypal/webhook',
            webhook_events: ['CHECKOUT.ORDER.APPROVED', 'PAYMENT.CAPTURE.COMPLETED'],
            webhook_id: 'WH-1234...',
            http_timeout_ms: 10000,
            http_max_retries: 2,
            idempotency_enabled: true,
            idempotency_key_source: 'orderId',
            logging_level: 'error',
            log_request_bodies: false,
            log_response_bodies: false,
            list_page_size_default: 50,
            list_max_page_size: 100,
            currency: 'EUR',
            processingFee: 3.5,
            fraudProtection: true
          },
          supportedMethods: ['paypal', 'paypal_credit'],
          countries: ['US', 'CA', 'GB', 'AU', 'DE', 'FR'],
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date()
        },
        {
          _id: 'gateway3',
          name: 'Banküberweisung',
          provider: 'bank_transfer',
          isActive: true,
          configuration: {
            enabled: true,
            code: 'bank_transfer',
            title: 'Vorkasse / Banküberweisung',
            description_checkout: 'Bitte überweisen Sie den Betrag auf das unten angegebene Konto.',
            account_holder: 'Max Mustermann',
            iban: 'DE00 0000 0000 0000 0000 00',
            bic: 'ABCDEFGHXXX',
            bank_name: 'Musterbank',
            payment_reference_template: 'Bestellnr. {{orderId}}',
            payment_term_days: 14,
            min_order_total: 0,
            max_order_total: 10000,
            allowed_customer_groups: ['b2c', 'b2b'],
            allowed_countries: ['DE', 'AT', 'CH'],
            allowed_shipping_methods: ['standard', 'express'],
            initial_order_status: 'pending_payment',
            expire_unpaid_orders: true,
            expire_action: 'cancel',
            email_instructions_enabled: true,
            email_instructions_text: 'Bitte überweisen Sie den Betrag innerhalb von 14 Tagen auf das angegebene Konto.',
            admin_can_mark_paid: true,
            mark_paid_requires_fields: ['amount', 'payment_date'],
            reporting_tag: 'BANK_TRANSFER',
            currency: 'EUR',
            processingFee: 0,
            fraudProtection: false
          },
          supportedMethods: ['bank_transfer'],
          countries: ['DE', 'AT', 'CH'],
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date()
        },
        {
          _id: 'gateway4',
          name: 'Barzahlung',
          provider: 'cash',
          isActive: true,
          configuration: {
            enabled: true,
            code: 'cash_on_pickup',
            title: 'Barzahlung bei Abholung',
            description_checkout: 'Sie bezahlen bei Abholung in bar.',
            cash_mode: 'pickup',
            allowed_shipping_methods: ['pickup_store_1'],
            min_order_total: 0,
            max_order_total: 1000,
            allowed_customer_groups: ['b2c'],
            allowed_product_types: ['physical'],
            initial_order_status: 'waiting_for_pickup',
            mark_paid_on_fulfillment: false,
            admin_can_mark_paid: true,
            mark_paid_requires_fields: ['amount', 'payment_date', 'receipt_no'],
            cash_receipt_number_enabled: true,
            cash_receipt_number_format: 'POS{{storeId}}-{{yyyy}}{{MM}}{{dd}}-{{seq}}',
            email_instructions_enabled: true,
            email_instructions_text: 'Bitte halten Sie den Betrag passend bereit.',
            fee_type: 'none',
            fee_value: 0,
            fee_is_percentage: false,
            reporting_tag: 'CASH',
            sort_order: 20,
            currency: 'EUR',
            processingFee: 0,
            fraudProtection: false
          },
          supportedMethods: ['cash'],
          countries: ['DE', 'AT', 'CH'],
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date()
        }
      ];

      // Try to load persisted configurations from files
      const configDir = path.join(process.cwd(), 'server', 'config', 'gateways');
      if (fs.existsSync(configDir)) {
        const files = fs.readdirSync(configDir);
        for (const file of files) {
          if (file.endsWith('.json')) {
            try {
              const configFile = path.join(configDir, file);
              const persisted = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
              const gatewayId = file.replace('.json', '');
              
              // Find and merge with base gateway
              const idx = gateways.findIndex(g => g._id === gatewayId);
              if (idx >= 0) {
                gateways[idx] = { ...gateways[idx], ...persisted };
              }
            } catch (e) {
              console.warn(`Failed to load gateway config from ${file}:`, e.message);
            }
          }
        }
      }

      console.log('FinancialService: Payment gateways retrieved successfully');
      return gateways;
    } catch (error) {
      console.error('FinancialService: Error getting payment gateways:', error);
      throw error;
    }
  }

  static validateGatewayConfiguration(gateway) {
    const errors = [];
    const config = gateway?.configuration || {};

    // Basic validation (all gateways)
    if (!gateway?.name?.trim()) errors.push('Name is required');
    if (!config.currency?.trim()) errors.push('Currency is required');
    if (typeof config.processingFee !== 'number' || config.processingFee < 0) errors.push('Processing Fee must be >= 0');

    // PayPal-specific validation
    if (gateway?.provider === 'paypal') {
      if (!config.environment) errors.push('environment is required');
      if (!config.sandbox_client_id?.trim()) errors.push('sandbox_client_id is required');
      if (!config.sandbox_client_secret?.trim()) errors.push('sandbox_client_secret is required');
      if (!config.default_currency?.trim()) errors.push('default_currency is required');
      if (!config.payment_intent) errors.push('payment_intent is required');
      if (!config.amount_source) errors.push('amount_source is required');
      if (!config.return_url?.trim()) errors.push('return_url is required');
      if (!config.cancel_url?.trim()) errors.push('cancel_url is required');

      // Validate URLs
      const urlFields = ['return_url', 'cancel_url', 'webhook_url'];
      for (const field of urlFields) {
        const value = config[field];
        if (value && typeof value === 'string' && value.trim() !== '' && !value.startsWith('http')) {
          errors.push(`${field} must start with http:// or https://`);
        }
      }
    }

    // Stripe-specific validation
    if (gateway?.provider === 'stripe') {
      if (!config.mode) errors.push('mode is required');
      if (!config.test_publishable_key?.trim()) errors.push('test_publishable_key is required');
      if (!config.test_secret_key?.trim()) errors.push('test_secret_key is required');
      if (!config.default_currency?.trim()) errors.push('default_currency is required');
      if (!config.amount_source) errors.push('amount_source is required');
      if (!config.payment_mode) errors.push('payment_mode is required');
      if (!config.success_url?.trim()) errors.push('success_url is required');
      if (!config.cancel_url?.trim()) errors.push('cancel_url is required');

      // Validate URLs
      const urlFields = ['success_url', 'cancel_url', 'webhook_url'];
      for (const field of urlFields) {
        const value = config[field];
        if (value && typeof value === 'string' && value.trim() !== '' && !value.startsWith('http')) {
          errors.push(`${field} must start with http:// or https://`);
        }
      }
    }

    // bank_transfer-specific validation
    if (gateway?.provider === 'bank_transfer') {
      if (!config.code?.trim()) errors.push('code is required');
      if (!config.title?.trim()) errors.push('title is required');
      if (!config.account_holder?.trim()) errors.push('account_holder is required');
      if (!config.iban?.trim()) errors.push('iban is required');
      if (!config.payment_reference_template?.trim()) errors.push('payment_reference_template is required');
      if (!config.initial_order_status?.trim()) errors.push('initial_order_status is required');
      if (config.admin_can_mark_paid === undefined || config.admin_can_mark_paid === null) errors.push('admin_can_mark_paid is required');
    }

    // cash-specific validation
    if (gateway?.provider === 'cash') {
      if (!config.code?.trim()) errors.push('code is required');
      if (!config.title?.trim()) errors.push('title is required');
      if (!config.cash_mode) errors.push('mode is required');
      if (!config.initial_order_status?.trim()) errors.push('initial_order_status is required');
      if (config.admin_can_mark_paid === undefined || config.admin_can_mark_paid === null) errors.push('admin_can_mark_paid is required');
    }

    return { valid: errors.length === 0, errors };
  }

  static async updatePaymentGateway(gatewayId, updates) {
    console.log('FinancialService: Updating payment gateway:', gatewayId);

    try {
      const fs = require('fs');
      const path = require('path');

      // Path to store gateway configurations
      const configDir = path.join(process.cwd(), 'server', 'config', 'gateways');
      const configFile = path.join(configDir, `${gatewayId}.json`);

      // Ensure directory exists
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }

      // Update timestamp
      const updatedGateway = {
        ...updates,
        updatedAt: new Date().toISOString()
      };

      // Persist to file
      fs.writeFileSync(configFile, JSON.stringify(updatedGateway, null, 2), 'utf-8');

      console.log('FinancialService: Payment gateway updated and persisted successfully:', configFile);
      return updatedGateway;
    } catch (error) {
      console.error('FinancialService: Error updating payment gateway:', error);
      throw error;
    }
  }

  // Create payment from order
  static async createPaymentFromOrder(orderId) {
    console.log('FinancialService: Creating payment from order:', orderId);

    try {
      const order = await Order.findById(orderId).populate('customerId');

      if (!order) {
        throw buildFinancialError('Auftrag wurde nicht gefunden.', 404, 'ORDER_NOT_FOUND');
      }

      const financialProfile = await FinancialService.resolveFinancialProfile({ customer: order.customerId });

      const amount = typeof order.totalCost === 'object' ? Number(order.totalCost) : order.totalCost;
      const paymentMethod = financialProfile.defaultPaymentMethod || 'credit_card';

      const payment = new Payment({
        orderId: order._id,
        orderNumber: order.orderNumber,
        customerId: order.customerId._id,
        customerName: order.customerId.name,
        amount: amount,
        paymentMethod: paymentMethod,
        gatewayResponse: 'Payment created'
      });

      await payment.save();

      console.log('FinancialService: Payment created from order successfully with resolved method:', paymentMethod);
      return payment;
    } catch (error) {
      console.error('FinancialService: Error creating payment from order:', error);
      throw error;
    }
  }

  // Create invoice from order
  // options.additionalItems: zusaetzliche BRUTTO-Positionen (z.B. Servicepauschale),
  // die bereits im order.totalCost enthalten sind und deshalb nicht doppelt zaehlen duerfen.
  static async createInvoiceFromOrder(orderId, options = {}) {
    console.log('FinancialService: Creating invoice from order:', orderId);

    try {
      const order = await Order.findById(orderId).populate('customerId');

      if (!order) {
        throw buildFinancialError('Auftrag wurde nicht gefunden.', 404, 'ORDER_NOT_FOUND');
      }

      if (order.bookingId) {
        await assertBookingNotYetInvoiced(order.bookingId);
      }

      await assertOrdersNotYetInvoiced([order]);

      const financialProfile = await FinancialService.resolveFinancialProfile({ customer: order.customerId });

      // Convert totalCost to number if it's a Decimal128
      const totalCost = typeof order.totalCost === 'object' ? Number(order.totalCost) : order.totalCost;

      const additionalItems = Array.isArray(options.additionalItems) ? options.additionalItems : [];
      const additionalGrossTotal = CalculationHelper.round(
        additionalItems.reduce((sum, item) => sum + Number(item.total || 0), 0)
      );

      // Rechnungspositionen mit echten Service-/Produktnamen und Geraetekennzeichnung.
      const items = buildInvoiceItemsFromOrder(order);

      // Der Warenkorb-/Promo-Rabatt steckt bereits in order.totalCost, nicht in den
      // Positionspreisen - er wird deshalb als Rechnungsrabatt (Brutto) weitergereicht.
      let orderDiscount = 0;
      if (items.length > 0) {
        orderDiscount = CalculationHelper.round(Math.max(0, Number(order.discount || 0)));
      } else {
        // Fallback ohne Positionsdaten: eine Sammelposition aus dem Auftragswert.
        items.push({
          serviceName: `${buildDeviceLabel(order)} Reparatur`,
          description: `${buildDeviceLabel(order)} Reparatur`,
          quantity: 1,
          unitPrice: CalculationHelper.round(Math.max(0, Number(totalCost || 0) - additionalGrossTotal)),
          total: CalculationHelper.round(Math.max(0, Number(totalCost || 0) - additionalGrossTotal)),
          type: 'service'
        });
      }

      additionalItems.forEach((item) => items.push({ ...item }));

      const isReverseCharge = Boolean(
        financialProfile.taxMode === 'reverse_charge' ||
        Boolean(order.customerId?.vatId && order.customerId?.country && order.customerId.country !== 'DE')
      );
      const itemsGrossTotal = CalculationHelper.round(items.reduce((sum, item) => sum + Number(item.total || 0), 0));
      // order.discount IST bereits der ausgerechnete Kundengruppenrabatt: der Checkout
      // hat ihn aus dem Kundenprofil ermittelt und in order.totalCost verrechnet.
      // Er darf hier NICHT erneut prozentual angewandt werden, sonst wird er doppelt
      // gerechnet - genau der Fehler aus Sophies Test vom 24.09.2026:
      //   richtig:  49,90 - 7,48  = 42,42
      //   falsch:   49,90 - 13,84 = 36,06   (7,48 + 15 % auf 42,42 = 6,36)
      // Invariante: Rechnungsbrutto === Auftragswert (order.totalCost).
      const discount = CalculationHelper.round(Math.min(itemsGrossTotal, orderDiscount));
      // Frist aus dem Kundenprofil; Datum und Zahlungsziel-Text leitet das Modell
      // daraus gemeinsam ab.
      const dueDays = normalizePaymentDueDays(financialProfile.paymentDueDays);
      const paymentTerms = composePaymentTerms({ paymentDueDays: dueDays });

      const invoice = new Invoice({
        orderId: order._id,
        bookingId: order.bookingId || undefined,
        customerId: order.customerId._id,
        customerName: order.customerId.name,
        customerEmail: order.customerId.email,
        customerVatId: (order.customerId?.vatId || '').trim(),
        sellerVatId: (financialProfile.sellerVatId || 'DE318981969').trim(),
        isReverseCharge,
        reverseChargeNotice: isReverseCharge ? 'Steuerschuldnerschaft des Leistungsempfängers / Reverse Charge' : undefined,
        zmRelevant: isReverseCharge,
        taxRate: isReverseCharge ? 0 : financialProfile.taxRate,
        billingAddress: resolveBillingAddressFromOrder(order),
        shippingAddress: resolveShippingAddressFromOrder(order),
        items,
        // subtotal (Netto), tax und total (Brutto) werden vom Invoice-Modell
        // brutto-first aus den Positionen und dem Rabatt abgeleitet.
        discount,
        dueDate: new Date(Date.now() + dueDays * 24 * 60 * 60 * 1000),
        paymentDueDays: dueDays,
        paymentTerms,
        status: 'sent',
        sentAt: new Date(),
      });

      await saveClaimedInvoice(invoice, { orders: [order] });
      const finalized = await FinancialService.finalizeInvoiceCreation(invoice);

      console.log('FinancialService: Invoice created from order successfully with resolved tax rate:', financialProfile.taxRate + '%');
      return finalized;
    } catch (error) {
      console.error('FinancialService: Error creating invoice from order:', error);
      throw error;
    }
  }
  // Create invoice from one or more repair order / booking IDs
  static async generateFromRepairOrders(repairOrderIds, options = {}) {
    console.log('FinancialService: Generating invoice from repair orders:', repairOrderIds);

    if (!repairOrderIds || repairOrderIds.length === 0) {
      throw buildFinancialError('Bitte mindestens einen Auftrag auswählen.', 400, 'ORDER_IDS_REQUIRED');
    }

    const orders = await Order.find({ _id: { $in: repairOrderIds } }).populate('customerId');

    if (orders.length === 0) {
      throw buildFinancialError('Zu den gewählten Angaben wurden keine Aufträge gefunden.', 404, 'ORDERS_NOT_FOUND');
    }

    // All orders must belong to the same customer
    const customerIds = [...new Set(orders.map(o => String(o.customerId._id)))];
    if (customerIds.length > 1) {
      throw buildFinancialError('Alle Aufträge einer Sammelrechnung müssen zum selben Kunden gehören.', 400, 'ORDERS_DIFFERENT_CUSTOMERS');
    }

    await assertOrdersNotYetInvoiced(orders);

    const customer = orders[0].customerId;
    const financialProfile = await FinancialService.resolveFinancialProfile({ customer });
    const items = [];

    let ordersDiscount = 0;
    orders.forEach(order => {
      const totalCost = typeof order.totalCost === 'object' ? Number(order.totalCost) : (order.totalCost || 0);
      const orderItems = buildInvoiceItemsFromOrder(order);

      if (orderItems.length > 0) {
        orderItems.forEach((item) => items.push(item));
        ordersDiscount = CalculationHelper.round(ordersDiscount + Math.max(0, Number(order.discount || 0)));
      } else {
        const deviceLabel = buildDeviceLabel(order);
        items.push({
          serviceName: `${deviceLabel} Reparatur`,
          description: `${deviceLabel} Reparatur (Auftrag ${order.orderNumber || order._id})`,
          quantity: 1,
          unitPrice: totalCost,
          total: totalCost,
          type: 'service'
        });
      }
    });

    const isReverseCharge = Boolean(
      options.isReverseCharge !== undefined
        ? options.isReverseCharge
        : (financialProfile.taxMode === 'reverse_charge' || (customer?.vatId && customer?.country && customer.country !== 'DE'))
    );
    // Positionspreise sind BRUTTO; Netto/MwSt rechnet das Invoice-Modell heraus.
    // options.taxRate ist ein PROZENTWERT (z.B. 19), kein Faktor.
    const itemsGrossTotal = CalculationHelper.round(items.reduce((s, i) => s + Number(i.total || 0), 0));
    const taxRate  = isReverseCharge ? 0 : normalizeTaxRatePercent(options.taxRate, financialProfile.taxRate);
    // Zwei Rabattquellen, die sich ADDIEREN und einander nie ersetzen:
    //  1. ordersDiscount: der bereits ausgerechnete Rabatt der Auftraege (order.discount).
    //     Er steckt nicht in den Positionspreisen (die sind Listen-Brutto) und muss
    //     durchgereicht werden, sonst wird der Kunde um genau diesen Betrag zu hoch belastet.
    //  2. options.discount: ein vom Bearbeiter AUSDRUECKLICH eingegebener Zusatzrabatt.
    //
    // Der Kundengruppenrabatt wird hier NICHT erneut prozentual angewandt - er ist in
    // ordersDiscount bereits enthalten. Genau diese doppelte Anwendung war der Fehler
    // aus Sophies Test vom 24.09.2026:
    //   richtig:  49,90 - 7,48  = 42,42
    //   falsch:   49,90 - 13,84 = 36,06   (7,48 + 15 % auf 42,42 = 6,36)
    // Invariante ohne Zusatzrabatt: Rechnungsbrutto === Summe der Auftragswerte.
    const manualDiscount = CalculationHelper.round(Math.max(0, Number(options.discount) || 0));
    const discount = CalculationHelper.round(
      Math.min(itemsGrossTotal, ordersDiscount + manualDiscount)
    );

    const bookingIds = [...new Set(orders.map((order) => toIdString(order.bookingId)).filter(Boolean))];
    const bookingId = bookingIds.length === 1 ? bookingIds[0] : undefined;

    if (bookingId) {
      await assertBookingNotYetInvoiced(bookingId);
    }

    const invoiceData = {
      repairOrderIds,
      orderId: orders.length === 1 ? orders[0]._id : undefined,
      bookingId,
      customerId:    customer._id,
      customerName:  customer.name,
      customerEmail: customer.email,
      customerVatId: (options.customerVatId || customer.vatId || '').trim(),
      sellerVatId:   (options.sellerVatId || financialProfile.sellerVatId || 'DE318981969').trim(),
      isReverseCharge,
      reverseChargeNotice: isReverseCharge ? (options.reverseChargeNotice || 'Steuerschuldnerschaft des Leistungsempfängers / Reverse Charge') : undefined,
      zmRelevant:    isReverseCharge,
      billingAddress: resolveBillingAddressFromOrder(orders[0]),
      shippingAddress: resolveShippingAddressFromOrder(orders[0]),
      items,
      // subtotal (Netto), tax und total (Brutto) leitet das Invoice-Modell ab.
      taxRate,
      discount,
      // Ein ausdruecklich gewaehltes Faelligkeitsdatum gewinnt, sonst die Frist aus dem
      // Kundenprofil. Den Zahlungsziel-Text leitet das Modell aus derselben Bedingung
      // ab - ein abweichender Freitext (options.paymentTerms) wird nicht uebernommen.
      dueDate:       options.dueDate ? new Date(options.dueDate) : new Date(Date.now() + normalizePaymentDueDays(financialProfile.paymentDueDays) * 24 * 60 * 60 * 1000),
      paymentDueDays: options.dueDate ? undefined : normalizePaymentDueDays(financialProfile.paymentDueDays),
      notes:         options.notes || '',
      status:        'sent',
      sentAt:        new Date()
    };

    const invoice = new Invoice(invoiceData);
    await saveClaimedInvoice(invoice, { orders });
    const finalized = await FinancialService.finalizeInvoiceCreation(invoice);

    console.log('FinancialService: Invoice generated from repair orders:', invoice.invoiceNumber);
    return finalized;
  }

  // Change invoice status with transition validation
  static async changeInvoiceStatus(invoiceId, newStatus, data = {}) {
    console.log('FinancialService: Changing invoice status:', invoiceId, '->', newStatus);

    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) throw buildFinancialError('Rechnung wurde nicht gefunden.', 404, 'INVOICE_NOT_FOUND');

    // "Storniert" ist KEIN reiner Statuswechsel: ein ausgestellter Beleg bekommt eine
    // Storno-Gutschrift (cancelInvoice), ein Entwurf wird verworfen (discardDraftInvoice).
    // Beide Wege laufen ueber dieselben Funktionen wie die eigenen Endpunkte.
    if (newStatus === 'cancelled' && invoice.status !== 'cancelled') {
      if (isIssuedStatus(invoice.status)) {
        const result = await FinancialService.cancelInvoice(invoice._id, {
          reason: data.notes,
          confirmPaidCancellation: data.confirmPaidCancellation === true,
          actorId: data.recordedBy,
          actorName: data.actorName,
        });
        return result.invoice;
      }
      const result = await FinancialService.discardDraftInvoice(invoice._id, {
        reason: data.notes,
        actorId: data.recordedBy,
        actorName: data.actorName,
      });
      return result.invoice;
    }

    const allowed = INVOICE_STATUS_TRANSITIONS[invoice.status] || [];
    if (!allowed.includes(newStatus)) {
      throw buildFinancialError(
        `Ein Beleg im Status "${invoiceStatusLabelDe(invoice.status)}" kann nicht auf "${invoiceStatusLabelDe(newStatus)}" gesetzt werden.`,
        409,
        'INVOICE_STATUS_TRANSITION_INVALID'
      );
    }

    const normalizedPaymentMethod = normalizeTrackedPaymentMethod(data.paymentMethod);
    const normalizedPaidAt = normalizeTrackedPaidAt(data.paidAt);

    if (data.paymentMethod && !normalizedPaymentMethod) {
      throw buildFinancialError('Ungültige Zahlart. Erlaubt sind: Kreditkarte, SEPA, PayPal, Bar.', 400, 'INVALID_PAYMENT_METHOD');
    }

    if (data.paidAt && !normalizedPaidAt) {
      throw buildFinancialError('Ungültiges Zahlungsdatum.', 400, 'INVALID_PAID_AT');
    }

    if (newStatus === 'paid') {
      if (!normalizedPaymentMethod) {
        throw buildFinancialError('Zum Setzen auf "bezahlt" wird die Zahlart benötigt.', 400, 'PAYMENT_METHOD_REQUIRED');
      }
      if (!normalizedPaidAt) {
        throw buildFinancialError('Zum Setzen auf "bezahlt" wird das Zahlungsdatum benötigt.', 400, 'PAID_AT_REQUIRED');
      }
    }

    // "Bezahlt" ist KEIN reiner Statuswechsel: der Zahlungsstand wird aus echten
    // Zahlungen abgeleitet. Frueher wurde hier nur paidAmount = total gesetzt - der
    // Beleg sah bezahlt aus, Auftrag/Buchung (die die Zuordnungen lesen) blieben
    // teilbezahlt, und die naechste Neuableitung kippte den Beleg zurueck.
    // Jetzt: bereits zugeordnetes Geld zaehlt, nur der TATSAECHLICH fehlende Betrag
    // wird genau einmal als Zahlung erfasst und zugeordnet. Ein bereits voll
    // bezahlter Beleg bekommt kein zusaetzliches Geld.
    if (newStatus === 'paid') {
      const balance = await PaymentService.computeInvoiceBalance(invoice);
      const missing = CalculationHelper.round(Number(balance?.open || 0));
      let recordedPayment = null;

      if (missing > 0.009) {
        // Der Schluessel beschreibt den STAND, den er schuetzt: offener Betrag plus die
        // Summe ALLER bisherigen Zuordnungszeilen des Belegs (auch die erstatteter
        // Zahlungen; Zuordnungen werden nie geloescht, die Summe waechst also mit jeder
        // Buchung). Ein Doppelklick sieht denselben Stand -> dieselbe Zahlung. Wurde die
        // Restzahlung spaeter erstattet und der Beleg erneut auf "bezahlt" gesetzt, ist
        // der Stand ein anderer -> neue Zahlung statt Kollision mit der erstatteten.
        const allocationRows = await PaymentAllocation.find({ invoiceId: invoice._id }).select('allocatedAmount').lean();
        const allocationState = CalculationHelper.round(allocationRows.reduce((sum, row) => sum + Number(row.allocatedAmount || 0), 0));
        const result = await FinancialService.addInvoicePayment(invoice._id, {
          amount: missing,
          paymentMethod: normalizedPaymentMethod,
          paymentDate: normalizedPaidAt,
          note: data.notes || 'Beim Setzen auf "bezahlt" erfasster Restbetrag',
          paymentReference: invoice.invoiceNumber ? `Rechnung ${invoice.invoiceNumber}` : '',
          recordedBy: data.recordedBy,
          // Doppelklick/Retry: derselbe Beleg, derselbe offene Betrag -> dieselbe Zahlung.
          idempotencyKey: `mark-paid:${toIdString(invoice._id)}:${missing.toFixed(2)}:${allocationState.toFixed(2)}`,
        });
        recordedPayment = result?.payment || null;
      }

      const refreshed = await Invoice.findById(invoice._id);
      const after = await PaymentService.computeInvoiceBalance(refreshed);
      if (!after || after.open > 0.009) {
        throw buildFinancialError(
          'Der Beleg konnte nicht als bezahlt verbucht werden, weil der Restbetrag nicht zugeordnet werden konnte.',
          409,
          'MARK_PAID_INCOMPLETE'
        );
      }

      // Nur den BELEG fortschreiben - der Betrag steht bereits in den Zuordnungen.
      await Invoice.updateOne(
        { _id: refreshed._id },
        {
          $set: {
            status: 'paid',
            paidAt: normalizedPaidAt,
            paymentMethod: normalizedPaymentMethod,
            paidAmount: CalculationHelper.round(after.allocated),
            dunningLevel: 0,
            dunningStage: 'none',
            ...(data.notes ? { notes: data.notes } : {}),
          },
        }
      );
      const finalInvoice = await Invoice.findById(invoice._id);
      await FinancialService.syncPaymentDerivedState(finalInvoice, 'changeInvoiceStatus');
      if (recordedPayment) finalInvoice.$locals.recordedPayment = recordedPayment;
      return finalInvoice;
    }

    invoice.status = newStatus;

    if (newStatus === 'sent') {
      invoice.sentAt = new Date();
    } else if (newStatus === 'pending_approval') {
      // no extra field
    } else if (newStatus === 'cancelled') {
      invoice.cancelledAt = new Date();
    } else if (newStatus === 'approved') {
      invoice.approvedAt = new Date();
    }

    invoice.paymentMethod = normalizedPaymentMethod;
    if (normalizedPaidAt) {
      invoice.paidAt = normalizedPaidAt;
    }

    if (data.notes) invoice.notes = data.notes;

    await invoice.save();

    // Abgeleitete Zustaende nicht fatal nachziehen: der Statuswechsel ist bereits
    // gespeichert und darf nicht nachtraeglich an einem Altbestands-Dokument scheitern.
    await FinancialService.syncPaymentDerivedState(invoice, 'changeInvoiceStatus');

    return invoice;
  }

  /**
   * Leitet invoice.paidAmount (und den daraus folgenden Zahlungsstatus) fuer die
   * uebergebenen Rechnungen NEU aus den gueltigen Zuordnungen ab.
   *
   * Bewusst per updateOne statt save(): der Betragshook des Rechnungsmodells darf
   * festgeschriebene Belege nicht neu berechnen - hier aendert sich nur der
   * Zahlungsstand, nie der Rechnungsbetrag.
   */
  static async recalculateInvoicePaidAmounts(invoiceIds = []) {
    const ids = [...new Set((invoiceIds || []).map((entry) => toIdString(entry)).filter(Boolean))];
    if (ids.length === 0) return [];

    const allocated = await PaymentService.getAllocatedTotalsByInvoice(ids);
    const credited = await PaymentService.getValueCreditedByInvoice(ids);
    const updated = [];

    for (const invoiceId of ids) {
      const invoice = await Invoice.findById(invoiceId);
      if (!invoice) continue;

      const paidAmount = CalculationHelper.round(Number(allocated.get(invoiceId) || 0));
      const update = { paidAmount };

      // Der BETRAG wird immer geschrieben, der BELEGSTATUS nur bei freigegebenen
      // Belegen: ein Entwurf oder ein Beleg in Freigabe darf auch ueber diesen Weg
      // nicht nach 'paid'/'partially_paid' gedraengt werden (denselben Schutz hat
      // PaymentService.allocateAtomically). Storniert/gutgeschrieben bleibt ebenfalls
      // unberuehrt. Die Statusregel ist dieselbe wie bei der Zuordnung.
      if (PAYMENT_DERIVED_STATUS_WRITABLE.includes(String(invoice.status || ''))) {
        Object.assign(update, PaymentService.resolvePaymentDerivedStatus({
          status: invoice.status,
          total: invoice.total,
          credited: Number(credited.get(invoiceId) || 0),
          paidAmount,
          paidAt: invoice.paidAt,
          dueDate: invoice.dueDate,
        }));
      }

      await Invoice.updateOne({ _id: invoice._id }, { $set: update });
      const refreshed = await Invoice.findById(invoice._id);
      await FinancialService.syncPaymentDerivedState(refreshed, 'recalculatePaidAmount');
      updated.push(refreshed);
    }

    return updated;
  }

  /**
   * Gemeinsamer Abschluss JEDER Rechnungserstellung.
   *
   * Bereits eingegangene, noch nicht zugeordnete Zahlungen der Buchung werden dem
   * neuen Beleg zugeordnet (Vorauszahlung -> spaetere Rechnung) und der abgeleitete
   * Zahlungsstand wird fortgeschrieben. Die Rechnung wird danach NEU GELESEN, weil
   * die Zuordnung ihre eigene Instanz speichert - sonst gibt der Aufrufer einen
   * veralteten Beleg (paidAmount 0, Status 'sent') an den Client zurueck.
   *
   * Absichtlich an EINER Stelle gebuendelt, damit ein neuer Erstellungspfad die
   * Zuordnung nicht erneut vergessen kann.
   */
  static async finalizeInvoiceCreation(invoice) {
    if (!invoice) return invoice;

    const bookingId = toIdString(invoice.bookingId);
    if (bookingId) {
      try {
        await FinancialService.autoAllocateUnallocatedPayments(bookingId);
      } catch (error) {
        console.error('FinancialService: auto allocation after invoice creation failed:', error);
      }
    }

    const refreshed = await Invoice.findById(invoice._id);
    await FinancialService.syncPaymentDerivedState(refreshed || invoice, 'invoiceCreated');

    // Ausgestellter Beleg: Stand bei Rechnungsstellung festhalten und das PDF einmalig
    // archivieren. Nicht fatal - der Beleg existiert bereits; scheitert die Archivierung,
    // holt der erste Abruf/Versand sie nach (dann mit Stichtag im PDF).
    if (refreshed && isIssuedStatus(refreshed.status)) {
      try {
        await FinancialService.ensureInvoiceDocument(refreshed._id, { reason: 'created' });
      } catch (error) {
        console.error('FinancialService: PDF-Archivierung nach Rechnungserstellung fehlgeschlagen:', error.message);
      }
    }
    return refreshed || invoice;
  }

  /**
   * Stand bei Rechnungsstellung: offener Betrag, bereits zugeordnetes Geld, die bis
   * dahin bekannten Zahlungen (Datum/Zahlart/Betrag) und die Zahlart. Wird genau einmal
   * mit dem ersten archivierten PDF festgehalten und danach nie fortgeschrieben.
   */
  static async captureIssueSnapshot(invoice) {
    const balance = await PaymentService.computeInvoiceBalance(invoice);
    const allocations = await PaymentAllocation.find({ invoiceId: invoice._id }).select('paymentId allocatedAmount').lean();
    const byPayment = new Map();
    allocations.forEach((row) => {
      const key = toIdString(row.paymentId);
      byPayment.set(key, CalculationHelper.round(Number(byPayment.get(key) || 0) + Number(row.allocatedAmount || 0)));
    });
    const payments = byPayment.size > 0
      ? await Payment.find({ _id: { $in: [...byPayment.keys()] } })
        .setOptions({ skipAutoPopulate: true })
        .select('_id paymentMethod processedAt createdAt status')
        .lean()
      : [];
    const snapshotPayments = payments
      .filter((payment) => PaymentService.isCountablePayment(payment))
      .map((payment) => ({
        date: payment.processedAt || payment.createdAt,
        method: payment.paymentMethod || '',
        amount: CalculationHelper.round(Number(byPayment.get(toIdString(payment._id)) || 0)),
      }))
      .filter((entry) => entry.amount > 0.009)
      .sort((a, b) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime());

    let paymentMethod = invoice.paymentMethod || (snapshotPayments[0] && snapshotPayments[0].method) || '';
    if (!paymentMethod && invoice.orderId) {
      const order = await Order.findById(toIdString(invoice.orderId)).setOptions({ skipAutoPopulate: true }).select('paymentMethod').lean();
      paymentMethod = order?.paymentMethod || '';
    }
    if (!paymentMethod && invoice.bookingId) {
      const booking = await Booking.findById(toIdString(invoice.bookingId)).setOptions({ skipAutoPopulate: true }).select('paymentMethod').lean();
      paymentMethod = ({ card: 'credit_card', paypal: 'paypal', invoice: 'invoice' })[booking?.paymentMethod] || '';
    }

    return {
      capturedAt: new Date(),
      openAmount: CalculationHelper.round(Number(balance?.open ?? Math.abs(Number(invoice.total || 0)))),
      paidAmount: CalculationHelper.round(Number(balance?.allocated || 0)),
      paymentMethod,
      payments: snapshotPayments,
    };
  }

  /**
   * Liefert das archivierte PDF eines AUSGESTELLTEN Belegs (erzeugt und speichert es beim
   * ersten Aufruf). Das gespeicherte Dokument wird nie ueberschrieben:
   *  - spaetere Zahlungen/Statuswechsel aendern es nicht (nicht im Fingerabdruck),
   *  - aendert sich der betragsrelevante Inhalt (Altweg syncOrderAndBookingValue), wird
   *    eine NEUE Fassung erzeugt; die bisherige bleibt unveraendert erhalten.
   * Speicherort (Aufbewahrungsregel, siehe models/InvoiceDocumentArchive.js): die Bytes
   * JEDER Fassung liegen als eigenes Dokument in InvoiceDocumentArchive; das
   * Invoice-Dokument traegt nur Metadaten (aktuelle Fassung + begrenzte Historie, deren
   * erster Eintrag - die ausgestellte Fassung - immer erhalten bleibt). Altbelege mit
   * Inline-Bytes werden unveraendert gelesen und erst bei einer Neufassung ausgelagert.
   * Zwei gleichzeitige Erstabrufe: nur einer speichert, beide liefern dieselbe Fassung.
   * Entwuerfe werden nicht archiviert (Vorschau, siehe renderDraftPdf).
   */
  static async ensureInvoiceDocument(invoiceId, { reason = '', actorId = null, actorName = '' } = {}) {
    const InvoicePdfService = require('./invoicePdfService');
    const load = () => Invoice.findById(toIdString(invoiceId)).select('+documentArchive.data +documentHistory');
    let invoice = await load();
    if (!invoice) throw buildFinancialError('Rechnung wurde nicht gefunden.', 404, 'INVOICE_NOT_FOUND');
    if (!isIssuedStatus(invoice.status) || invoice.cancellation?.kind === 'draft_discarded') {
      throw buildFinancialError('Ein Entwurf wird nicht archiviert.', 409, 'INVOICE_NOT_ISSUED');
    }

    const fingerprint = InvoicePdfService.buildDocumentFingerprint(invoice);
    const archive = invoice.documentArchive || {};
    const currentBytes = await readArchivedDocumentBytes(archive);
    if (currentBytes && archive.fingerprint === fingerprint) {
      return { buffer: currentBytes, sha256: archive.sha256, version: archive.version || 1, created: false, invoice };
    }

    const previous = currentBytes ? archive : null;
    const hasSnapshot = invoice.issueSnapshot && Number.isFinite(Number(invoice.issueSnapshot.openAmount));
    const snapshot = (!hasSnapshot || previous) && !invoice.isCreditNote
      ? await FinancialService.captureIssueSnapshot(invoice)
      : null;
    if (snapshot) invoice.issueSnapshot = snapshot;

    const buffer = await InvoicePdfService.generate(invoice);
    const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
    const now = new Date();
    const version = previous ? Number(previous.version || 1) + 1 : 1;

    // 1) Bytes zuerst in die Archivsammlung; die Rechnung verweist erst im atomaren
    //    Update (Schritt 2) darauf. Scheitert Schritt 2, war die Fassung nie ausgeliefert.
    const createdArchiveIds = [];
    const storeBytes = async (entry) => {
      const stored = await InvoiceDocumentArchive.create(entry);
      createdArchiveIds.push(stored._id);
      return stored._id;
    };
    const documentId = await storeBytes({
      invoiceId: invoice._id, version, sha256, size: buffer.length, fingerprint, generatedAt: now, data: buffer, source: 'generated',
    });
    const newArchive = { documentId, sha256, size: buffer.length, fingerprint, generatedAt: now, version };

    let nextHistory = null;
    if (previous) {
      // Altbestand: Inline-Bytes (aktuelle Fassung und Historie) unveraendert auslagern,
      // bevor sie aus dem Rechnungsdokument verschwinden.
      nextHistory = [];
      for (const entry of (invoice.documentHistory || [])) {
        const plain = typeof entry.toObject === 'function' ? entry.toObject() : entry;
        const inline = plain.data ? toBufferValue(plain.data) : null;
        const externalId = inline && inline.length > 0
          ? await storeBytes({
            invoiceId: invoice._id, version: Number(plain.version || 1), sha256: plain.sha256 || crypto.createHash('sha256').update(inline).digest('hex'),
            size: inline.length, fingerprint: plain.fingerprint, generatedAt: plain.generatedAt, data: inline, source: 'legacy_inline',
          })
          : (plain.documentId || undefined);
        nextHistory.push({
          documentId: externalId, sha256: plain.sha256, size: plain.size || (inline ? inline.length : undefined),
          fingerprint: plain.fingerprint, generatedAt: plain.generatedAt, supersededAt: plain.supersededAt, version: plain.version,
        });
      }
      const previousDocumentId = previous.documentId || await storeBytes({
        invoiceId: invoice._id, version: Number(previous.version || 1), sha256: previous.sha256 || crypto.createHash('sha256').update(currentBytes).digest('hex'),
        size: currentBytes.length, fingerprint: previous.fingerprint, generatedAt: previous.generatedAt, data: currentBytes, source: 'legacy_inline',
      });
      nextHistory.push({
        documentId: previousDocumentId, sha256: previous.sha256, size: previous.size || currentBytes.length,
        fingerprint: previous.fingerprint, generatedAt: previous.generatedAt, supersededAt: now, version: previous.version || 1,
      });
      // Begrenzt: die erste (ausgestellte) Fassung bleibt immer vermerkt, dazu die juengsten.
      if (nextHistory.length > DOCUMENT_HISTORY_INLINE_LIMIT) {
        nextHistory = [nextHistory[0], ...nextHistory.slice(-(DOCUMENT_HISTORY_INLINE_LIMIT - 1))];
      }
    }

    const audit = {
      at: now,
      action: previous ? 'document_regenerated' : 'document_archived',
      actorId: actorId || undefined,
      actorName: actorName || '',
      detail: previous
        ? `Betragsrelevanter Inhalt geändert – neue Fassung ${version}, Fassung ${previous.version || 1} bleibt im Archiv (${reason || 'Abruf'}).`
        : `PDF archiviert (${reason || 'Abruf'}).`,
    };

    // 2) Atomar umstellen. Bewusst KEIN lockedAt: der Belegbetrag wird von
    //    syncOrderAndBookingValue noch fortgeschrieben (fachliche Entscheidung offen); das
    //    PDF selbst bleibt unveraendert. documentArchive wird als Ganzes gesetzt - damit
    //    entfallen auch etwaige Inline-Bytes eines Altbelegs (sie liegen jetzt im Archiv).
    const set = {
      documentArchive: newArchive,
      ...(snapshot ? { issueSnapshot: snapshot } : {}),
      ...(nextHistory ? { documentHistory: nextHistory } : {}),
    };
    const filter = previous
      ? { _id: invoice._id, 'documentArchive.sha256': previous.sha256 }
      : { _id: invoice._id, $or: [{ 'documentArchive.sha256': { $exists: false } }, { 'documentArchive.sha256': null }] };
    const result = await Invoice.updateOne(filter, { $set: set, $push: { auditTrail: audit } });
    if (result.modifiedCount === 1) {
      return { buffer, sha256, version, created: true, invoice };
    }
    // Paralleler Abruf hat gewonnen: die eigenen, nie referenzierten Archivdatensaetze
    // entfernen und dessen Fassung ausliefern.
    await InvoiceDocumentArchive.deleteMany({ _id: { $in: createdArchiveIds } }).catch(() => {});
    invoice = await load();
    const storedBytes = await readArchivedDocumentBytes(invoice?.documentArchive || {});
    if (storedBytes) {
      return { buffer: storedBytes, sha256: invoice.documentArchive.sha256, version: invoice.documentArchive.version || 1, created: false, invoice };
    }
    throw buildFinancialError('Das Rechnungsdokument konnte nicht archiviert werden.', 500, 'DOCUMENT_ARCHIVE_FAILED');
  }

  /** Entwurfsvorschau (nur Admin/Mitarbeiter): wird nicht archiviert. */
  static async renderDraftPdf(invoiceId) {
    const InvoicePdfService = require('./invoicePdfService');
    const invoice = await Invoice.findById(toIdString(invoiceId));
    if (!invoice) throw buildFinancialError('Rechnung wurde nicht gefunden.', 404, 'INVOICE_NOT_FOUND');
    return InvoicePdfService.generate(invoice);
  }

  static async syncOrderPaymentTracking(invoiceInput) {
    const invoice = invoiceInput && typeof invoiceInput.toObject === 'function'
      ? invoiceInput.toObject()
      : invoiceInput;
    if (!invoice) return;

    const orderIds = [];
    if (invoice.orderId) orderIds.push(invoice.orderId);
    if (Array.isArray(invoice.repairOrderIds) && invoice.repairOrderIds.length > 0) {
      orderIds.push(...invoice.repairOrderIds);
    }

    const uniqueOrderIds = [...new Set(orderIds.map((entry) => toIdString(entry)).filter(Boolean))];
    if (uniqueOrderIds.length === 0) return;

    const orderObjectIds = uniqueOrderIds
      .filter((id) => Types.ObjectId.isValid(id))
      .map((id) => new Types.ObjectId(id));
    if (orderObjectIds.length === 0) return;

    // TRENNUNG DER ACHSEN (Regel 1 in paymentService.js): Order.paymentStatus ist ein
    // ZAHLUNGSstand und wird deshalb aus den gueltigen Zuordnungen ALLER Belege
    // abgeleitet, die diesen Auftrag betreffen - nicht aus dem Belegstatus der
    // zufaellig zuletzt synchronisierten Rechnung. Frueher hat bei mehreren Belegen
    // einer Buchung der letzte Lauf den Stand der anderen ueberschrieben, und eine
    // stornierte oder auf 'sent' zurueckgesetzte Rechnung hat den Auftrag auf
    // 'pending' gedrueckt, obwohl das Geld weiterhin gegen ihn steht.
    const relatedInvoices = await Invoice.find({
      $or: [
        { orderId: { $in: orderObjectIds } },
        { repairOrderIds: { $in: orderObjectIds } },
      ],
    })
      .select('_id orderId repairOrderIds total status isCreditNote bookingId createdAt invoiceNumber')
      .lean();

    // Forderung je Beleg aus DERSELBEN Berechnung wie Liste/Detail/Buchung: Brutto
    // minus wertmindernde Gutschriften, gegen gueltige Zuordnungen. Eine
    // Ueberzahlungsrueckgabe (Altbestand 'partial_refund') mindert die Forderung
    // nicht und setzt den Auftrag deshalb auch nicht mehr auf "erstattet".
    const receivables = relatedInvoices.filter((entry) => !entry.isCreditNote && entry.status !== 'cancelled');
    const balances = await PaymentService.getInvoiceBalances(receivables, { bookingCap: false });

    // Direkt auf den Auftrag gestempeltes Geld zaehlt nur, wenn es KEIN Buchungsgeld
    // ist: der Checkout stempelt die Zahlung einer ganzen Buchung auf den ersten
    // Auftrag (orderId = orders[0]). Diese Summe gehoert der Buchung und darf nicht
    // einem einzelnen Auftrag als eigene Zahlung gutgeschrieben werden.
    const orderPayments = await Payment.find({
      orderId: { $in: orderObjectIds },
      status: { $in: PaymentService.COUNTABLE_PAYMENT_STATUSES },
    })
      .select('_id orderId bookingId amount refundAmount status paymentDate processedAt paymentMethod')
      .lean();

    const invoiceOrderKeys = (entry) => {
      const keys = [];
      if (entry.orderId) keys.push(toIdString(entry.orderId));
      if (Array.isArray(entry.repairOrderIds)) keys.push(...entry.repairOrderIds.map((id) => toIdString(id)));
      return [...new Set(keys.filter((key) => uniqueOrderIds.includes(key)))];
    };

    const emptyState = () => ({ invoiced: 0, gross: 0, allocated: 0, received: 0, paidAt: null, paymentMethod: null });
    const stateByOrder = new Map(uniqueOrderIds.map((id) => [id, emptyState()]));

    receivables.forEach((entry) => {
      const balance = balances.get(toIdString(entry._id));
      if (!balance) return;
      invoiceOrderKeys(entry).forEach((key) => {
        const state = stateByOrder.get(key);
        if (!state) return;
        state.invoiced = CalculationHelper.round(state.invoiced + balance.receivable);
        state.gross = CalculationHelper.round(state.gross + balance.total);
        state.allocated = CalculationHelper.round(state.allocated + balance.allocated);
      });
    });

    orderPayments.forEach((payment) => {
      const state = stateByOrder.get(toIdString(payment.orderId));
      if (!state) return;
      const stamp = normalizeTrackedPaidAt(payment.processedAt || payment.paymentDate);
      if (stamp && (!state.paidAt || stamp > state.paidAt)) {
        state.paidAt = stamp;
        state.paymentMethod = normalizeTrackedPaymentMethod(payment.paymentMethod) || state.paymentMethod;
      }
      if (payment.bookingId) return;
      state.received = CalculationHelper.round(state.received + PaymentService.effectivePaymentAmount(payment));
    });

    const fallbackPaymentMethod = normalizeTrackedPaymentMethod(invoice.paymentMethod);
    const fallbackPaidAt = normalizeTrackedPaidAt(invoice.paidAt);
    const paidOrderIds = [];

    for (const orderId of uniqueOrderIds) {
      const state = stateByOrder.get(orderId);
      if (!state) continue;

      const open = CalculationHelper.round(Math.max(0, state.invoiced - state.allocated));
      const moneyHeld = Math.max(state.allocated, state.received);

      let paymentStatus = 'pending';
      // Voll gutgeschrieben (Forderung 0 bei vorhandenem Brutto) = Wert erstattet.
      if (state.gross > 0.009 && state.invoiced <= 0.009) paymentStatus = 'refunded';
      else if (state.invoiced > 0.009 && open <= 0.009) paymentStatus = 'paid';
      else if (moneyHeld > 0.009) paymentStatus = 'partial';

      if (paymentStatus === 'paid') paidOrderIds.push(orderId);

      await Order.updateOne(
        { _id: orderId },
        {
          $set: {
            paymentStatus,
            paymentMethod: state.paymentMethod || fallbackPaymentMethod,
            paidAt: paymentStatus === 'paid' ? (state.paidAt || fallbackPaidAt) : (state.paidAt || null),
          }
        }
      );
    }

    if (paidOrderIds.length > 0) {
      await Order.updateMany(
        { _id: { $in: paidOrderIds }, requiresPaymentBeforeCompletion: true },
        { $set: { requiresPaymentBeforeCompletion: false } }
      );

      const paidOrders = await Order.find({ _id: { $in: paidOrderIds }, sourceComplaintId: { $ne: null } })
        .select('sourceComplaintId')
        .lean();
      const complaintIds = [...new Set(paidOrders.map((order) => toIdString(order.sourceComplaintId)).filter(Boolean))];

      if (complaintIds.length > 0) {
        await Complaint.updateMany(
          { _id: { $in: complaintIds }, status: 'awaiting_payment' },
          { $set: { status: 'closed' } }
        );
      }
    }
  }

  static async syncBookingPaymentStatus(invoiceInput) {
    const invoice = invoiceInput && typeof invoiceInput.toObject === 'function'
      ? invoiceInput.toObject()
      : invoiceInput;
    if (!invoice) return;

    let bookingId = invoice.bookingId;

    if (!bookingId && invoice.orderId) {
      const order = await Order.findById(invoice.orderId).select('bookingId').lean();
      bookingId = order?.bookingId;
    }

    if (!bookingId && Array.isArray(invoice.repairOrderIds) && invoice.repairOrderIds.length > 0) {
      const repairOrderIds = invoice.repairOrderIds.map((entry) => toIdString(entry)).filter(Boolean);
      const linkedOrder = repairOrderIds.length > 0
        ? await Order.findOne({
            _id: { $in: repairOrderIds },
            bookingId: { $ne: null }
          }).select('bookingId').lean()
        : null;
      bookingId = linkedOrder?.bookingId;
    }

    if (!bookingId) return;

    await FinancialService.applyBookingPaymentState(bookingId);
  }

  /**
   * Schreibt den ZAHLUNGSSTAND einer Buchung aus den tatsaechlichen Zahlungen.
   *
   * Frueher wurde hier Invoice.status 1:1 nach booking.paymentStatus kopiert. Damit
   * landete ein BELEGSTATUS ('sent'/'versendet') im Zahlungsfeld und verdeckte ein
   * 'teilbezahlt'. Erfuellung (booking.status, booking.shippingStatus) und Zahlung
   * (billingStatus/paymentStatus) sind jetzt getrennt: eine Buchung kann gleichzeitig
   * versendet UND teilbezahlt sein.
   */
  static async applyBookingPaymentState(bookingInput) {
    const booking = bookingInput && typeof bookingInput.save === 'function'
      ? bookingInput
      : await Booking.findById(toIdString(bookingInput));
    if (!booking) return null;

    const orders = await Order.find({ bookingId: booking._id })
      .setOptions({ skipAutoPopulate: true })
      .select('_id')
      .lean();

    const balance = await PaymentService.computeBookingBalance({
      bookingId: booking._id,
      orderIds: orders.map((order) => order._id),
      orderValue: Number(booking.totalCost || 0),
    });
    if (!balance) return null;

    let billingStatus = 'unpaid';
    if (balance.overpaid > 0.009) billingStatus = 'overpaid';
    else if (balance.reference > 0.009 && balance.open <= 0.009) billingStatus = 'paid';
    else if (balance.received > 0.009) billingStatus = 'partially-paid';

    // paymentStatus fuehrt nur noch Zahlungswerte - niemals einen Belegstatus.
    const paymentStatusMap = {
      unpaid: 'pending',
      'partially-paid': 'partial',
      paid: 'paid',
      overpaid: 'paid',
    };

    booking.billingStatus = billingStatus;
    booking.paymentStatus = paymentStatusMap[billingStatus] || 'pending';
    await booking.save();

    return { booking, balance, billingStatus };
  }

  /**
   * Abgeleitete Folgezustaende (Auftrag, Buchung) nachziehen.
   *
   * Bewusst NICHT fatal: die Geldbuchung ist zu diesem Zeitpunkt bereits geschrieben.
   * Ein Fehler beim Fortschreiben abgeleiteter Zustaende - etwa ein Altbestands-
   * Booking, das die heutige Pflichtfeld-Validierung nicht mehr besteht - darf die
   * Zahlung nicht nachtraeglich als Fehler erscheinen lassen. Der Aufruf ist
   * idempotent und kann jederzeit wiederholt werden.
   */
  static async syncPaymentDerivedState(invoice, context = 'payment') {
    const warnings = [];
    try {
      await FinancialService.syncOrderPaymentTracking(invoice);
    } catch (error) {
      warnings.push(`syncOrderPaymentTracking: ${error.message}`);
      console.error(`FinancialService: derived order state not updated (${context}):`, error);
    }
    try {
      await FinancialService.syncBookingPaymentStatus(invoice);
    } catch (error) {
      warnings.push(`syncBookingPaymentStatus: ${error.message}`);
      console.error(`FinancialService: derived booking state not updated (${context}):`, error);
    }
    return warnings;
  }

  /**
   * Doppelbuchungsschutz fuer manuell erfasste Auftragszahlungen.
   * Liefert die zu verwendenden Idempotenzschluessel und - falls vorhanden - die
   * bereits gebuchte identische Zahlung.
   */
  static async findManualPaymentDuplicate({ bookingId, invoiceId, amount, paymentMethod, paymentDate, paymentReference, note, idempotencyKey }) {
    const fingerprint = [
      'booking', toIdString(bookingId), toIdString(invoiceId),
      CalculationHelper.round(Number(amount)).toFixed(2), String(paymentMethod || ''),
      new Date(paymentDate || Date.now()).toISOString().slice(0, 10),
      String(paymentReference || ''), String(note || ''),
    ];
    return findDuplicatePayment('booking-payment', fingerprint, idempotencyKey);
  }

  // Record a partial (or full) payment against an invoice
  //
  // Der gesamte Vorgang ist in sich stimmig: entweder Zahlung + Zuordnung +
  // Rechnungsstand sind geschrieben und der Aufrufer bekommt 2xx, oder es wurde
  // nichts gebucht und der Aufrufer bekommt einen Fehler. Das Fortschreiben der
  // abgeleiteten Zustaende (Auftrag/Buchung) kann die bereits gebuchte Zahlung
  // nicht mehr scheitern lassen - es wird als Warnung zurueckgegeben.
  //
  // paymentData.idempotencyKey (optional) verhindert eine Doppelbuchung bei Retry
  // oder Doppelklick; ohne Schluessel greift ein serverseitig abgeleiteter
  // Fingerabdruck ueber ein 5-Minuten-Fenster.
  static async addInvoicePayment(invoiceId, paymentData) {
    console.log('FinancialService: Adding payment to invoice:', invoiceId);

    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) throw buildFinancialError('Rechnung wurde nicht gefunden.', 404, 'INVOICE_NOT_FOUND');

    const allowedStatuses = ['draft', 'pending_approval', 'sent', 'viewed', 'partially_paid', 'overdue'];
    // Beim Anbieter bereits eingezogenes Geld wird auch fuer eine inzwischen bezahlte
    // Rechnung erfasst (als Ueberzahlung) - es darf nicht verloren gehen.
    const capturedOnPaidInvoice = paymentData.allowOverpayment === true && invoice.status === 'paid';
    if (!allowedStatuses.includes(invoice.status) && !capturedOnPaidInvoice) {
      throw buildFinancialError(
        `Für eine Rechnung im Status "${invoiceStatusLabelDe(invoice.status)}" kann keine Zahlung erfasst werden.`,
        409,
        'INVOICE_STATUS_NOT_PAYABLE'
      );
    }

    const amount = CalculationHelper.round(parseFloat(paymentData.amount));
    if (!Number.isFinite(amount) || amount <= 0) {
      throw buildFinancialError('Der Zahlungsbetrag muss größer als 0 sein.', 400, 'INVALID_AMOUNT');
    }

    const paymentDate = paymentData.paymentDate ? new Date(paymentData.paymentDate) : new Date();
    const paymentMethod = paymentData.paymentMethod || 'bank_transfer';
    const note = paymentData.note || paymentData.gatewayResponse || '';

    // Doppelbuchungsschutz VOR der Betragspruefung: eine Wiederholung desselben
    // Requests ist bereits gebucht und darf dem Bearbeiter nicht als
    // "Betrag übersteigt den offenen Rechnungsbetrag" gemeldet werden - genau diese
    // irrefuehrende Meldung entstuende sonst beim Retry nach dem ersten Erfolg.
    const fingerprint = [
      'invoice', toIdString(invoice._id), amount.toFixed(2), paymentMethod,
      new Date(paymentDate).toISOString().slice(0, 10),
      String(paymentData.paymentReference || ''), String(note),
    ];
    const { keys, existing } = await findDuplicatePayment('invoice-payment', fingerprint, paymentData.idempotencyKey);
    if (existing) {
      console.warn('FinancialService: duplicate invoice payment suppressed for invoice', String(invoice._id));
      const currentInvoice = await Invoice.findById(invoice._id);
      return {
        payment: existing,
        invoice: currentInvoice,
        duplicate: true,
        message: 'Diese Zahlung wurde bereits erfasst und nicht erneut gebucht.',
        warnings: [],
      };
    }

    const balanceBefore = await PaymentService.computeInvoiceBalance(invoice);
    const remaining = CalculationHelper.round(balanceBefore ? balanceBefore.open : Number(invoice.total || 0) - Number(invoice.paidAmount || 0));
    // allowOverpayment: bereits beim Anbieter eingezogenes Geld (PayPal-Capture) MUSS
    // erfasst werden, auch wenn es den offenen Betrag uebersteigt - sonst waere es
    // eingezogen, aber nirgends verbucht. Der Ueberhang bleibt nicht zugeordnet und
    // erscheint als "Erstattung offen". Manuelle Erfassung bleibt streng begrenzt.
    const allowOverpayment = paymentData.allowOverpayment === true;
    if (!allowOverpayment && amount > remaining + 0.01) {
      throw buildFinancialError(
        `Der Zahlungsbetrag (${formatEuroDe(amount)}) übersteigt den offenen Rechnungsbetrag (${formatEuroDe(remaining)}).`,
        400,
        'AMOUNT_EXCEEDS_OPEN'
      );
    }

    // Create payment record
    const payment = new Payment({
      invoiceId: invoice._id,
      orderId:        toIdString(invoice.orderId) || undefined,
      bookingId:      toIdString(invoice.bookingId) || undefined,
      customerId:    invoice.customerId,
      customerName:  invoice.customerName,
      amount,
      currency:       paymentData.currency || 'EUR',
      paymentMethod,
      paymentDate,
      status:         'completed',
      processedAt:    paymentDate,
      transactionId:  paymentData.transactionId || undefined,
      paymentReference: paymentData.paymentReference || (invoice.invoiceNumber ? `Rechnung ${invoice.invoiceNumber}` : ''),
      note,
      allocatedAmount: 0,
      source:         'manual',
      recordedBy:     paymentData.recordedBy || undefined,
      gatewayResponse: paymentData.gatewayResponse || '',
      metadata:       paymentData.metadata || {},
      idempotencyKey: keys[0],
    });

    try {
      await payment.save();
    } catch (error) {
      // E11000 auf idempotencyKey = zwei gleichzeitige Requests, einer hat gewonnen.
      if (error?.code === 11000 && String(error?.message || '').includes('idempotencyKey')) {
        const winner = await Payment.findOne({ idempotencyKey: { $in: keys } });
        const currentInvoice = await Invoice.findById(invoice._id);
        return {
          payment: winner,
          invoice: currentInvoice,
          duplicate: true,
          message: 'Diese Zahlung wurde bereits erfasst und nicht erneut gebucht.',
          warnings: [],
        };
      }
      throw error;
    }

    // Zuordnung + Rechnungsstand atomar fortschreiben. Schlaegt das fehl, wird die
    // eben angelegte Zahlung wieder entfernt: keine halbe Buchung.
    let allocationResult = null;
    const allocatable = allowOverpayment ? CalculationHelper.round(Math.min(amount, Math.max(0, remaining))) : amount;
    try {
      allocationResult = allocatable > 0.009
        ? await PaymentService.allocateAtomically({
          payment,
          invoice,
          amount: allocatable,
          note: paymentData.note || `Zahlung zu Rechnung ${invoice.invoiceNumber || invoice._id}`,
          orderId: toIdString(invoice.orderId) || undefined,
          // Eingezogenes Anbietergeld: ist der Beleg inzwischen weiter bezahlt, wird nur
          // der dann noch offene Teil zugeordnet (Rest = Erstattung offen).
          allowPartial: allowOverpayment,
        })
        : { allocation: null, invoice, allocatedAmount: 0 };
    } catch (allocError) {
      if (allowOverpayment) {
        // Eingezogenes Geld wird nie zurueckgedreht - es bleibt als nicht zugeordnet stehen.
        console.error('FinancialService: allocation of captured payment failed, kept unallocated:', allocError);
        allocationResult = { allocation: null, invoice, allocatedAmount: 0 };
      } else {
        await Payment.deleteOne({ _id: payment._id }).catch(() => {});
        console.error('FinancialService: allocation failed, payment rolled back:', allocError);
        throw buildFinancialError(
          'Die Zahlung konnte der Rechnung nicht zugeordnet werden und wurde nicht gebucht.',
          500,
          'ALLOCATION_FAILED'
        );
      }
    }

    if (!allocationResult && allowOverpayment) {
      allocationResult = { allocation: null, invoice, allocatedAmount: 0 };
    }

    if (!allocationResult) {
      await Payment.deleteOne({ _id: payment._id }).catch(() => {});
      throw buildFinancialError(
        'Die Zahlung konnte nicht gebucht werden, weil der Rechnungsstand parallel geändert wurde. Bitte erneut versuchen.',
        409,
        'ALLOCATION_CONFLICT'
      );
    }

    const updatedInvoice = await Invoice.findById(invoice._id);
    const warnings = await FinancialService.syncPaymentDerivedState(updatedInvoice, 'addInvoicePayment');

    // Ein Beleg ohne Freigabe nimmt das Geld an, behaelt aber seinen Belegstatus:
    // PaymentService.allocateAtomically schreibt fuer 'draft'/'pending_approval'
    // ausschliesslich paidAmount fort. Der Bearbeiter erfaehrt das ausdruecklich,
    // damit er den Beleg nicht faelschlich fuer erledigt haelt.
    const approvalPending = !PaymentService.ALLOCATABLE_INVOICE_STATUSES
      .includes(String(updatedInvoice?.status || invoice.status || ''));
    const warningParts = [];
    if (approvalPending) {
      warningParts.push(`Der Beleg ist noch nicht freigegeben (Status "${invoiceStatusLabelDe(updatedInvoice?.status || invoice.status)}"). Der Zahlungseingang wurde erfasst, der Belegstatus bleibt bis zur Freigabe unverändert.`);
    }
    const excess = CalculationHelper.round(amount - Number(allocationResult?.allocatedAmount || 0));
    if (allowOverpayment && excess > 0.009) {
      warningParts.push(`${formatEuroDe(excess)} übersteigen den offenen Betrag und stehen als Überzahlung (Erstattung offen) an der Rechnung.`);
    }
    const warning = warningParts.join(' ');

    return { payment, invoice: updatedInvoice, duplicate: false, warnings, ...(warning ? { warning } : {}) };
  }

  // Create a credit note for a paid or cancelled invoice
  static async createCreditNote(invoiceId, options = {}) {
    console.log('FinancialService: Creating credit note for invoice:', invoiceId);

    const original = await Invoice.findById(invoiceId);
    if (!original) throw buildFinancialError('Rechnung wurde nicht gefunden.', 404, 'INVOICE_NOT_FOUND');

    const allowedStatuses = ['paid', 'cancelled', 'credited', 'partially_paid', 'sent', 'viewed', 'overdue'];
    if (!allowedStatuses.includes(original.status)) {
      throw buildFinancialError(
        `Für eine Rechnung im Status "${invoiceStatusLabelDe(original.status)}" kann keine Gutschrift erstellt werden.`,
        409,
        'INVOICE_STATUS_NOT_CREDITABLE'
      );
    }

    // Load financial settings
    const settings = await FinancialService.getFinancialSettings();

    // Eine Gutschrift ist das exakte Spiegelbild ihrer Ursprungsrechnung: dieselbe
    // Brutto-Logik, derselbe Steuersatz, dieselbe Reverse-Charge-Kennzeichnung.
    const isReverseCharge = Boolean(original.isReverseCharge);
    // options.taxRate ist ein PROZENTWERT (z.B. 19). Ohne Angabe erbt die Gutschrift
    // den Satz der Ursprungsrechnung - nur so stimmt die Spiegelung.
    const taxRate = isReverseCharge
      ? 0
      : normalizeTaxRatePercent(
        options.taxRate,
        Number.isFinite(Number(original.taxRate)) ? Number(original.taxRate) : settings.defaults.taxRate
      );

    // Build credit note items (negative BRUTTO amounts)
    const creditItems = (options.items || original.items).map(item => ({
      serviceName: item.serviceName ? `Gutschrift: ${item.serviceName}` : undefined,
      description: `Gutschrift: ${item.description}`,
      quantity: item.quantity,
      unitPrice: -Math.abs(Number(item.unitPrice) || 0),
      total: -Math.abs(Number(item.total) || 0),
      taxRate,
      type: item.type
    }));

    // Rabatt wird als positiver Betrag gespeichert (Schema min 0); das Vorzeichen
    // setzt die Summenberechnung im Modell.
    const discount = CalculationHelper.round(Math.abs(Number(options.discount) || 0));
    const creditGrossMagnitude = CalculationHelper.round(Math.max(
      0,
      creditItems.reduce((sum, item) => sum + Math.abs(item.total), 0) - discount
    ));

    // Eine Teilgutschrift mit eigenen Positionen ist im Zweifel eine Wertminderung.
    // 'partial_refund' bedeutet ausschliesslich die Rueckgabe einer Ueberzahlung und
    // muss vom Aufrufer explizit angefordert werden (siehe handleOverpayment).
    const correctionType = options.correctionType || (options.items ? 'price_adjustment' : 'full_cancellation');
    // Der Korrekturtyp kommt aus dem Request-Body und MUSS serverseitig geprueft
    // werden: 'partial_refund' ist von der Wertminderungs-Obergrenze ausgenommen und
    // waere sonst ein unbegrenzter Gutschriftshebel.
    if (!VALID_CORRECTION_TYPES.includes(correctionType)) {
      throw buildFinancialError(
        `Ungültiger Korrekturtyp "${correctionType}". Zulässig sind: ${VALID_CORRECTION_TYPES.join(', ')}.`,
        400,
        'INVALID_CORRECTION_TYPE'
      );
    }
    const isRefundNote = REFUND_CORRECTION_TYPES.includes(correctionType);

    // Bereits gutgeschriebene WERTMINDERUNGEN beruecksichtigen, damit dieselbe Minderung
    // nicht bei jedem Sync erneut gutgeschrieben wird. Ueberzahlungsrueckgaben zaehlen
    // hier bewusst nicht mit - sie mindern den Rechnungswert nicht.
    const alreadyCredited = await FinancialService.getCreditedTotal(original._id, { valueAdjustmentsOnly: true });
    const originalGross = Math.abs(CalculationHelper.round(Number(original.total || 0)));
    const remainingCreditable = CalculationHelper.round(originalGross - alreadyCredited);
    if (!isRefundNote && creditGrossMagnitude > remainingCreditable + 0.01) {
      throw buildFinancialError(
        `Die Gutschrift übersteigt den noch gutschreibbaren Betrag der Rechnung ${original.invoiceNumber} `
        + `(offen: ${formatEuroDe(remainingCreditable)}, angefordert: ${formatEuroDe(creditGrossMagnitude)}).`,
        400,
        'CREDIT_NOTE_EXCEEDS_INVOICE'
      );
    }

    // Auch eine ERSTATTUNGSgutschrift braucht eine reale Obergrenze: zurueckgeben
    // laesst sich nur Geld, das tatsaechlich eingegangen ist. Bezug ist das im
    // Vorgang eingegangene Geld (bzw. der auf dem Beleg verbuchte Betrag, wenn es
    // keine Buchung gibt), abzueglich bereits erstatteter Gutschriften.
    if (isRefundNote) {
      const alreadyRefundCredited = CalculationHelper.round(
        await FinancialService.getCreditedTotal(original._id) - alreadyCredited
      );
      let receivedReference = CalculationHelper.round(Number(original.paidAmount || 0));
      const originalBookingId = toIdString(original.bookingId);
      if (originalBookingId) {
        const bookingBalance = await PaymentService.computeBookingBalance({ bookingId: originalBookingId });
        if (bookingBalance) receivedReference = CalculationHelper.round(Math.max(receivedReference, bookingBalance.received));
      }
      const remainingRefundable = CalculationHelper.round(receivedReference - alreadyRefundCredited);
      if (creditGrossMagnitude > remainingRefundable + 0.01) {
        throw buildFinancialError(
          `Die Erstattungsgutschrift übersteigt den tatsächlich eingegangenen Betrag `
          + `(erstattbar: ${formatEuroDe(Math.max(0, remainingRefundable))}, angefordert: ${formatEuroDe(creditGrossMagnitude)}).`,
          400,
          'REFUND_EXCEEDS_RECEIVED'
        );
      }
    }

    const creditNote = new Invoice({
      // Vorab vergebene ID (Storno): ein wiederholter Anlageversuch derselben
      // Storno-Gutschrift scheitert am _id statt eine zweite anzulegen.
      ...(options.creditNoteId ? { _id: options.creditNoteId } : {}),
      creditNoteOf:       original._id,
      creditNoteOfNumber: original.invoiceNumber || '',
      isCreditNote:   true,
      correctionType,
      repairOrderIds: original.repairOrderIds,
      orderId:        original.orderId,
      bookingId:      original.bookingId,
      customerId:     original.customerId,
      customerName:   original.customerName,
      customerEmail:  original.customerEmail,
      // normalize*, weil ein nicht gesetztes nested-Objekt als "null-Dokument" gelesen
      // wird und beim Neuanlegen sonst einen CastError erzeugt.
      billingAddress: normalizeBillingAddress(original.billingAddress) || undefined,
      shippingAddress: normalizeShippingAddress(original.shippingAddress) || undefined,
      customerVatId:  original.customerVatId,
      sellerVatId:    original.sellerVatId,
      isReverseCharge,
      reverseChargeNotice: original.reverseChargeNotice,
      zmRelevant:     original.zmRelevant,
      taxRate,
      items:          creditItems,
      discount,
      // subtotal/tax/total werden brutto-first vom Invoice-Modell abgeleitet.
      dueDate:        options.dueDate ? new Date(options.dueDate) : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      paymentTerms:   'Sofort',
      notes:          options.reason || `Gutschrift für Rechnung ${original.invoiceNumber}`,
      // Eine Storno-Gutschrift ist sofort ein ausgestellter Beleg; sonstige Gutschriften
      // entstehen wie bisher als Entwurf und werden beim Versand ausgestellt.
      status:         options.issue ? 'sent' : 'draft'
    });

    await creditNote.save();

    if (options.skipOriginalStatusUpdate) {
      console.log('FinancialService: Credit note created (original status handled by caller)');
      return creditNote;
    }

    // Nur eine vollstaendige Gutschrift schliesst die Ursprungsrechnung ab. Bei einer
    // Teilgutschrift bleibt der Status erhalten, sonst waere der Restbetrag weder
    // zahlbar noch mahnbar (INVOICE_STATUS_TRANSITIONS.credited ist leer).
    // Nur Wertminderungen koennen eine Rechnung vollstaendig gutschreiben. Eine
    // Ueberzahlungsrueckgabe laesst die Forderung unveraendert bestehen.
    const creditedAfter = isRefundNote
      ? alreadyCredited
      : CalculationHelper.round(alreadyCredited + creditGrossMagnitude);
    if (!isRefundNote && creditedAfter >= originalGross - 0.01 && originalGross > 0) {
      original.status = 'credited';
      await original.save();
    }

    console.log('FinancialService: Credit note created successfully with tax rate:', taxRate + '%');
    return creditNote;
  }

  /**
   * RECHNUNGSSTORNO eines AUSGESTELLTEN Belegs (T09).
   *
   *  - Der Originalbeleg (Daten, Nummer, archiviertes PDF) bleibt unveraendert; er wird
   *    nur als 'cancelled' markiert und traegt den Storno-Datensatz (Grund, Bearbeiter,
   *    Zeitpunkt, Gegenbeleg) plus Revisionsspur.
   *  - Gegenbeleg ist eine ausgestellte Storno-Gutschrift (INV-CN-..., correctionType
   *    'full_cancellation') ueber den noch nicht gutgeschriebenen Rest. Dadurch sinkt die
   *    Forderung ueber die bestehende Saldo-Logik auf 0 - keine zweite Rechenregel.
   *  - Bereits zugeordnetes Geld bleibt gebucht und erscheint als "Erstattung offen";
   *    es wird NIE automatisch erstattet. Dafuer ist eine ausdrueckliche Bestaetigung
   *    noetig (confirmPaidCancellation).
   *  - Genau einmal: atomare Reservierung am Beleg und eine vorab vergebene ID der
   *    Gutschrift. Wiederholung -> { alreadyCancelled: true }, paralleler Aufruf -> 409.
   *  - Ein Entwurf wird nicht storniert, sondern verworfen (discardDraftInvoice).
   *  - Fortsetzung nach Absturz: steht der Beleg noch in cancellation.state 'processing',
   *    wird ZUERST dieser Vorgang abgeschlossen - vor jeder Rest-/Statuspruefung. Die
   *    bereits ausgestellte Storno-Gutschrift wird an ihrer vorab vergebenen _id erkannt
   *    und nie ein zweites Mal erzeugt; bei der Restberechnung zaehlt sie nicht mit.
   *  - Kein Storno parallel zu einem laufenden Mahnschritt (frische dunningLock).
   */
  static async cancelInvoice(invoiceId, options = {}) {
    const id = toIdString(invoiceId);
    if (!Types.ObjectId.isValid(id)) throw buildFinancialError('Rechnung wurde nicht gefunden.', 404, 'INVOICE_NOT_FOUND');
    const reason = String(options.reason || '').trim().slice(0, 500);
    const actorId = options.actorId || undefined;
    const actorName = String(options.actorName || '').slice(0, 80);

    let invoice = await Invoice.findById(id);
    if (!invoice) throw buildFinancialError('Rechnung wurde nicht gefunden.', 404, 'INVOICE_NOT_FOUND');

    const loadResult = async (alreadyCancelled) => {
      const fresh = await Invoice.findById(id);
      const creditNote = fresh?.cancellation?.creditNoteId ? await Invoice.findById(fresh.cancellation.creditNoteId) : null;
      const balance = await PaymentService.computeInvoiceBalance(fresh);
      return {
        alreadyCancelled,
        invoice: fresh,
        creditNote,
        allocatedAtCancellation: CalculationHelper.round(Number(fresh?.cancellation?.allocatedAtCancellation || 0)),
        balance: FinancialService.toBalancePayload(balance),
      };
    };
    const inProgressError = () => buildFinancialError('Das Storno dieser Rechnung wird gerade ausgeführt. Bitte die Ansicht in einem Moment neu laden.', 409, 'CANCELLATION_IN_PROGRESS');
    const dunningInProgressError = () => buildFinancialError('Für diese Rechnung wird gerade ein Mahnschritt versendet. Bitte das Storno in einem Moment erneut auslösen.', 409, 'DUNNING_IN_PROGRESS');
    const hasFreshDunningLock = (doc, at) => Boolean(doc?.dunningLock?.token && doc.dunningLock.at
      && (at.getTime() - new Date(doc.dunningLock.at).getTime()) < DUNNING_LOCK_STALE_MS);

    if (invoice.cancellation?.kind === 'storno' && invoice.cancellation?.state === 'completed') {
      return loadResult(true);
    }
    if (invoice.isCreditNote) {
      throw buildFinancialError('Eine Gutschrift wird nicht storniert. Bei Bedarf bitte eine neue Rechnung erstellen.', 409, 'CREDIT_NOTE_NOT_CANCELLABLE');
    }

    // Unterbrochenes Storno fortsetzen - VOR den Rest-/Statuspruefungen: die bereits
    // ausgestellte Storno-Gutschrift wuerde dort sonst als "schon gutgeschrieben" zaehlen.
    const now = new Date();
    const staleBefore = new Date(now.getTime() - 2 * 60 * 1000);
    if (invoice.cancellation?.kind === 'storno' && invoice.cancellation?.state === 'processing') {
      return FinancialService.resumeInterruptedCancellation(invoice, {
        now, staleBefore, actorId, actorName, options, loadResult, inProgressError,
      });
    }

    if (!isIssuedStatus(invoice.status)) {
      throw buildFinancialError('Ein Entwurf wird nicht storniert, sondern verworfen („Entwurf verwerfen“).', 409, 'INVOICE_NOT_ISSUED');
    }
    if (invoice.status === 'cancelled') {
      throw buildFinancialError('Diese Rechnung ist bereits storniert.', 409, 'INVOICE_ALREADY_CANCELLED');
    }
    if (!reason) {
      throw buildFinancialError('Bitte einen Grund für das Storno angeben.', 400, 'REASON_REQUIRED');
    }

    const originalGross = Math.abs(CalculationHelper.round(Number(invoice.total || 0)));
    const alreadyCredited = await FinancialService.getCreditedTotal(invoice._id, { valueAdjustmentsOnly: true });
    const remaining = CalculationHelper.round(originalGross - alreadyCredited);
    if (invoice.status === 'credited' || remaining <= 0.009) {
      throw buildFinancialError('Diese Rechnung ist bereits vollständig gutgeschrieben – ein Storno ist nicht mehr nötig.', 409, 'INVOICE_ALREADY_CREDITED');
    }
    if (hasFreshDunningLock(invoice, now)) throw dunningInProgressError();

    const requiresConfirmation = (allocated) => {
      const error = buildFinancialError(
        `Auf diese Rechnung sind bereits ${allocated.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} € gebucht. `
        + 'Beim Storno bleibt die Zahlung erhalten und wird als Guthaben bzw. offene Erstattung ausgewiesen – '
        + 'es wird nichts automatisch erstattet. Bitte das Storno ausdrücklich bestätigen.',
        409,
        'CANCELLATION_REQUIRES_CONFIRMATION'
      );
      error.allocated = allocated;
      return error;
    };
    const balanceBefore = await PaymentService.computeInvoiceBalance(invoice);
    const allocatedBefore = CalculationHelper.round(Number(balanceBefore?.allocated || 0));
    if (allocatedBefore > 0.009 && options.confirmPaidCancellation !== true) {
      throw requiresConfirmation(allocatedBefore);
    }

    // Reservieren (genau einmal). Bedingung ist der FACHLICHE Zustand (ausgestellt, nicht
    // storniert/gutgeschrieben, kein laufender Mahnschritt) - nicht der zuvor gelesene
    // Status: ein Zahlungseingang dazwischen (sent -> partially_paid) darf das Storno
    // nicht mit einer irrefuehrenden Meldung scheitern lassen.
    const creditNoteId = new Types.ObjectId();
    const dunningStaleBefore = new Date(now.getTime() - DUNNING_LOCK_STALE_MS);
    const claim = await Invoice.updateOne(
      {
        _id: invoice._id,
        isCreditNote: { $ne: true },
        status: { $in: CANCELLABLE_INVOICE_STATUSES },
        'cancellation.state': { $exists: false },
        $or: [
          { 'dunningLock.token': { $exists: false } },
          { 'dunningLock.token': null },
          { 'dunningLock.at': { $lt: dunningStaleBefore } },
        ],
      },
      {
        $set: {
          cancellation: {
            kind: 'storno', state: 'processing', reason, requestedAt: now,
            actorId, actorName, previousStatus: invoice.status, creditNoteId,
            allocatedAtCancellation: allocatedBefore,
          },
        },
      }
    );
    if (claim.modifiedCount !== 1) {
      // Den ECHTEN Grund melden: neu lesen und den aktuellen Zustand auswerten.
      invoice = await Invoice.findById(id);
      const state = invoice?.cancellation;
      if (state?.kind === 'storno' && state?.state === 'completed') return loadResult(true);
      if (state?.kind === 'storno' && state?.state === 'processing') throw inProgressError();
      if (!invoice) throw buildFinancialError('Rechnung wurde nicht gefunden.', 404, 'INVOICE_NOT_FOUND');
      if (invoice.status === 'credited') {
        throw buildFinancialError('Diese Rechnung wurde inzwischen vollständig gutgeschrieben – ein Storno ist nicht mehr nötig.', 409, 'INVOICE_ALREADY_CREDITED');
      }
      if (invoice.status === 'cancelled') throw buildFinancialError('Diese Rechnung ist bereits storniert.', 409, 'INVOICE_ALREADY_CANCELLED');
      if (!isIssuedStatus(invoice.status)) {
        throw buildFinancialError('Ein Entwurf wird nicht storniert, sondern verworfen („Entwurf verwerfen“).', 409, 'INVOICE_NOT_ISSUED');
      }
      if (hasFreshDunningLock(invoice, new Date())) throw dunningInProgressError();
      throw buildFinancialError('Die Rechnung wurde soeben parallel geändert. Bitte die Ansicht neu laden und das Storno erneut auslösen.', 409, 'INVOICE_CONFLICT');
    }

    const releaseClaim = () => Invoice.updateOne(
      { _id: invoice._id, 'cancellation.state': 'processing', 'cancellation.creditNoteId': creditNoteId },
      { $unset: { cancellation: '' } }
    );

    // Nach der Reservierung neu pruefen: zwischen Lesen und Reservieren kann Geld
    // eingegangen oder eine Gutschrift entstanden sein.
    let allocated = allocatedBefore;
    try {
      invoice = await Invoice.findById(id);
      const balanceNow = await PaymentService.computeInvoiceBalance(invoice);
      allocated = CalculationHelper.round(Number(balanceNow?.allocated || 0));
      if (allocated > 0.009 && options.confirmPaidCancellation !== true) {
        await releaseClaim();
        throw requiresConfirmation(allocated);
      }
      const creditedNow = await FinancialService.getCreditedTotal(invoice._id, { valueAdjustmentsOnly: true });
      if (CalculationHelper.round(originalGross - creditedNow) <= 0.009) {
        await releaseClaim();
        throw buildFinancialError('Diese Rechnung wurde inzwischen vollständig gutgeschrieben – ein Storno ist nicht mehr nötig.', 409, 'INVOICE_ALREADY_CREDITED');
      }
      if (allocated !== allocatedBefore) {
        await Invoice.updateOne(
          { _id: invoice._id, 'cancellation.state': 'processing', 'cancellation.creditNoteId': creditNoteId },
          { $set: { 'cancellation.allocatedAtCancellation': allocated } }
        );
      }
    } catch (error) {
      if (!error?.statusCode) await releaseClaim();
      throw error;
    }

    return FinancialService.issueAndCompleteCancellation(invoice, {
      creditNoteId, reason, allocated, previousStatus: invoice.cancellation?.previousStatus || invoice.status,
      actorId, actorName, options, loadResult, releaseOnFailure: releaseClaim,
    });
  }

  /**
   * Fortsetzung eines unterbrochenen Stornos (cancellation.state 'processing').
   *  - Existiert die Storno-Gutschrift mit der vorab vergebenen _id bereits, wird nur noch
   *    der Abschluss nachgeholt (idempotent) - aber erst nach CANCELLATION_COMPLETION_GRACE_MS
   *    seit requestedAt. Davor laeuft der urspruengliche Vorgang vermutlich noch (zweiter
   *    Klick zwischen Gutschrift und Abschluss): 409 "wird gerade ausgefuehrt", damit der
   *    erste Aufruf selbst abschliesst (inkl. seines E-Mail-Versands).
   *  - Fehlt sie, darf erst nach 2 Minuten uebernommen werden (ein paralleler Vorgang
   *    koennte sie gerade anlegen); die Uebernahme ist atomar (requestedAt als Marke).
   *  - Der Revisionseintrag 'cancellation_resumed' entsteht erst MIT dem Abschluss.
   * Grund, Bearbeiter und Ausgangsstatus bleiben die des urspruenglichen Vorgangs.
   */
  static async resumeInterruptedCancellation(invoice, { now, staleBefore, actorId, actorName, options, loadResult, inProgressError }) {
    const state = invoice.cancellation || {};
    let creditNoteId = state.creditNoteId || null;
    const existingNote = creditNoteId ? await Invoice.findById(creditNoteId) : null;
    if (existingNote) {
      const graceBefore = new Date(now.getTime() - CANCELLATION_COMPLETION_GRACE_MS);
      const inFlight = !state.requestedAt || new Date(state.requestedAt) > graceBefore;
      if (inFlight) throw inProgressError();
    } else {
      const resumable = state.requestedAt && new Date(state.requestedAt) < staleBefore;
      if (!resumable) throw inProgressError();
      const takeoverSet = { 'cancellation.requestedAt': now };
      if (!creditNoteId) {
        creditNoteId = new Types.ObjectId();
        takeoverSet['cancellation.creditNoteId'] = creditNoteId;
      }
      const takeover = await Invoice.updateOne(
        { _id: invoice._id, 'cancellation.state': 'processing', 'cancellation.requestedAt': state.requestedAt },
        { $set: takeoverSet }
      );
      if (takeover.modifiedCount !== 1) throw inProgressError();
    }
    const resumeAuditEntry = { at: now, action: 'cancellation_resumed', actorId: actorId || undefined, actorName: actorName || '', detail: `Unterbrochenes Storno fortgesetzt (${existingNote ? 'Storno-Gutschrift war bereits ausgestellt' : 'Storno-Gutschrift noch nicht ausgestellt'}).` };
    const fresh = await Invoice.findById(invoice._id);
    return FinancialService.issueAndCompleteCancellation(fresh, {
      creditNoteId,
      reason: String(state.reason || '').trim() || String(options.reason || '').trim() || 'Storno',
      allocated: CalculationHelper.round(Number(state.allocatedAtCancellation || 0)),
      previousStatus: state.previousStatus || invoice.status,
      actorId: state.actorId || actorId,
      actorName: state.actorName || actorName,
      options,
      loadResult,
      resumeAuditEntry,
      // Nur wenn noch KEINE Gutschrift existiert, wird bei einem Fehler freigegeben -
      // dann ist nichts ausgestellt und ein neuer, normaler Storno-Versuch moeglich.
      releaseOnFailure: existingNote ? null : () => Invoice.updateOne(
        { _id: invoice._id, 'cancellation.state': 'processing', 'cancellation.creditNoteId': creditNoteId },
        { $unset: { cancellation: '' } }
      ),
    });
  }

  /**
   * Gemeinsamer zweiter Teil von Storno und Fortsetzung: Storno-Gutschrift (vorab
   * vergebene _id) ausstellen - falls noch nicht vorhanden - und das Original abschliessen.
   * Der Rest wird OHNE die eigene Storno-Gutschrift berechnet.
   */
  static async issueAndCompleteCancellation(invoice, { creditNoteId, reason, allocated, previousStatus, actorId, actorName, options = {}, loadResult, releaseOnFailure, resumeAuditEntry = null }) {
    let creditNote = await Invoice.findById(creditNoteId);
    if (!creditNote) {
      const originalGross = Math.abs(CalculationHelper.round(Number(invoice.total || 0)));
      const alreadyCredited = await FinancialService.getCreditedTotal(invoice._id, { valueAdjustmentsOnly: true, excludeIds: [creditNoteId] });
      const remaining = CalculationHelper.round(originalGross - alreadyCredited);
      const stornoText = `Storno der Rechnung ${invoice.invoiceNumber}: ${reason}`;
      // Ohne vorherige Gutschrift: exaktes Spiegelbild aller Positionen (inkl. Rabatt).
      // Nach einer Teilgutschrift: eine Position ueber den verbleibenden Rest.
      const mirrorAll = alreadyCredited <= 0.009;
      try {
        if (remaining <= 0.009) {
          throw buildFinancialError('Diese Rechnung ist bereits vollständig gutgeschrieben – ein Storno ist nicht mehr nötig.', 409, 'INVOICE_ALREADY_CREDITED');
        }
        creditNote = await FinancialService.createCreditNote(invoice._id, {
          creditNoteId,
          correctionType: 'full_cancellation',
          reason: stornoText,
          issue: true,
          skipOriginalStatusUpdate: true,
          ...(mirrorAll
            ? { discount: CalculationHelper.round(Number(invoice.discount || 0)) }
            : {
              items: [{
                serviceName: 'Storno Restbetrag',
                description: `Storno des nicht gutgeschriebenen Restbetrags der Rechnung ${invoice.invoiceNumber}`,
                quantity: 1,
                unitPrice: remaining,
                total: remaining,
                type: 'fee',
              }],
            }),
        });
      } catch (error) {
        if (error?.code === 11000) {
          creditNote = await Invoice.findById(creditNoteId);
        } else {
          // Reservierung freigeben: nichts ist passiert, ein neuer Versuch ist moeglich.
          if (releaseOnFailure) await releaseOnFailure();
          throw error;
        }
      }
    }

    // Zum Abschluss den tatsaechlich gebuchten Betrag festhalten (es kann waehrend des
    // Vorgangs Geld eingegangen sein; es bleibt als Guthaben/offene Erstattung stehen).
    try {
      const balanceAtCompletion = await PaymentService.computeInvoiceBalance(await Invoice.findById(invoice._id));
      allocated = Math.max(allocated, CalculationHelper.round(Number(balanceAtCompletion?.allocated || 0)));
    } catch (error) {
      console.error('FinancialService: Saldo beim Storno-Abschluss nicht ermittelbar:', error.message);
    }
    const completedAt = new Date();
    const completion = await Invoice.updateOne(
      { _id: invoice._id, 'cancellation.state': 'processing', 'cancellation.creditNoteId': creditNote._id },
      {
        $set: {
          status: 'cancelled',
          cancelledAt: completedAt,
          'cancellation.state': 'completed',
          'cancellation.completedAt': completedAt,
          'cancellation.creditNoteNumber': creditNote.invoiceNumber || '',
          'cancellation.allocatedAtCancellation': allocated,
          nextDunningDueDate: null,
        },
        // Eine Mahnsperre gehoert dem Mahnschritt, der sie gesetzt hat - sie wird hier
        // nicht entfernt (der Schritt gibt sie selbst frei; storniert wird nicht gemahnt).
        $push: {
          auditTrail: {
            $each: [
              ...(resumeAuditEntry ? [resumeAuditEntry] : []),
              {
                at: completedAt,
                action: 'cancelled',
                actorId,
                actorName,
                detail: `Storniert (vorher: ${invoiceStatusLabelDe(previousStatus)}). Grund: ${reason}. Storno-Gutschrift ${creditNote.invoiceNumber || creditNote._id}`
                  + `${allocated > 0.009 ? `; bereits gebuchte ${formatEuroDe(allocated)} bleiben als Guthaben/offene Erstattung erhalten` : ''}.`,
              },
            ],
          },
        },
      }
    );
    if (completion.modifiedCount !== 1) {
      // Ein paralleler Fortsetzer hat den Abschluss bereits geschrieben.
      const current = await Invoice.findById(invoice._id).select('cancellation').lean();
      if (current?.cancellation?.state === 'completed') return loadResult(true);
      throw buildFinancialError('Das Storno dieser Rechnung konnte nicht abgeschlossen werden. Bitte die Ansicht neu laden und das Storno erneut auslösen.', 409, 'CANCELLATION_INCOMPLETE');
    }
    await Invoice.updateOne(
      { _id: creditNote._id },
      { $push: { auditTrail: { at: completedAt, action: 'issued', actorId, actorName, detail: `Storno-Gutschrift zu Rechnung ${invoice.invoiceNumber} ausgestellt.` } } }
    );

    // Gegenbeleg archivieren (unveraenderliches PDF). Nicht fatal: der erste Abruf holt es nach.
    try {
      await FinancialService.ensureInvoiceDocument(creditNote._id, { reason: 'Storno', actorId, actorName });
    } catch (error) {
      console.error('FinancialService: Storno-Gutschrift konnte nicht archiviert werden:', error.message);
    }
    await FinancialService.syncPaymentDerivedState(await Invoice.findById(invoice._id), 'cancelInvoice');

    const result = await loadResult(false);
    if (options.sendEmail === true && creditNote.customerEmail) {
      try {
        await FinancialService.sendInvoice(creditNote._id, creditNote.customerEmail, options.message || '', { actorId, actorName });
        result.emailSent = true;
      } catch (error) {
        result.emailSent = false;
        result.warning = 'Das Storno ist gebucht, die Storno-Gutschrift konnte aber nicht per E-Mail versendet werden. Der Versand kann erneut ausgelöst werden.';
      }
    }
    return result;
  }

  /**
   * Entwurf verwerfen (getrennt vom Storno eines ausgestellten Belegs). Der Datensatz
   * bleibt mit seiner Nummer erhalten (lueckenlose Nummernkreise), wird als 'cancelled'
   * mit cancellation.kind 'draft_discarded' markiert und erzeugt keine Gutschrift.
   */
  static async discardDraftInvoice(invoiceId, options = {}) {
    const id = toIdString(invoiceId);
    if (!Types.ObjectId.isValid(id)) throw buildFinancialError('Rechnung wurde nicht gefunden.', 404, 'INVOICE_NOT_FOUND');
    const invoice = await Invoice.findById(id);
    if (!invoice) throw buildFinancialError('Rechnung wurde nicht gefunden.', 404, 'INVOICE_NOT_FOUND');
    if (invoice.cancellation?.kind === 'draft_discarded') return { alreadyDiscarded: true, invoice };
    if (isIssuedStatus(invoice.status)) {
      throw buildFinancialError('Ein ausgestellter Beleg kann nicht verworfen werden – bitte stattdessen stornieren.', 409, 'INVOICE_ALREADY_ISSUED');
    }
    const allocationCount = await PaymentAllocation.countDocuments({ invoiceId: invoice._id });
    if (allocationCount > 0) {
      throw buildFinancialError('Auf diesen Entwurf sind Zahlungen gebucht – er kann nicht verworfen werden.', 409, 'DRAFT_HAS_PAYMENTS');
    }
    // Ein Gutschrift-Entwurf, der seine Ursprungsrechnung vollstaendig gutschreibt, darf
    // nicht verworfen werden, wenn fuer denselben Auftrag/dieselbe Buchung inzwischen eine
    // NEUE Rechnung aktiv ist: das Original muesste wieder aufleben (zwei aktive Rechnungen).
    if (invoice.isCreditNote && invoice.creditNoteOf) {
      const creditedOriginal = await Invoice.findById(invoice.creditNoteOf).setOptions({ skipAutoPopulate: true })
        .select('_id status total cancellation orderId repairOrderIds bookingId').lean();
      let originalKeys = null;
      if (creditedOriginal && creditedOriginal.status === 'credited' && !creditedOriginal.cancellation?.state) {
        const creditedWithout = await FinancialService.getCreditedTotal(creditedOriginal._id, { valueAdjustmentsOnly: true, excludeIds: [invoice._id] });
        if (creditedWithout < Math.abs(Number(creditedOriginal.total || 0)) - 0.01) {
          originalKeys = Invoice.buildActiveBillingKeys(creditedOriginal);
        }
      }
      if (originalKeys) {
        const successor = await Invoice.findOne({ _id: { $ne: creditedOriginal._id }, activeBillingKeys: { $in: originalKeys } })
          .setOptions({ skipAutoPopulate: true }).select('_id invoiceNumber').lean();
        if (successor) {
          throw buildFinancialError(
            `Dieser Gutschrift-Entwurf kann nicht verworfen werden: Für denselben Auftrag bzw. dieselbe Buchung besteht inzwischen die Rechnung ${successor.invoiceNumber || successor._id}. `
            + 'Bitte den Entwurf ausstellen oder die neue Rechnung zuerst stornieren.',
            409,
            'CREDIT_NOTE_DISCARD_BLOCKED'
          );
        }
      }
    }
    const reason = String(options.reason || '').trim().slice(0, 500) || 'Entwurf verworfen';
    const now = new Date();
    const actorId = options.actorId || undefined;
    const actorName = String(options.actorName || '').slice(0, 80);
    const result = await Invoice.updateOne(
      { _id: invoice._id, status: invoice.status },
      {
        $set: {
          status: 'cancelled',
          cancelledAt: now,
          cancellation: { kind: 'draft_discarded', state: 'completed', reason, requestedAt: now, completedAt: now, actorId, actorName, previousStatus: invoice.status },
        },
        $push: { auditTrail: { at: now, action: 'draft_discarded', actorId, actorName, detail: `Entwurf verworfen. Grund: ${reason}` } },
      }
    );
    if (result.modifiedCount !== 1) {
      const fresh = await Invoice.findById(id);
      if (fresh?.cancellation?.kind === 'draft_discarded') return { alreadyDiscarded: true, invoice: fresh };
      throw buildFinancialError('Der Entwurf wurde parallel geändert. Bitte die Ansicht neu laden.', 409, 'INVOICE_CONFLICT');
    }

    // Ein verworfener Gutschrift-Entwurf mindert die Forderung nicht mehr: hatte er die
    // Ursprungsrechnung auf "gutgeschrieben" gesetzt, wird deren Status neu abgeleitet.
    if (invoice.isCreditNote && invoice.creditNoteOf) {
      const original = await Invoice.findById(invoice.creditNoteOf);
      if (original && original.status === 'credited' && !original.cancellation?.state) {
        const credited = await FinancialService.getCreditedTotal(original._id, { valueAdjustmentsOnly: true });
        if (credited < Math.abs(Number(original.total || 0)) - 0.01) {
          const reopenedStatus = original.dueDate && new Date(original.dueDate) < now ? 'overdue' : 'sent';
          // Mit dem Wiedereroeffnen beansprucht die Rechnung ihren Auftrag/ihre Buchung
          // erneut. Ist dafuer inzwischen eine NEUE Rechnung aktiv, bleibt das Original
          // gutgeschrieben - sonst stuenden zwei aktive Rechnungen fuer dieselbe Leistung.
          const reopenKeys = Invoice.buildActiveBillingKeys({
            orderId: original.orderId, repairOrderIds: original.repairOrderIds, bookingId: original.bookingId,
          });
          try {
            await Invoice.updateOne(
              { _id: original._id, status: 'credited' },
              { $set: { status: reopenedStatus, ...(reopenKeys ? { activeBillingKeys: reopenKeys } : {}) } }
            );
            await FinancialService.recalculateInvoicePaidAmounts([original._id]);
          } catch (error) {
            if (!Invoice.isActiveBillingKeyConflict(error)) throw error;
            await Invoice.updateOne(
              { _id: original._id },
              { $push: { auditTrail: { at: now, action: 'reopen_blocked', actorId, actorName, detail: `Gutschrift-Entwurf verworfen; die Rechnung bleibt gutgeschrieben, weil für denselben Auftrag bzw. dieselbe Buchung inzwischen eine neue Rechnung besteht.` } } }
            );
          }
        }
      }
    }
    return { alreadyDiscarded: false, invoice: await Invoice.findById(id) };
  }

  // Summe aller bereits zu einer Rechnung erstellten Gutschriften (positiver Betrag).
  // options.valueAdjustmentsOnly: nur WERTMINDERNDE Gutschriften (Preiskorrektur,
  // Storno und Altbelege ohne correctionType). Ueberzahlungsrueckgaben
  // ('partial_refund') sind Geldrueckfluesse und mindern den Rechnungswert nicht -
  // die beiden Toepfe duerfen nie vermischt werden.
  static async getCreditedTotal(invoiceId, options = {}) {
    const query = { creditNoteOf: invoiceId };
    // Verworfene (stornierte) Gutschrift-Entwuerfe mindern nichts - wie in der Saldo-Logik.
    query.status = { $ne: 'cancelled' };
    // options.excludeIds: Belege, die nicht mitzaehlen (z.B. die eigene Storno-Gutschrift
    // bei der Fortsetzung eines unterbrochenen Stornos).
    const excludeIds = (options.excludeIds || []).map((entry) => toIdString(entry)).filter((entry) => Types.ObjectId.isValid(entry));
    if (excludeIds.length > 0) query._id = { $nin: excludeIds.map((entry) => new Types.ObjectId(entry)) };
    if (options.valueAdjustmentsOnly) {
      // $nin trifft auch Dokumente ohne correctionType (Altbestand = Wertminderung).
      query.correctionType = { $nin: REFUND_CORRECTION_TYPES };
    }
    const creditNotes = await Invoice.find(query)
      .select('total')
      .lean();
    return CalculationHelper.round(
      creditNotes.reduce((sum, note) => sum + Math.abs(Number(note.total || 0)), 0)
    );
  }

  // Get detailed invoice context: invoice + linked payments + linked credit notes
  static async getInvoiceDetails(invoiceId) {
    console.log('FinancialService: Getting invoice details for:', invoiceId);

    const invoice = await Invoice.findById(invoiceId)
      .populate('creditNoteOf', 'invoiceNumber status total createdAt isCreditNote')
      .populate('repairOrderIds', 'orderNumber status deviceType deviceBrand deviceModel')
      .populate('orderId', 'orderNumber status deviceType deviceBrand deviceModel');
    if (!invoice) throw buildFinancialError('Rechnung wurde nicht gefunden.', 404, 'INVOICE_NOT_FOUND');

    // Hydrate missing addresses for legacy invoices or paths that stored incomplete address data.
    const hasBillingAddress = normalizeBillingAddress(invoice.billingAddress);
    const hasShippingAddress = normalizeShippingAddress(invoice.shippingAddress);
    if (!hasBillingAddress || !hasShippingAddress) {
      let orderContext = null;
      if (invoice.orderId) {
        orderContext = await Order.findById(invoice.orderId)
          .populate('customerId', 'invoiceAddress paymentAddress shippingAddress')
          .select('guestInfo.billingAddress guestInfo.shippingAddress billingAddress shippingAddress customerId')
          .lean();
      }

      let bookingContext = null;
      if (invoice.bookingId) {
        bookingContext = await Booking.findById(invoice.bookingId)
          .populate('customerId', 'invoiceAddress paymentAddress shippingAddress')
          .select('guestInfo.billingAddress guestInfo.shippingAddress billingAddress shippingAddress customerId')
          .lean();
      }

      if (!hasBillingAddress) {
        invoice.billingAddress =
          resolveBillingAddressFromBooking(bookingContext)
          || resolveBillingAddressFromOrder(orderContext)
          || invoice.billingAddress;
      }

      if (!hasShippingAddress) {
        invoice.shippingAddress =
          resolveShippingAddressFromBooking(bookingContext)
          || resolveShippingAddressFromOrder(orderContext)
          || invoice.shippingAddress;
      }
    }

    // Zahlungen im VORGANGSKONTEXT, nicht nur die auf diesen Beleg gestempelten.
    // Eine Gateway-Vorauszahlung traegt beim Checkout nur bookingId/orderId - eine
    // Abfrage allein auf invoiceId lieferte deshalb immer 0 Zeilen ("Noch keine
    // Zahlungen verzeichnet"), obwohl der Kunde bereits bezahlt hatte.
    const paymentConditions = [{ invoiceId: invoice._id }];
    const invoiceBookingId = toIdString(invoice.bookingId);
    const invoiceOrderId = toIdString(invoice.orderId);
    if (invoiceBookingId) paymentConditions.push({ bookingId: invoiceBookingId });
    if (invoiceOrderId) paymentConditions.push({ orderId: invoiceOrderId });

    const rawPayments = await Payment.find({ $or: paymentConditions })
      .sort({ createdAt: -1 })
      .lean();

    const allocations = rawPayments.length > 0
      ? await PaymentAllocation.find({ paymentId: { $in: rawPayments.map((payment) => payment._id) } }).lean()
      : [];
    const allocatedToThisInvoiceByPayment = new Map();
    allocations.forEach((allocation) => {
      if (toIdString(allocation.invoiceId) !== toIdString(invoice._id)) return;
      const key = toIdString(allocation.paymentId);
      allocatedToThisInvoiceByPayment.set(
        key,
        CalculationHelper.round(Number(allocatedToThisInvoiceByPayment.get(key) || 0) + Number(allocation.allocatedAmount || 0))
      );
    });

    // Jede Zeile traegt, ob sie DIESER Rechnung zugeordnet ist - der Client darf
    // "vorhanden" nicht mit "verrechnet" verwechseln.
    const payments = rawPayments.map((payment) => {
      const allocatedToThisInvoice = CalculationHelper.round(Number(allocatedToThisInvoiceByPayment.get(toIdString(payment._id)) || 0));
      return {
        ...payment,
        allocatedToThisInvoice,
        isAllocatedToThisInvoice: allocatedToThisInvoice > 0.009,
      };
    });

    // Credit notes created for this invoice
    const creditNotes = await Invoice.find({ creditNoteOf: invoice._id })
      .select('_id invoiceNumber status total createdAt isCreditNote notes correctionType')
      .sort({ createdAt: -1 });

    // Verbindlicher Zahlungsstand des Belegs - dieselbe Berechnung wie die Liste.
    const computed = await PaymentService.computeInvoiceBalance(invoice);
    const balance = computed ? { ...FinancialService.toBalancePayload(computed), paymentState: computed.paymentState } : null;

    return { invoice, payments, creditNotes, balance };
  }

  // Get all overdue invoices, preserving the original customer payment deadline.
  /**
   * Mahnstand EINES Belegs aus Beleg + Saldo (reine Berechnung, schreibt nichts).
   * inList = ueberfaellig mit echter offener Forderung; eligible = jetzt mahnbar.
   */
  static describeDunningState(invoice, balance, now = new Date()) {
    const stage = String(invoice?.dunningStage || 'none');
    const level = Number(invoice?.dunningLevel || 0);
    const originalDueDate = invoice?.originalDueDate || invoice?.dueDate || null;
    const openAmount = CalculationHelper.round(Number(balance?.open || 0));
    const today = startOfLocalDay(now);
    const daysOverdue = originalDueDate
      ? Math.round((today.getTime() - startOfLocalDay(originalDueDate).getTime()) / (24 * 60 * 60 * 1000))
      : 0;
    const lastFailure = invoice?.dunningLastFailure?.error ? {
      at: invoice.dunningLastFailure.at || null,
      stage: invoice.dunningLastFailure.stage || '',
      stageLabel: DUNNING_STAGE_LABELS[invoice.dunningLastFailure.stage] || '',
      error: invoice.dunningLastFailure.error,
    } : null;
    const base = {
      originalDueDate,
      daysOverdue: Math.max(0, daysOverdue),
      openAmount,
      currentStage: stage,
      currentStageLabel: DUNNING_STAGE_LABELS[stage] || stage,
      currentLevel: level,
      nextStage: DUNNING_STAGES[level]?.stage || null,
      nextStageLabel: DUNNING_STAGES[level]?.label || null,
      nextEligibleDate: null,
      lastFailure,
      inList: false,
      eligible: false,
      reason: '',
    };

    if (!invoice || invoice.isCreditNote) return { ...base, reason: 'Gutschriften werden nicht gemahnt.' };
    // Ein eingeleitetes (auch ein noch laufendes) Storno beendet das Mahnverfahren.
    if (invoice.cancellation?.state) {
      return { ...base, reason: 'Für diese Rechnung ist ein Storno eingeleitet bzw. abgeschlossen – sie wird nicht gemahnt.' };
    }
    if (!DUNNING_RECEIVABLE_STATUSES.includes(String(invoice.status || ''))) {
      return { ...base, reason: `Beleg im Status "${invoiceStatusLabelDe(invoice.status)}" wird nicht gemahnt.` };
    }
    if (openAmount <= 0.009) return { ...base, reason: 'Keine offene Forderung.' };
    if (daysOverdue <= 0) return { ...base, reason: 'Noch nicht fällig.' };

    const listed = { ...base, inList: true };
    if (stage === 'collection') return { ...listed, reason: 'An Inkasso übergeben – keine automatische Weiterführung.' };
    if (level >= DUNNING_STAGES.length) {
      return { ...listed, reason: 'Letzte Mahnung versendet – eine Übergabe an das Inkasso erfolgt nur manuell.' };
    }
    const nextEligibleDate = invoice.nextDunningDueDate
      ? new Date(invoice.nextDunningDueDate)
      : addDays(startOfLocalDay(originalDueDate), DUNNING_INTERVAL_DAYS);
    const withNext = { ...listed, nextEligibleDate };
    const lock = invoice.dunningLock;
    if (lock?.token && lock.at && (now.getTime() - new Date(lock.at).getTime()) < DUNNING_LOCK_STALE_MS) {
      return { ...withNext, reason: 'Wird gerade bearbeitet.' };
    }
    if (now.getTime() < nextEligibleDate.getTime()) {
      return { ...withNext, reason: `Nächste Mahnstufe erst ab ${nextEligibleDate.toLocaleDateString('de-DE')} möglich.` };
    }
    if (lock?.token) {
      return { ...withNext, reason: 'Ein früherer Mahnschritt wurde nicht abgeschlossen (Versandergebnis unklar). Bitte prüfen und den Schritt einzeln erneut auslösen.', staleLock: true };
    }
    return { ...withNext, eligible: true };
  }

  /**
   * Mahnliste: ueberfaellige Belege mit ECHTER offener Forderung (Saldo aus dem
   * PaymentService, nicht total - paidAmount). Bezahlte, stornierte, gutgeschriebene,
   * nur-ueberzahlte Belege und Gutschriften erscheinen nicht. Jeder Eintrag traegt
   * `dunning` (Faelligkeit, Tage, offener Betrag, Stufe, naechster Termin, faellig, Grund).
   */
  static async getOverdueInvoices() {
    const now = new Date();
    const candidates = await Invoice.find({
      isCreditNote: { $ne: true },
      status: { $in: DUNNING_RECEIVABLE_STATUSES },
      $or: [{ originalDueDate: { $lt: now } }, { dueDate: { $lt: now } }],
    }).sort({ dueDate: 1 });
    if (candidates.length === 0) return [];
    const balances = await PaymentService.getInvoiceBalances(candidates);
    const result = [];
    candidates.forEach((invoice) => {
      const balance = balances.get(toIdString(invoice._id));
      const dunning = FinancialService.describeDunningState(invoice, balance, now);
      if (!dunning.inList) return;
      const plain = invoice.toObject();
      delete plain.dunningLock;
      result.push({ ...plain, balance: FinancialService.toBalancePayload(balance), paymentState: balance?.paymentState || 'open', dunning });
    });
    return result;
  }

  /**
   * Stand eines Belegs NACH dem Versand eines Mahn-/Inkassoschreibens (nur lesend).
   * reason: 'open' (Stufe darf gelten), 'paid', 'cancelled', 'lock_lost' (eigene Sperre
   * nicht mehr vorhanden) oder 'unknown' (Lesefehler, readFailed = true).
   */
  static async readDunningStateAfterSend(invoiceId, token) {
    try {
      const current = await Invoice.findById(invoiceId);
      if (!current) return { readFailed: false, stillOpen: false, reason: 'cancelled' };
      const balance = await PaymentService.computeInvoiceBalance(current);
      const cancelled = Boolean(current.cancellation?.state) || ['cancelled', 'credited'].includes(String(current.status || ''));
      const open = DUNNING_RECEIVABLE_STATUSES.includes(String(current.status || ''))
        && CalculationHelper.round(Number(balance?.open || 0)) > 0.009;
      const ownsLock = String(current.dunningLock?.token || '') === String(token);
      let reason = 'open';
      if (cancelled) reason = 'cancelled';
      else if (!open) reason = 'paid';
      else if (!ownsLock) reason = 'lock_lost';
      return { readFailed: false, stillOpen: !cancelled && open, reason };
    } catch (error) {
      console.error('FinancialService: Stand nach dem Mahnversand nicht lesbar:', error.message);
      return { readFailed: true, stillOpen: false, reason: 'unknown' };
    }
  }

  /**
   * EIN Mahnschritt fuer EINEN Beleg - die einzige Stelle, die eine Mahnstufe setzt.
   * Cron (runDunningJob), der vom Bearbeiter gestartete Lauf, ein gespeicherter Lauf
   * (executeDunningRun) und der Einzelschritt aus der Mahnliste laufen alle hierueber.
   *
   *  - Nur faellige Belege (describeDunningState.eligible) gehen genau EINE Stufe weiter.
   *  - Atomare Sperre am Beleg, gebunden an den gelesenen Stand (Stufe + Termin): ein
   *    paralleler Ausloeser findet einen veraenderten Stand vor und tut nichts -> nie zwei
   *    Mails, nie zwei Stufen.
   *  - Erfolg: Stufe, naechster Termin = heute + 7 Tage (das Faelligkeitsdatum bleibt
   *    eingefroren), Protokoll (Datum, Stufe, Empfaenger, Vorlage, Ergebnis, Betrag).
   *  - Fehler: protokolliert und am Beleg sichtbar (dunningLastFailure), Stufe und
   *    Termin bleiben -> der Schritt kann kontrolliert wiederholt werden.
   *
   * @returns {{outcome: 'sent'|'failed'|'skipped', message: string, invoiceId, invoiceNumber, stage?, stageLabel?}}
   */
  static async processDunningStep(invoiceId, options = {}) {
    const source = options.source === 'automatic' ? 'automatic' : 'manual';
    const now = options.now ? new Date(options.now) : new Date();
    const id = toIdString(invoiceId);
    const invoice = Types.ObjectId.isValid(id) ? await Invoice.findById(id) : null;
    if (!invoice) {
      return { outcome: 'skipped', message: 'Rechnung wurde nicht gefunden.', invoiceId: id, invoiceNumber: '' };
    }
    const skip = (message) => ({ outcome: 'skipped', message, invoiceId: id, invoiceNumber: invoice.invoiceNumber || '' });

    let balance = await PaymentService.computeInvoiceBalance(invoice);
    let state = FinancialService.describeDunningState(invoice, balance, now);
    const takeOverStaleLock = source === 'manual' && state.staleLock === true && now.getTime() >= new Date(state.nextEligibleDate || 0).getTime();
    if (!state.eligible && !takeOverStaleLock) return skip(state.reason || 'Nicht mahnbar.');

    const level = Number(invoice.dunningLevel || 0);
    const token = crypto.randomBytes(12).toString('hex');
    const lockFilter = {
      _id: invoice._id,
      status: { $in: DUNNING_RECEIVABLE_STATUSES },
      'cancellation.state': { $exists: false },
      dunningLevel: level === 0 ? { $in: [0, null] } : level,
      dunningStage: invoice.dunningStage && invoice.dunningStage !== 'none' ? invoice.dunningStage : { $in: ['none', null] },
      nextDunningDueDate: invoice.nextDunningDueDate ? invoice.nextDunningDueDate : { $in: [null] },
      ...(takeOverStaleLock
        ? { 'dunningLock.token': invoice.dunningLock.token }
        : { $or: [{ 'dunningLock.token': { $exists: false } }, { 'dunningLock.token': null }] }),
    };
    const locked = await Invoice.updateOne(lockFilter, { $set: { dunningLock: { token, at: now } } });
    if (locked.modifiedCount !== 1) return skip('Der Beleg wurde parallel bearbeitet – kein weiterer Mahnschritt.');

    const release = () => Invoice.updateOne({ _id: invoice._id, 'dunningLock.token': token }, { $unset: { dunningLock: '' } });
    let fresh;
    try {
      // Nach der Sperre neu lesen: eine Zahlung kann soeben eingegangen sein.
      fresh = await Invoice.findById(invoice._id);
      balance = await PaymentService.computeInvoiceBalance(fresh);
      state = FinancialService.describeDunningState({ ...fresh.toObject(), dunningLock: null }, balance, now);
      if (!state.eligible) {
        await release();
        return skip(state.reason || 'Nicht mehr mahnbar.');
      }
    } catch (error) {
      await release();
      throw error;
    }

    const stage = DUNNING_STAGES[level];
    // Empfaenger: die E-Mail am Beleg; ein Bearbeiter darf im Einzelschritt eine andere
    // Adresse angeben (z.B. Buchhaltung des Kunden) - sie wird protokolliert.
    const overrideRecipient = source === 'manual' ? String(options.recipientEmail || '').trim() : '';
    const recipient = (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(overrideRecipient) ? overrideRecipient : '') || String(fresh.customerEmail || '').trim();
    const templateName = EmailService.TRIGGER_TEMPLATE_MAP?.[stage.trigger] || stage.label;
    const nextDueDate = addDays(startOfLocalDay(now), DUNNING_INTERVAL_DAYS);
    const originalDueDate = fresh.originalDueDate || fresh.dueDate;
    const openAmount = CalculationHelper.round(Number(balance?.open || 0));
    const actorId = options.actorId || undefined;
    const actorName = String(options.actorName || '').slice(0, 80);

    let emailResult;
    if (!recipient) {
      emailResult = { success: false, error: 'Keine E-Mail-Adresse am Beleg hinterlegt.' };
    } else {
      try {
        emailResult = await EmailService.sendTriggerEmail(stage.trigger, recipient, {
          companyName: process.env.COMPANY_NAME || 'McRepair.de',
          customerName: fresh.customerName || 'Kunde',
          invoiceNumber: fresh.invoiceNumber,
          invoiceAmount: formatEuroDe(Math.abs(Number(fresh.total || 0))),
          amountOpen: formatEuroDe(openAmount),
          originalDueDate: new Date(originalDueDate).toLocaleDateString('de-DE'),
          dueDate: nextDueDate.toLocaleDateString('de-DE'),
          dunningStage: stage.label,
          invoiceUrl: await EmailService.buildSystemUrl(`/invoices?invoiceId=${fresh._id}`),
          customMessage: String(options.customMessage || '').trim().slice(0, 5000),
          supportEmail: process.env.SUPPORT_EMAIL || 'support@mcrepair.de',
          supportPhone: process.env.SUPPORT_PHONE || '+49 (0) 123/456789'
        });
      } catch (error) {
        emailResult = { success: false, error: error.message };
      }
    }

    const historyBase = {
      stage: stage.stage,
      executedAt: now,
      previousDueDate: fresh.nextDunningDueDate || originalDueDate,
      dunningRunId: options.runId || undefined,
      recipient,
      templateName,
      trigger: stage.trigger,
      amountOpen: openAmount,
      source,
      actorId,
    };

    if (emailResult?.success) {
      // Waehrend des Versands kann eine Zahlung eingegangen oder ein Storno eingeleitet
      // worden sein. Die Stufe wird deshalb nur uebernommen, wenn der Beleg JETZT noch
      // eine offene Forderung hat - geprueft im Lesezugriff UND in der Update-Bedingung.
      // Der Status wird nie aus dem vor dem Versand gelesenen Stand gesetzt.
      // Scheitert der Lesezugriff, wird die Stufe trotzdem ueber das bedingte Update
      // versucht (Status mahnbar, kein Storno, eigene Sperre): die Mail IST raus und muss
      // vermerkt werden, sonst verschickt der naechste Lauf dieselbe Stufe noch einmal.
      const afterSendState = await FinancialService.readDunningStateAfterSend(fresh._id, token);
      let advanced = { modifiedCount: 0 };
      let advanceError = null;
      if (afterSendState.readFailed || afterSendState.stillOpen) {
        try {
          advanced = await Invoice.updateOne(
            {
              _id: fresh._id,
              'dunningLock.token': token,
              status: { $in: DUNNING_RECEIVABLE_STATUSES },
              'cancellation.state': { $exists: false },
            },
            {
              $set: {
                dunningLevel: stage.level,
                dunningStage: stage.stage,
                dunningNotifiedAt: now,
                nextDunningDueDate: nextDueDate,
                originalDueDate,
              },
              $unset: { dunningLock: '', dunningLastFailure: '' },
              $push: {
                dunningHistory: { ...historyBase, nextDueDate, emailSentAt: now, result: 'sent' },
                auditTrail: { at: now, action: 'dunning_sent', actorId, actorName, detail: `${stage.label} an ${recipient} versendet (offen ${formatEuroDe(openAmount)}).` },
              },
            }
          );
        } catch (error) {
          advanceError = error;
        }
      }

      if (advanced.modifiedCount === 1) {
        // Nur ein noch nicht als ueberfaellig markierter Beleg wird es jetzt - bedingt auf
        // den AKTUELLEN Status, damit eine soeben verbuchte Zahlung nicht ueberschrieben wird.
        await Invoice.updateOne(
          { _id: fresh._id, status: { $in: ['sent', 'viewed'] }, 'cancellation.state': { $exists: false } },
          { $set: { status: 'overdue' } }
        );
        return {
          outcome: 'sent',
          message: `${stage.label} versendet.`,
          invoiceId: id,
          invoiceNumber: fresh.invoiceNumber || '',
          stage: stage.stage,
          stageLabel: stage.label,
          nextDunningDueDate: nextDueDate,
          amountOpen: openAmount,
        };
      }

      // Die Mail ist raus, die Stufe wurde nicht uebernommen. Den ECHTEN Grund ermitteln
      // (bezahlt, storniert, Sperre verloren) - ist er nicht feststellbar, bleibt die
      // eigene Sperre bestehen: der automatische Lauf uebernimmt sie nie, die Mahnliste
      // zeigt den Fall als "nicht abgeschlossen" zur Pruefung durch einen Bearbeiter.
      const reasonState = advanceError
        ? { reason: 'unknown' }
        : await FinancialService.readDunningStateAfterSend(fresh._id, token);
      // 'open' trotz nicht angewandter Stufe heisst: der Stand hat sich zwischen Lesen und
      // Schreiben erneut geaendert - nicht eindeutig, also wie 'unknown' behandeln.
      const reason = reasonState.reason === 'open' ? 'unknown' : reasonState.reason;
      const notApplied = {
        paid: 'Die Rechnung wurde während des Versands bezahlt.',
        cancelled: 'Die Rechnung wurde während des Versands storniert bzw. gutgeschrieben.',
        lock_lost: 'Die Bearbeitungssperre wurde während des Versands von einem anderen Vorgang übernommen.',
        unknown: 'Der Rechnungsstand konnte nach dem Versand nicht ermittelt werden. Die Sperre bleibt bestehen; bitte prüfen, bevor der Schritt erneut ausgelöst wird.',
      }[reason] || 'Die Rechnung wurde während des Versands bezahlt oder storniert.';
      try {
        await Invoice.updateOne(
          { _id: fresh._id },
          {
            $push: {
              dunningHistory: { ...historyBase, emailSentAt: now, result: 'sent', note: `Stufe nicht übernommen: ${notApplied}` },
              auditTrail: { at: now, action: 'dunning_sent', actorId, actorName, detail: `${stage.label} an ${recipient} versendet; Mahnstufe nicht erhöht. ${notApplied}` },
            },
          }
        );
      } catch (error) {
        console.error('FinancialService: Mahnversand konnte nicht protokolliert werden:', error.message);
      }
      // Nur bei eindeutigem Grund und nur die EIGENE Sperre freigeben.
      if (reason === 'paid' || reason === 'cancelled') {
        await Invoice.updateOne({ _id: fresh._id, 'dunningLock.token': token }, { $unset: { dunningLock: '' } });
      }
      return {
        outcome: 'sent',
        message: `${stage.label} wurde versendet, die Mahnstufe aber nicht erhöht: ${notApplied}`,
        invoiceId: id,
        invoiceNumber: fresh.invoiceNumber || '',
        stage: null,
        stageLabel: stage.label,
        stageApplied: false,
        ...(reason === 'unknown' ? { requiresReview: true } : {}),
        amountOpen: openAmount,
      };
    }

    const errorText = String(emailResult?.error || 'E-Mail-Versand fehlgeschlagen').slice(0, 500);
    await Invoice.updateOne(
      { _id: fresh._id, 'dunningLock.token': token },
      {
        $set: { dunningLastFailure: { at: now, stage: stage.stage, error: errorText }, originalDueDate },
        $unset: { dunningLock: '' },
        $push: {
          dunningHistory: { ...historyBase, emailError: errorText, result: 'failed' },
          auditTrail: { at: now, action: 'dunning_failed', actorId, actorName, detail: `${stage.label} an ${recipient || '-'} NICHT versendet: ${errorText}` },
        },
      }
    );
    return {
      outcome: 'failed',
      message: `${stage.label} wurde nicht versendet (E-Mail-Versand fehlgeschlagen). Die Mahnstufe wurde nicht erhöht; der Schritt kann erneut ausgelöst werden.`,
      error: errorText,
      invoiceId: id,
      invoiceNumber: fresh.invoiceNumber || '',
      stage: stage.stage,
      stageLabel: stage.label,
    };
  }

  /**
   * Mahnlauf ueber alle faelligen Belege. Einstieg fuer den Cron (server.js,
   * DUNNING_CRON_ENABLED) UND den vom Bearbeiter gestarteten Lauf - beide nutzen
   * processDunningStep, ein zweiter Lauf am selben Tag findet deshalb nichts mehr vor.
   */
  static async runDunningJob(options = {}) {
    console.log('FinancialService: Running dunning job');
    const source = options.source === 'manual' ? 'manual' : 'automatic';
    const now = new Date();

    const overdue = await FinancialService.getOverdueInvoices();
    // Faellige, noch nicht als ueberfaellig markierte Belege kennzeichnen (Faelligkeit
    // bleibt unveraendert; die Folgefrist steht separat in nextDunningDueDate).
    for (const entry of overdue) {
      if (['sent', 'viewed'].includes(entry.status) || !entry.originalDueDate) {
        await Invoice.updateOne(
          { _id: entry._id, status: entry.status },
          { $set: { ...(['sent', 'viewed'].includes(entry.status) ? { status: 'overdue' } : {}), originalDueDate: entry.originalDueDate || entry.dueDate } }
        );
      }
    }

    const eligible = overdue.filter((entry) => entry.dunning?.eligible);
    if (eligible.length === 0) {
      return { processed: overdue.length, actions: [], run: null, sent: 0, failed: 0, skipped: 0 };
    }

    const run = new DunningRun({
      name: `Mahnlauf ${now.toLocaleDateString('de-DE')}${source === 'automatic' ? ' (automatisch)' : ''}`,
      status: 'running',
      defaultStatus: 'overdue',
      defaultNote: source === 'automatic' ? 'Automatischer fristbasierter Mahnlauf' : 'Vom Bearbeiter gestarteter Mahnlauf',
      items: eligible.map((entry) => ({
        invoiceId: entry._id,
        invoiceNumber: entry.invoiceNumber,
        customerName: entry.customerName || '-',
        customerEmail: entry.customerEmail,
        dueDate: entry.dunning.originalDueDate,
        amountOpen: entry.dunning.openAmount,
        dunningLevel: Number(entry.dunningLevel || 0),
        status: 'processing'
      })),
      logs: [{ type: 'started', message: `Mahnlauf mit ${eligible.length} fälligen Fällen gestartet`, at: now, actorId: options.actorId || undefined }],
      createdBy: options.actorId || undefined
    });
    await run.save();

    const summary = await FinancialService.processDunningRunItems(run, { source, actorId: options.actorId, actorName: options.actorName });
    return { processed: overdue.length, run: summary.run, actions: summary.actions, sent: summary.sent, failed: summary.failed, skipped: summary.skipped };
  }

  // Gemeinsamer Teil fuer runDunningJob und executeDunningRun.
  static async processDunningRunItems(run, { source, actorId, actorName, customMessage = '' } = {}) {
    const actions = [];
    let sent = 0;
    let failed = 0;
    let skipped = 0;
    for (const item of run.items) {
      if (['sent', 'escalated'].includes(item.status) && run.$locals?.onlyOpen) continue;
      const result = await FinancialService.processDunningStep(item.invoiceId, { source, actorId, actorName, runId: run._id, customMessage });
      item.status = result.outcome === 'sent' ? 'sent' : (result.outcome === 'failed' ? 'failed' : 'skipped');
      item.note = result.message;
      item.lastActionAt = new Date();
      item.lastActionBy = actorId || undefined;
      if (result.outcome === 'sent') {
        sent += 1;
        item.dunningLevel = DUNNING_STAGES.find((entry) => entry.stage === result.stage)?.level || item.dunningLevel;
        item.amountOpen = result.amountOpen ?? item.amountOpen;
      } else if (result.outcome === 'failed') {
        failed += 1;
      } else {
        skipped += 1;
      }
      run.logs.push({ type: 'item_update', message: `${item.invoiceNumber}: ${result.message}`, invoiceId: item.invoiceId, actorId: actorId || undefined, at: new Date() });
      if (result.outcome !== 'skipped') {
        const invoice = await Invoice.findById(item.invoiceId).select('customerName customerEmail total').lean();
        actions.push({
          invoiceId: item.invoiceId,
          invoiceNumber: item.invoiceNumber,
          customerName: invoice?.customerName || item.customerName,
          customerEmail: invoice?.customerEmail || item.customerEmail,
          dunningLevel: item.dunningLevel,
          dunningStage: result.stage,
          outcome: result.outcome,
          amount: invoice?.total,
          amountOpen: result.amountOpen,
          action: result.message,
        });
      }
    }
    run.status = 'completed';
    run.logs.push({ type: 'completed', message: `${sent} versendet, ${failed} fehlgeschlagen, ${skipped} übersprungen`, at: new Date(), actorId: actorId || undefined });
    await run.save();
    return { run, actions, sent, failed, skipped };
  }

  /**
   * Gespeicherten Mahnlauf (Run-Builder) ausfuehren: jeder noch offene Fall geht ueber
   * processDunningStep - nicht faellige Faelle werden mit Grund uebersprungen, bereits
   * versendete nicht erneut angefasst. Wiederholbar (fehlgeschlagene Faelle).
   */
  static async executeDunningRun(runId, { actorId, actorName, customMessage = '' } = {}) {
    if (!Types.ObjectId.isValid(String(runId || ''))) throw buildFinancialError('Mahnlauf wurde nicht gefunden.', 404, 'DUNNING_RUN_NOT_FOUND');
    const run = await DunningRun.findById(runId);
    if (!run) throw buildFinancialError('Mahnlauf wurde nicht gefunden.', 404, 'DUNNING_RUN_NOT_FOUND');
    if (run.status === 'cancelled') throw buildFinancialError('Ein abgebrochener Mahnlauf kann nicht ausgeführt werden.', 409, 'DUNNING_RUN_CANCELLED');
    if (run.status === 'paused') throw buildFinancialError('Der Mahnlauf ist pausiert. Bitte zuerst fortsetzen.', 409, 'DUNNING_RUN_PAUSED');
    run.status = 'running';
    run.logs.push({ type: 'started', message: 'Mahnlauf ausgeführt', actorId: actorId || undefined, at: new Date() });
    run.$locals.onlyOpen = true;
    return FinancialService.processDunningRunItems(run, { source: 'manual', actorId, actorName, customMessage });
  }

  /**
   * Manuelle Uebergabe an das Inkasso - nur nach der Letzten Mahnung und nur mit echter
   * offener Forderung. Es wird KEIN externes Inkasso gestartet: nur Stufe, Mitteilung an
   * den Kunden und Protokoll. Scheitert die Mitteilung, bleibt die Stufe unveraendert.
   */
  static async activateCollection(invoiceId, userId, options = {}) {
    const id = toIdString(invoiceId);
    const invoice = Types.ObjectId.isValid(id) ? await Invoice.findById(id) : null;
    if (!invoice) throw buildFinancialError('Rechnung wurde nicht gefunden.', 404, 'INVOICE_NOT_FOUND');
    if (invoice.dunningStage === 'collection') return invoice;
    const balance = await PaymentService.computeInvoiceBalance(invoice);
    const state = FinancialService.describeDunningState(invoice, balance);
    if (!state.inList) {
      throw buildFinancialError(`Nur überfällige Rechnungen mit offener Forderung können an das Inkasso übergeben werden (${state.reason || 'nicht mahnbar'}).`, 409, 'COLLECTION_NOT_ALLOWED');
    }
    if (invoice.dunningStage !== 'final_notice') {
      throw buildFinancialError('Die Übergabe an das Inkasso ist erst nach der Letzten Mahnung möglich.', 409, 'COLLECTION_TOO_EARLY');
    }

    const now = new Date();
    const token = crypto.randomBytes(12).toString('hex');
    const locked = await Invoice.updateOne(
      { _id: invoice._id, dunningStage: 'final_notice', 'cancellation.state': { $exists: false }, $or: [{ 'dunningLock.token': { $exists: false } }, { 'dunningLock.token': null }] },
      { $set: { dunningLock: { token, at: now } } }
    );
    if (locked.modifiedCount !== 1) {
      throw buildFinancialError('Der Beleg wird gerade bearbeitet. Bitte die Ansicht neu laden.', 409, 'DUNNING_IN_PROGRESS');
    }
    const recipient = String(invoice.customerEmail || '').trim();
    const openAmount = CalculationHelper.round(Number(balance?.open || 0));
    let emailResult;
    try {
      emailResult = recipient
        ? await EmailService.sendTriggerEmail('collection_notice', recipient, {
          companyName: process.env.COMPANY_NAME || 'McRepair.de',
          customerName: invoice.customerName || 'Kunde',
          invoiceNumber: invoice.invoiceNumber,
          invoiceAmount: formatEuroDe(Math.abs(Number(invoice.total || 0))),
          amountOpen: formatEuroDe(openAmount),
          originalDueDate: new Date(invoice.originalDueDate || invoice.dueDate).toLocaleDateString('de-DE'),
          dueDate: '-',
          dunningStage: 'Inkasso',
          invoiceUrl: await EmailService.buildSystemUrl(`/invoices?invoiceId=${invoice._id}`),
          customMessage: String(options.customMessage || '').trim().slice(0, 5000),
          supportEmail: process.env.SUPPORT_EMAIL || 'support@mcrepair.de',
          supportPhone: process.env.SUPPORT_PHONE || '+49 (0) 123/456789'
        })
        : { success: false, error: 'Keine E-Mail-Adresse am Beleg hinterlegt.' };
    } catch (error) {
      emailResult = { success: false, error: error.message };
    }
    const historyBase = {
      stage: 'collection', executedAt: now, previousDueDate: invoice.nextDunningDueDate, recipient,
      templateName: EmailService.TRIGGER_TEMPLATE_MAP?.collection_notice || 'Inkasso', trigger: 'collection_notice',
      amountOpen: openAmount, source: 'manual', actorId: userId || undefined,
    };
    if (!emailResult?.success) {
      const errorText = String(emailResult?.error || 'E-Mail-Versand fehlgeschlagen').slice(0, 500);
      await Invoice.updateOne({ _id: invoice._id, 'dunningLock.token': token }, {
        $set: { dunningLastFailure: { at: now, stage: 'collection', error: errorText } },
        $unset: { dunningLock: '' },
        $push: { dunningHistory: { ...historyBase, emailError: errorText, result: 'failed' } },
      });
      throw buildFinancialError('Die Inkasso-Mitteilung konnte nicht versendet werden – die Stufe wurde nicht geändert. Bitte erneut versuchen.', 502, 'COLLECTION_NOTICE_FAILED');
    }
    // Wie im Mahnschritt: waehrend des Versands kann eine Zahlung oder ein Storno
    // eingegangen sein. Die Inkasso-Stufe gilt nur, wenn JETZT noch eine offene Forderung
    // besteht - geprueft im Lesezugriff UND in der Update-Bedingung. Bei einem Lesefehler
    // entscheidet allein das bedingte Update.
    const afterSendState = await FinancialService.readDunningStateAfterSend(invoice._id, token);
    let applied = { modifiedCount: 0 };
    let applyError = null;
    if (afterSendState.readFailed || afterSendState.stillOpen) {
      try {
        applied = await Invoice.updateOne({
          _id: invoice._id,
          'dunningLock.token': token,
          dunningStage: 'final_notice',
          status: { $in: DUNNING_RECEIVABLE_STATUSES },
          'cancellation.state': { $exists: false },
        }, {
          $set: { dunningLevel: 4, dunningStage: 'collection', nextDunningDueDate: null, dunningNotifiedAt: now },
          $unset: { dunningLock: '', dunningLastFailure: '' },
          $push: {
            dunningHistory: { ...historyBase, emailSentAt: now, result: 'sent' },
            auditTrail: { at: now, action: 'dunning_collection', actorId: userId || undefined, actorName: String(options.actorName || ''), detail: `An Inkasso übergeben (intern vermerkt, kein externer Auftrag). Offen ${formatEuroDe(openAmount)}.` },
          },
        });
      } catch (error) {
        applyError = error;
      }
    }
    if (applied.modifiedCount === 1) return Invoice.findById(invoice._id);

    // Mitteilung ist raus, die Stufe gilt nicht (mehr): protokollieren, eigene Sperre nur
    // bei eindeutigem Grund freigeben (sonst bleibt der Fall zur Pruefung gesperrt).
    const reasonState = applyError ? { reason: 'unknown' } : await FinancialService.readDunningStateAfterSend(invoice._id, token);
    const reason = reasonState.reason === 'open' ? 'unknown' : reasonState.reason;
    const notApplied = {
      paid: 'Die Rechnung wurde während des Versands bezahlt.',
      cancelled: 'Die Rechnung wurde während des Versands storniert bzw. gutgeschrieben.',
      lock_lost: 'Die Bearbeitungssperre wurde während des Versands von einem anderen Vorgang übernommen.',
      unknown: 'Der Rechnungsstand konnte nach dem Versand nicht ermittelt werden. Bitte den Beleg prüfen.',
    }[reason] || 'Die Rechnung wurde während des Versands bezahlt oder storniert.';
    try {
      await Invoice.updateOne({ _id: invoice._id }, {
        $push: {
          dunningHistory: { ...historyBase, emailSentAt: now, result: 'sent', note: `Stufe nicht übernommen: ${notApplied}` },
          auditTrail: { at: now, action: 'dunning_collection', actorId: userId || undefined, actorName: String(options.actorName || ''), detail: `Inkasso-Mitteilung an ${recipient} versendet; Übergabe nicht vermerkt. ${notApplied}` },
        },
      });
    } catch (error) {
      console.error('FinancialService: Inkasso-Mitteilung konnte nicht protokolliert werden:', error.message);
    }
    if (reason === 'paid' || reason === 'cancelled') {
      await Invoice.updateOne({ _id: invoice._id, 'dunningLock.token': token }, { $unset: { dunningLock: '' } });
    }
    throw buildFinancialError(
      `Die Inkasso-Mitteilung wurde versendet, die Übergabe an das Inkasso aber nicht vermerkt: ${notApplied}`,
      409,
      'COLLECTION_NOT_APPLIED'
    );
  }

  static async createDunningRun(payload = {}, userId) {
    const invoiceIds = Array.isArray(payload.invoiceIds) ? payload.invoiceIds : [];
    if (invoiceIds.length === 0) throw buildFinancialError('Bitte mindestens eine Rechnung für den Mahnlauf auswählen.', 400, 'DUNNING_RUN_EMPTY');

    const validIds = invoiceIds.map((id) => toIdString(id)).filter((id) => Types.ObjectId.isValid(id));
    const invoices = await Invoice.find({ _id: { $in: validIds } });
    if (invoices.length === 0) throw buildFinancialError('Die ausgewählten Rechnungen wurden nicht gefunden.', 404, 'INVOICE_NOT_FOUND');
    // Offener Betrag aus dem Saldo (nicht total - paidAmount).
    const balances = await PaymentService.getInvoiceBalances(invoices);

    const items = invoices.map((invoice) => ({
      invoiceId: invoice._id,
      invoiceNumber: invoice.invoiceNumber,
      customerName: invoice.customerName || '-',
      customerEmail: invoice.customerEmail,
      dueDate: invoice.originalDueDate || invoice.dueDate,
      amountOpen: CalculationHelper.round(Number(balances.get(toIdString(invoice._id))?.open || 0)),
      dunningLevel: invoice.dunningLevel || 0,
      status: 'pending',
      note: ''
    }));

    const run = new DunningRun({
      name: payload.name || `Mahnlauf ${new Date().toLocaleDateString('de-DE')}`,
      status: payload.status || 'draft',
      defaultStatus: payload.defaultStatus || 'overdue',
      defaultNote: payload.defaultNote || '',
      items,
      logs: [
        {
          type: 'created',
          message: `Mahnlauf mit ${items.length} Fällen erstellt`,
          actorId: userId || undefined
        }
      ],
      createdBy: userId || undefined
    });

    await run.save();
    return run;
  }

  static async getDunningRuns(filters = {}) {
    const query = {};
    if (filters.status) query.status = filters.status;
    return DunningRun.find(query).sort({ createdAt: -1 }).limit(100);
  }

  static async getDunningRunById(runId) {
    const run = await DunningRun.findById(runId);
    if (!run) throw buildFinancialError('Mahnlauf wurde nicht gefunden.', 404, 'DUNNING_RUN_NOT_FOUND');
    return run;
  }

  static async updateDunningRun(runId, updates = {}, userId) {
    const run = await DunningRun.findById(runId);
    if (!run) throw buildFinancialError('Mahnlauf wurde nicht gefunden.', 404, 'DUNNING_RUN_NOT_FOUND');

    if (typeof updates.name === 'string') run.name = updates.name;
    if (typeof updates.defaultNote === 'string') run.defaultNote = updates.defaultNote;
    if (typeof updates.defaultStatus === 'string') run.defaultStatus = updates.defaultStatus;
    if (typeof updates.status === 'string') run.status = updates.status;

    if (updates.logMessage) {
      run.logs.push({
        type: updates.logType || 'note',
        message: String(updates.logMessage),
        actorId: userId || undefined,
        at: new Date()
      });
    }

    await run.save();
    return run;
  }

  static async updateDunningRunItem(runId, invoiceId, updates = {}, userId) {
    const run = await DunningRun.findById(runId);
    if (!run) throw buildFinancialError('Mahnlauf wurde nicht gefunden.', 404, 'DUNNING_RUN_NOT_FOUND');

    const item = run.items.find((entry) => String(entry.invoiceId) === String(invoiceId));
    if (!item) throw buildFinancialError('Die Rechnung ist nicht Teil dieses Mahnlaufs.', 404, 'DUNNING_ITEM_NOT_FOUND');

    if (typeof updates.status === 'string') item.status = updates.status;
    if (typeof updates.note === 'string') item.note = updates.note;
    if (typeof updates.amountOpen === 'number') item.amountOpen = updates.amountOpen;

    item.lastActionAt = new Date();
    item.lastActionBy = userId || undefined;

    run.logs.push({
      type: 'item_update',
      message: updates.logMessage || `Fall ${item.invoiceNumber} aktualisiert`,
      invoiceId: item.invoiceId,
      actorId: userId || undefined,
      at: new Date()
    });

    await run.save();
    return run;
  }

  static async addDunningRunItem(runId, invoiceId, userId) {
    const run = await DunningRun.findById(runId);
    if (!run) throw buildFinancialError('Mahnlauf wurde nicht gefunden.', 404, 'DUNNING_RUN_NOT_FOUND');

    const alreadyExists = run.items.some((entry) => String(entry.invoiceId) === String(invoiceId));
    if (alreadyExists) return run;

    const invoice = Types.ObjectId.isValid(toIdString(invoiceId)) ? await Invoice.findById(invoiceId) : null;
    if (!invoice) throw buildFinancialError('Rechnung wurde nicht gefunden.', 404, 'INVOICE_NOT_FOUND');
    const balance = await PaymentService.computeInvoiceBalance(invoice);

    run.items.push({
      invoiceId: invoice._id,
      invoiceNumber: invoice.invoiceNumber,
      customerName: invoice.customerName || '-',
      customerEmail: invoice.customerEmail,
      dueDate: invoice.originalDueDate || invoice.dueDate,
      amountOpen: CalculationHelper.round(Number(balance?.open || 0)),
      dunningLevel: invoice.dunningLevel || 0,
      status: 'pending',
      note: 'Manuell hinzugefuegt',
      lastActionAt: new Date(),
      lastActionBy: userId || undefined
    });

    run.logs.push({
      type: 'item_update',
      message: `Fall ${invoice.invoiceNumber} zum Lauf hinzugefuegt`,
      invoiceId: invoice._id,
      actorId: userId || undefined,
      at: new Date()
    });

    await run.save();
    return run;
  }

  // Export payments as CSV or JSON
  static async exportPayments(filters = {}, format = 'csv') {
    const query = {};

    if (filters.status)  query.status  = filters.status;
    if (filters.method)  query.paymentMethod = filters.method;
    if (filters.dateFrom || filters.dateTo) {
      query.createdAt = {};
      if (filters.dateFrom) query.createdAt.$gte = new Date(filters.dateFrom);
      if (filters.dateTo)   query.createdAt.$lte = new Date(filters.dateTo);
    }

    const payments = await Payment.find(query).sort({ createdAt: -1 }).limit(10000);

    if (format === 'json') return payments;

    // CSV
    const headers = ['transactionId','customerName','amount','currency','paymentMethod','status','createdAt','invoiceId'];
    const rows = payments.map(p => [
      p.transactionId,
      p.customerName,
      p.amount.toFixed(2),
      p.currency,
      p.paymentMethod,
      p.status,
      p.createdAt ? p.createdAt.toISOString() : '',
      p.invoiceId || ''
    ]);

    return [headers, ...rows].map(r => r.join(',')).join('\n');
  }

  // Export invoices as CSV or JSON
  static async exportInvoices(filters = {}, format = 'csv') {
    const query = {};

    if (filters.status)     query.status    = filters.status;
    if (filters.customerId) query.customerId = filters.customerId;
    if (filters.isReverseCharge !== undefined && filters.isReverseCharge !== null && filters.isReverseCharge !== '') {
      query.isReverseCharge = filters.isReverseCharge === true || filters.isReverseCharge === 'true';
    }
    if (filters.zmRelevant !== undefined && filters.zmRelevant !== null && filters.zmRelevant !== '') {
      query.zmRelevant = filters.zmRelevant === true || filters.zmRelevant === 'true';
    }
    if (filters.dateFrom || filters.dateTo) {
      query.createdAt = {};
      if (filters.dateFrom) query.createdAt.$gte = new Date(filters.dateFrom);
      if (filters.dateTo)   query.createdAt.$lte = new Date(filters.dateTo);
    }

    const invoices = await Invoice.find(query).sort({ createdAt: -1 }).limit(10000);

    if (format === 'json') return invoices;

    // CSV with tax breakdown & reverse charge data
    const headers = [
      'invoiceNumber',
      'customerName',
      'customerEmail',
      'customerVatId',
      'sellerVatId',
      'isReverseCharge',
      'reverseChargeNotice',
      'zmRelevant',
      'subtotal',
      'tax',
      'discount',
      'total',
      'paidAmount',
      'status',
      'dueDate',
      'createdAt',
      'isCreditNote'
    ];
    const rows = invoices.map(inv => [
      inv.invoiceNumber,
      inv.customerName,
      inv.customerEmail,
      inv.customerVatId || '',
      inv.sellerVatId || '',
      inv.isReverseCharge ? '1' : '0',
      `"${(inv.reverseChargeNotice || '').replace(/"/g, '""')}"`,
      inv.zmRelevant ? '1' : '0',
      inv.subtotal.toFixed(2),
      inv.tax.toFixed(2),
      inv.discount.toFixed(2),
      inv.total.toFixed(2),
      (inv.paidAmount || 0).toFixed(2),
      inv.status,
      inv.dueDate ? inv.dueDate.toISOString().split('T')[0] : '',
      inv.createdAt ? inv.createdAt.toISOString() : '',
      inv.isCreditNote ? '1' : '0'
    ]);

    return [headers, ...rows].map(r => r.join(',')).join('\n');
  }

  /**
   * Automatisches Zuordnen unzugeordneter Zahlungen zu offenen Rechnungen eines Auftrags
   */
  /**
   * Ordnet bereits eingegangenes, noch nicht zugeordnetes Geld den offenen Rechnungen
   * einer Buchung zu (typischer Fall: PayPal-Vorauszahlung, Rechnung entsteht spaeter).
   *
   * ZUORDNUNGSREGEL (verbindlich):
   *  - Kandidaten sind alle Zahlungen der Buchung im Status 'completed', abzueglich
   *    Erstattungen und bereits zugeordneter Betraege.
   *  - Zielrechnungen sind offene Forderungen im Status sent/viewed/partially_paid/
   *    overdue. Entwuerfe, Belege in Freigabe und Gutschriften bleiben ausgeschlossen -
   *    eine Zuordnung darf keinen Beleg an der Freigabe vorbei auf 'paid' setzen.
   *  - Reihenfolge ist FIFO: aelteste Faelligkeit zuerst, danach aeltestes Anlagedatum.
   *    Bei MEHREREN offenen Rechnungen wird NICHT alles auf die erste gebucht: jede
   *    Rechnung bekommt hoechstens ihren offenen Betrag, der Rest wandert weiter.
   *  - Ein verbleibender Rest bleibt bewusst nicht zugeordnet (sichtbar als
   *    `unallocatedTotal`) und wird nicht als Ueberzahlung auf eine Rechnung gebucht.
   *
   * Mehrfachaufrufe (wiederholter Webhook, erneute Rechnungserstellung, parallele
   * Laeufe) koennen dasselbe Geld nicht doppelt zaehlen: der bereits zugeordnete
   * Betrag wird jedes Mal neu aus den PaymentAllocation-Zeilen gelesen und die
   * eigentliche Buchung laeuft ueber ein bedingtes Update auf der Zahlung
   * (PaymentService.allocateAtomically).
   */
  static async autoAllocateUnallocatedPayments(bookingId) {
    if (!bookingId) return null;
    try {
      const BookingPaymentService = require('./bookingPaymentService');
      const { booking, orders, invoices } = await BookingPaymentService.loadContext(bookingId);

      // Achtung: loadContext liefert ROHE lean-Dokumente. Das frueher hier gepruefte
      // `inv.isOpen` gibt es dort nicht (es entsteht erst in getOverview), weshalb
      // diese Funktion an jeder Aufrufstelle wirkungslos war. Die Offenheit wird
      // deshalb aus dem Belegstatus selbst bestimmt.
      const openInvoices = PaymentService.sortOpenInvoicesFifo(invoices || []);
      if (openInvoices.length === 0) return { allocated: 0, allocations: [] };

      const orderIds = (orders || []).map((order) => order._id);
      const matchConditions = [{ bookingId: booking._id }];
      if (invoices.length > 0) matchConditions.push({ invoiceId: { $in: invoices.map((invoice) => invoice._id) } });
      if (orderIds.length > 0) matchConditions.push({ orderId: { $in: orderIds } });

      const payments = await Payment.find({ $or: matchConditions, status: 'completed' })
        .sort({ paymentDate: 1, createdAt: 1 });

      // Offener Betrag je Rechnung aus den GUELTIGEN Zuordnungen, nicht aus dem
      // denormalisierten paidAmount - sonst wuerde ein Altbestands-Fehler fortgeschrieben.
      // Dieselbe Berechnung wie ueberall: Forderung (Brutto minus wertmindernde
      // Gutschriften) minus gueltige Zuordnungen.
      const openBalances = await PaymentService.getInvoiceBalances(openInvoices, { bookingCap: false });
      const openAmountByInvoice = new Map(openInvoices.map((invoice) => [
        String(invoice._id),
        CalculationHelper.round(Number(openBalances.get(String(invoice._id))?.open || 0)),
      ]));

      const touchedInvoiceIds = new Set();
      const performed = [];
      let allocatedSum = 0;

      for (const payment of payments) {
        const existingAllocations = await PaymentAllocation.find({ paymentId: payment._id }).select('allocatedAmount').lean();
        const alreadyAllocated = CalculationHelper.round(
          existingAllocations.reduce((sum, entry) => sum + Number(entry.allocatedAmount || 0), 0)
        );
        // Erstattungen mindern den zuordenbaren Betrag.
        const effectiveAmount = CalculationHelper.round(
          Math.max(0, Number(payment.amount || 0) - Number(payment.refundAmount || 0))
        );
        let remaining = CalculationHelper.round(effectiveAmount - alreadyAllocated);
        if (remaining <= 0.009) continue;

        payment.allocatedAmount = alreadyAllocated;

        for (const invoiceSummary of openInvoices) {
          if (remaining <= 0.009) break;
          const invoiceKey = String(invoiceSummary._id);
          const invoiceOpen = Number(openAmountByInvoice.get(invoiceKey) || 0);
          if (invoiceOpen <= 0.009) continue;

          const invoice = await Invoice.findById(invoiceSummary._id);
          if (!invoice) continue;
          // Zwischenzeitlicher Statuswechsel (z.B. storniert) beendet die Zuordnung.
          if (!PaymentService.ALLOCATABLE_INVOICE_STATUSES.includes(String(invoice.status || ''))) {
            openAmountByInvoice.set(invoiceKey, 0);
            continue;
          }

          const allocatable = CalculationHelper.round(Math.min(remaining, invoiceOpen));
          const result = await PaymentService.allocateAtomically({
            payment,
            invoice,
            amount: allocatable,
            note: `Automatische Zuordnung (${invoice.invoiceNumber || invoice._id})`,
            orderId: toIdString(invoice.orderId) || toIdString(payment.orderId) || undefined,
            allowPartial: true,
          });

          if (!result) {
            // Rennen verloren: ein paralleler Lauf hat diese Zahlung bereits gebucht.
            console.warn('FinancialService: concurrent allocation detected, skipping payment', String(payment._id));
            break;
          }

          remaining = CalculationHelper.round(remaining - allocatable);
          openAmountByInvoice.set(invoiceKey, CalculationHelper.round(invoiceOpen - allocatable));
          allocatedSum = CalculationHelper.round(allocatedSum + allocatable);
          touchedInvoiceIds.add(invoiceKey);
          performed.push({
            paymentId: String(payment._id),
            invoiceId: invoiceKey,
            invoiceNumber: invoice.invoiceNumber || '',
            amount: allocatable,
          });
        }
      }

      for (const invoiceId of touchedInvoiceIds) {
        const invoice = await Invoice.findById(invoiceId);
        if (invoice) await FinancialService.syncPaymentDerivedState(invoice, 'autoAllocate');
      }
      if (touchedInvoiceIds.size === 0) {
        // Auch ohne neue Zuordnung muss der Buchungsstand stimmen.
        await FinancialService.applyBookingPaymentState(booking._id).catch((error) => {
          console.error('FinancialService: booking payment state not updated (autoAllocate):', error);
        });
      }

      return { allocated: allocatedSum, allocations: performed };
    } catch (error) {
      console.error('FinancialService: Error in autoAllocateUnallocatedPayments:', error.message);
      return null;
    }
  }

  /**
   * Synchronisiert Auftragswertänderungen (Order/Booking) mit Rechnung, Zahlungen & Mahnstatus
   */
  static async syncOrderAndBookingValue(targetId, targetType = 'booking') {
    try {
      let bookingId = null;
      let orderId = null;
      const rawId = String(targetId || '').trim();
      const cleanId = rawId.replace(/^#/, '').trim();

      if (targetType === 'order') {
        let order = null;
        if (Types.ObjectId.isValid(rawId)) {
          order = await Order.findById(rawId);
        }
        if (!order && cleanId) {
          order = await Order.findOne({
            $or: [
              { orderNumber: cleanId },
              { orderNumber: `#${cleanId}` },
              { orderNumber: { $regex: new RegExp(`^#?${cleanId}$`, 'i') } }
            ]
          });
        }
        if (order) {
          orderId = order._id;
          bookingId = order.bookingId;
        }
      } else {
        let booking = null;
        if (Types.ObjectId.isValid(rawId)) {
          booking = await Booking.findById(rawId);
        }
        if (!booking && cleanId) {
          booking = await Booking.findOne({
            $or: [
              { bookingNumber: cleanId },
              { bookingNumber: `#${cleanId}` },
              { bookingNumber: { $regex: new RegExp(`^#?${cleanId}$`, 'i') } }
            ]
          });
        }
        if (!booking && cleanId) {
          const order = await Order.findOne({
            $or: [
              { orderNumber: cleanId },
              { orderNumber: `#${cleanId}` },
              { orderNumber: { $regex: new RegExp(`^#?${cleanId}$`, 'i') } }
            ]
          });
          if (order && order.bookingId) {
            booking = await Booking.findById(order.bookingId);
            orderId = order._id;
          }
        }
        if (booking) {
          bookingId = booking._id;
        }
      }

      if (!bookingId && !orderId) return { ok: true, skipped: 'target_not_found' };

      let booking = null;
      if (bookingId) {
        booking = await Booking.findById(bookingId);
        if (booking) {
          const orders = await Order.find({ bookingId: booking._id }).lean();
          if (orders.length > 0) {
            const sumOrders = orders.reduce((sum, o) => sum + Number(o.totalCost || 0), 0);
            booking.totalCost = CalculationHelper.round(sumOrders);
            await booking.save();
          }
        }
      }

      const invoiceQuery = [];
      if (bookingId) invoiceQuery.push({ bookingId });
      if (orderId) invoiceQuery.push({ orderId }, { repairOrderIds: orderId });

      const invoices = await Invoice.find({ $or: invoiceQuery }).sort({ createdAt: -1 });
      if (!invoices || invoices.length === 0) return { ok: true, invoiceUpdated: false };

      const mainInvoice = invoices.find(inv => !inv.isCreditNote) || invoices[0];
      let newOrderValue = booking ? Number(booking.totalCost || 0) : null;
      if (newOrderValue === null && orderId) {
        const order = await Order.findById(orderId).select('totalCost').lean();
        newOrderValue = Number(order?.totalCost || 0);
      }
      if (newOrderValue === null) {
        newOrderValue = Number(mainInvoice.total || 0);
      }

      const mutableStatuses = ['draft', 'pending_approval', 'sent', 'viewed', 'partially_paid', 'overdue'];
      if (mutableStatuses.includes(mainInvoice.status)) {
        if (booking) {
          // Positionen mit echten Service-/Produktnamen und Geraetekennzeichnung neu
          // aufbauen. Die Positionssumme kann bei einem Buchungsrabatt bewusst vom
          // autoritativen Brutto-Gesamtbetrag unten abweichen.
          const orders = await findOrdersForInvoiceItems({ bookingId: booking._id });
          const bookingItemByOrderId = new Map();
          (booking.items || []).forEach((bookingItem) => {
            if (bookingItem?.orderId) bookingItemByOrderId.set(String(bookingItem.orderId), bookingItem);
          });

          const items = [];
          orders.forEach((o) => {
            const bookingItem = bookingItemByOrderId.get(String(o._id));
            buildInvoiceItemsFromOrder(o, { deviceLabel: bookingItem?.device })
              .forEach((item) => items.push(item));
          });
          if (items.length > 0) {
            mainInvoice.items = items;
          }
        }

        // Autoritatives BRUTTO; Netto und MwSt rechnet das Invoice-Modell heraus.
        mainInvoice.total = CalculationHelper.round(newOrderValue);

        // Gueltige Zuordnungen (erstattetes Geld gekappt), nicht die rohe Zeilensumme.
        const allocatedTotals = await PaymentService.getAllocatedTotalsByInvoice([mainInvoice._id]);
        const paidAmount = CalculationHelper.round(Number(allocatedTotals.get(String(mainInvoice._id)) || 0));
        const creditedTotals = await PaymentService.getValueCreditedByInvoice([mainInvoice._id]);
        mainInvoice.paidAmount = paidAmount;

        // Betrag und Positionen werden auch im Entwurf fortgeschrieben, der
        // BELEGSTATUS aber nur, wenn der Beleg die Freigabe hinter sich hat -
        // 'draft'/'pending_approval' bleiben, wo sie sind (gleicher Schutz und dieselbe
        // Regel wie in recalculateInvoicePaidAmounts und PaymentService.allocateAtomically).
        if (PAYMENT_DERIVED_STATUS_WRITABLE.includes(String(mainInvoice.status || ''))) {
          const derived = PaymentService.resolvePaymentDerivedStatus({
            status: mainInvoice.status,
            total: mainInvoice.total,
            credited: Number(creditedTotals.get(String(mainInvoice._id)) || 0),
            paidAmount,
            paidAt: mainInvoice.paidAt,
            dueDate: mainInvoice.dueDate,
          });
          if (derived.status === 'paid') mainInvoice.nextDunningDueDate = undefined;
          else if (!derived.status && paidAmount <= 0.009) {
            derived.status = mainInvoice.dueDate && new Date(mainInvoice.dueDate) < new Date() ? 'overdue' : 'sent';
            derived.paidAt = null;
          }
          Object.assign(mainInvoice, derived);
        }

        await mainInvoice.save();
        await FinancialService.syncPaymentDerivedState(mainInvoice, 'syncOrderAndBookingValue');
      } else if (['paid', 'credited'].includes(mainInvoice.status)) {
        const currentInvoiceTotal = Number(mainInvoice.total || 0);
        const diff = CalculationHelper.round(newOrderValue - currentInvoiceTotal);
        // Bereits gutgeschriebene Minderungen abziehen, sonst erzeugt jeder weitere
        // Sync dieselbe Korrektur noch einmal.
        const alreadyCredited = await FinancialService.getCreditedTotal(mainInvoice._id, { valueAdjustmentsOnly: true });
        const outstandingReduction = CalculationHelper.round(Math.abs(Math.min(0, diff)) - alreadyCredited);
        if (diff < -0.01 && outstandingReduction > 0.01) {
          await FinancialService.createCreditNote(mainInvoice._id, {
            reason: `Automatische Korrekturrechnung wegen Auftragswertminderung (-EUR ${outstandingReduction.toFixed(2)})`,
            correctionType: 'price_adjustment',
            discount: 0,
            items: [{
              serviceName: 'Auftragswertanpassung',
              description: 'Auftragswertanpassung (Minderung)',
              quantity: 1,
              unitPrice: outstandingReduction,
              total: outstandingReduction,
              type: 'fee'
            }]
          });
        }
      }
      return { ok: true, invoiceUpdated: true };
    } catch (error) {
      // NICHT verschlucken: die Aufrufer (Auftragsbearbeitung, Geraetewechsel, Route)
      // machen daraus eine sichtbare deutsche Warnung. Frueher blieb ein echter
      // Abgleichsfehler unsichtbar und Rechnung/Buchung liefen still auseinander.
      console.error('FinancialService: Error in syncOrderAndBookingValue:', error);
      return { ok: false, error: String(error?.message || 'unbekannter Fehler') };
    }
  }

  /**
   * Ueberzahlung einer Buchung bearbeiten.
   *
   * DREI GETRENNTE VORGAENGE, die hier nie vermischt werden:
   *   1. Erstattung      - Geld geht an den Kunden zurueck (processRefund).
   *   2. Belegkorrektur  - eine Gutschrift mindert die Forderung (createCreditNote).
   *   3. Zuordnung       - Geld wird einer Rechnung zugeordnet oder davon geloest.
   *
   * Frueher erzeugte der Ueberzahlungsausgleich IMMER eine Gutschrift und erstattete
   * zusaetzlich: eine korrekte 50-EUR-Rechnung bekam eine 50-EUR-Gutschrift, der
   * Auftrag sprang auf "erstattet" - dieselbe Differenz wurde zweimal abgezogen.
   * Eine Ueberzahlung aendert keinen Beleg; sie wird erstattet oder bleibt als
   * Guthaben (nicht zugeordnet, "Erstattung offen") sichtbar stehen.
   *
   * Der Betrag ist immer auf die tatsaechliche Ueberzahlung gekappt - ein zweiter
   * Klick mit dem vorbelegten Betrag erstattet nichts mehr.
   */
  static async handleOverpayment(bookingId, options = {}) {
    const BookingPaymentService = require('./bookingPaymentService');
    const overview = await BookingPaymentService.getOverview(bookingId);
    // overpaidTotal ist bereits gegen die richtige Bezugsgroesse (Forderungen plus
    // noch nicht berechnete Auftraege, ersatzweise Auftragswert) gerechnet.
    // Bereits beim Anbieter angestossene (noch ausstehende) Erstattungen werden
    // abgezogen, damit dieselbe Ueberzahlung nicht zweimal erstattet wird.
    const calculatedOverpaid = CalculationHelper.round(Math.max(0, Number(
      overview.summary.refundPendingTotal ?? overview.summary.overpaidTotal ?? 0
    )));

    if (calculatedOverpaid <= 0.009) {
      return {
        isOverpaid: false,
        overpaidAmount: 0,
        creditNote: null,
        refundResult: null,
        message: 'Für diese Buchung besteht keine (weitere) Überzahlung – es wurde nichts erstattet.',
      };
    }

    let overpaidAmount = calculatedOverpaid;
    if (options.amount != null && String(options.amount).trim() !== '') {
      const requested = CalculationHelper.round(Number(options.amount));
      if (!Number.isFinite(requested) || requested <= 0) {
        throw buildFinancialError('Der Erstattungsbetrag muss größer als 0 sein.', 400, 'INVALID_AMOUNT');
      }
      if (requested > calculatedOverpaid + 0.01) {
        throw buildFinancialError(
          `Der Betrag (${formatEuroDe(requested)}) übersteigt die tatsächliche Überzahlung (${formatEuroDe(calculatedOverpaid)}).`,
          400,
          'AMOUNT_EXCEEDS_OVERPAYMENT'
        );
      }
      overpaidAmount = requested;
    }

    if (!options.processRefund) {
      return {
        isOverpaid: true,
        overpaidAmount: calculatedOverpaid,
        creditNote: null,
        refundResult: null,
        message: `Überzahlung von ${formatEuroDe(calculatedOverpaid)} bleibt als Guthaben stehen (Erstattung offen). `
          + 'Es wurde weder eine Gutschrift erstellt noch Geld erstattet.',
      };
    }

    // Erstattet wird ausschliesslich NICHT zugeordnetes Geld - so bleibt jede
    // Rechnung, die korrekt bezahlt ist, bezahlt. Groesster freier Rest zuerst.
    const candidates = (overview.payments || [])
      .filter((payment) => payment.status === 'completed' && Number(payment.unallocatedAmount || 0) > 0.009)
      .sort((a, b) => Number(b.unallocatedAmount || 0) - Number(a.unallocatedAmount || 0));

    const refundMode = options.refundMode === 'gateway' ? 'gateway' : 'manual';
    const reason = String(options.reason || '').trim() || `Erstattung Überzahlung (${formatEuroDe(overpaidAmount)})`;
    const refunds = [];
    let remaining = overpaidAmount;
    for (const candidate of candidates) {
      if (remaining <= 0.009) break;
      const part = CalculationHelper.round(Math.min(remaining, Number(candidate.unallocatedAmount || 0)));
      if (part <= 0.009) continue;
      const refund = await FinancialService.processRefund(String(candidate._id), part, reason, {
        mode: refundMode,
        recordedBy: options.recordedBy,
        // Ein wiederholter Klick mit demselben Stand trifft denselben Schluessel.
        idempotencyKey: `overpayment:${toIdString(overview.booking?._id)}:${toIdString(candidate._id)}:${part.toFixed(2)}:${CalculationHelper.round(Number(candidate.refundAmount || 0)).toFixed(2)}`,
      });
      refunds.push(refund);
      if (refund.status === 'completed' || refund.status === 'pending') remaining = CalculationHelper.round(remaining - part);
    }

    if (refunds.length === 0 || remaining > 0.009) {
      const refundedSoFar = CalculationHelper.round(overpaidAmount - remaining);
      throw buildFinancialError(
        refunds.length === 0
          ? 'Es gibt keine Zahlung mit nicht zugeordnetem Betrag, aus der erstattet werden kann. '
            + 'Bitte prüfen Sie die Zuordnungen der Buchung.'
          : `Es konnten nur ${formatEuroDe(refundedSoFar)} aus nicht zugeordneten Zahlungen erstattet werden.`,
        409,
        'NO_REFUNDABLE_PAYMENT'
      );
    }

    const pending = refunds.some((refund) => refund.status === 'pending');
    return {
      isOverpaid: true,
      overpaidAmount,
      creditNote: null,
      refundResult: refunds.length === 1 ? refunds[0] : refunds,
      refunds,
      refundStatus: pending ? 'pending' : 'completed',
      message: pending
        ? `Erstattung über ${formatEuroDe(overpaidAmount)} wurde beim Zahlungsanbieter angestoßen und ist noch ausstehend. Sie zählt erst nach Bestätigung.`
        : `Erstattung über ${formatEuroDe(overpaidAmount)} wurde erfasst. Die Rechnung bleibt unverändert.`,
    };
  }

  /**
   * Ziel einer Zahlungsaufforderung aufloesen. Reihenfolge:
   *   1. Rechnungsnummer (auch Altformate/weiche Trennzeichen) bzw. Rechnungs-ID ->
   *      genau diese Rechnung, offener Betrag dieser Rechnung. Funktioniert auch fuer
   *      Rechnungen OHNE Buchung.
   *   2. Buchungs-/Auftragsnummer bzw. -ID -> die Buchung, offener Vorgangsbetrag.
   */
  static async resolvePaymentRequestTarget(identifier) {
    const BookingPaymentService = require('./bookingPaymentService');
    const invoice = await BookingPaymentService.findInvoiceByIdentifier(identifier);
    if (invoice && !invoice.isCreditNote) {
      const booking = invoice.bookingId
        ? await Booking.findById(invoice.bookingId).setOptions({ skipAutoPopulate: true }).lean()
        : null;
      return { targetType: 'invoice', invoice, booking, invoices: [invoice] };
    }
    const { booking, invoices } = await BookingPaymentService.loadContext(identifier);
    return { targetType: 'booking', invoice: null, booking, invoices };
  }

  /**
   * Sendet eine Zahlungsaufforderung fuer eine offene Restforderung.
   *
   * KANAL: ausschliesslich E-MAIL. Es gibt keine PayPal-Zahlungsanforderung ueber die
   * PayPal-API in diesem System. Die E-Mail enthaelt den Link zur Rechnung; dort kann
   * der Kunde (angemeldet) u.a. per PayPal bezahlen. Das wird in Antwort und Historie
   * ausdruecklich so benannt.
   *
   * Der im Dialog geschriebene Hinweistext wird ueber die Vorlage
   * 'Allgemeine Systemnachricht' versendet, die einen Platzhalter fuer freien Text hat
   * ({{notificationBody}}). Nur wenn diese Vorlage fehlt, wird ersatzweise die
   * Zahlungserinnerung ohne Hinweistext versendet - und das ehrlich protokolliert.
   *
   * Es wird NIEMALS Erfolg gemeldet, ohne dass der Mailserver die Nachricht
   * tatsaechlich angenommen hat - und Annahme ist keine Zustellbestaetigung. Eine
   * versendete Aufforderung ist auch kein Zahlungseingang. Jeder Versuch (auch der
   * fehlgeschlagene und der ohne Empfaenger) wird als PaymentRequest protokolliert.
   */
  static async requestAdditionalPayment(identifier, options = {}, actor = null) {
    const PaymentRequest = require('../models/PaymentRequest');
    const BookingPaymentService = require('./bookingPaymentService');

    const target = await FinancialService.resolvePaymentRequestTarget(identifier);
    const { booking, targetType } = target;

    let openBalance = 0;
    let mainInvoice = null;
    if (targetType === 'invoice') {
      mainInvoice = target.invoice;
      const balance = await PaymentService.computeInvoiceBalance(mainInvoice);
      openBalance = CalculationHelper.round(Number(balance?.open || 0));
    } else {
      const overview = await BookingPaymentService.getOverview(String(booking._id));
      openBalance = CalculationHelper.round(Number(overview.summary.openOrderBalance || 0));
      mainInvoice = PaymentService.sortOpenInvoicesFifo(target.invoices || [])[0]
        || (target.invoices || []).find((invoice) => !invoice.isCreditNote)
        || null;
    }

    const customerId = toIdString(booking?.customerId) || toIdString(mainInvoice?.customerId);
    const customer = customerId ? await User.findById(customerId).lean() : null;
    const recipientEmail = String(customer?.email || booking?.guestInfo?.email || mainInvoice?.customerEmail || '').trim();
    const recipientName = customer
      ? `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || customer.name || ''
      : `${booking?.guestInfo?.firstName || ''} ${booking?.guestInfo?.lastName || ''}`.trim() || mainInvoice?.customerName || '';

    const note = String(options.note || '').trim().slice(0, 2000);

    if (openBalance <= 0.009) {
      // Kein Fehler, aber auch kein Versand - und deshalb auch kein "erfolgreich".
      return {
        success: false,
        status: 'no_open_balance',
        openBalance: 0,
        targetType,
        message: targetType === 'invoice'
          ? `Für Rechnung ${mainInvoice?.invoiceNumber || ''} ist kein Betrag mehr offen.`
          : 'Keine offene Restforderung vorhanden.',
      };
    }

    // Angeforderter Betrag: honoriert und gegen den offenen Betrag geprueft.
    let amount = openBalance;
    if (options.amount != null && String(options.amount).trim() !== '') {
      const requested = CalculationHelper.round(Number(options.amount));
      if (!Number.isFinite(requested) || requested <= 0) {
        throw buildFinancialError('Der angeforderte Betrag muss größer als 0 sein.', 400, 'INVALID_AMOUNT');
      }
      if (requested > openBalance + 0.01) {
        throw buildFinancialError(
          `Der angeforderte Betrag (${formatEuroDe(requested)}) übersteigt den offenen Betrag (${formatEuroDe(openBalance)}).`,
          400,
          'AMOUNT_EXCEEDS_OPEN'
        );
      }
      amount = requested;
    }

    const paymentLink = mainInvoice
      ? await EmailService.buildSystemUrl(`/invoices?invoiceId=${mainInvoice._id}`)
      : await EmailService.buildSystemUrl('/invoices');

    const baseRecord = {
      bookingId: booking?._id || undefined,
      bookingNumber: booking?.bookingNumber || '',
      targetType,
      invoiceId: mainInvoice?._id,
      invoiceNumber: mainInvoice?.invoiceNumber || '',
      orderId: toIdString(mainInvoice?.orderId) || undefined,
      openBalanceAtRequest: Math.max(0, openBalance),
      channel: 'email',
      paymentLink,
      recipientEmail,
      recipientName,
      note,
      requestedBy: actor?._id || undefined,
      requestedByName: actor ? `${actor.firstName || ''} ${actor.lastName || ''}`.trim() || actor.email || '' : '',
      requestedAt: new Date(),
      resendOfId: options.resendOfId || undefined,
    };

    if (!recipientEmail) {
      // Laut scheitern statt still "erfolgreich" zu melden.
      const record = await PaymentRequest.create({
        ...baseRecord,
        amount,
        status: 'skipped_no_recipient',
        error: 'Keine E-Mail-Adresse hinterlegt.',
      });
      return {
        success: false,
        status: 'skipped_no_recipient',
        requestId: String(record._id),
        openBalance,
        amount,
        targetType,
        recipientEmail: '',
        message: 'Es ist keine E-Mail-Adresse hinterlegt – es wurde nichts gesendet.',
      };
    }

    const documentLabel = mainInvoice?.invoiceNumber || booking?.bookingNumber || '-';
    const dueDateLabel = mainInvoice?.dueDate ? new Date(mainInvoice.dueDate).toLocaleDateString('de-DE') : 'sofort';
    const amountLabel = `EUR ${amount.toFixed(2)}`;
    const escapedNote = note
      ? note.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/\n/g, '<br />')
      : '';
    const notificationBody = [
      `Für ${mainInvoice?.invoiceNumber ? `die Rechnung ${mainInvoice.invoiceNumber}` : 'Ihren Auftrag'} ist noch ein Betrag von <strong>${amountLabel}</strong> offen (fällig: ${dueDateLabel}).`,
      escapedNote,
      'Über den Button gelangen Sie zu Ihrer Rechnung und können den Betrag dort begleichen.',
    ].filter(Boolean).join('<br /><br />');

    const variables = {
      companyName: process.env.COMPANY_NAME || 'McRepair.de',
      customerName: recipientName || 'Kunde',
      invoiceNumber: documentLabel,
      openAmount: amountLabel,
      // Vorlage 'Allgemeine Systemnachricht' (traegt den Hinweistext).
      notificationTitle: `Zahlungsaufforderung zu ${mainInvoice?.invoiceNumber ? `Rechnung ${mainInvoice.invoiceNumber}` : `Auftrag ${documentLabel}`}`,
      notificationPreview: `Offener Betrag ${amountLabel}`,
      notificationTopic: `${mainInvoice?.invoiceNumber ? `Rechnung ${mainInvoice.invoiceNumber}` : `Auftrag ${documentLabel}`} – offener Betrag ${amountLabel}`,
      notificationBody,
      notificationDate: new Date().toLocaleDateString('de-DE'),
      effectiveDate: dueDateLabel,
      ctaLabel: 'Rechnung ansehen und bezahlen',
      ctaUrl: paymentLink,
      // Variablennamen der Zahlungserinnerung (Ersatzweg ohne Hinweistext).
      amountOpen: amountLabel,
      originalDueDate: dueDateLabel,
      dunningStage: 'Zahlungsaufforderung',
      dueDate: dueDateLabel,
      invoiceUrl: paymentLink,
      supportEmail: process.env.SUPPORT_EMAIL || 'support@mcrepair.de',
      supportPhone: process.env.SUPPORT_PHONE || '+49 (0) 123/456789',
    };

    const record = await PaymentRequest.create({ ...baseRecord, amount, status: 'pending' });

    const NOTE_TEMPLATE = 'Allgemeine Systemnachricht';
    const FALLBACK_TEMPLATE = 'Zahlungserinnerung';
    const isTemplateProblem = (result) => /not found|inactive|Missing required variables|Vorlage/i.test(String(result?.error || ''));

    let emailResult = null;
    let templateName = '';
    let attempts = 0;
    try {
      attempts += 1;
      emailResult = await EmailService.sendTemplateEmail(NOTE_TEMPLATE, recipientEmail, variables);
      templateName = NOTE_TEMPLATE;
      // Nur bei einem VORLAGEN-Problem auf die Ersatzvorlage wechseln. Ein Fehler des
      // Mailservers wuerde dort genauso scheitern und nur die Wartezeit verdoppeln.
      if (!emailResult?.success && isTemplateProblem(emailResult)) {
        attempts += 1;
        // Die Zahlungserinnerung traegt den Hinweistext ueber {{customMessage}}.
        const fallback = await EmailService.sendTemplateEmail(FALLBACK_TEMPLATE, recipientEmail, { ...variables, customMessage: note });
        if (fallback?.success) {
          emailResult = fallback;
          templateName = FALLBACK_TEMPLATE;
        } else {
          emailResult = { success: false, error: fallback?.error || emailResult?.error || 'E-Mail konnte nicht gesendet werden.' };
        }
      }
    } catch (error) {
      emailResult = { success: false, error: error.message };
    }

    record.attempts = attempts;
    record.templateName = templateName;
    // Beide Vorlagen transportieren den Hinweistext: die Systemnachricht im Text, die
    // Zahlungserinnerung ueber {{customMessage}} (auch bei gespeicherten Altvorlagen).
    record.noteDelivered = Boolean(note) && emailResult?.success === true;

    if (emailResult?.success) {
      record.status = 'accepted_by_provider';
      record.providerMessageId = emailResult.messageId || '';
      record.error = '';
    } else {
      record.status = 'failed';
      record.error = String(emailResult?.error || 'Unbekannter Fehler beim Versand.');
    }
    await record.save();

    if (!emailResult?.success) {
      return {
        success: false,
        status: 'failed',
        requestId: String(record._id),
        openBalance,
        amount,
        targetType,
        channel: 'email',
        recipientEmail,
        error: record.error,
        message: `Die Zahlungsaufforderung konnte nicht per E-Mail gesendet werden: ${record.error}`,
      };
    }

    const noteWarning = note && !record.noteDelivered
      ? ' Hinweis: Der persönliche Text wurde NICHT mitgesendet.'
      : '';

    return {
      success: true,
      status: 'accepted_by_provider',
      requestId: String(record._id),
      openBalance,
      amount,
      targetType,
      invoiceNumber: mainInvoice?.invoiceNumber || '',
      recipientEmail,
      channel: 'email',
      paymentLink,
      templateName,
      providerMessageId: record.providerMessageId,
      noteDelivered: record.noteDelivered,
      // Bewusste Wortwahl: per E-Mail uebergeben, nicht zugestellt, kein PayPal-Auftrag.
      message: `Zahlungsaufforderung über ${formatEuroDe(amount)} per E-Mail an ${recipientEmail} übergeben `
        + '(kein PayPal-Zahlungsauftrag; eine Zustellung wird dadurch nicht garantiert).'
        + noteWarning,
    };
  }

  /** Historie der Zahlungsaufforderungen einer Buchung oder Rechnung, neueste zuerst. */
  static async getPaymentRequests(identifier, filters = {}) {
    const PaymentRequest = require('../models/PaymentRequest');
    const target = await FinancialService.resolvePaymentRequestTarget(identifier);

    const conditions = [];
    if (target.booking?._id) conditions.push({ bookingId: target.booking._id });
    const invoiceIds = (target.invoices || []).map((invoice) => invoice._id).filter(Boolean);
    if (invoiceIds.length > 0) conditions.push({ invoiceId: { $in: invoiceIds } });
    if (conditions.length === 0) return { bookingId: '', bookingNumber: '', requests: [] };

    const limit = Math.min(Math.max(parseInt(filters.limit, 10) || 50, 1), 200);
    const requests = await PaymentRequest.find({ $or: conditions })
      .sort({ requestedAt: -1 })
      .limit(limit)
      .lean();

    return {
      bookingId: target.booking ? String(target.booking._id) : '',
      bookingNumber: target.booking?.bookingNumber || '',
      invoiceId: target.invoice ? String(target.invoice._id) : '',
      invoiceNumber: target.invoice?.invoiceNumber || '',
      requests,
    };
  }

  /**
   * Kontrollierter Wiederversand.
   *
   * Der alte Datensatz wird NIE veraendert; es entsteht immer eine neue Zeile mit
   * resendOfId. Innerhalb einer Sperrfrist (Standard 24 h) wird abgelehnt, solange
   * nicht `force` gesetzt ist.
   */
  static async resendPaymentRequest(requestId, options = {}, actor = null) {
    const PaymentRequest = require('../models/PaymentRequest');

    if (!Types.ObjectId.isValid(String(requestId || ''))) {
      throw buildFinancialError('Ungültige ID der Zahlungsaufforderung.', 400, 'INVALID_PAYMENT_REQUEST_ID');
    }
    const original = await PaymentRequest.findById(requestId);
    if (!original) throw buildFinancialError('Zahlungsaufforderung wurde nicht gefunden.', 404, 'PAYMENT_REQUEST_NOT_FOUND');

    const byInvoice = original.targetType === 'invoice' || !original.bookingId;
    const cooldownHours = Number.isFinite(Number(options.cooldownHours)) ? Number(options.cooldownHours) : 24;
    if (!options.force && cooldownHours > 0) {
      const since = new Date(Date.now() - cooldownHours * 60 * 60 * 1000);
      const recent = await PaymentRequest.findOne({
        ...(byInvoice ? { invoiceId: original.invoiceId } : { bookingId: original.bookingId }),
        status: 'accepted_by_provider',
        requestedAt: { $gte: since },
      }).sort({ requestedAt: -1 });

      if (recent) {
        throw buildFinancialError(
          `Hierfür wurde bereits am ${new Date(recent.requestedAt).toLocaleString('de-DE')} eine Zahlungsaufforderung versendet. `
          + `Ein erneuter Versand ist erst nach ${cooldownHours} Stunden möglich.`,
          429,
          'PAYMENT_REQUEST_COOLDOWN'
        );
      }
    }

    return FinancialService.requestAdditionalPayment(
      byInvoice ? String(original.invoiceId) : String(original.bookingId),
      {
        note: options.note != null ? options.note : original.note,
        amount: options.amount != null ? options.amount : undefined,
        resendOfId: original._id,
      },
      actor
    );
  }

  // ──────────────────────────────────────────────
}

module.exports = FinancialService;