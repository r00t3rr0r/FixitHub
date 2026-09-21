const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Order = require('../models/Order');
const Invoice = require('../models/Invoice');
const Payment = require('../models/Payment');
const PaymentAllocation = require('../models/PaymentAllocation');
const User = require('../models/User');
const FinancialService = require('./financialService');
const PaymentService = require('./paymentService');
const PaypalService = require('./paypalService');

const MANUAL_PAYMENT_METHODS = ['cash', 'bank_transfer', 'sepa', 'credit_card', 'debit_card', 'paypal', 'invoice'];
// Belege, denen ein Bearbeiter MANUELL eine Zahlung zuordnen darf.
const OPEN_INVOICE_STATUSES = ['draft', 'pending_approval', 'sent', 'viewed', 'partially_paid', 'overdue'];
// Fuer den SALDO zaehlt nur Geld, das tatsaechlich eingegangen ist. 'processing' und
// 'pending' sind angekuendigtes, nicht vereinnahmtes Geld und wurden frueher
// mitgezaehlt - dadurch sah ein Auftrag bezahlt aus, dessen Zahlung noch offen war.
const COUNTABLE_PAYMENT_STATUSES = PaymentService.COUNTABLE_PAYMENT_STATUSES;
const MAX_PAYMENT_AMOUNT = 1000000;
const MAX_NOTE_LENGTH = 500;
const DAY_MS = 24 * 60 * 60 * 1000;

const round2 = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

const sanitizeText = (value, maxLength) => String(value ?? '')
  .replace(/[\u0000-\u001F\u007F]/g, ' ')
  .trim()
  .slice(0, maxLength);

const buildValidationError = (message, code = 'VALIDATION_ERROR') => {
  const error = new Error(message);
  error.statusCode = 400;
  error.code = code;
  return error;
};

const parseAmount = (value, label = 'Betrag') => {
  const amount = round2(Number(value));
  if (!Number.isFinite(amount) || amount <= 0) {
    throw buildValidationError(`${label} muss größer als 0 sein.`);
  }
  if (amount > MAX_PAYMENT_AMOUNT) {
    throw buildValidationError(`${label} überschreitet den maximal zulässigen Wert.`);
  }
  return amount;
};

const parsePaymentDate = (value) => {
  if (!value) return new Date();
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw buildValidationError('Ungültiges Zahlungsdatum.');
  }
  if (date.getTime() > Date.now() + DAY_MS) {
    throw buildValidationError('Das Zahlungsdatum darf nicht in der Zukunft liegen.');
  }
  return date;
};

class BookingPaymentService {
  static async loadContext(bookingId) {
    let booking = null;
    const rawId = String(bookingId || '').trim();
    const cleanId = rawId.replace(/^#/, '').trim();

    if (mongoose.Types.ObjectId.isValid(rawId)) {
      booking = await Booking.findById(rawId).lean();
    }
    if (!booking && cleanId) {
      booking = await Booking.findOne({
        $or: [
          { bookingNumber: cleanId },
          { bookingNumber: `#${cleanId}` },
          { bookingNumber: { $regex: new RegExp(`^#?${cleanId}$`, 'i') } }
        ]
      }).lean();
    }
    if (!booking && cleanId) {
      let order = null;
      if (mongoose.Types.ObjectId.isValid(rawId)) {
        order = await Order.findById(rawId).lean();
      }
      if (!order) {
        order = await Order.findOne({
          $or: [
            { orderNumber: cleanId },
            { orderNumber: `#${cleanId}` },
            { orderNumber: { $regex: new RegExp(`^#?${cleanId}$`, 'i') } }
          ]
        }).lean();
      }
      if (order && order.bookingId) {
        booking = await Booking.findById(order.bookingId).lean();
      }
    }

    if (!booking) {
      const error = new Error('Auftrag wurde nicht gefunden.');
      error.statusCode = 404;
      throw error;
    }

    const [orders, invoices] = await Promise.all([
      Order.find({ bookingId: booking._id }).select('_id orderNumber totalCost cost status').lean(),
      Invoice.find({ bookingId: booking._id }).sort({ createdAt: -1 }).lean(),
    ]);

    return { booking, orders, invoices };
  }

  static async getOverview(bookingId) {
    const { booking, orders, invoices } = await BookingPaymentService.loadContext(bookingId);

    const invoiceIds = invoices.map((invoice) => invoice._id);
    const orderIds = orders.map((order) => order._id);

    const matchConditions = [{ bookingId: booking._id }];
    if (invoiceIds.length > 0) matchConditions.push({ invoiceId: { $in: invoiceIds } });
    if (orderIds.length > 0) matchConditions.push({ orderId: { $in: orderIds } });

    const payments = await Payment.find({ $or: matchConditions })
      .sort({ paymentDate: -1, createdAt: -1 })
      .lean();

    const paymentIds = payments.map((payment) => payment._id);
    const allocations = paymentIds.length > 0
      ? await PaymentAllocation.find({ paymentId: { $in: paymentIds } }).lean()
      : [];

    const invoiceById = new Map(invoices.map((invoice) => [String(invoice._id), invoice]));
    const allocationsByPaymentId = new Map();
    allocations.forEach((allocation) => {
      const key = String(allocation.paymentId);
      const invoice = invoiceById.get(String(allocation.invoiceId));
      if (!allocationsByPaymentId.has(key)) allocationsByPaymentId.set(key, []);
      allocationsByPaymentId.get(key).push({
        _id: allocation._id,
        invoiceId: allocation.invoiceId,
        invoiceNumber: invoice?.invoiceNumber || '',
        allocatedAmount: round2(allocation.allocatedAmount),
        allocatedAt: allocation.allocatedAt,
        note: allocation.note || '',
      });
    });

    const enrichedPayments = payments.map((payment) => {
      const paymentAllocations = allocationsByPaymentId.get(String(payment._id)) || [];
      const allocatedAmount = round2(paymentAllocations.reduce((sum, entry) => sum + entry.allocatedAmount, 0));
      const effectiveAmount = round2(Number(payment.amount || 0) - Number(payment.refundAmount || 0));

      return {
        ...payment,
        amount: round2(payment.amount),
        allocatedAmount,
        unallocatedAmount: round2(Math.max(effectiveAmount - allocatedAmount, 0)),
        allocations: paymentAllocations,
        paypalOrderId: payment.metadata?.paypalOrderId || '',
        paypalCaptureId: payment.metadata?.providerDetails?.captureId || payment.metadata?.providerReference || '',
      };
    });

    // Zahlungsstand je Beleg aus den GUELTIGEN Zuordnungen, nicht aus dem
    // denormalisierten paidAmount: so stimmt die Anzeige auch dann, wenn ein
    // Altbestandsbeleg einen abweichenden Zaehlerstand traegt.
    const allocatedByInvoice = await PaymentService.getAllocatedTotalsByInvoice(invoices.map((invoice) => invoice._id));

    const invoiceSummaries = invoices.map((invoice) => {
      const allocated = round2(Number(allocatedByInvoice.get(String(invoice._id)) || 0));
      const total = round2(Math.abs(Number(invoice.total || 0)));
      const open = round2(Math.max(total - allocated, 0));
      const overpaid = round2(Math.max(allocated - total, 0));

      let paymentState = 'open';
      if (overpaid > 0.009) paymentState = 'overpaid';
      else if (open <= 0.009 && total > 0) paymentState = 'paid';
      else if (allocated > 0.009) paymentState = 'partially_paid';

      return {
        _id: invoice._id,
        invoiceNumber: invoice.invoiceNumber,
        // Belegstatus (Erfuellung/Lebenslauf) - NICHT der Zahlungsstand.
        status: invoice.status,
        // Zahlungsstand, getrennt vom Belegstatus.
        paymentState,
        isCreditNote: Boolean(invoice.isCreditNote),
        total: round2(invoice.total),
        allocated,
        paidAmount: allocated,
        storedPaidAmount: round2(invoice.paidAmount || 0),
        openAmount: invoice.isCreditNote ? 0 : open,
        overpaidAmount: invoice.isCreditNote ? 0 : overpaid,
        dueDate: invoice.dueDate,
        createdAt: invoice.createdAt,
        isOpen: OPEN_INVOICE_STATUSES.includes(invoice.status) && !invoice.isCreditNote,
        // Kann automatisch bedient werden (Entwurf/Freigabe ausgenommen).
        isAllocatable: PaymentService.ALLOCATABLE_INVOICE_STATUSES.includes(invoice.status) && !invoice.isCreditNote,
      };
    });

    const orderValue = round2(booking.totalCost || 0);
    const invoicedTotal = round2(invoiceSummaries
      .filter((invoice) => !invoice.isCreditNote && invoice.status !== 'cancelled')
      .reduce((sum, invoice) => sum + invoice.total, 0));
    const creditedTotal = round2(invoiceSummaries
      .filter((invoice) => invoice.isCreditNote)
      .reduce((sum, invoice) => sum + Math.abs(invoice.total), 0));
    const receivedTotal = round2(enrichedPayments
      .filter((payment) => COUNTABLE_PAYMENT_STATUSES.includes(payment.status))
      .reduce((sum, payment) => sum + Math.max(0, payment.amount - Number(payment.refundAmount || 0)), 0));
    const allocatedTotal = round2(enrichedPayments.reduce((sum, payment) => sum + payment.allocatedAmount, 0));
    const invoiceOpenTotal = round2(invoiceSummaries
      .filter((invoice) => invoice.isOpen)
      .reduce((sum, invoice) => sum + invoice.openAmount, 0));
    // Bezugsgroesse: solange keine Rechnung existiert, der Auftragswert.
    const referenceTotal = invoicedTotal > 0.009 ? invoicedTotal : orderValue;
    const overpaidTotal = round2(Math.max(0, receivedTotal - referenceTotal));

    return {
      booking: {
        _id: booking._id,
        bookingNumber: booking.bookingNumber,
        status: booking.status,
        billingStatus: booking.billingStatus,
        paymentStatus: booking.paymentStatus,
        totalCost: orderValue,
        createdAt: booking.createdAt,
      },
      invoices: invoiceSummaries,
      payments: enrichedPayments,
      summary: {
        orderValue,
        invoicedTotal,
        creditedTotal,
        receivedTotal,
        allocatedTotal,
        unallocatedTotal: round2(Math.max(receivedTotal - allocatedTotal, 0)),
        invoiceOpenTotal,
        notInvoicedTotal: round2(orderValue - invoicedTotal),
        // NIE negativ: eine Ueberzahlung wird separat als overpaidTotal gefuehrt und
        // nicht als "Saldo -300,00 EUR" dargestellt.
        openOrderBalance: round2(Math.max(0, referenceTotal - receivedTotal)),
        referenceTotal,
        overpaidTotal,
        isOverpaid: overpaidTotal > 0.009,
        isFullyPaid: referenceTotal > 0 && receivedTotal >= referenceTotal - 0.01,
      },
      // Einheitlicher Satz fuer die Anzeige: der Client soll nichts nachrechnen.
      balance: {
        total: referenceTotal,
        invoicedTotal,
        allocated: allocatedTotal,
        received: receivedTotal,
        open: round2(Math.max(0, referenceTotal - receivedTotal)),
        invoiceOpen: invoiceOpenTotal,
        unallocated: round2(Math.max(receivedTotal - allocatedTotal, 0)),
        overpaid: overpaidTotal,
      },
      paymentMethods: MANUAL_PAYMENT_METHODS,
    };
  }

  /**
   * Erfasst eine manuell eingegangene Zahlung.
   *
   * Zwei Aenderungen gegenueber frueher:
   *  1. Ohne ausgewaehlte Rechnung bleibt das Geld nicht mehr unsichtbar liegen: es
   *     wird FIFO auf die offenen Rechnungen des Auftrags verteilt (aelteste
   *     Faelligkeit zuerst). Ein echter Rest bleibt als `unallocatedAmount` sichtbar.
   *  2. Doppelbuchungsschutz ueber `idempotencyKey` - ein Doppelklick oder ein Retry
   *     des Clients erzeugt keine zweite Zahlung mehr.
   */
  static async addManualPayment(bookingId, data = {}, actingUserId = null) {
    const { booking, invoices } = await BookingPaymentService.loadContext(bookingId);

    const amount = parseAmount(data.amount);
    const paymentDate = parsePaymentDate(data.paymentDate);
    const paymentMethod = String(data.paymentMethod || '').trim();
    if (!MANUAL_PAYMENT_METHODS.includes(paymentMethod)) {
      throw buildValidationError('Ungültige Zahlart.');
    }

    const note = sanitizeText(data.note, MAX_NOTE_LENGTH);
    const paymentReference = sanitizeText(data.paymentReference, 120);

    // Zielrechnung VOR dem Schreiben pruefen: eine nicht bebuchbare Rechnung darf
    // nicht erst nach dem Anlegen der Zahlung auffallen.
    let targetInvoice = null;
    if (data.invoiceId) {
      targetInvoice = invoices.find((invoice) => String(invoice._id) === String(data.invoiceId)) || null;
      if (!targetInvoice) {
        throw buildValidationError('Die gewählte Rechnung gehört nicht zu diesem Auftrag.');
      }
      if (targetInvoice.isCreditNote) {
        throw buildValidationError('Gutschriften können keine Zahlungen zugeordnet werden.');
      }
      if (!OPEN_INVOICE_STATUSES.includes(targetInvoice.status)) {
        throw buildValidationError(`Rechnungen im Status "${PaymentService.invoiceStatusLabel(targetInvoice.status)}" können keine weiteren Zahlungen aufnehmen.`);
      }
    }

    const customer = booking.customerId ? await User.findById(booking.customerId).select('firstName lastName email').lean() : null;
    const customerName = customer
      ? [customer.firstName, customer.lastName].filter(Boolean).join(' ').trim() || customer.email
      : [booking.guestInfo?.firstName, booking.guestInfo?.lastName].filter(Boolean).join(' ').trim();

    const { keys, existing } = await FinancialService.findManualPaymentDuplicate({
      bookingId: booking._id,
      invoiceId: targetInvoice?._id,
      amount,
      paymentMethod,
      paymentDate,
      paymentReference,
      note,
      idempotencyKey: data.idempotencyKey,
    });

    if (existing) {
      const overview = await BookingPaymentService.getOverview(bookingId);
      return {
        ...overview,
        duplicate: true,
        message: 'Diese Zahlung wurde bereits erfasst und nicht erneut gebucht.',
      };
    }

    let payment;
    try {
      payment = await Payment.create({
        bookingId: booking._id,
        invoiceId: targetInvoice?._id,
        customerId: booking.customerId || undefined,
        customerName: customerName || '',
        isGuest: Boolean(booking.guestInfo?.isGuest),
        guestEmail: booking.guestInfo?.email || '',
        amount,
        currency: 'EUR',
        paymentDate,
        processedAt: paymentDate,
        status: 'completed',
        paymentMethod,
        paymentReference: paymentReference || (booking.bookingNumber ? `Auftrag ${booking.bookingNumber}` : ''),
        note,
        allocatedAmount: 0,
        source: 'manual',
        recordedBy: actingUserId || undefined,
        idempotencyKey: keys[0],
      });
    } catch (error) {
      if (error?.code === 11000 && String(error?.message || '').includes('idempotencyKey')) {
        const overview = await BookingPaymentService.getOverview(bookingId);
        return {
          ...overview,
          duplicate: true,
          message: 'Diese Zahlung wurde bereits erfasst und nicht erneut gebucht.',
        };
      }
      throw error;
    }

    // Zuordnen: entweder gezielt auf die gewaehlte Rechnung, sonst FIFO ueber alle
    // offenen Rechnungen des Auftrags. Wieviel am Ende zugeordnet ist, wird NICHT
    // hier mitgezaehlt, sondern unten aus der Zahlung selbst gelesen - der
    // FIFO-Lauf liefert die buchungsweite Summe ueber ALLE offenen Zahlungen und
    // waere als Wert dieser einen Zahlung schlicht falsch.
    try {
      if (targetInvoice) {
        const invoice = await Invoice.findById(targetInvoice._id);
        const allocatedForInvoice = await PaymentService.getAllocatedTotalsByInvoice([invoice._id]);
        const invoiceOpen = round2(Math.max(0, Number(invoice.total || 0) - Number(allocatedForInvoice.get(String(invoice._id)) || 0)));
        const allocatable = round2(Math.min(amount, invoiceOpen));
        if (allocatable > 0.009) {
          await PaymentService.allocateAtomically({
            payment,
            invoice,
            amount: allocatable,
            note: note || `Zuordnung zu Rechnung ${invoice.invoiceNumber || invoice._id}`,
          });
        }
      } else {
        await FinancialService.autoAllocateUnallocatedPayments(booking._id);
      }
    } catch (allocError) {
      // Die Zahlung ist gebucht - eine fehlgeschlagene Zuordnung darf sie nicht
      // zurueckdrehen. Der Rest bleibt als nicht zugeordnet sichtbar.
      console.error('BookingPaymentService: allocation after manual payment failed:', allocError);
    }

    const refreshedPayment = await Payment.findById(payment._id).lean();
    const unallocatedAmount = round2(Math.max(0, amount - Number(refreshedPayment?.allocatedAmount || 0)));

    await FinancialService.applyBookingPaymentState(booking._id).catch((error) => {
      console.error('BookingPaymentService: booking payment state not updated:', error);
    });

    const warnings = [];
    if (unallocatedAmount > 0.009) {
      warnings.push(`${unallocatedAmount.toFixed(2)} € dieser Zahlung konnten keiner offenen Rechnung zugeordnet werden und bleiben als nicht zugeordnet stehen.`);
    }
    // Ein Beleg ohne Freigabe nimmt das Geld an, behaelt aber seinen Belegstatus -
    // sonst waere ein Entwurf ueber eine Zuordnung auf 'bezahlt' gesetzt worden.
    if (targetInvoice && !PaymentService.ALLOCATABLE_INVOICE_STATUSES.includes(String(targetInvoice.status || ''))) {
      warnings.push(`Der Beleg ist noch nicht freigegeben (Status "${PaymentService.invoiceStatusLabel(targetInvoice.status)}"). Der Zahlungseingang wurde erfasst, der Belegstatus bleibt bis zur Freigabe unverändert.`);
    }

    const overview = await BookingPaymentService.getOverview(bookingId);
    return {
      ...overview,
      duplicate: false,
      paymentId: String(payment._id),
      allocatedAmount: round2(Number(refreshedPayment?.allocatedAmount || 0)),
      unallocatedAmount,
      ...(warnings.length > 0 ? { warning: warnings.join(' ') } : {}),
    };
  }

  static async allocatePayment(bookingId, paymentId, data = {}) {
    const { booking, invoices } = await BookingPaymentService.loadContext(bookingId);

    if (!mongoose.Types.ObjectId.isValid(String(paymentId))) {
      throw buildValidationError('Ungültige Zahlungs-ID.');
    }

    const payment = await Payment.findById(paymentId);
    if (!payment) {
      const error = new Error('Zahlung wurde nicht gefunden.');
      error.statusCode = 404;
      throw error;
    }

    if (payment.status !== 'completed') {
      throw buildValidationError('Nur abgeschlossene Zahlungen können einer Rechnung zugeordnet werden.');
    }

    const invoiceSummary = invoices.find((invoice) => String(invoice._id) === String(data.invoiceId));
    if (!invoiceSummary) {
      throw buildValidationError('Die gewählte Rechnung gehört nicht zu diesem Auftrag.');
    }
    if (invoiceSummary.isCreditNote) {
      throw buildValidationError('Gutschriften können keine Zahlungen zugeordnet werden.');
    }

    const invoice = await Invoice.findById(invoiceSummary._id);
    if (!OPEN_INVOICE_STATUSES.includes(invoice.status)) {
      throw buildValidationError(`Rechnungen im Status "${PaymentService.invoiceStatusLabel(invoice.status)}" können keine weiteren Zahlungen aufnehmen.`);
    }

    const existingAllocations = await PaymentAllocation.find({ paymentId: payment._id }).lean();
    const alreadyAllocated = round2(existingAllocations.reduce((sum, entry) => sum + Number(entry.allocatedAmount || 0), 0));
    const effectiveAmount = round2(Math.max(0, Number(payment.amount || 0) - Number(payment.refundAmount || 0)));
    const unallocated = round2(effectiveAmount - alreadyAllocated);

    if (unallocated <= 0) {
      throw buildValidationError('Diese Zahlung ist bereits vollständig zugeordnet.');
    }

    // Offener Rechnungsbetrag aus den gueltigen Zuordnungen, nicht aus paidAmount.
    const allocatedForInvoice = await PaymentService.getAllocatedTotalsByInvoice([invoice._id]);
    const invoiceOpenAmount = round2(Math.max(0, Number(invoice.total || 0) - Number(allocatedForInvoice.get(String(invoice._id)) || 0)));

    const requestedAmount = data.amount === undefined || data.amount === null || data.amount === ''
      ? Math.min(unallocated, invoiceOpenAmount)
      : parseAmount(data.amount, 'Zuordnungsbetrag');

    if (requestedAmount <= 0) {
      throw buildValidationError('Es ist kein zuordenbarer Betrag vorhanden.');
    }
    if (requestedAmount > unallocated + 0.01) {
      throw buildValidationError(`Der Zuordnungsbetrag übersteigt den nicht zugeordneten Zahlungsbetrag (${unallocated.toFixed(2)} €).`);
    }
    if (requestedAmount > invoiceOpenAmount + 0.01) {
      throw buildValidationError(`Der Zuordnungsbetrag übersteigt den offenen Rechnungsbetrag (${invoiceOpenAmount.toFixed(2)} €).`);
    }

    const allocatedAmount = round2(Math.min(requestedAmount, unallocated, invoiceOpenAmount));

    payment.allocatedAmount = alreadyAllocated;
    if (!payment.bookingId) {
      payment.bookingId = booking._id;
      await Payment.updateOne({ _id: payment._id }, { $set: { bookingId: booking._id } });
    }

    const result = await PaymentService.allocateAtomically({
      payment,
      invoice,
      amount: allocatedAmount,
      note: sanitizeText(data.note, MAX_NOTE_LENGTH) || `Zuordnung zu Rechnung ${invoice.invoiceNumber || invoice._id}`,
    });

    if (!result) {
      throw buildValidationError('Die Zuordnung wurde parallel geändert. Bitte laden Sie die Ansicht neu und versuchen Sie es erneut.', 'ALLOCATION_CONFLICT');
    }

    const refreshedInvoice = await Invoice.findById(invoice._id);
    await FinancialService.syncPaymentDerivedState(refreshedInvoice, 'allocatePayment');

    return BookingPaymentService.getOverview(bookingId);
  }

  static async removeAllocation(bookingId, paymentId, allocationId) {
    await BookingPaymentService.loadContext(bookingId);

    const allocation = await PaymentAllocation.findOne({ _id: allocationId, paymentId });
    if (!allocation) {
      const error = new Error('Zuordnung wurde nicht gefunden.');
      error.statusCode = 404;
      throw error;
    }

    const invoiceId = allocation.invoiceId;
    const releasedAmount = round2(allocation.allocatedAmount);
    await allocation.deleteOne();

    const payment = await Payment.findById(paymentId);
    if (payment) {
      const remaining = await PaymentAllocation.find({ paymentId: payment._id }).lean();
      payment.allocatedAmount = round2(remaining.reduce((sum, entry) => sum + Number(entry.allocatedAmount || 0), 0));
      if (String(payment.invoiceId || '') === String(invoiceId) && !remaining.some((entry) => String(entry.invoiceId) === String(invoiceId))) {
        payment.invoiceId = remaining[0]?.invoiceId || undefined;
      }
      await payment.save();
    }

    // Rechnungsstand NEU ableiten statt einen Delta-Wert abzuziehen: nur so bleiben
    // gespeicherter und tatsaechlicher Zahlungsstand dauerhaft deckungsgleich.
    await FinancialService.recalculateInvoicePaidAmounts([invoiceId]);

    return BookingPaymentService.getOverview(bookingId);
  }

  static async deleteManualPayment(bookingId, paymentId) {
    await BookingPaymentService.loadContext(bookingId);

    const payment = await Payment.findById(paymentId);
    if (!payment) {
      const error = new Error('Zahlung wurde nicht gefunden.');
      error.statusCode = 404;
      throw error;
    }
    if (payment.source !== 'manual') {
      throw buildValidationError('Nur manuell erfasste Zahlungen können gelöscht werden.');
    }

    const allocations = await PaymentAllocation.find({ paymentId: payment._id }).lean();
    if (allocations.length > 0) {
      throw buildValidationError('Bitte heben Sie zuerst alle Rechnungszuordnungen dieser Zahlung auf.');
    }

    await payment.deleteOne();

    return BookingPaymentService.getOverview(bookingId);
  }

  /**
   * Leitet den Zahlungsstand einer Rechnung neu ab.
   *
   * Frueher wurde hier ein Delta auf den gespeicherten paidAmount addiert
   * (read-modify-write). Das war die zweite, konkurrierende Quelle der Wahrheit neben
   * den PaymentAllocation-Zeilen und die Ursache dafuer, dass Betraege je nach
   * Reihenfolge doppelt oder gar nicht gezaehlt wurden. Der Parameter `delta` bleibt
   * aus Kompatibilitaetsgruenden erhalten, wird aber bewusst ignoriert.
   */
  static async applyInvoicePaymentDelta(invoiceId, delta) { // eslint-disable-line no-unused-vars
    await FinancialService.recalculateInvoicePaidAmounts([invoiceId]);
  }

  /**
   * Links existing PayPal payments to the booking and imports missing PayPal
   * transactions via the PayPal reporting API.
   */
  static async importPaypalPayments(bookingId) {
    const { booking, orders, invoices } = await BookingPaymentService.loadContext(bookingId);

    const invoiceIds = invoices.map((invoice) => invoice._id);
    const orderIds = orders.map((order) => order._id);

    // 1. Link PayPal payments that already exist locally (checkout / invoice payments).
    const linkConditions = [];
    if (invoiceIds.length > 0) linkConditions.push({ invoiceId: { $in: invoiceIds } });
    if (orderIds.length > 0) linkConditions.push({ orderId: { $in: orderIds } });

    let linked = 0;
    if (linkConditions.length > 0) {
      const linkResult = await Payment.updateMany(
        { paymentMethod: 'paypal', bookingId: { $in: [null, undefined] }, $or: linkConditions },
        { $set: { bookingId: booking._id } }
      );
      linked = linkResult.modifiedCount || 0;
    }

    // 2. Pull transactions from PayPal and match them against this booking.
    const referenceKeys = new Set();
    if (booking.bookingNumber) referenceKeys.add(String(booking.bookingNumber).toLowerCase());
    invoices.forEach((invoice) => {
      if (invoice.invoiceNumber) referenceKeys.add(String(invoice.invoiceNumber).toLowerCase());
    });
    orders.forEach((order) => {
      if (order.orderNumber) referenceKeys.add(String(order.orderNumber).toLowerCase());
    });

    const customer = booking.customerId ? await User.findById(booking.customerId).select('email firstName lastName').lean() : null;
    const customerEmail = String(customer?.email || booking.guestInfo?.email || '').trim().toLowerCase();
    const customerName = customer
      ? [customer.firstName, customer.lastName].filter(Boolean).join(' ').trim() || customer.email
      : [booking.guestInfo?.firstName, booking.guestInfo?.lastName].filter(Boolean).join(' ').trim();

    let imported = 0;
    let updated = 0;
    let warning = '';

    try {
      const gateway = await PaypalService.getActiveGateway();
      const auth = await PaypalService.getAccessToken(gateway);

      const startDate = new Date(new Date(booking.createdAt || Date.now()).getTime() - 3 * DAY_MS);
      const transactions = await PaypalService.listTransactions({ startDate, endDate: new Date() }, auth);

      const statusMap = { S: 'completed', P: 'pending', V: 'refunded', D: 'failed' };

      for (const entry of transactions) {
        const info = entry.transaction_info || {};
        const transactionId = String(info.transaction_id || '').trim();
        if (!transactionId) continue;

        const invoiceRef = String(info.invoice_id || '').toLowerCase();
        const customField = String(info.custom_field || '').toLowerCase();
        const payerEmail = String(entry.payer_info?.email_address || '').toLowerCase();

        const matchesReference = [...referenceKeys].some((key) => invoiceRef.includes(key) || customField.includes(key));
        const amountValue = round2(Math.abs(Number(info.transaction_amount?.value || 0)));
        const matchesAmountAndPayer = Boolean(customerEmail)
          && payerEmail === customerEmail
          && amountValue > 0
          && (Math.abs(amountValue - round2(booking.totalCost || 0)) < 0.01
            || invoices.some((invoice) => Math.abs(amountValue - round2(invoice.total || 0)) < 0.01));

        if (!matchesReference && !matchesAmountAndPayer) continue;

        const paymentDate = info.transaction_initiation_date ? new Date(info.transaction_initiation_date) : new Date();
        const status = statusMap[String(info.transaction_status || 'S')] || 'completed';
        const matchedInvoice = invoices.find((invoice) => invoiceRef.includes(String(invoice.invoiceNumber || '').toLowerCase()));

        const existing = await Payment.findOne({
          $or: [
            { transactionId },
            { 'metadata.providerReference': transactionId },
            { 'metadata.paypalOrderId': transactionId },
          ],
        });

        if (existing) {
          let changed = false;
          if (!existing.bookingId) { existing.bookingId = booking._id; changed = true; }
          if (existing.status !== status && existing.source !== 'manual') { existing.status = status; changed = true; }
          if (changed) {
            await existing.save();
            updated += 1;
          }
          continue;
        }

        await Payment.create({
          bookingId: booking._id,
          invoiceId: matchedInvoice?._id,
          customerId: booking.customerId || undefined,
          customerName: customerName || entry.payer_info?.payer_name?.alternate_full_name || '',
          isGuest: Boolean(booking.guestInfo?.isGuest),
          guestEmail: booking.guestInfo?.email || '',
          amount: amountValue,
          currency: String(info.transaction_amount?.currency_code || 'EUR').toUpperCase(),
          paymentDate,
          processedAt: paymentDate,
          status,
          paymentMethod: 'paypal',
          transactionId,
          paymentReference: info.invoice_id || '',
          note: sanitizeText(info.transaction_subject || info.transaction_note || '', MAX_NOTE_LENGTH),
          allocatedAmount: 0,
          source: 'paypal_import',
          gatewayResponse: `PayPal transaction ${transactionId} (${info.transaction_status || 'S'})`,
          metadata: {
            gatewayProvider: 'paypal',
            providerReference: transactionId,
            paypalEnvironment: auth.environment,
            providerDetails: {
              captureId: transactionId,
              payerEmail,
              paypalInvoiceId: info.invoice_id || '',
            },
            importedAt: new Date().toISOString(),
          },
        });
        imported += 1;
      }
    } catch (error) {
      console.warn('BookingPaymentService: PayPal import skipped:', error?.response?.data?.message || error.message);
      warning = error.code === 'PAYPAL_GATEWAY_UNAVAILABLE' || error.code === 'PAYPAL_CREDENTIALS_MISSING'
        ? error.message
        : 'PayPal-Transaktionen konnten nicht abgerufen werden. Bereits erfasste PayPal-Zahlungen wurden verknüpft.';
    }

    const overview = await BookingPaymentService.getOverview(bookingId);
    return { ...overview, importResult: { imported, updated, linked, warning } };
  }
}

module.exports = BookingPaymentService;
