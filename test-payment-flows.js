/**
 * Regressionstest Zahlungsfluss (Track "payments": T04, T05, T06, T07, T08, T19, T25,
 * Ueberzahlungs-Sichtbarkeit und Erstattungs-Idempotenz).
 *
 * Jeder Abschnitt bildet einen Fall aus Sophies Abnahmetest vom 24.09.2026 nach und
 * prueft den Zustand so, wie ihn Liste, Detail und Buchungsuebersicht lesen - nicht den
 * Rueckgabewert einer einzelnen Funktion.
 *
 * Externe Anbieter sind GEMOCKT (kein PayPal, kein SMTP): PayPal-Erstattung und E-Mail-
 * Versand werden durch Stubs ersetzt, die ausdruecklich auch Fehler und "PENDING"
 * liefern. Das ist Mock-Evidenz, keine Sandbox-Evidenz.
 *
 * Aufruf (benoetigt eine WEGWERF-Datenbank, niemals die Entwicklungs-DB):
 *   TEST_MONGODB_URI=mongodb://127.0.0.1:27099/t_payments node test-payment-flows.js
 *   DEBUG_TEST=1 zeigt zusaetzlich die Service-Logs.
 */
const path = require('path');
const fs = require('fs');
const mongoose = require(path.join(__dirname, 'server/node_modules/mongoose'));

const MODELS_DIR = path.join(__dirname, 'server/models');
const SERVICES_DIR = path.join(__dirname, 'server/services');
const URI = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27099/t_payment_flows';

// Sicherheitsnetz: Dieser Test ruft dropDatabase() auf. Er darf ausschliesslich gegen eine
// ausdruecklich angegebene Wegwerf-Datenbank laufen - nie gegen die Entwicklungsdatenbank.
// Erlaubt ist nur: lokaler Host, AUSDRUECKLICH angegebener Port ungleich 27017, und ein
// Datenbankname, der nicht der Name der Entwicklungsdatenbank aus .env ist.
function isUnsafeTestUri(uri) {
  const text = String(uri || '');
  const match = text.match(/^mongodb:\/\/(?:[^@/]*@)?(\[[^\]]+\]|[^:/,?]+)(?::(\d+))?\/([^/?]+)/i);
  if (!match) return true; // mongodb+srv, mehrere Hosts oder unlesbar
  const host = match[1].replace(/^\[|\]$/g, '').toLowerCase();
  const port = match[2];
  const dbName = match[3].toLowerCase();
  if (!['127.0.0.1', 'localhost', '::1'].includes(host)) return true;
  if (!port || port === '27017') return true;
  let devDbName = 'fixithub';
  try {
    const envText = require('fs').readFileSync(require('path').join(__dirname, '.env'), 'utf8');
    const devUrl = (envText.match(/^DATABASE_URL=(.*)$/m) || [])[1] || '';
    const devMatch = devUrl.match(/\/([^/?\s]+)(?:\?|\s*$)/);
    if (devMatch) devDbName = devMatch[1].toLowerCase();
  } catch (error) {
    /* ohne .env gilt der Standardname */
  }
  return dbName === devDbName || dbName === 'fixithub';
}

const out = (...args) => process.stdout.write(`${args.join(' ')}\n`);
if (!process.env.DEBUG_TEST) {
  console.log = () => {};
  console.warn = () => {};
  console.error = () => {};
}

let pass = 0;
let fail = 0;
const check = (condition, message, actual) => {
  if (condition) {
    pass += 1;
    out(`  PASS ${message} :: ${actual}`);
  } else {
    fail += 1;
    out(`  FAIL ${message} :: ${actual}`);
  }
};
const runSection = async (title, fn) => {
  out(`\n[${title}]`);
  try {
    await fn();
  } catch (error) {
    fail += 1;
    out(`  FAIL Abschnitt abgebrochen :: ${error.message}`);
  }
};
const DAY_MS = 24 * 60 * 60 * 1000;
const round2 = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

async function main() {
  if (isUnsafeTestUri(URI)) {
    throw new Error('Dieser Test darf nicht gegen die Entwicklungsdatenbank laufen.');
  }

  await mongoose.connect(URI);
  await mongoose.connection.dropDatabase();

  fs.readdirSync(MODELS_DIR)
    .filter((file) => file.endsWith('.js'))
    .forEach((file) => {
      try {
        require(path.join(MODELS_DIR, file));
      } catch (error) {
        /* Modelle mit optionalen Abhaengigkeiten ueberspringen */
      }
    });

  const User = mongoose.model('User');
  const Order = mongoose.model('Order');
  const Booking = mongoose.model('Booking');
  const Service = mongoose.model('Service');
  const Invoice = mongoose.model('Invoice');
  const Payment = mongoose.model('Payment');
  const PaymentAllocation = mongoose.model('PaymentAllocation');
  const PaymentRequest = mongoose.model('PaymentRequest');
  await Promise.all([Payment.init(), PaymentAllocation.init(), Invoice.init()]);

  const FinancialService = require(path.join(SERVICES_DIR, 'financialService'));
  const PaymentService = require(path.join(SERVICES_DIR, 'paymentService'));
  const BookingPaymentService = require(path.join(SERVICES_DIR, 'bookingPaymentService'));
  const BookingService = require(path.join(SERVICES_DIR, 'bookingService'));
  const PaypalService = require(path.join(SERVICES_DIR, 'paypalService'));
  const EmailService = require(path.join(SERVICES_DIR, 'emailService'));

  // --- Externe Anbieter stubben: niemals echte Mails, niemals echtes Geld ---------
  const sentEmails = [];
  let emailMode = 'success';
  const emailStub = async (name, to, variables) => {
    sentEmails.push({ name, to, variables });
    if (emailMode === 'fail') return { success: false, error: 'SMTP nicht erreichbar (Test)' };
    return { success: true, messageId: `test-${sentEmails.length}` };
  };
  EmailService.sendTemplateEmail = emailStub;
  EmailService.sendTriggerEmail = (trigger, to, variables) => emailStub(`trigger:${trigger}`, to, variables);
  EmailService.buildSystemUrl = async (p) => `https://test.invalid${p}`;

  const paypalRefundCalls = [];
  let paypalRefundMode = 'COMPLETED';
  PaypalService.getActiveGateway = async () => ({ provider: 'paypal', isActive: true, configuration: { environment: 'sandbox' } });
  PaypalService.getAccessToken = async () => ({ accessToken: 'test', baseUrl: 'https://sandbox.invalid', environment: 'sandbox' });
  PaypalService.refundCapture = async (captureId, amount, options = {}) => {
    paypalRefundCalls.push({ captureId, amount, requestId: options.requestId });
    if (paypalRefundMode === 'ERROR') {
      const error = new Error('PayPal: UNPROCESSABLE_ENTITY (Test)');
      error.statusCode = 422;
      throw error;
    }
    return { id: `REF-${paypalRefundCalls.length}`, status: paypalRefundMode, amount: { value: String(amount), currency_code: 'EUR' } };
  };

  const service = await Service.create({ name: 'Displaytausch', description: 'Display', category: 'screen', price: 50 });

  let seq = 0;
  const makeCustomer = async (extra = {}) => {
    seq += 1;
    return User.create({
      name: `Testkunde ${seq}`,
      email: `kunde${seq}@test.invalid`,
      role: 'customer',
      customerNumber: `K-PAY-${seq}`,
      ...extra,
    });
  };
  const makeOrder = async (customer, price, extra = {}) => {
    seq += 1;
    return Order.create({
      customerId: customer._id,
      orderNumber: `ORD-PAY-${String(seq).padStart(3, '0')}`,
      deviceBrand: 'Apple',
      deviceModel: 'iPhone 15',
      deviceType: 'Smartphone',
      errorDescription: 'Display defekt',
      services: [{ serviceId: service._id, name: 'Displaytausch', price, quantity: 1, estimatedTime: 30 }],
      totalCost: price,
      discount: 0,
      status: 'completed',
      ...extra,
    });
  };
  const makeBooking = async (customer, prices, bookingExtra = {}) => {
    const orders = [];
    for (const price of prices) orders.push(await makeOrder(customer, price));
    const booking = await Booking.create({
      customerId: customer._id,
      orderIds: orders.map((order) => order._id),
      items: orders.map((order) => ({ type: 'repair', orderId: order._id, orderNumber: order.orderNumber, cost: order.totalCost })),
      totalCost: round2(prices.reduce((sum, price) => sum + price, 0)),
      status: 'processing',
      ...bookingExtra,
    });
    await Order.updateMany({ _id: { $in: orders.map((order) => order._id) } }, { $set: { bookingId: booking._id } });
    return { booking, orders };
  };
  // Vorauszahlung wie aus dem Checkout: bookingId + orderId des ersten Auftrags.
  const prepay = async (booking, order, amount, extra = {}) => Payment.create({
    bookingId: booking._id,
    orderId: order._id,
    customerId: booking.customerId,
    amount,
    paymentMethod: 'paypal',
    status: 'completed',
    source: 'checkout',
    processedAt: new Date(),
    metadata: { providerReference: `CAP-${booking._id}`, providerDetails: { captureId: `CAP-${booking._id}` } },
    ...extra,
  });
  const countablePaid = async (invoiceId) => {
    const balance = await PaymentService.computeInvoiceBalance(invoiceId);
    return balance;
  };
  const listRow = async (invoice) => {
    const list = await FinancialService.getInvoices({ search: invoice.invoiceNumber, limit: 50 });
    return list.invoices.find((row) => String(row._id) === String(invoice._id));
  };

  // =====================================================================================
  await runSection('T25 Zahlungsziel: Datum und Text aus EINER gespeicherten Bedingung', async () => {
    // Kundenstamm wie in Sophies Fall: 7 Tage Frist, Freitext "Net 30".
    const customer = await makeCustomer({ paymentDueDays: 7, paymentTerms: 'Net 30' });
    const order = await makeOrder(customer, 49.9);
    const invoice = await FinancialService.createInvoiceFromOrder(String(order._id));
    const days = Math.round((new Date(invoice.dueDate) - new Date(invoice.createdAt)) / DAY_MS);
    check(days === 7, 'Faelligkeit = Rechnungsdatum + 7 Tage', days);
    check(/\b7\b/.test(invoice.paymentTerms) && !/30/.test(invoice.paymentTerms), 'Zahlungsziel-Text nennt 7 Tage, nicht 30', invoice.paymentTerms);
    check(invoice.paymentDueDays === 7, 'Gespeicherte Bedingung paymentDueDays = 7', invoice.paymentDueDays);

    // Ein Erstellungspfad, der nur ein Datum setzt (z.B. Buchungsrechnung), darf nicht
    // den Schema-Default "Net 30" neben ein 7-Tage-Datum stellen.
    const direct = await Invoice.create({
      customerId: customer._id,
      customerName: customer.name,
      customerEmail: customer.email,
      items: [{ description: 'Test', quantity: 1, unitPrice: 10, total: 10, type: 'service' }],
      taxRate: 19,
      dueDate: new Date(Date.now() + 7 * DAY_MS),
      status: 'sent',
    });
    check(/\b7\b/.test(direct.paymentTerms) && !/30/.test(direct.paymentTerms), 'Nur Datum gesetzt -> Text folgt dem Datum', direct.paymentTerms);

    // Umgekehrt: nur die Frist gesetzt -> Datum folgt der Frist.
    const byDays = await Invoice.create({
      customerId: customer._id,
      customerName: customer.name,
      customerEmail: customer.email,
      items: [{ description: 'Test', quantity: 1, unitPrice: 10, total: 10, type: 'service' }],
      taxRate: 19,
      paymentDueDays: 14,
      status: 'sent',
    });
    const byDaysDays = Math.round((new Date(byDays.dueDate) - new Date(byDays.createdAt)) / DAY_MS);
    check(byDaysDays === 14 && /\b14\b/.test(byDays.paymentTerms), 'Nur Frist gesetzt -> Datum und Text = 14 Tage', `${byDaysDays} / ${byDays.paymentTerms}`);

    const profile = await FinancialService.resolveFinancialProfile({ customerId: customer._id });
    check(/\b7\b/.test(profile.paymentTerms) && profile.paymentDueDays === 7, 'Kundenprofil: Text und Tage stimmen ueberein', `${profile.paymentDueDays} / ${profile.paymentTerms}`);
  });

  // =====================================================================================
  await runSection('T04 100 vorausbezahlt, Auftrag 50, Rechnung 50, Erstattung 50 -> Beleg bleibt 50', async () => {
    const customer = await makeCustomer();
    const { booking, orders } = await makeBooking(customer, [50]);
    const payment = await prepay(booking, orders[0], 100);
    const invoice = await FinancialService.generateFromRepairOrders([String(orders[0]._id)], {});
    const before = await countablePaid(invoice._id);
    check(before.allocated === 50 && before.open === 0, 'Rechnung 50 aus Vorauszahlung beglichen', JSON.stringify({ allocated: before.allocated, open: before.open }));
    const overviewBefore = await BookingPaymentService.getOverview(String(booking._id));
    check(overviewBefore.summary.overpaidTotal === 50, 'Buchung zeigt Ueberzahlung 50', overviewBefore.summary.overpaidTotal);

    const rowBefore = await listRow(invoice);
    check(rowBefore?.balance?.refundPending === 50, 'Rechnungsliste: Erstattung offen 50 sichtbar', rowBefore?.balance?.refundPending);
    check(rowBefore?.balance?.received === 100, 'Rechnungsliste: insgesamt eingegangen 100 sichtbar', rowBefore?.balance?.received);
    const detailBefore = await FinancialService.getInvoiceDetails(String(invoice._id));
    check(detailBefore.balance?.refundPending === 50, 'Rechnungsdetail: Erstattung offen 50 sichtbar', detailBefore.balance?.refundPending);

    const result = await FinancialService.handleOverpayment(String(booking._id), {
      amount: 50, processRefund: true, refundMode: 'manual', reason: 'Erstattung Ueberzahlung',
    });
    const creditNotes = await Invoice.countDocuments({ creditNoteOf: invoice._id });
    check(creditNotes === 0, 'KEINE automatische Gutschrift', creditNotes);
    check(!result.creditNote, 'Antwort enthaelt keine Gutschrift', String(result.creditNote));
    const refreshedPayment = await Payment.findById(payment._id).lean();
    check(refreshedPayment.refundAmount === 50 && refreshedPayment.status === 'completed', 'Zahlung: 50 erstattet, Rest bleibt gueltig', `${refreshedPayment.refundAmount} / ${refreshedPayment.status}`);
    const refreshedInvoice = await Invoice.findById(invoice._id).lean();
    check(refreshedInvoice.total === 50, 'Belegsumme bleibt 50', refreshedInvoice.total);
    const after = await countablePaid(invoice._id);
    check(after.open === 0 && after.allocated === 50, 'Rechnung weiterhin bezahlt', JSON.stringify({ allocated: after.allocated, open: after.open }));
    const overviewAfter = await BookingPaymentService.getOverview(String(booking._id));
    check(overviewAfter.summary.overpaidTotal === 0 && overviewAfter.summary.openOrderBalance === 0, 'Buchung: Ueberzahlung 0, offen 0', JSON.stringify({ over: overviewAfter.summary.overpaidTotal, open: overviewAfter.summary.openOrderBalance }));
    const refreshedOrder = await Order.findById(orders[0]._id).lean();
    check(refreshedOrder.paymentStatus === 'paid', 'Auftrag bleibt "bezahlt" (nicht "erstattet")', refreshedOrder.paymentStatus);

    // Doppelklick: der Client schickt den vorbelegten Betrag erneut.
    await FinancialService.handleOverpayment(String(booking._id), {
      amount: 50, processRefund: true, refundMode: 'manual', reason: 'Erstattung Ueberzahlung',
    }).catch(() => {});
    const twice = await Payment.findById(payment._id).lean();
    check(twice.refundAmount === 50, 'Zweiter Klick erstattet nicht erneut', twice.refundAmount);
  });

  // =====================================================================================
  await runSection('T05 100 vorausbezahlt, Rechnung 150, offen 50, Nachzahlung 50 -> ueberall bezahlt', async () => {
    const customer = await makeCustomer();
    const { booking, orders } = await makeBooking(customer, [150]);
    await prepay(booking, orders[0], 100);
    const invoice = await FinancialService.generateFromRepairOrders([String(orders[0]._id)], {});
    const mid = await countablePaid(invoice._id);
    check(mid.allocated === 100 && mid.open === 50, 'Nach Vorauszahlung: 100 zugeordnet, 50 offen', JSON.stringify({ allocated: mid.allocated, open: mid.open }));
    await FinancialService.addInvoicePayment(String(invoice._id), { amount: 50, paymentMethod: 'bank_transfer' });
    const row = await listRow(invoice);
    const detail = await FinancialService.getInvoiceDetails(String(invoice._id));
    const overview = await BookingPaymentService.getOverview(String(booking._id));
    const storedInvoice = await Invoice.findById(invoice._id).lean();
    const storedOrder = await Order.findById(orders[0]._id).lean();
    const storedBooking = await Booking.findById(booking._id).lean();
    check(storedInvoice.status === 'paid', 'Belegstatus bezahlt', storedInvoice.status);
    check(row.paymentState === 'paid' && row.balance.open === 0, 'Liste: bezahlt, offen 0', `${row.paymentState} / ${row.balance.open}`);
    check(detail.balance.paymentState === 'paid' && detail.balance.open === 0, 'Detail: bezahlt, offen 0', `${detail.balance.paymentState} / ${detail.balance.open}`);
    check(overview.summary.isFullyPaid && overview.summary.openOrderBalance === 0, 'Buchungsuebersicht: vollstaendig bezahlt', `${overview.summary.isFullyPaid} / ${overview.summary.openOrderBalance}`);
    check(storedBooking.billingStatus === 'paid', 'Buchung billingStatus bezahlt', storedBooking.billingStatus);
    check(storedOrder.paymentStatus === 'paid', 'Auftrag paymentStatus bezahlt', storedOrder.paymentStatus);
  });

  // =====================================================================================
  await runSection('T06 "Bezahlt" setzen bucht den echten Fehlbetrag genau einmal', async () => {
    const customer = await makeCustomer();
    const { booking, orders } = await makeBooking(customer, [150]);
    await prepay(booking, orders[0], 100);
    const invoice = await FinancialService.generateFromRepairOrders([String(orders[0]._id)], {});
    await FinancialService.changeInvoiceStatus(String(invoice._id), 'paid', { paymentMethod: 'cash', paidAt: new Date().toISOString() });
    const payments = await Payment.find({ bookingId: booking._id }).lean();
    const received = round2(payments.filter((p) => p.status === 'completed').reduce((s, p) => s + p.amount - (p.refundAmount || 0), 0));
    check(payments.length === 2, 'Genau eine zusaetzliche Zahlung angelegt', payments.length);
    check(received === 150, 'Eingegangen gesamt = 150 (100 + fehlende 50)', received);
    const balance = await countablePaid(invoice._id);
    check(balance.allocated === 150 && balance.open === 0 && balance.overpaid === 0, 'Beleg: 150 zugeordnet, offen 0, keine Ueberzahlung', JSON.stringify({ a: balance.allocated, o: balance.open, u: balance.overpaid }));
    const storedOrder = await Order.findById(orders[0]._id).lean();
    check(storedOrder.paymentStatus === 'paid', 'Auftrag bezahlt (dieselbe Rechnung wie Beleg)', storedOrder.paymentStatus);
    // Neuableitung darf den Stand nicht wieder kippen.
    await FinancialService.recalculateInvoicePaidAmounts([invoice._id]);
    const afterRecalc = await Invoice.findById(invoice._id).lean();
    check(afterRecalc.status === 'paid' && afterRecalc.paidAmount === 150, 'Nach Neuableitung weiterhin bezahlt / 150', `${afterRecalc.status} / ${afterRecalc.paidAmount}`);

    // Bereits voll bezahlter Altbeleg im Status "versendet": kein zusaetzliches Geld.
    const customer2 = await makeCustomer();
    const { booking: booking2, orders: orders2 } = await makeBooking(customer2, [80]);
    await prepay(booking2, orders2[0], 80);
    const invoice2 = await FinancialService.generateFromRepairOrders([String(orders2[0]._id)], {});
    await Invoice.updateOne({ _id: invoice2._id }, { $set: { status: 'sent' } });
    await FinancialService.changeInvoiceStatus(String(invoice2._id), 'paid', { paymentMethod: 'cash', paidAt: new Date().toISOString() });
    const payments2 = await Payment.countDocuments({ bookingId: booking2._id });
    check(payments2 === 1, 'Voll bezahlter Beleg: keine zusaetzliche Zahlung', payments2);
  });

  // =====================================================================================
  await runSection('T07 300 Teilzahlung: sichtbar, Versandstatus unberuehrt, genau eine Wirkung', async () => {
    const customer = await makeCustomer();
    const { booking, orders } = await makeBooking(customer, [500], { shippingStatus: 'shipped' });
    const invoice = await FinancialService.generateFromRepairOrders([String(orders[0]._id)], {});
    await Promise.all([1, 2, 3].map(() => FinancialService.addInvoicePayment(String(invoice._id), {
      amount: 300, paymentMethod: 'bank_transfer', paymentDate: new Date().toISOString(),
    }).catch((error) => ({ error }))));
    const count = await Payment.countDocuments({ invoiceId: invoice._id });
    check(count === 1, 'Drei gleichzeitige identische Klicks -> genau eine Zahlung', count);
    const row = await listRow(invoice);
    check(row.balance.total === 500 && row.balance.allocated === 300 && row.balance.open === 200, 'Liste: Summe 500 / bezahlt 300 / offen 200', JSON.stringify(row.balance));
    check(row.paymentState === 'partially_paid', 'Zahlungsstand teilbezahlt', row.paymentState);
    const storedBooking = await Booking.findById(booking._id).lean();
    check(storedBooking.billingStatus === 'partially-paid', 'Buchung teilbezahlt', storedBooking.billingStatus);
    check(storedBooking.shippingStatus === 'shipped' || storedBooking.shippingStatus === booking.shippingStatus, 'Versandstatus unveraendert', storedBooking.shippingStatus);
    await FinancialService.autoAllocateUnallocatedPayments(String(booking._id));
    await FinancialService.autoAllocateUnallocatedPayments(String(booking._id));
    const allocations = await PaymentAllocation.countDocuments({ invoiceId: invoice._id });
    check(allocations === 1, 'Wiederholte Zuordnungslaeufe -> eine Zuordnung', allocations);
  });

  // =====================================================================================
  await runSection('T08 Mehrere Auftraege/Rechnungen, Teilerstattung, Zuordnung der Ueberzahlung', async () => {
    const customer = await makeCustomer();
    const { booking, orders } = await makeBooking(customer, [50, 100]);
    const payment = await prepay(booking, orders[0], 200);
    const invA = await BookingService.createInvoice(String(booking._id), { invoiceMode: 'order', orderId: String(orders[0]._id) });
    const invB = await BookingService.createInvoice(String(booking._id), { invoiceMode: 'order', orderId: String(orders[1]._id) });
    const balA = await countablePaid(invA._id);
    const balB = await countablePaid(invB._id);
    check(balA.open === 0 && balB.open === 0, 'Beide Rechnungen aus einer Zahlung beglichen', `${balA.open} / ${balB.open}`);
    const overview = await BookingPaymentService.getOverview(String(booking._id));
    check(overview.summary.overpaidTotal === 50, 'Ueberzahlung 50 auf Buchungsebene', overview.summary.overpaidTotal);
    const rowA = await listRow(invA);
    const rowB = await listRow(invB);
    const pendingSum = round2(Number(rowA.balance.refundPending || 0) + Number(rowB.balance.refundPending || 0));
    check(pendingSum === 50, 'Erstattung offen genau einmal ausgewiesen (nicht je Rechnung)', `${rowA.balance.refundPending} + ${rowB.balance.refundPending}`);
    const storedOrders = await Order.find({ _id: { $in: orders.map((o) => o._id) } }).lean();
    check(storedOrders.every((o) => o.paymentStatus === 'paid'), 'Beide Auftraege bezahlt', storedOrders.map((o) => o.paymentStatus).join(','));

    await FinancialService.processRefund(String(payment._id), 25, 'Teilerstattung', { mode: 'manual' });
    const overview2 = await BookingPaymentService.getOverview(String(booking._id));
    check(overview2.summary.overpaidTotal === 25, 'Nach Teilerstattung 25: Ueberzahlung 25', overview2.summary.overpaidTotal);
    const balA2 = await countablePaid(invA._id);
    const balB2 = await countablePaid(invB._id);
    check(balA2.open === 0 && balB2.open === 0, 'Rechnungen bleiben bezahlt', `${balA2.open} / ${balB2.open}`);

    // Teilrechnung: Vorauszahlung fuer zwei Auftraege, erst EIN Auftrag berechnet.
    // Das Geld fuer den noch nicht berechneten Auftrag ist KEINE Ueberzahlung.
    const { booking: partialBooking, orders: partialOrders } = await makeBooking(customer, [50, 100]);
    await prepay(partialBooking, partialOrders[0], 150);
    const partialInvoice = await BookingService.createInvoice(String(partialBooking._id), { invoiceMode: 'order', orderId: String(partialOrders[0]._id) });
    const partialOverview = await BookingPaymentService.getOverview(String(partialBooking._id));
    check(partialOverview.summary.overpaidTotal === 0 && partialOverview.summary.openOrderBalance === 0, 'Teilrechnung: keine Scheinueberzahlung, nichts offen', JSON.stringify({ over: partialOverview.summary.overpaidTotal, open: partialOverview.summary.openOrderBalance, ref: partialOverview.summary.referenceTotal }));
    const partialRow = await listRow(partialInvoice);
    check(Number(partialRow.balance.refundPending || 0) === 0, 'Teilrechnung: keine "Erstattung offen" an der Rechnung', partialRow.balance.refundPending);
    const bulk = await PaymentService.getBookingBalancesBulk([String(partialBooking._id)]);
    const bulkEntry = bulk.get(String(partialBooking._id));
    check(bulkEntry.overpaid === 0 && bulkEntry.reference === 150, 'Listenweg (Bulk) rechnet gleich: Bezug 150, Ueberzahlung 0', JSON.stringify({ ref: bulkEntry.reference, over: bulkEntry.overpaid }));

    // Dieselbe Leistung darf nicht auf zwei Rechnungen landen.
    const loose = await makeOrder(customer, 70);
    await FinancialService.createInvoiceFromOrder(String(loose._id));
    let secondError = null;
    try {
      await FinancialService.createInvoiceFromOrder(String(loose._id));
    } catch (error) {
      secondError = error;
    }
    check(secondError && secondError.statusCode === 409, 'Zweite Rechnung fuer denselben Auftrag abgelehnt (409)', secondError ? `${secondError.statusCode} ${secondError.message}` : 'keine Ablehnung');
    let thirdError = null;
    try {
      await FinancialService.generateFromRepairOrders([String(loose._id)], {});
    } catch (error) {
      thirdError = error;
    }
    check(thirdError && thirdError.statusCode === 409, 'Sammelrechnung mit bereits berechnetem Auftrag abgelehnt (409)', thirdError ? `${thirdError.statusCode} ${thirdError.message}` : 'keine Ablehnung');
  });

  // =====================================================================================
  await runSection('Erstattungen: kumulativ, idempotent, ausstehend zaehlt nicht', async () => {
    const customer = await makeCustomer();
    const { booking, orders } = await makeBooking(customer, [40]);
    const payment = await prepay(booking, orders[0], 100);

    await FinancialService.processRefund(String(payment._id), 10, 'Teil 1', { mode: 'manual', idempotencyKey: 'r-1' });
    await FinancialService.processRefund(String(payment._id), 10, 'Teil 1', { mode: 'manual', idempotencyKey: 'r-1' });
    let stored = await Payment.findById(payment._id).lean();
    check(stored.refundAmount === 10, 'Gleicher Schluessel zweimal -> eine Erstattung', stored.refundAmount);
    await FinancialService.processRefund(String(payment._id), 15, 'Teil 2', { mode: 'manual' });
    stored = await Payment.findById(payment._id).lean();
    check(stored.refundAmount === 25, 'Zwei verschiedene Teilerstattungen addieren sich (10 + 15)', stored.refundAmount);

    let overError = null;
    try {
      await FinancialService.processRefund(String(payment._id), 80, 'zu viel', { mode: 'manual' });
    } catch (error) {
      overError = error;
    }
    check(overError && overError.statusCode === 400, 'Erstattung ueber den Restbetrag abgelehnt', overError ? overError.message : 'keine Ablehnung');

    paypalRefundMode = 'PENDING';
    const pendingResult = await FinancialService.processRefund(String(payment._id), 5, 'PayPal', { mode: 'gateway' });
    stored = await Payment.findById(payment._id).lean();
    check(stored.refundAmount === 25, 'PayPal-Erstattung PENDING zaehlt nicht', stored.refundAmount);
    check(pendingResult.status === 'pending', 'Antwort meldet "ausstehend"', pendingResult.status);
    check(paypalRefundCalls.length === 1 && paypalRefundCalls[0].captureId === `CAP-${booking._id}`, 'PayPal-Refund mit Capture-ID aufgerufen', JSON.stringify(paypalRefundCalls[0]));

    // Webhook bestaetigt die Erstattung - zweimal zugestellt.
    const refundId = pendingResult.gatewayReference;
    await FinancialService.applyGatewayRefundUpdate({ provider: 'paypal', captureId: `CAP-${booking._id}`, refundId, amount: 5, status: 'COMPLETED' });
    await FinancialService.applyGatewayRefundUpdate({ provider: 'paypal', captureId: `CAP-${booking._id}`, refundId, amount: 5, status: 'COMPLETED' });
    stored = await Payment.findById(payment._id).lean();
    check(stored.refundAmount === 30, 'Webhook COMPLETED doppelt -> genau +5', stored.refundAmount);

    paypalRefundMode = 'ERROR';
    let gatewayError = null;
    try {
      await FinancialService.processRefund(String(payment._id), 5, 'PayPal Fehler', { mode: 'gateway' });
    } catch (error) {
      gatewayError = error;
    }
    stored = await Payment.findById(payment._id).lean();
    check(gatewayError && stored.refundAmount === 30, 'Anbieterfehler -> Fehler, nichts gezaehlt', gatewayError ? gatewayError.message : 'kein Fehler');

    const cashPayment = await Payment.create({ bookingId: booking._id, amount: 20, paymentMethod: 'cash', status: 'completed', source: 'manual' });
    let noGateway = null;
    try {
      await FinancialService.processRefund(String(cashPayment._id), 5, 'bar', { mode: 'gateway' });
    } catch (error) {
      noGateway = error;
    }
    const storedCash = await Payment.findById(cashPayment._id).lean();
    check(noGateway && !storedCash.refundAmount, 'Barzahlung ueber Gateway: abgelehnt statt Scheinerfolg', noGateway ? noGateway.message : 'kein Fehler');
  });

  // =====================================================================================
  await runSection('PayPal-Webhooks: Refund-Ressource, Wiederholung, Reihenfolge', async () => {
    const customer = await makeCustomer();
    const { booking, orders } = await makeBooking(customer, [60]);
    const payment = await prepay(booking, orders[0], 100);
    const captureId = `CAP-${booking._id}`;
    // Form der PayPal-Refund-Ressource (PAYMENT.CAPTURE.REFUNDED): id = Refund-ID,
    // die Capture steht im Link rel="up".
    const resource = {
      id: 'WH-REF-1',
      status: 'COMPLETED',
      amount: { value: '40.00', currency_code: 'EUR' },
      links: [
        { rel: 'self', href: 'https://api.sandbox.paypal.com/v2/payments/refunds/WH-REF-1' },
        { rel: 'up', href: `https://api.sandbox.paypal.com/v2/payments/captures/${captureId}` },
      ],
    };
    const parsed = PaypalService.parseRefundWebhook('PAYMENT.CAPTURE.REFUNDED', resource);
    check(parsed.captureId === captureId && parsed.refundId === 'WH-REF-1' && parsed.amount === 40, 'Refund-Ressource korrekt gelesen', JSON.stringify(parsed));
    await PaypalService.handleRefundWebhook('PAYMENT.CAPTURE.REFUNDED', resource);
    await PaypalService.handleRefundWebhook('PAYMENT.CAPTURE.REFUNDED', resource);
    const stored = await Payment.findById(payment._id).lean();
    check(stored.refundAmount === 40 && stored.status === 'completed', 'Webhook doppelt: 40 erstattet, Rest 60 bleibt gueltig', `${stored.refundAmount} / ${stored.status}`);
    const pendingResource = { ...resource, id: 'WH-REF-2', status: 'PENDING', amount: { value: '10.00', currency_code: 'EUR' } };
    await PaypalService.handleRefundWebhook('PAYMENT.CAPTURE.REFUNDED', pendingResource);
    const afterPending = await Payment.findById(payment._id).lean();
    check(afterPending.refundAmount === 40, 'Ausstehende Anbieter-Erstattung zaehlt nicht', afterPending.refundAmount);
    check(PaypalService.resolveCaptureWebhookStatus('completed', 'PAYMENT.CAPTURE.PENDING') === null, 'Spaetes PENDING stuft abgeschlossene Zahlung nicht zurueck', 'null');
    check(PaypalService.resolveCaptureWebhookStatus('refunded', 'PAYMENT.CAPTURE.COMPLETED') === null, 'Wiederholtes COMPLETED hebt Erstattung nicht auf', 'null');
    check(PaypalService.resolveCaptureWebhookStatus('processing', 'PAYMENT.CAPTURE.COMPLETED') === 'completed', 'COMPLETED schliesst ausstehende Zahlung ab', 'completed');
  });

  // =====================================================================================
  await runSection('T19 Zahlungsaufforderung: Rechnungsnummer, Betrag, Kanal, Hinweistext, Fehler', async () => {
    const customer = await makeCustomer();
    const { booking, orders } = await makeBooking(customer, [120]);
    await prepay(booking, orders[0], 20);
    const invoice = await FinancialService.generateFromRepairOrders([String(orders[0]._id)], {});

    emailMode = 'success';
    sentEmails.length = 0;
    const result = await FinancialService.requestAdditionalPayment(invoice.invoiceNumber, { note: 'Bitte bis Freitag überweisen <b>danke</b>' });
    check(result.success === true && result.amount === 100, 'Suche per Rechnungsnummer, offener Betrag 100', `${result.success} / ${result.amount}`);
    check(result.channel === 'email' && /E-Mail/.test(result.message) && !/PayPal-Zahlungsanforderung wurde/.test(result.message), 'Kanal ausdruecklich E-Mail', result.message);
    const mail = sentEmails[sentEmails.length - 1];
    const body = JSON.stringify(mail?.variables || {});
    check(body.includes('Bitte bis Freitag überweisen') && !body.includes('<b>danke</b>'), 'Hinweistext erreicht die E-Mail (HTML entschaerft)', mail ? mail.name : 'keine Mail');
    check(result.noteDelivered === true, 'noteDelivered = true', result.noteDelivered);
    check(body.includes(`/invoices?invoiceId=${invoice._id}`), 'Zahlungslink auf die Rechnung enthalten', mail ? 'ja' : 'nein');
    const history = await PaymentRequest.find({ invoiceId: invoice._id }).lean();
    check(history.length === 1 && history[0].status === 'accepted_by_provider' && history[0].invoiceNumber === invoice.invoiceNumber, 'Historie mit Rechnungsnummer und Status', history.map((h) => h.status).join(','));

    emailMode = 'fail';
    const failed = await FinancialService.requestAdditionalPayment(invoice.invoiceNumber, { note: 'x' });
    check(failed.success === false && failed.status === 'failed', 'Anbieterfehler meldet keinen Erfolg', `${failed.success} / ${failed.status}`);

    const guestless = await makeCustomer();
    const loose = await makeOrder(guestless, 30);
    const looseInvoice = await FinancialService.createInvoiceFromOrder(String(loose._id)).catch(() => null);
    if (looseInvoice) {
      await Invoice.updateOne({ _id: looseInvoice._id }, { $set: { customerEmail: '' } });
      await User.updateOne({ _id: guestless._id }, { $set: { email: '' } });
      emailMode = 'success';
      const noRecipient = await FinancialService.requestAdditionalPayment(looseInvoice.invoiceNumber, {});
      check(noRecipient.success === false && noRecipient.status === 'skipped_no_recipient', 'Rechnung ohne Buchung und ohne Empfaenger: kein Erfolg', `${noRecipient.success} / ${noRecipient.status}`);
    } else {
      check(false, 'Rechnung ohne Buchung konnte fuer den Empfaengertest nicht angelegt werden', 'n/a');
    }
  });

  out(`\n==== ${pass} bestanden, ${fail} fehlgeschlagen ====`);

  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  process.exit(fail === 0 ? 0 : 1);
}

main().catch(async (error) => {
  out('ERROR:', error.stack || error.message);
  try { await mongoose.disconnect(); } catch (e) { /* ignore */ }
  process.exit(2);
});
