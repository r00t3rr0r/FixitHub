// PaymentService.js
//
// Gemeinsame Zahlungs-/Saldo-Logik. Bewusst frei von Abhaengigkeiten zu
// FinancialService und BookingPaymentService, damit beide Seiten sie ohne
// Require-Zyklus benutzen koennen.
//
// FACHLICHE REGELN (verbindlich, siehe auch RECHNUNGSERSTELLUNG_SPEZIFIKATION.md):
//
//  1. ZAHLUNGSSTAND != BELEGSTATUS. Invoice.status beschreibt den Beleglebenslauf
//     (Entwurf/versendet/storniert), der Zahlungsstand wird IMMER aus den gueltigen
//     Zahlungszuordnungen abgeleitet und nie aus dem Belegstatus gelesen.
//  2. Gezaehlt werden ausschliesslich Zahlungen im Status 'completed', abzueglich
//     eines eventuellen Teil- oder Vollerstattungsbetrags (refundAmount).
//  3. Offener Betrag = max(0, Brutto-Gesamtbetrag - zugeordnete gueltige Zahlungen).
//     Eine Ueberzahlung wird SEPARAT als 'overpaid' gefuehrt und nie als negativer
//     offener Betrag dargestellt.
//  4. Automatische Zuordnung laeuft FIFO: aelteste Faelligkeit zuerst, danach
//     aeltestes Anlagedatum. Entwuerfe, Belege in Freigabe und Gutschriften
//     erhalten niemals eine automatische Zuordnung.

const mongoose = require('mongoose');
const Payment = require('../models/Payment');
const PaymentAllocation = require('../models/PaymentAllocation');
const Invoice = require('../models/Invoice');
const Order = require('../models/Order');

// Belegstatus, die eine automatische Zahlungszuordnung aufnehmen duerfen.
// 'draft' und 'pending_approval' sind bewusst NICHT enthalten: ein Beleg, der die
// Freigabe noch nicht durchlaufen hat, darf nicht ueber eine Zuordnung in den
// Status 'paid' gedraengt werden (INVOICE_STATUS_TRANSITIONS kennt diesen Uebergang
// nicht und der Beleg waere danach unbeweglich).
const ALLOCATABLE_INVOICE_STATUSES = ['sent', 'viewed', 'partially_paid', 'overdue'];

// Nur tatsaechlich eingegangenes Geld zaehlt gegen den offenen Betrag.
const COUNTABLE_PAYMENT_STATUSES = ['completed'];

// Versuche fuer das optimistische Sperren einer Zahlung. Ein Durchlauf kann aus
// zwei Gruenden folgenlos bleiben: ein paralleler Lauf hat die Sperre zuerst
// bekommen, oder ein Altbestandszaehler musste erst repariert werden. Beides
// verbraucht einen Versuch, deshalb mehr als zwei.
const ALLOCATION_LOCK_ATTEMPTS = 4;

// Ab wann ein `allocatedAmount` OHNE passende Zuordnungszeilen als Altbestand und
// nicht mehr als laufende Reservierung gilt. Zwischen Sperre und dem Anlegen der
// PaymentAllocation liegen Millisekunden; alles Aeltere stammt aus der Zeit, in der
// der Zaehler ohne Zeile geschrieben wurde.
const STALE_ALLOCATION_COUNTER_MS = 60 * 1000;

// Deutsche Bezeichner der Belegstatus. Jede Meldung, die den Bearbeiter erreicht,
// muss diesen Text zeigen und nie den rohen englischen Enum-Wert ('draft',
// 'partially_paid'); der technische Wert gehoert in den Fehlercode und ins Log.
const INVOICE_STATUS_LABELS_DE = {
  draft: 'Entwurf',
  pending_approval: 'in Freigabe',
  sent: 'versendet',
  viewed: 'angesehen',
  partially_paid: 'teilbezahlt',
  overdue: 'überfällig',
  paid: 'bezahlt',
  cancelled: 'storniert',
  credited: 'gutgeschrieben',
};

// Unbekannte Altbestandswerte werden durchgereicht, damit die Meldung nie leer wird.
const invoiceStatusLabel = (status) => {
  const key = String(status || '').trim();
  return INVOICE_STATUS_LABELS_DE[key] || key || 'unbekannt';
};

const round2 = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

const toIdString = (value) => {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    if (typeof value.toHexString === 'function') return value.toHexString();
    if (value._id != null && value._id !== value) return toIdString(value._id);
  }
  return String(value);
};

// Tatsaechlich vereinnahmter Betrag einer Zahlung (nach Erstattungen).
const effectivePaymentAmount = (payment) => round2(
  Math.max(0, Number(payment?.amount || 0) - Number(payment?.refundAmount || 0))
);

const isCountablePayment = (payment) => COUNTABLE_PAYMENT_STATUSES.includes(String(payment?.status || ''));

class PaymentService {
  static ALLOCATABLE_INVOICE_STATUSES = ALLOCATABLE_INVOICE_STATUSES;
  static COUNTABLE_PAYMENT_STATUSES = COUNTABLE_PAYMENT_STATUSES;
  static INVOICE_STATUS_LABELS_DE = INVOICE_STATUS_LABELS_DE;
  static invoiceStatusLabel = invoiceStatusLabel;
  static round2 = round2;
  static effectivePaymentAmount = effectivePaymentAmount;
  static isCountablePayment = isCountablePayment;

  // Delete all payments
  static async deleteAllPayments() {
    try {
      const result = await Payment.deleteMany({});
      return { success: true, deletedCount: result.deletedCount };
    } catch (error) {
      console.error('PaymentService: Error deleting all payments:', error);
      throw error;
    }
  }

  /**
   * Summe der GUELTIGEN Zuordnungen je Rechnung.
   * Gueltig = die zugehoerige Zahlung steht auf 'completed'. Ist die Zahlung
   * (teil-)erstattet, wird der Zuordnungsbetrag anteilig gekappt, damit
   * zurueckgezahltes Geld nicht weiter als beglichen gilt.
   *
   * @returns {Promise<Map<string, number>>} invoiceId -> zugeordneter Betrag
   */
  static async getAllocatedTotalsByInvoice(invoiceIds = []) {
    const ids = (invoiceIds || []).map(toIdString).filter(Boolean);
    if (ids.length === 0) return new Map();

    const objectIds = ids
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
      .map((id) => new mongoose.Types.ObjectId(id));
    if (objectIds.length === 0) return new Map();

    const requested = new Set(objectIds.map((id) => id.toHexString()));

    const hits = await PaymentAllocation.find({ invoiceId: { $in: objectIds } })
      .select('paymentId')
      .lean();
    if (hits.length === 0) return new Map();

    const paymentIds = [...new Set(hits.map((entry) => toIdString(entry.paymentId)).filter(Boolean))];
    const payments = await Payment.find({ _id: { $in: paymentIds } })
      .select('_id amount refundAmount status')
      .lean();
    const paymentById = new Map(payments.map((payment) => [toIdString(payment._id), payment]));

    // WICHTIG: fuer die Kappung werden ALLE Zuordnungen der beteiligten Zahlungen
    // geladen, nicht nur die auf die angefragten Rechnungen. Sonst haengt der einer
    // Rechnung zugerechnete Betrag davon ab, welche anderen Rechnungen zufaellig in
    // derselben Abfrage stehen - dieselbe Rechnung meldete dann in verschiedenen
    // Ansichten verschiedene Zahlbetraege.
    const allocations = await PaymentAllocation.find({ paymentId: { $in: paymentIds } })
      .select('paymentId invoiceId allocatedAmount')
      .lean();

    // Anteilige Kappung bei Teilerstattung: die Zuordnungen einer Zahlung duerfen in
    // Summe nie mehr sein als der nach Erstattung verbliebene Betrag.
    const remainingByPayment = new Map();
    payments.forEach((payment) => {
      remainingByPayment.set(toIdString(payment._id), effectivePaymentAmount(payment));
    });

    const totals = new Map();
    // Stabile Reihenfolge ueber den VOLLSTAENDIGEN Satz: aelteste Zuordnung zuerst
    // behaelt ihren vollen Betrag. Das Ergebnis ist damit unabhaengig davon, welche
    // Rechnungen der Aufrufer angefragt hat.
    const ordered = [...allocations].sort((a, b) => String(a._id).localeCompare(String(b._id)));
    ordered.forEach((allocation) => {
      const paymentKey = toIdString(allocation.paymentId);
      const payment = paymentById.get(paymentKey);
      if (!payment || !isCountablePayment(payment)) return;

      const remaining = Number(remainingByPayment.get(paymentKey) || 0);
      if (remaining <= 0) return;

      const usable = round2(Math.min(Number(allocation.allocatedAmount || 0), remaining));
      if (usable <= 0) return;
      remainingByPayment.set(paymentKey, round2(remaining - usable));

      // Erst jetzt auf die angefragten Rechnungen projizieren.
      const invoiceKey = toIdString(allocation.invoiceId);
      if (!requested.has(invoiceKey)) return;
      totals.set(invoiceKey, round2(Number(totals.get(invoiceKey) || 0) + usable));
    });

    return totals;
  }

  /**
   * Abgeleiteter Zahlungsstand einer einzelnen Rechnung.
   * @returns {{invoiceId, invoiceNumber, total, allocated, open, overpaid, paymentState}}
   */
  static async computeInvoiceBalance(invoiceInput) {
    const invoice = invoiceInput && typeof invoiceInput === 'object' && invoiceInput._id
      ? invoiceInput
      : await Invoice.findById(invoiceInput).select('_id invoiceNumber total isCreditNote status').lean();
    if (!invoice) return null;

    const totals = await PaymentService.getAllocatedTotalsByInvoice([invoice._id]);
    return PaymentService.buildInvoiceBalance(invoice, Number(totals.get(toIdString(invoice._id)) || 0));
  }

  /** Reiner Rechenteil, damit Listen-Endpunkte ohne weitere DB-Runde auskommen. */
  static buildInvoiceBalance(invoice, allocatedAmount) {
    const grossTotal = round2(Math.abs(Number(invoice.total || 0)));
    const allocated = round2(Math.max(0, Number(allocatedAmount || 0)));
    const open = round2(Math.max(0, grossTotal - allocated));
    const overpaid = round2(Math.max(0, allocated - grossTotal));

    let paymentState = 'open';
    if (overpaid > 0.009) paymentState = 'overpaid';
    else if (open <= 0.009 && grossTotal > 0) paymentState = 'paid';
    else if (allocated > 0.009) paymentState = 'partially_paid';

    return {
      invoiceId: toIdString(invoice._id),
      invoiceNumber: invoice.invoiceNumber || '',
      isCreditNote: Boolean(invoice.isCreditNote),
      status: invoice.status || '',
      total: grossTotal,
      allocated,
      open,
      overpaid,
      paymentState,
    };
  }

  /**
   * EINE Trefferregel fuer die Zahlungen einer Buchung, gemeinsam genutzt von
   * Detail- (computeBookingBalance) und Listenweg (getBookingBalancesBulk).
   *
   * Eine Zahlung gehoert zur Buchung, wenn sie deren bookingId ODER eine ihrer
   * Rechnungen ODER einen ihrer Auftraege traegt. Altbestandszahlungen tragen
   * haeufig nur invoiceId/orderId; laufen beide Wege auf verschiedenen Regeln,
   * widerspricht die Liste der Detailansicht derselben Buchung. Die Auftraege
   * werden hier IMMER selbst nachgeschlagen - ein Aufrufer, der sie nicht
   * mitgibt, darf deshalb kein anderes Ergebnis bekommen.
   *
   * @returns {Promise<{conditions: Array, bookingByInvoiceId: Map<string,string>, bookingByOrderId: Map<string,string>}>}
   */
  static async buildBookingPaymentMatch({ bookingIds = [], invoices = [], orderIds = [] } = {}) {
    const ids = [...new Set((bookingIds || []).map(toIdString).filter(Boolean))];
    // Nur bei genau EINER Buchung ist die Zuordnung eines Belegs/Auftrags ohne
    // eigene bookingId eindeutig.
    const fallbackBookingKey = ids.length === 1 ? ids[0] : '';

    const bookingByInvoiceId = new Map();
    (invoices || []).forEach((invoice) => {
      const invoiceKey = toIdString(invoice?._id);
      if (!invoiceKey) return;
      const bookingKey = toIdString(invoice?.bookingId) || fallbackBookingKey;
      if (bookingKey) bookingByInvoiceId.set(invoiceKey, bookingKey);
    });

    const bookingByOrderId = new Map();
    (orderIds || []).forEach((orderId) => {
      const orderKey = toIdString(orderId);
      if (orderKey && fallbackBookingKey) bookingByOrderId.set(orderKey, fallbackBookingKey);
    });

    if (ids.length > 0) {
      const orders = await Order.find({ bookingId: { $in: ids } })
        .setOptions({ skipAutoPopulate: true })
        .select('_id bookingId')
        .lean();
      orders.forEach((order) => {
        const orderKey = toIdString(order._id);
        const bookingKey = toIdString(order.bookingId);
        if (orderKey && bookingKey) bookingByOrderId.set(orderKey, bookingKey);
      });
    }

    const conditions = [];
    if (ids.length > 0) conditions.push({ bookingId: { $in: ids } });
    if (bookingByInvoiceId.size > 0) conditions.push({ invoiceId: { $in: [...bookingByInvoiceId.keys()] } });
    if (bookingByOrderId.size > 0) conditions.push({ orderId: { $in: [...bookingByOrderId.keys()] } });

    return { conditions, bookingByInvoiceId, bookingByOrderId };
  }

  /**
   * Abgeleiteter Zahlungsstand einer ganzen Buchung.
   * `total` ist die Summe der offenen Forderungen (Rechnungen ohne Gutschriften und
   * ohne stornierte Belege); `received` das insgesamt eingegangene Geld.
   */
  static async computeBookingBalance({ bookingId, invoices = null, orderIds = [], orderValue = null } = {}) {
    const bookingKey = toIdString(bookingId);
    if (!bookingKey) return null;

    const invoiceDocs = invoices || await Invoice.find({ bookingId: bookingKey })
      .select('_id invoiceNumber total paidAmount status isCreditNote dueDate createdAt')
      .sort({ createdAt: -1 })
      .lean();

    const receivables = invoiceDocs.filter((invoice) => !invoice.isCreditNote && invoice.status !== 'cancelled');
    const allocatedByInvoice = await PaymentService.getAllocatedTotalsByInvoice(receivables.map((invoice) => invoice._id));

    const byInvoice = receivables.map((invoice) => PaymentService.buildInvoiceBalance(
      invoice,
      Number(allocatedByInvoice.get(toIdString(invoice._id)) || 0)
    ));

    const invoicedTotal = round2(byInvoice.reduce((sum, entry) => sum + entry.total, 0));
    const allocated = round2(byInvoice.reduce((sum, entry) => sum + entry.allocated, 0));
    const open = round2(byInvoice.reduce((sum, entry) => sum + entry.open, 0));

    // Dieselbe Trefferregel wie im Listenweg - inklusive der Auftraege der Buchung,
    // auch wenn der Aufrufer keine `orderIds` mitgibt.
    const { conditions: matchConditions } = await PaymentService.buildBookingPaymentMatch({
      bookingIds: [bookingKey],
      invoices: invoiceDocs,
      orderIds,
    });

    const payments = await Payment.find({ $or: matchConditions })
      .select('_id amount refundAmount status')
      .lean();
    const received = round2(payments
      .filter(isCountablePayment)
      .reduce((sum, payment) => sum + effectivePaymentAmount(payment), 0));

    // Bezugsgroesse fuer den Buchungssaldo: solange keine Rechnung existiert, ist es
    // der Auftragswert - sonst die Summe der gestellten Forderungen. Ohne diese
    // Unterscheidung waere jede Vorauszahlung vor der Rechnungsstellung eine
    // "Ueberzahlung".
    const reference = invoicedTotal > 0.009
      ? invoicedTotal
      : round2(Math.max(0, Number(orderValue || 0)));

    return {
      bookingId: bookingKey,
      orderValue: round2(Math.max(0, Number(orderValue || 0))),
      reference,
      invoicedTotal,
      // allocated/invoiceOpen sind belegbezogen (Regel 3: zugeordnete Zahlungen).
      allocated,
      invoiceOpen: open,
      // open/overpaid sind vorgangsbezogen: tatsaechlich eingegangenes Geld gegen die
      // Bezugsgroesse. Nie negativ - eine Ueberzahlung steht separat in `overpaid`.
      open: round2(Math.max(0, reference - received)),
      received,
      unallocated: round2(Math.max(0, received - allocated)),
      overpaid: round2(Math.max(0, received - reference)),
      byInvoice,
    };
  }

  /**
   * Zuordnungen fuer viele Buchungen auf einmal (Listen-Endpunkte).
   *
   * ACHTUNG zur Benennung: `open` ist hier - wie `invoiceOpen` in
   * computeBookingBalance - BELEGbezogen (Summe der offenen Rechnungsbetraege).
   * Der VORGANGSbezogene offene Betrag (Bezugsgroesse minus eingegangenes Geld)
   * braucht den Auftragswert und entsteht erst in
   * BookingService.buildPaymentBalanceMap, das `open` hier auf `invoiceOpen`
   * abbildet. Beide Wege muessen fuer dieselbe Buchung dieselben Zahlen liefern.
   *
   * @returns {Promise<Map<string, {invoicedTotal, allocated, open, invoiceOpen, overpaid, received, unallocated}>>}
   */
  static async getBookingBalancesBulk(bookingIds = []) {
    const ids = (bookingIds || []).map(toIdString).filter(Boolean);
    const result = new Map();
    if (ids.length === 0) return result;

    const invoices = await Invoice.find({ bookingId: { $in: ids } })
      .select('_id bookingId invoiceNumber total status isCreditNote')
      .lean();

    const receivables = invoices.filter((invoice) => !invoice.isCreditNote && invoice.status !== 'cancelled');
    const allocatedByInvoice = await PaymentService.getAllocatedTotalsByInvoice(receivables.map((invoice) => invoice._id));

    // Zahlungen werden nach DERSELBEN Regel gesucht wie in computeBookingBalance:
    // ueber die Buchung ODER eine ihrer Rechnungen ODER einen ihrer Auftraege.
    // Beide Wege teilen sich dafuer buildBookingPaymentMatch, damit sie nicht
    // wieder auseinanderlaufen koennen.
    const {
      conditions: paymentMatch,
      bookingByInvoiceId,
      bookingByOrderId,
    } = await PaymentService.buildBookingPaymentMatch({ bookingIds: ids, invoices });

    // Eine Abfrage mit $or liefert jedes Dokument genau einmal, auch wenn mehrere
    // Bedingungen zutreffen - doppelt gezaehlt werden kann hier nichts.
    const payments = await Payment.find({ $or: paymentMatch })
      .select('_id bookingId invoiceId orderId amount refundAmount status')
      .lean();

    ids.forEach((id) => result.set(id, {
      invoicedTotal: 0, allocated: 0, open: 0, invoiceOpen: 0, overpaid: 0, received: 0, unallocated: 0,
    }));

    receivables.forEach((invoice) => {
      const key = toIdString(invoice.bookingId);
      const entry = result.get(key);
      if (!entry) return;
      const balance = PaymentService.buildInvoiceBalance(
        invoice,
        Number(allocatedByInvoice.get(toIdString(invoice._id)) || 0)
      );
      entry.invoicedTotal = round2(entry.invoicedTotal + balance.total);
      entry.allocated = round2(entry.allocated + balance.allocated);
      entry.open = round2(entry.open + balance.open);
    });

    payments.filter(isCountablePayment).forEach((payment) => {
      // Zuordnung zur Buchung in derselben Reihenfolge wie im Match: direkte
      // bookingId zuerst, danach ueber Rechnung bzw. Auftrag.
      const bookingKey = (result.has(toIdString(payment.bookingId)) && toIdString(payment.bookingId))
        || bookingByInvoiceId.get(toIdString(payment.invoiceId))
        || bookingByOrderId.get(toIdString(payment.orderId))
        || '';
      const entry = result.get(bookingKey);
      if (!entry) return;
      entry.received = round2(entry.received + effectivePaymentAmount(payment));
    });

    result.forEach((entry) => {
      entry.overpaid = round2(Math.max(0, entry.received - entry.invoicedTotal));
      entry.unallocated = round2(Math.max(0, entry.received - entry.allocated));
      // Gleicher Wert unter dem Namen, den die Detailansicht benutzt - damit ein
      // Aufrufer, der nach `invoiceOpen` greift, nicht undefined bekommt und den
      // belegbezogenen Wert nie versehentlich als vorgangsbezogen liest.
      entry.invoiceOpen = entry.open;
    });

    return result;
  }

  /**
   * Schreibt EINE Zuordnung atomar.
   *
   * Der Schutz gegen Doppelzaehlung sitzt auf der ZAHLUNG: `allocatedAmount` wird per
   * bedingtem Update (optimistisches Sperren) hochgezaehlt. Zwei gleichzeitige Laeufe
   * (wiederholter Webhook, doppelter Rechnungslauf, paralleler Klick) koennen die
   * Bedingung nur einmal erfuellen - der Verlierer bekommt null zurueck und ordnet
   * nichts zu. Erst danach entsteht die PaymentAllocation-Zeile.
   *
   * Der Rechnungsbetrag wird per $inc fortgeschrieben (kommutativ und damit auch bei
   * echter Parallelitaet korrekt) und loest bewusst KEINEN Mongoose-save aus, damit
   * der Betragshook der Rechnung festgeschriebene Belege nicht neu berechnet.
   *
   * @returns {Promise<{allocation, invoice, allocatedAmount}|null>} null = Rennen verloren
   */
  static async allocateAtomically({ payment, invoice, amount, note = '', orderId = null }) {
    const allocatable = round2(amount);
    if (!(allocatable > 0.009)) return null;

    // Sperrwert und Budget kommen IMMER frisch aus der Datenbank. Der uebergebene
    // Zahlungsbeleg darf nicht als Erwartungswert dienen: Aufrufer ueberschreiben
    // `allocatedAmount` im Speicher mit einem nachgerechneten Wert, womit die
    // Bedingung mit einem erfundenen Erwartungswert scharf gestellt wuerde.
    for (let attempt = 0; attempt < ALLOCATION_LOCK_ATTEMPTS; attempt += 1) {
      const stored = await Payment.findById(payment._id)
        .select('_id amount refundAmount allocatedAmount invoiceId orderId updatedAt')
        .lean();
      if (!stored) return null;

      const rows = await PaymentAllocation.find({ paymentId: stored._id }).select('allocatedAmount').lean();
      const derived = round2(rows.reduce((sum, entry) => sum + Number(entry.allocatedAmount || 0), 0));
      const counter = round2(Number(stored.allocatedAmount || 0));

      // Zaehler VOR den Zuordnungszeilen: entweder eine laufende Reservierung
      // (Sekundenbruchteile zwischen Sperre und Zeile) oder Altbestand aus der Zeit,
      // als der Zaehler ohne Zeile geschrieben wurde. Frisch = Rennen, alt = kaputt.
      if (counter > derived + 0.009) {
        const age = Date.now() - new Date(stored.updatedAt || 0).getTime();
        if (!(age > STALE_ALLOCATION_COUNTER_MS)) return null;

        const repaired = await Payment.updateOne(
          { _id: stored._id, allocatedAmount: counter, updatedAt: stored.updatedAt },
          { $set: { allocatedAmount: derived, updatedAt: new Date() } }
        );
        if (repaired.modifiedCount !== 1) continue;
        console.warn(
          `PaymentService: allocatedAmount mismatch repaired (stored=${counter.toFixed(2)}, derived=${derived.toFixed(2)}) for payment ${stored._id}`
        );
        continue;
      }

      // Massgeblich ist, wieviel Geld tatsaechlich schon verplant ist.
      const planned = round2(Math.max(counter, derived));
      const budget = round2(effectivePaymentAmount(stored) - planned);
      if (budget < allocatable - 0.009) return null;

      const lockConditions = [{ allocatedAmount: counter }];
      // Altbestand ohne das Feld: erst dann als "0" akzeptieren.
      if (counter === 0) lockConditions.push({ allocatedAmount: { $exists: false } }, { allocatedAmount: null });

      const claimed = await Payment.findOneAndUpdate(
        { _id: stored._id, $or: lockConditions },
        {
          $set: {
            allocatedAmount: round2(planned + allocatable),
            updatedAt: new Date(),
            ...(stored.invoiceId ? {} : { invoiceId: invoice._id }),
          },
        },
        { new: true }
      );
      // Rennen verloren: neu lesen statt aufgeben - der naechste Durchlauf sieht das
      // bereits verplante Geld und weist die Doppelzuordnung sauber ab.
      if (!claimed) continue;

      let allocation = null;
      try {
        allocation = await PaymentAllocation.create({
          paymentId: stored._id,
          invoiceId: invoice._id,
          orderId: toIdString(orderId || invoice.orderId || stored.orderId) || undefined,
          allocatedAmount: allocatable,
          allocatedAt: new Date(),
          note: note || `Zuordnung zu Rechnung ${invoice.invoiceNumber || invoice._id}`,
        });
      } catch (error) {
        // Sperre wieder freigeben, damit kein Geld "verschwindet".
        await Payment.updateOne(
          { _id: stored._id, allocatedAmount: round2(planned + allocatable) },
          { $set: { allocatedAmount: planned } }
        ).catch(() => {});
        throw error;
      }

      const incremented = await Invoice.findOneAndUpdate(
        { _id: invoice._id },
        { $inc: { paidAmount: allocatable } },
        { new: true }
      );

      if (incremented) {
        const paidAmount = round2(Number(incremented.paidAmount || 0));
        const total = round2(Number(incremented.total || 0));
        const statusUpdate = { paidAmount };
        // Belegstatus nur fortschreiben, wenn der Beleg die Freigabe hinter sich hat.
        // Ein Entwurf darf nicht ueber eine Zuordnung auf 'paid' gedraengt werden -
        // INVOICE_STATUS_TRANSITIONS kennt diesen Uebergang nicht.
        if (ALLOCATABLE_INVOICE_STATUSES.includes(String(incremented.status || ''))) {
          if (total > 0 && paidAmount >= total - 0.01) {
            statusUpdate.status = 'paid';
            statusUpdate.paidAt = incremented.paidAt || new Date();
            statusUpdate.dunningLevel = 0;
            statusUpdate.dunningStage = 'none';
          } else if (paidAmount > 0.009) {
            statusUpdate.status = 'partially_paid';
          }
        }
        // Gezielter $set statt save(): der Betragshook der Rechnung bleibt unberuehrt.
        await Invoice.updateOne({ _id: invoice._id }, { $set: statusUpdate });
      }

      payment.allocatedAmount = round2(planned + allocatable);
      if (!payment.invoiceId) payment.invoiceId = invoice._id;

      return { allocation, invoice: incremented, allocatedAmount: allocatable };
    }

    console.warn('PaymentService: allocation lock not obtained after retries for payment', String(payment._id));
    return null;
  }

  /**
   * Noch nicht zugeordneter Rest einer Zahlung (nach Erstattungen).
   */
  static async getUnallocatedAmount(paymentId) {
    const payment = await Payment.findById(paymentId).select('_id amount refundAmount status').lean();
    if (!payment) return 0;
    const allocations = await PaymentAllocation.find({ paymentId: payment._id }).select('allocatedAmount').lean();
    const allocated = round2(allocations.reduce((sum, entry) => sum + Number(entry.allocatedAmount || 0), 0));
    return round2(Math.max(0, effectivePaymentAmount(payment) - allocated));
  }

  /**
   * Offene Rechnungen einer Buchung in verbindlicher FIFO-Reihenfolge.
   * Regel: aelteste Faelligkeit zuerst, danach aeltestes Anlagedatum, danach
   * Belegnummer. Gutschriften, Entwuerfe und Belege in Freigabe sind ausgeschlossen.
   */
  static sortOpenInvoicesFifo(invoices = []) {
    return invoices
      .filter((invoice) => !invoice.isCreditNote && ALLOCATABLE_INVOICE_STATUSES.includes(String(invoice.status || '')))
      .sort((a, b) => {
        const dueA = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
        const dueB = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
        if (dueA !== dueB) return dueA - dueB;
        const createdA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const createdB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        if (createdA !== createdB) return createdA - createdB;
        return String(a.invoiceNumber || '').localeCompare(String(b.invoiceNumber || ''));
      });
  }
}

module.exports = PaymentService;
