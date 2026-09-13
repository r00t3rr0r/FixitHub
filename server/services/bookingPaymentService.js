const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Order = require('../models/Order');
const Invoice = require('../models/Invoice');
const Payment = require('../models/Payment');
const PaymentAllocation = require('../models/PaymentAllocation');
const User = require('../models/User');
const FinancialService = require('./financialService');
const PaypalService = require('./paypalService');

const MANUAL_PAYMENT_METHODS = ['cash', 'bank_transfer', 'sepa', 'credit_card', 'debit_card', 'paypal', 'invoice'];
const OPEN_INVOICE_STATUSES = ['draft', 'pending_approval', 'sent', 'viewed', 'partially_paid', 'overdue'];
const COUNTABLE_PAYMENT_STATUSES = ['completed', 'processing', 'pending'];
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

    const invoiceSummaries = invoices.map((invoice) => ({
      _id: invoice._id,
      invoiceNumber: invoice.invoiceNumber,
      status: invoice.status,
      isCreditNote: Boolean(invoice.isCreditNote),
      total: round2(invoice.total),
      paidAmount: round2(invoice.paidAmount || 0),
      openAmount: round2(Math.max(Number(invoice.total || 0) - Number(invoice.paidAmount || 0), 0)),
      dueDate: invoice.dueDate,
      createdAt: invoice.createdAt,
      isOpen: OPEN_INVOICE_STATUSES.includes(invoice.status) && !invoice.isCreditNote,
    }));

    const orderValue = round2(booking.totalCost || 0);
    const invoicedTotal = round2(invoiceSummaries
      .filter((invoice) => !invoice.isCreditNote && invoice.status !== 'cancelled')
      .reduce((sum, invoice) => sum + invoice.total, 0));
    const creditedTotal = round2(invoiceSummaries
      .filter((invoice) => invoice.isCreditNote)
      .reduce((sum, invoice) => sum + Math.abs(invoice.total), 0));
    const receivedTotal = round2(enrichedPayments
      .filter((payment) => COUNTABLE_PAYMENT_STATUSES.includes(payment.status))
      .reduce((sum, payment) => sum + payment.amount - Number(payment.refundAmount || 0), 0));
    const allocatedTotal = round2(enrichedPayments.reduce((sum, payment) => sum + payment.allocatedAmount, 0));
    const invoiceOpenTotal = round2(invoiceSummaries
      .filter((invoice) => invoice.isOpen)
      .reduce((sum, invoice) => sum + invoice.openAmount, 0));

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
        openOrderBalance: round2(orderValue - receivedTotal),
        isOverpaid: receivedTotal - orderValue > 0.01,
        isFullyPaid: orderValue > 0 && receivedTotal >= orderValue - 0.01,
      },
      paymentMethods: MANUAL_PAYMENT_METHODS,
    };
  }

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

    let targetInvoice = null;
    if (data.invoiceId) {
      targetInvoice = invoices.find((invoice) => String(invoice._id) === String(data.invoiceId)) || null;
      if (!targetInvoice) {
        throw buildValidationError('Die gewählte Rechnung gehört nicht zu diesem Auftrag.');
      }
    }

    const customer = booking.customerId ? await User.findById(booking.customerId).select('firstName lastName email').lean() : null;
    const customerName = customer
      ? [customer.firstName, customer.lastName].filter(Boolean).join(' ').trim() || customer.email
      : [booking.guestInfo?.firstName, booking.guestInfo?.lastName].filter(Boolean).join(' ').trim();

    const payment = await Payment.create({
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
    });

    if (targetInvoice) {
      const allocatable = Math.min(amount, round2(Number(targetInvoice.total || 0) - Number(targetInvoice.paidAmount || 0)));
      if (allocatable > 0) {
        await BookingPaymentService.allocatePayment(bookingId, payment._id, {
          invoiceId: targetInvoice._id,
          amount: allocatable,
          note,
        });
      }
    }

    return BookingPaymentService.getOverview(bookingId);
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
      throw buildValidationError(`Rechnungen im Status "${invoice.status}" können keine weiteren Zahlungen aufnehmen.`);
    }

    const existingAllocations = await PaymentAllocation.find({ paymentId: payment._id }).lean();
    const alreadyAllocated = round2(existingAllocations.reduce((sum, entry) => sum + Number(entry.allocatedAmount || 0), 0));
    const effectiveAmount = round2(Number(payment.amount || 0) - Number(payment.refundAmount || 0));
    const unallocated = round2(effectiveAmount - alreadyAllocated);

    if (unallocated <= 0) {
      throw buildValidationError('Diese Zahlung ist bereits vollständig zugeordnet.');
    }

    const requestedAmount = data.amount === undefined || data.amount === null || data.amount === ''
      ? Math.min(unallocated, round2(Number(invoice.total || 0) - Number(invoice.paidAmount || 0)))
      : parseAmount(data.amount, 'Zuordnungsbetrag');

    if (requestedAmount <= 0) {
      throw buildValidationError('Es ist kein zuordenbarer Betrag vorhanden.');
    }
    if (requestedAmount > unallocated + 0.01) {
      throw buildValidationError(`Der Zuordnungsbetrag übersteigt den nicht zugeordneten Zahlungsbetrag (${unallocated.toFixed(2)} €).`);
    }

    const invoiceOpenAmount = round2(Number(invoice.total || 0) - Number(invoice.paidAmount || 0));
    if (requestedAmount > invoiceOpenAmount + 0.01) {
      throw buildValidationError(`Der Zuordnungsbetrag übersteigt den offenen Rechnungsbetrag (${invoiceOpenAmount.toFixed(2)} €).`);
    }

    const allocatedAmount = Math.min(requestedAmount, unallocated, invoiceOpenAmount);

    await PaymentAllocation.create({
      paymentId: payment._id,
      invoiceId: invoice._id,
      orderId: invoice.orderId || payment.orderId || undefined,
      allocatedAmount,
      allocatedAt: new Date(),
      note: sanitizeText(data.note, MAX_NOTE_LENGTH) || `Zuordnung zu Rechnung ${invoice.invoiceNumber || invoice._id}`,
    });

    payment.allocatedAmount = round2(alreadyAllocated + allocatedAmount);
    if (!payment.invoiceId) payment.invoiceId = invoice._id;
    if (!payment.bookingId) payment.bookingId = booking._id;
    await payment.save();

    await BookingPaymentService.applyInvoicePaymentDelta(invoice._id, allocatedAmount);

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

    await BookingPaymentService.applyInvoicePaymentDelta(invoiceId, -releasedAmount);

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

  /** Applies a paid-amount delta to an invoice and re-syncs order & booking state. */
  static async applyInvoicePaymentDelta(invoiceId, delta) {
    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) return;

    const paidAmount = round2(Math.max(Number(invoice.paidAmount || 0) + Number(delta || 0), 0));

    invoice.paidAmount = paidAmount;

    if (paidAmount >= Number(invoice.total || 0) - 0.01 && Number(invoice.total || 0) > 0) {
      invoice.status = 'paid';
      invoice.paidAt = invoice.paidAt || new Date();
    } else if (paidAmount > 0) {
      invoice.status = 'partially_paid';
      invoice.paidAt = null;
    } else if (['paid', 'partially_paid'].includes(invoice.status)) {
      invoice.status = invoice.dueDate && new Date(invoice.dueDate) < new Date() ? 'overdue' : 'sent';
      invoice.paidAt = null;
    }

    await invoice.save();

    await FinancialService.syncOrderPaymentTracking(invoice);
    await FinancialService.syncBookingPaymentStatus(invoice);
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
