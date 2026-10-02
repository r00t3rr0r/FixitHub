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

// Gutschriftarten, die Geld ZURUECKGEBEN statt die Forderung zu mindern (Altbestand
// des frueheren Ueberzahlungsausgleichs). Sie senken die Forderung nie.
const REFUND_CORRECTION_TYPES = ['partial_refund'];

// Auftragsstatus ohne Forderung: ein stornierter Auftrag wird nicht (mehr) berechnet.
const NON_RECEIVABLE_ORDER_STATUSES = ['cancelled'];

// Sperre einer RECHNUNG waehrend einer Zuordnung. Die Sperre auf der Zahlung allein
// verhindert nur, dass DIESELBE Zahlung doppelt verplant wird; zwei VERSCHIEDENE
// Zahlungen saehen sonst gleichzeitig denselben offenen Betrag und ordneten beide zu.
const INVOICE_ALLOCATION_LOCK_ATTEMPTS = 60;
const INVOICE_ALLOCATION_LOCK_WAIT_MS = 50;
// Eine Zuordnung dauert Millisekunden; eine aeltere Sperre stammt von einem
// abgebrochenen Prozess und darf uebernommen werden.
const INVOICE_ALLOCATION_LOCK_STALE_MS = 30 * 1000;

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
  static REFUND_CORRECTION_TYPES = REFUND_CORRECTION_TYPES;
  static NON_RECEIVABLE_ORDER_STATUSES = NON_RECEIVABLE_ORDER_STATUSES;
  static INVOICE_STATUS_LABELS_DE = INVOICE_STATUS_LABELS_DE;
  static invoiceStatusLabel = invoiceStatusLabel;
  static round2 = round2;
  static effectivePaymentAmount = effectivePaymentAmount;
  static isCountablePayment = isCountablePayment;

  /**
   * Kundenprojektion der Zahlungsuebersicht einer Buchung (CUSTUX-7). Reine
   * Lese-/Filterfunktion ueber BookingPaymentService.getOverview - es wird nichts
   * neu gerechnet, damit Kunde und Team dieselben Zahlen sehen.
   *
   * Enthalten: Summen (Gesamt, Bezahlt, Offen, Ueberzahlt/Erstattung offen) und die
   * tatsaechlichen Geldbewegungen (abgeschlossen/erstattet) mit Rechnungsbezug.
   * NICHT enthalten: PayPal-Order-/Capture-IDs, Metadaten, Gateway-Antworten, interne
   * Notizen, Bearbeiter, Idempotenzschluessel, Erstattungsinterna, Entwuerfe.
   *
   * Mehrgeraete-Buchung: alle Betraege gelten fuer die GESAMTE Buchung (orderCount).
   */
  static toCustomerPaymentOverview(overview = {}, { orderCount = null } = {}) {
    const r2 = (value) => round2(Number(value) || 0);
    const summary = overview.summary || {};
    const visibleInvoices = (overview.invoices || [])
      .filter((invoice) => !['draft', 'pending_approval'].includes(String(invoice.status || '')));
    const visibleInvoiceIds = new Set(visibleInvoices.map((invoice) => toIdString(invoice._id)));
    const customerPaymentStatuses = ['completed', 'refunded'];
    const count = Number.isFinite(Number(orderCount)) && Number(orderCount) > 0
      ? Number(orderCount)
      : null;

    return {
      booking: {
        _id: toIdString(overview.booking?._id),
        bookingNumber: overview.booking?.bookingNumber || '',
      },
      currency: 'EUR',
      appliesToWholeBooking: true,
      orderCount: count,
      summary: {
        referenceTotal: r2(summary.referenceTotal),
        receivedTotal: r2(summary.receivedTotal),
        openOrderBalance: r2(summary.openOrderBalance),
        overpaidTotal: r2(summary.overpaidTotal),
        refundPendingTotal: r2(summary.refundPendingTotal),
        refundsInProgressTotal: r2(summary.refundsInProgressTotal),
        notInvoicedTotal: r2(summary.notInvoicedTotal),
        isFullyPaid: Boolean(summary.isFullyPaid),
      },
      invoices: visibleInvoices.map((invoice) => ({
        _id: toIdString(invoice._id),
        invoiceNumber: invoice.invoiceNumber || '',
        isCreditNote: Boolean(invoice.isCreditNote),
        status: invoice.status,
        statusLabel: invoiceStatusLabel(invoice.status),
        total: r2(invoice.total),
        openAmount: r2(invoice.openAmount),
        dueDate: invoice.dueDate || null,
      })),
      payments: (overview.payments || [])
        .filter((payment) => customerPaymentStatuses.includes(String(payment.status || '')))
        .map((payment) => ({
          _id: toIdString(payment._id),
          paymentDate: payment.paymentDate || payment.createdAt || null,
          amount: r2(payment.amount),
          refundedAmount: r2(payment.refundAmount),
          effectiveAmount: r2(payment.effectiveAmount),
          paymentMethod: payment.paymentMethod || '',
          status: payment.status,
          currency: payment.currency || 'EUR',
          allocations: (payment.allocations || [])
            .filter((allocation) => visibleInvoiceIds.has(toIdString(allocation.invoiceId)))
            .map((allocation) => ({
              invoiceNumber: allocation.invoiceNumber || '',
              allocatedAmount: r2(allocation.allocatedAmount),
            })),
        })),
    };
  }

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
   * Summe der WERTMINDERNDEN Gutschriften je Rechnung (positiver Betrag).
   *
   * Belegkorrektur ist eine eigene Achse neben Zahlung und Erstattung: eine
   * Preiskorrektur/ein Storno senkt die Forderung, eine Ueberzahlungsrueckgabe
   * ('partial_refund', Altbestand aus dem frueheren Ueberzahlungsausgleich) nicht -
   * sie beschreibt Geld, das zurueckfliesst, und darf die Forderung nicht ein zweites
   * Mal mindern. Stornierte Gutschriften zaehlen nicht.
   *
   * @returns {Promise<Map<string, number>>} invoiceId -> gutgeschriebener Betrag
   */
  static async getValueCreditedByInvoice(invoiceIds = []) {
    const objectIds = (invoiceIds || [])
      .map(toIdString)
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
      .map((id) => new mongoose.Types.ObjectId(id));
    const result = new Map();
    if (objectIds.length === 0) return result;

    const creditNotes = await Invoice.find({
      creditNoteOf: { $in: objectIds },
      isCreditNote: true,
      status: { $ne: 'cancelled' },
      correctionType: { $nin: REFUND_CORRECTION_TYPES },
    })
      .setOptions({ skipAutoPopulate: true })
      .select('creditNoteOf total')
      .lean();

    creditNotes.forEach((note) => {
      const key = toIdString(note.creditNoteOf);
      result.set(key, round2(Number(result.get(key) || 0) + Math.abs(Number(note.total || 0))));
    });
    return result;
  }

  /**
   * Nicht zugeordneter Rest der Zahlungen, die an einer Rechnung haengen, EINMAL
   * zugerechnet: auf die Rechnung, die die Zahlung als invoiceId traegt, ersatzweise
   * auf die Rechnung ihrer aeltesten Zuordnung. Eine Zahlung, die zwei Rechnungen
   * bedient, erscheint mit ihrem Ueberhang dadurch nicht auf beiden.
   *
   * @returns {Promise<{excess: Map<string, number>, refunded: Map<string, number>, refundsPending: Map<string, number>}>}
   */
  static async getLinkedPaymentExcessByInvoice(invoiceIds = []) {
    const ids = (invoiceIds || []).map(toIdString).filter((id) => mongoose.Types.ObjectId.isValid(id));
    const excess = new Map();
    const refunded = new Map();
    const refundsPending = new Map();
    if (ids.length === 0) return { excess, refunded, refundsPending };

    const objectIds = ids.map((id) => new mongoose.Types.ObjectId(id));
    const requested = new Set(ids);

    const hitPaymentIds = await PaymentAllocation.distinct('paymentId', { invoiceId: { $in: objectIds } });
    const payments = await Payment.find({
      $or: [{ invoiceId: { $in: objectIds } }, { _id: { $in: hitPaymentIds } }],
    })
      .setOptions({ skipAutoPopulate: true })
      .select('_id amount refundAmount status invoiceId refunds')
      .lean();
    if (payments.length === 0) return { excess, refunded, refundsPending };

    const allocations = await PaymentAllocation.find({ paymentId: { $in: payments.map((payment) => payment._id) } })
      .select('_id paymentId invoiceId allocatedAmount')
      .lean();
    const allocatedByPayment = new Map();
    const firstInvoiceByPayment = new Map();
    [...allocations]
      .sort((a, b) => String(a._id).localeCompare(String(b._id)))
      .forEach((allocation) => {
        const key = toIdString(allocation.paymentId);
        allocatedByPayment.set(key, round2(Number(allocatedByPayment.get(key) || 0) + Number(allocation.allocatedAmount || 0)));
        if (!firstInvoiceByPayment.has(key)) firstInvoiceByPayment.set(key, toIdString(allocation.invoiceId));
      });

    payments.forEach((payment) => {
      const key = toIdString(payment._id);
      const primary = toIdString(payment.invoiceId) || firstInvoiceByPayment.get(key) || '';
      if (!requested.has(primary)) return;

      const refundedAmount = round2(Number(payment.refundAmount || 0));
      if (refundedAmount > 0.009) refunded.set(primary, round2(Number(refunded.get(primary) || 0) + refundedAmount));
      const pendingAmount = round2((payment.refunds || [])
        .filter((entry) => entry.status === 'pending')
        .reduce((sum, entry) => sum + Number(entry.amount || 0), 0));
      if (pendingAmount > 0.009) refundsPending.set(primary, round2(Number(refundsPending.get(primary) || 0) + pendingAmount));

      if (!isCountablePayment(payment)) return;
      const unallocated = round2(Math.max(0, effectivePaymentAmount(payment) - Number(allocatedByPayment.get(key) || 0)));
      if (unallocated > 0.009) excess.set(primary, round2(Number(excess.get(primary) || 0) + unallocated));
    });

    return { excess, refunded, refundsPending };
  }

  /**
   * DER Zahlungsstand von Rechnungen - eine Berechnung fuer Liste, Detail, Buchung,
   * Auftrag und Zuordnung.
   *
   *   forderung      = Brutto - wertmindernde Gutschriften
   *   offen          = max(0, forderung - gueltig zugeordnet)
   *   eingegangen    = zugeordnet + an der Rechnung haengender, nicht zugeordneter Rest
   *   erstattungOffen= alles, was ueber die Forderung hinaus eingegangen ist
   *
   * Bei Buchungsrechnungen wird `refundPending` auf die Ueberzahlung der BUCHUNG
   * gekappt: Geld, das fuer einen noch nicht berechneten Auftrag derselben Buchung
   * bestimmt ist, ist keine Ueberzahlung.
   *
   * @returns {Promise<Map<string, object>>} invoiceId -> Balance (siehe buildInvoiceBalance)
   */
  static async getInvoiceBalances(invoices = [], { bookingCap = true } = {}) {
    const docs = (invoices || []).filter((invoice) => invoice && invoice._id);
    const result = new Map();
    if (docs.length === 0) return result;

    const ids = docs.map((invoice) => toIdString(invoice._id));
    const receivableIds = docs.filter((invoice) => !invoice.isCreditNote).map((invoice) => toIdString(invoice._id));
    const [allocatedByInvoice, creditedByInvoice, linked] = await Promise.all([
      PaymentService.getAllocatedTotalsByInvoice(ids),
      PaymentService.getValueCreditedByInvoice(receivableIds),
      PaymentService.getLinkedPaymentExcessByInvoice(receivableIds),
    ]);

    docs.forEach((invoice) => {
      const key = toIdString(invoice._id);
      result.set(key, PaymentService.buildInvoiceBalance(invoice, Number(allocatedByInvoice.get(key) || 0), {
        credited: invoice.isCreditNote ? 0 : Number(creditedByInvoice.get(key) || 0),
        excess: invoice.isCreditNote ? 0 : Number(linked.excess.get(key) || 0),
        refunded: Number(linked.refunded.get(key) || 0),
        refundsInProgress: Number(linked.refundsPending.get(key) || 0),
      }));
    });

    if (!bookingCap) return result;

    // Kappung auf die Ueberzahlung der Buchung, deterministisch in Rechnungsreihenfolge
    // (aelteste zuerst) ueber ALLE Forderungen der Buchung - unabhaengig davon, welche
    // Rechnungen der Aufrufer gerade auf seiner Seite hat.
    const bookingIds = [...new Set(docs
      .filter((invoice) => !invoice.isCreditNote && invoice.bookingId)
      .map((invoice) => toIdString(invoice.bookingId))
      .filter(Boolean))];
    if (bookingIds.length === 0) return result;

    const bookingBalances = await PaymentService.getBookingBalancesBulk(bookingIds);
    const bookingInvoices = await Invoice.find({ bookingId: { $in: bookingIds }, isCreditNote: { $ne: true }, status: { $ne: 'cancelled' } })
      .setOptions({ skipAutoPopulate: true })
      .select('_id bookingId invoiceNumber total status isCreditNote createdAt')
      .sort({ createdAt: 1, _id: 1 })
      .lean();
    const missing = bookingInvoices.filter((invoice) => !result.has(toIdString(invoice._id)));
    const extra = missing.length > 0
      ? await PaymentService.getInvoiceBalances(missing, { bookingCap: false })
      : new Map();

    const remainingCap = new Map(bookingIds.map((id) => [id, Number(bookingBalances.get(id)?.overpaid || 0)]));
    bookingInvoices.forEach((invoice) => {
      const key = toIdString(invoice._id);
      const bookingKey = toIdString(invoice.bookingId);
      const balance = result.get(key) || extra.get(key);
      if (!balance) return;
      const cap = Number(remainingCap.get(bookingKey) || 0);
      const capped = round2(Math.min(balance.refundPending, Math.max(0, cap)));
      remainingCap.set(bookingKey, round2(cap - capped));
      if (!result.has(key) || capped === balance.refundPending) return;
      const reduction = round2(balance.refundPending - capped);
      balance.refundPending = capped;
      balance.received = round2(Math.max(balance.allocated, balance.received - reduction));
      balance.unallocatedCredit = reduction;
      if (balance.paymentState === 'overpaid' && capped <= 0.009) {
        balance.paymentState = balance.open <= 0.009 ? (balance.receivable > 0.009 ? 'paid' : 'credited') : 'partially_paid';
      }
    });

    return result;
  }

  /**
   * Abgeleiteter Zahlungsstand einer einzelnen Rechnung.
   * @returns {{invoiceId, invoiceNumber, total, allocated, open, overpaid, paymentState, ...}}
   */
  static async computeInvoiceBalance(invoiceInput) {
    // Achtung: ein ObjectId liefert auf `_id` sich selbst zurueck und ist deshalb KEIN
    // Hinweis auf einen geladenen Beleg - frueher wurde eine uebergebene ObjectId als
    // Beleg mit Summe 0 behandelt.
    const isDocument = invoiceInput
      && typeof invoiceInput === 'object'
      && typeof invoiceInput.toHexString !== 'function'
      && invoiceInput._id
      && invoiceInput.total !== undefined;
    const invoice = isDocument
      ? invoiceInput
      : await Invoice.findById(toIdString(invoiceInput))
        .setOptions({ skipAutoPopulate: true })
        .select('_id invoiceNumber total isCreditNote status bookingId createdAt')
        .lean();
    if (!invoice) return null;

    const balances = await PaymentService.getInvoiceBalances([invoice]);
    return balances.get(toIdString(invoice._id)) || null;
  }

  /** Reiner Rechenteil, damit Listen-Endpunkte ohne weitere DB-Runde auskommen. */
  static buildInvoiceBalance(invoice, allocatedAmount, extras = {}) {
    const grossTotal = round2(Math.abs(Number(invoice.total || 0)));
    const credited = round2(Math.min(grossTotal, Math.max(0, Number(extras.credited || 0))));
    const receivable = round2(Math.max(0, grossTotal - credited));
    const allocated = round2(Math.max(0, Number(allocatedAmount || 0)));
    const excess = round2(Math.max(0, Number(extras.excess || 0)));
    const open = round2(Math.max(0, receivable - allocated));
    const overpaid = round2(Math.max(0, allocated - receivable));
    const refundPending = round2(overpaid + excess);

    let paymentState = 'open';
    if (refundPending > 0.009) paymentState = 'overpaid';
    else if (open <= 0.009 && receivable > 0.009) paymentState = 'paid';
    else if (open <= 0.009 && grossTotal > 0.009) paymentState = 'credited';
    else if (allocated > 0.009) paymentState = 'partially_paid';

    return {
      invoiceId: toIdString(invoice._id),
      invoiceNumber: invoice.invoiceNumber || '',
      isCreditNote: Boolean(invoice.isCreditNote),
      status: invoice.status || '',
      total: grossTotal,
      // Wertmindernde Gutschriften und daraus die tatsaechliche Forderung.
      credited,
      receivable,
      allocated,
      open,
      overpaid,
      // Insgesamt fuer diesen Beleg eingegangenes Geld - auch der Teil, der ueber die
      // Forderung hinausgeht und deshalb nicht zugeordnet werden konnte.
      received: round2(allocated + excess),
      // "Ueberzahlt / Erstattung offen": der Betrag, der dem Kunden zurueckzuzahlen ist.
      refundPending,
      refunded: round2(Math.max(0, Number(extras.refunded || 0))),
      refundsInProgress: round2(Math.max(0, Number(extras.refundsInProgress || 0))),
      unallocatedCredit: 0,
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
   * GEMEINSAMER Kern fuer Detail- (computeBookingBalance) und Listenweg
   * (getBookingBalancesBulk). Beide duerfen fuer dieselbe Buchung nie verschiedene
   * Zahlen liefern - deshalb gibt es genau diese eine Berechnung.
   *
   * Bezugsgroesse (reference):
   *   - ohne Rechnung: der Auftragswert der Buchung,
   *   - mit Rechnung(en): Summe der Forderungen (Brutto minus wertmindernde
   *     Gutschriften) PLUS der Wert der Auftraege, die noch auf keiner Rechnung
   *     stehen. Frueher zaehlte nur die Rechnungssumme - eine Vorauszahlung fuer zwei
   *     Auftraege erschien nach der ersten Teilrechnung als "Ueberzahlung".
   *
   * @returns {Promise<Map<string, object>>}
   */
  static async computeBookingBalancesCore(bookingIds = [], { orderValueByBooking = null, extraOrderIds = [] } = {}) {
    const ids = [...new Set((bookingIds || []).map(toIdString).filter(Boolean))];
    const result = new Map();
    if (ids.length === 0) return result;

    const [invoices, orders] = await Promise.all([
      Invoice.find({ bookingId: { $in: ids } })
        .setOptions({ skipAutoPopulate: true })
        .select('_id bookingId invoiceNumber total paidAmount status isCreditNote dueDate createdAt orderId repairOrderIds')
        .sort({ createdAt: -1 })
        .lean(),
      Order.find({ bookingId: { $in: ids } })
        .setOptions({ skipAutoPopulate: true })
        .select('_id bookingId totalCost status')
        .lean(),
    ]);

    let orderValues = orderValueByBooking;
    if (!orderValues) {
      const Booking = require('../models/Booking');
      const bookings = await Booking.find({ _id: { $in: ids } })
        .setOptions({ skipAutoPopulate: true })
        .select('_id totalCost')
        .lean();
      orderValues = new Map(bookings.map((booking) => [toIdString(booking._id), Number(booking.totalCost || 0)]));
    }

    const receivables = invoices.filter((invoice) => !invoice.isCreditNote && invoice.status !== 'cancelled');
    const balances = await PaymentService.getInvoiceBalances(receivables, { bookingCap: false });

    // Dieselbe Trefferregel wie ueberall: ueber die Buchung ODER eine ihrer Rechnungen
    // ODER einen ihrer Auftraege. Eine Abfrage mit $or liefert jedes Dokument genau
    // einmal - doppelt gezaehlt werden kann hier nichts.
    const {
      conditions: paymentMatch,
      bookingByInvoiceId,
      bookingByOrderId,
    } = await PaymentService.buildBookingPaymentMatch({ bookingIds: ids, invoices, orderIds: extraOrderIds });
    const payments = paymentMatch.length > 0
      ? await Payment.find({ $or: paymentMatch })
        .setOptions({ skipAutoPopulate: true })
        .select('_id bookingId invoiceId orderId amount refundAmount status')
        .lean()
      : [];

    ids.forEach((id) => {
      const orderValue = round2(Math.max(0, Number(orderValues.get(id) || 0)));
      result.set(id, {
        bookingId: id,
        orderValue,
        invoicedTotal: 0,
        invoicedGross: 0,
        credited: 0,
        allocated: 0,
        invoiceOpen: 0,
        received: 0,
        uninvoicedValue: 0,
        nonReceivableOrderValue: 0,
        reference: orderValue,
        byInvoice: [],
        coveredOrderIds: new Set(),
        hasReceivables: false,
      });
    });

    receivables.forEach((invoice) => {
      const entry = result.get(toIdString(invoice.bookingId));
      const balance = balances.get(toIdString(invoice._id));
      if (!entry || !balance) return;
      entry.hasReceivables = true;
      entry.byInvoice.push(balance);
      entry.invoicedTotal = round2(entry.invoicedTotal + balance.receivable);
      entry.invoicedGross = round2(entry.invoicedGross + balance.total);
      entry.credited = round2(entry.credited + balance.credited);
      entry.allocated = round2(entry.allocated + balance.allocated);
      entry.invoiceOpen = round2(entry.invoiceOpen + balance.open);
      if (invoice.orderId) entry.coveredOrderIds.add(toIdString(invoice.orderId));
      (invoice.repairOrderIds || []).forEach((orderId) => entry.coveredOrderIds.add(toIdString(orderId)));
    });

    orders.forEach((order) => {
      const entry = result.get(toIdString(order.bookingId));
      if (!entry) return;
      if (entry.coveredOrderIds.has(toIdString(order._id))) return;
      // Ein stornierter Auftrag traegt keine Forderung: er zaehlt weder als "noch nicht
      // berechnet" noch - ohne Rechnung - im Auftragswert der Buchung (der ihn als
      // Summe aller Auftraege noch enthaelt). Frueher blieb die Buchung dadurch mit dem
      // Wert des stornierten Geraets "teilbezahlt".
      if (NON_RECEIVABLE_ORDER_STATUSES.includes(String(order.status || ''))) {
        entry.nonReceivableOrderValue = round2(entry.nonReceivableOrderValue + Math.max(0, Number(order.totalCost || 0)));
        return;
      }
      if (!entry.hasReceivables) return;
      entry.uninvoicedValue = round2(entry.uninvoicedValue + Math.max(0, Number(order.totalCost || 0)));
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
      entry.reference = entry.hasReceivables
        ? round2(entry.invoicedTotal + entry.uninvoicedValue)
        : round2(Math.max(0, entry.orderValue - entry.nonReceivableOrderValue));
      entry.open = round2(Math.max(0, entry.reference - entry.received));
      entry.overpaid = round2(Math.max(0, entry.received - entry.reference));
      entry.unallocated = round2(Math.max(0, entry.received - entry.allocated));
      delete entry.coveredOrderIds;
      delete entry.hasReceivables;
    });

    return result;
  }

  /**
   * Abgeleiteter Zahlungsstand einer ganzen Buchung.
   * `invoicedTotal` ist die Summe der Forderungen (Rechnungen ohne Gutschriften und
   * ohne stornierte Belege, abzueglich wertmindernder Gutschriften); `received` das
   * insgesamt eingegangene Geld. `invoices` wird aus Kompatibilitaetsgruenden noch
   * angenommen, die Berechnung liest aber immer den vollstaendigen Belegsatz.
   */
  static async computeBookingBalance({ bookingId, invoices = null, orderIds = [], orderValue = null } = {}) { // eslint-disable-line no-unused-vars
    const bookingKey = toIdString(bookingId);
    if (!bookingKey) return null;

    const core = await PaymentService.computeBookingBalancesCore([bookingKey], {
      orderValueByBooking: orderValue == null ? null : new Map([[bookingKey, Number(orderValue || 0)]]),
      extraOrderIds: orderIds,
    });
    const entry = core.get(bookingKey);
    if (!entry) return null;

    return {
      bookingId: bookingKey,
      orderValue: entry.orderValue,
      reference: entry.reference,
      invoicedTotal: entry.invoicedTotal,
      invoicedGross: entry.invoicedGross,
      credited: entry.credited,
      uninvoicedValue: entry.uninvoicedValue,
      // allocated/invoiceOpen sind belegbezogen (Regel 3: zugeordnete Zahlungen).
      allocated: entry.allocated,
      invoiceOpen: entry.invoiceOpen,
      // open/overpaid sind vorgangsbezogen: tatsaechlich eingegangenes Geld gegen die
      // Bezugsgroesse. Nie negativ - eine Ueberzahlung steht separat in `overpaid`.
      open: entry.open,
      received: entry.received,
      unallocated: entry.unallocated,
      overpaid: entry.overpaid,
      byInvoice: entry.byInvoice,
    };
  }

  /**
   * Zahlungsstand fuer viele Buchungen auf einmal (Listen-Endpunkte), ueber
   * DENSELBEN Kern wie computeBookingBalance.
   *
   * ACHTUNG zur Benennung: `open` ist hier - wie `invoiceOpen` in
   * computeBookingBalance - BELEGbezogen (Summe der offenen Rechnungsbetraege). Der
   * VORGANGSbezogene offene Betrag steht in `bookingOpen`, die Bezugsgroesse in
   * `reference`. BookingService.buildPaymentBalanceMap soll `reference` verwenden.
   *
   * @returns {Promise<Map<string, {invoicedTotal, allocated, open, invoiceOpen, overpaid, received, unallocated, reference, bookingOpen}>>}
   */
  static async getBookingBalancesBulk(bookingIds = []) {
    const core = await PaymentService.computeBookingBalancesCore(bookingIds);
    const result = new Map();
    core.forEach((entry, key) => {
      result.set(key, {
        invoicedTotal: entry.invoicedTotal,
        allocated: entry.allocated,
        open: entry.invoiceOpen,
        invoiceOpen: entry.invoiceOpen,
        overpaid: entry.overpaid,
        received: entry.received,
        unallocated: entry.unallocated,
        reference: entry.reference,
        bookingOpen: entry.open,
        uninvoicedValue: entry.uninvoicedValue,
      });
    });
    return result;
  }

  /**
   * Belegstatus aus dem Zahlungsstand - EINE Regel fuer Zuordnung, Neuableitung und
   * Wertsynchronisation. Massgeblich ist die Forderung (Brutto minus wertmindernde
   * Gutschriften), nicht das Brutto allein: eine teilweise gutgeschriebene Rechnung
   * ist mit dem Restbetrag vollstaendig bezahlt.
   *
   * Liefert nur die zu setzenden Felder; der Aufrufer entscheidet vorher, ob der
   * Beleg ueberhaupt fortgeschrieben werden darf (Entwurf/Freigabe/storniert nicht).
   */
  static resolvePaymentDerivedStatus({ status, total, credited = 0, paidAmount, paidAt = null, dueDate = null }) {
    const gross = round2(Math.abs(Number(total || 0)));
    const receivable = round2(Math.max(0, gross - Math.max(0, Number(credited || 0))));
    const paid = round2(Math.max(0, Number(paidAmount || 0)));

    if (receivable > 0.009 && paid >= receivable - 0.01) {
      return { status: 'paid', paidAt: paidAt || new Date(), dunningLevel: 0, dunningStage: 'none' };
    }
    if (paid > 0.009) {
      return { status: 'partially_paid', paidAt: null };
    }
    if (['paid', 'partially_paid'].includes(String(status || ''))) {
      return { status: dueDate && new Date(dueDate) < new Date() ? 'overdue' : 'sent', paidAt: null };
    }
    return {};
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
  static async allocateAtomically({ payment, invoice, amount, note = '', orderId = null, allowPartial = false }) {
    const requested = round2(amount);
    if (!(requested > 0.009)) return null;

    // Serialisierung auf der RECHNUNG: nur ein Zuordnungslauf je Beleg gleichzeitig, und
    // der offene Betrag wird INNERHALB der Sperre frisch gelesen. So koennen zwei
    // verschiedene Zahlungen denselben offenen Betrag nie beide belegen.
    return PaymentService.withInvoiceAllocationLock(invoice._id, async () => {
      const freshInvoice = await Invoice.findById(invoice._id)
        .setOptions({ skipAutoPopulate: true })
        .select('_id invoiceNumber total isCreditNote status bookingId createdAt')
        .lean();
      if (!freshInvoice || freshInvoice.isCreditNote) return null;
      const balance = (await PaymentService.getInvoiceBalances([freshInvoice], { bookingCap: false }))
        .get(toIdString(freshInvoice._id));
      const open = round2(Number(balance?.open || 0));
      if (requested > open + 0.009 && !allowPartial) return null;
      const allocatable = round2(Math.min(requested, open));
      if (!(allocatable > 0.009)) return null;
      return PaymentService.allocateWithinInvoiceLock({ payment, invoice, allocatable, note, orderId });
    });
  }

  /**
   * Fuehrt `fn` unter der Zuordnungssperre der Rechnung aus. Die Sperre ist ein
   * bedingtes Update auf Invoice.allocationLock (Token + Zeitpunkt), wartet kurz auf
   * einen laufenden Lauf und uebernimmt eine verwaiste Sperre nach
   * INVOICE_ALLOCATION_LOCK_STALE_MS. Liefert null, wenn die Sperre nicht zu bekommen war.
   */
  static async withInvoiceAllocationLock(invoiceId, fn) {
    const id = toIdString(invoiceId);
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    const token = new mongoose.Types.ObjectId().toHexString();
    for (let attempt = 0; attempt < INVOICE_ALLOCATION_LOCK_ATTEMPTS; attempt += 1) {
      const now = new Date();
      const claimed = await Invoice.updateOne(
        {
          _id: id,
          $or: [
            { 'allocationLock.token': { $exists: false } },
            { 'allocationLock.token': { $in: [null, ''] } },
            { 'allocationLock.at': { $lt: new Date(now.getTime() - INVOICE_ALLOCATION_LOCK_STALE_MS) } },
          ],
        },
        { $set: { allocationLock: { token, at: now } } }
      );
      if (claimed.modifiedCount === 1) {
        try {
          return await fn();
        } finally {
          await Invoice.updateOne({ _id: id, 'allocationLock.token': token }, { $unset: { allocationLock: 1 } })
            .catch((error) => console.error('PaymentService: invoice allocation lock not released:', error.message));
        }
      }
      if (claimed.matchedCount === 0) {
        const exists = await Invoice.exists({ _id: id });
        if (!exists) return null;
      }
      await new Promise((resolve) => setTimeout(resolve, INVOICE_ALLOCATION_LOCK_WAIT_MS + Math.floor(Math.random() * INVOICE_ALLOCATION_LOCK_WAIT_MS)));
    }
    console.warn('PaymentService: invoice allocation lock not obtained for invoice', id);
    return null;
  }

  // Zuordnung einer Zahlung; nur unter withInvoiceAllocationLock aufrufen.
  static async allocateWithinInvoiceLock({ payment, invoice, allocatable, note = '', orderId = null }) {
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
        const credited = Number((await PaymentService.getValueCreditedByInvoice([incremented._id])).get(toIdString(incremented._id)) || 0);
        const statusUpdate = { paidAmount };
        // Belegstatus nur fortschreiben, wenn der Beleg die Freigabe hinter sich hat.
        // Ein Entwurf darf nicht ueber eine Zuordnung auf 'paid' gedraengt werden -
        // INVOICE_STATUS_TRANSITIONS kennt diesen Uebergang nicht.
        if (ALLOCATABLE_INVOICE_STATUSES.includes(String(incremented.status || ''))) {
          Object.assign(statusUpdate, PaymentService.resolvePaymentDerivedStatus({
            status: incremented.status,
            total: incremented.total,
            credited,
            paidAmount,
            paidAt: incremented.paidAt,
            dueDate: incremented.dueDate,
          }));
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
