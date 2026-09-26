/**
 * Regressionstest Track "payments-b": Buchungs-Zahlungsstand, Rechnungserstellung und
 * Einsendelabel-Schutz.
 *
 * Abgesichert:
 *   1. Stornierte Auftraege tragen keine Forderung: sie zaehlen weder als "noch nicht
 *      berechnet" noch (ohne Rechnung) in die Bezugsgroesse; billingStatus wird nicht
 *      faelschlich 'partially-paid'.
 *   2. Buchungsliste (BookingService.buildPaymentBalanceMap) === Detail
 *      (BookingPaymentService.getOverview) bei teilweise berechneter Buchung.
 *   3. Manuelle Reparaturposition erscheint auf Rechnung (FinancialService und
 *      Buchungsrechnung) und in den Buchungsansichten mit ihrem Namen.
 *   4. FinancialService.createInvoice mit orderId und ohne Rabatt uebernimmt den
 *      AUFTRAGSrabatt (nicht den heutigen Kundenprozentsatz).
 *   5. Dialog "Rechnung aus Reparaturauftraegen" mit seiner Standard-Nutzlast:
 *      Rechnungsbrutto === Auftragswert.
 *   6. syncOrderAndBookingValue verschluckt Fehler nicht mehr ({ ok:false }).
 *   7. BookingService.createInvoice: Faelligkeit aus dem Kundenprofil, nicht fix 30 Tage.
 *   8. Einsendelabel: nach Abgleich 'created' (Sendungsnummer ohne PDF) kein zweites
 *      bezahltes Label; ein Abgleich waehrend einer laufenden Erstellung wird abgelehnt.
 *
 * DHL, E-Mail und Benachrichtigungen sind GEMOCKT (kein Label, keine Mail).
 *
 * Aufruf (benoetigt eine WEGWERF-Datenbank, niemals die Entwicklungs-DB):
 *   TEST_MONGODB_URI=mongodb://127.0.0.1:27099/t_booking_billing node test-booking-billing-consistency.js
 */
const path = require('path');
const fs = require('fs');

const SERVER_DIR = path.join(__dirname, 'server');
const mongoose = require(path.join(SERVER_DIR, 'node_modules/mongoose'));
const axios = require(require.resolve('axios', { paths: [path.join(SERVER_DIR, 'services')] }));

const URI = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27099/t_booking_billing_consistency';

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
    out(`  FAIL Abschnitt abgebrochen :: ${error.stack || error.message}`);
  }
};
const DAY_MS = 24 * 60 * 60 * 1000;
const round2 = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

async function main() {
  if (isUnsafeTestUri(URI)) {
    throw new Error('Dieser Test darf nicht gegen die Entwicklungsdatenbank laufen.');
  }

  // Kein echter HTTP-Aufruf (DHL, PayPal) aus diesem Test.
  axios.defaults.adapter = async (config) => { throw new Error(`Echter HTTP-Aufruf im Test blockiert: ${config.url}`); };

  await mongoose.connect(URI);
  await mongoose.connection.dropDatabase();

  const MODELS_DIR = path.join(SERVER_DIR, 'models');
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
  await Promise.all([Payment.init(), PaymentAllocation.init(), Invoice.init()]);

  const EmailService = require(path.join(SERVER_DIR, 'services/emailService'));
  EmailService.sendTemplateEmail = async () => ({ success: true, mocked: true });
  EmailService.sendTriggerEmail = async () => ({ success: true, mocked: true });
  EmailService.sendInvoiceEmail = async () => ({ success: true, mocked: true });
  EmailService.buildSystemUrl = async (p) => `https://test.invalid${p}`;
  const NotificationService = require(path.join(SERVER_DIR, 'services/notificationService'));
  NotificationService.createNotification = async (data) => ({ _id: new mongoose.Types.ObjectId(), ...data });

  const FinancialService = require(path.join(SERVER_DIR, 'services/financialService'));
  const PaymentService = require(path.join(SERVER_DIR, 'services/paymentService'));
  const BookingPaymentService = require(path.join(SERVER_DIR, 'services/bookingPaymentService'));
  const BookingService = require(path.join(SERVER_DIR, 'services/bookingService'));
  const DHLService = require(path.join(SERVER_DIR, 'services/dhlService'));

  const service = await Service.create({ name: 'Displaytausch', description: 'Display', category: 'screen', price: 50 });
  let seq = 0;
  const makeCustomer = async (extra = {}) => {
    seq += 1;
    return User.create({ name: `Kunde ${seq}`, email: `kunde-bb${seq}@test.invalid`, role: 'customer', ...extra });
  };
  const makeOrder = async (customer, price, extra = {}) => {
    seq += 1;
    return Order.create({
      customerId: customer._id,
      orderNumber: `ORD-BB-${String(seq).padStart(3, '0')}`,
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
      items: orders.map((order) => ({ type: 'repair', orderId: order._id, orderNumber: order.orderNumber, cost: order.totalCost, device: 'Apple iPhone 15' })),
      totalCost: round2(prices.reduce((sum, price) => sum + price, 0)),
      status: 'processing',
      ...bookingExtra,
    });
    await Order.updateMany({ _id: { $in: orders.map((order) => order._id) } }, { $set: { bookingId: booking._id } });
    return { booking, orders };
  };
  const prepay = async (booking, order, amount) => Payment.create({
    bookingId: booking._id,
    orderId: order._id,
    customerId: booking.customerId,
    amount,
    paymentMethod: 'paypal',
    status: 'completed',
    source: 'checkout',
    processedAt: new Date(),
  });

  // =====================================================================================
  await runSection('1 Stornierter Auftrag traegt keine Forderung', async () => {
    const customer = await makeCustomer();
    const { booking, orders } = await makeBooking(customer, [50, 30]);
    await Order.updateOne({ _id: orders[1]._id }, { $set: { status: 'cancelled' } });
    await prepay(booking, orders[0], 50);
    await FinancialService.generateFromRepairOrders([String(orders[0]._id)], {});
    const overview = await BookingPaymentService.getOverview(String(booking._id));
    check(overview.summary.referenceTotal === 50, 'Bezugsgroesse 50 (Storno 30 zaehlt nicht)', overview.summary.referenceTotal);
    check(overview.summary.openOrderBalance === 0, 'Offen 0', overview.summary.openOrderBalance);
    const stored = await Booking.findById(booking._id).lean();
    check(stored.billingStatus === 'paid', 'billingStatus bezahlt (nicht teilbezahlt)', stored.billingStatus);

    // Ohne Rechnung: Auftragswert ohne den stornierten Auftrag.
    const customer2 = await makeCustomer();
    const { booking: booking2, orders: orders2 } = await makeBooking(customer2, [50, 30]);
    await Order.updateOne({ _id: orders2[1]._id }, { $set: { status: 'cancelled' } });
    await prepay(booking2, orders2[0], 50);
    const balance2 = await PaymentService.computeBookingBalance({ bookingId: booking2._id });
    check(balance2.reference === 50 && balance2.open === 0, 'Ohne Rechnung: Bezugsgroesse 50, offen 0', JSON.stringify({ r: balance2.reference, o: balance2.open }));
    const bulk2 = (await PaymentService.getBookingBalancesBulk([booking2._id])).get(String(booking2._id));
    check(bulk2.reference === 50 && bulk2.bookingOpen === 0, 'Listenweg identisch', JSON.stringify({ r: bulk2.reference, o: bulk2.bookingOpen }));
  });

  // =====================================================================================
  await runSection('2 Buchungsliste === Detail bei teilweise berechneter Buchung', async () => {
    const customer = await makeCustomer();
    const { booking, orders } = await makeBooking(customer, [50, 30]);
    await prepay(booking, orders[0], 80);
    await FinancialService.generateFromRepairOrders([String(orders[0]._id)], {});
    const overview = await BookingPaymentService.getOverview(String(booking._id));
    const map = await BookingService.buildPaymentBalanceMap([await Booking.findById(booking._id).lean()]);
    const row = map.get(String(booking._id));
    check(overview.summary.referenceTotal === 80 && overview.summary.overpaidTotal === 0, 'Detail: Bezugsgroesse 80, keine Ueberzahlung', `${overview.summary.referenceTotal} / ${overview.summary.overpaidTotal}`);
    check(row && row.total === overview.summary.referenceTotal, 'Liste: gleiche Bezugsgroesse wie Detail', row ? `${row.total} === ${overview.summary.referenceTotal}` : 'keine Zeile');
    check(row && row.overpaid === overview.summary.overpaidTotal && row.open === overview.summary.openOrderBalance, 'Liste: gleiches offen/ueberzahlt wie Detail', row ? `${row.open}/${row.overpaid} vs ${overview.summary.openOrderBalance}/${overview.summary.overpaidTotal}` : 'keine Zeile');
  });

  // =====================================================================================
  await runSection('3 Manuelle Position erscheint mit Namen auf Rechnung und in Buchungsansichten', async () => {
    const customer = await makeCustomer();
    const manualLine = { isManual: true, name: 'Akku-Kalibrierung', description: 'Kalibrierung nach Tausch', price: 20, quantity: 1, estimatedTime: 0 };
    const order = await makeOrder(customer, 70, {
      services: [
        { serviceId: service._id, name: 'Displaytausch', price: 50, quantity: 1, estimatedTime: 30 },
        manualLine,
      ],
    });
    const invoice = await FinancialService.createInvoiceFromOrder(String(order._id));
    const names = invoice.items.map((item) => item.serviceName);
    check(names.includes('Akku-Kalibrierung'), 'FinancialService-Rechnung: Position "Akku-Kalibrierung"', names.join(' | '));
    const manualItem = invoice.items.find((item) => item.serviceName === 'Akku-Kalibrierung');
    check(manualItem && /Kalibrierung nach Tausch/.test(manualItem.description || ''), 'Beschreibung der manuellen Position uebernommen', manualItem ? manualItem.description : 'fehlt');
    check(invoice.total === 70, 'Rechnungsbrutto === Auftragswert', invoice.total);

    const { booking, orders } = await makeBooking(customer, [30]);
    await Order.updateOne({ _id: orders[0]._id }, { $set: { services: [{ ...manualLine, price: 30 }] } });
    const bookingInvoice = await BookingService.createInvoice(String(booking._id), {});
    const bookingNames = (bookingInvoice.items || []).map((item) => item.serviceName);
    check(bookingNames.includes('Akku-Kalibrierung'), 'Buchungsrechnung: Position "Akku-Kalibrierung"', bookingNames.join(' | '));
    const bookingOrders = await BookingService.getBookingOrders(String(booking._id)).catch((error) => ({ error }));
    const orderList = bookingOrders?.orders || bookingOrders?.data?.orders || (Array.isArray(bookingOrders) ? bookingOrders : []);
    const viewNames = (orderList[0]?.services || []).map((s) => s.name);
    check(viewNames.includes('Akku-Kalibrierung'), 'Buchungsansicht (getBookingOrders): Name statt "Unknown Service"', bookingOrders?.error ? bookingOrders.error.message : viewNames.join(' | '));
  });

  // =====================================================================================
  await runSection('4 createInvoice mit orderId ohne Rabatt uebernimmt den Auftragsrabatt', async () => {
    // Heute 15 % Kundenrabatt; der Auftrag wurde mit 10 % (4,99) angelegt.
    const customer = await makeCustomer({ discount: 15 });
    const order = await makeOrder(customer, 44.91, {
      services: [{ serviceId: service._id, name: 'Displaytausch', price: 49.9, quantity: 1, estimatedTime: 30 }],
      discount: 4.99,
    });
    const invoice = await FinancialService.createInvoice({
      orderId: String(order._id),
      customerId: String(customer._id),
      items: [{ serviceName: 'Displaytausch', description: 'Displaytausch', quantity: 1, unitPrice: 49.9, total: 49.9, type: 'service' }],
      taxRate: 19,
    });
    check(invoice.discount === 4.99 && invoice.total === 44.91, 'Rabatt 4,99 aus dem Auftrag, Brutto 44,91 === Auftragswert', `${invoice.discount} / ${invoice.total}`);

    // Freistehende manuelle Rechnung ohne Auftrag: Profilprozentsatz gilt weiterhin.
    const free = await FinancialService.createInvoice({
      customerId: String(customer._id),
      items: [{ serviceName: 'Beratung', description: 'Beratung', quantity: 1, unitPrice: 100, total: 100, type: 'service' }],
      taxRate: 19,
    });
    check(free.discount === 15 && free.total === 85, 'Freie Rechnung: 15 % Profilrabatt', `${free.discount} / ${free.total}`);
  });

  // =====================================================================================
  await runSection('5 Dialog "Rechnung aus Reparaturauftraegen" mit Standard-Nutzlast', async () => {
    const customer = await makeCustomer({ discount: 15 });
    const order = await makeOrder(customer, 42.42, {
      services: [{ serviceId: service._id, name: 'Displaytausch', price: 49.9, quantity: 1, estimatedTime: 30 }],
      discount: 7.48,
    });
    // Genau die Nutzlast, die FinancialManagement.tsx mit unveraenderten Feldern sendet
    // (Zusatzrabatt leer -> 0, Steuer 19 %, Faelligkeit aus den Standardtagen).
    const dueDate = new Date(Date.now() + 14 * DAY_MS).toISOString().slice(0, 10);
    const invoice = await FinancialService.generateFromRepairOrders([String(order._id)], {
      isReverseCharge: false,
      customerVatId: '',
      sellerVatId: 'DE318981969',
      reverseChargeNotice: 'Steuerschuldnerschaft des Leistungsempfängers / Reverse Charge',
      taxRate: 19,
      discount: Math.max(0, Number(String('' || '0').replace(',', '.')) || 0),
      dueDate,
      paymentTerms: 'Net 30',
      notes: '',
    });
    check(invoice.total === 42.42, 'Rechnungsbrutto 42,42 === Auftragswert', invoice.total);
    check(invoice.discount === 7.48, 'Rabatt nur einmal (7,48)', invoice.discount);
  });

  // =====================================================================================
  await runSection('6 syncOrderAndBookingValue meldet Fehler statt sie zu verschlucken', async () => {
    const customer = await makeCustomer();
    const { booking, orders } = await makeBooking(customer, [60]);
    await FinancialService.generateFromRepairOrders([String(orders[0]._id)], {});
    const ok = await FinancialService.syncOrderAndBookingValue(String(orders[0]._id), 'order');
    check(ok && ok.ok === true, 'Erfolg meldet { ok: true }', JSON.stringify(ok));

    const originalSave = Invoice.prototype.save;
    Invoice.prototype.save = async function failingSave() { throw new Error('Simulierter Speicherfehler'); };
    let result;
    let thrown = null;
    try {
      await Order.updateOne({ _id: orders[0]._id }, { $set: { totalCost: 65 } });
      result = await FinancialService.syncOrderAndBookingValue(String(orders[0]._id), 'order');
    } catch (error) {
      thrown = error;
    } finally {
      Invoice.prototype.save = originalSave;
    }
    check(thrown || (result && result.ok === false), 'Fehler sichtbar ({ ok:false } oder Ausnahme)', thrown ? thrown.message : JSON.stringify(result));
    check(!thrown && result && typeof result.error === 'string' && result.error.length > 0, 'Fehlertext wird mitgeliefert', JSON.stringify(result));
    void booking;
  });

  // =====================================================================================
  await runSection('7 Buchungsrechnung: Faelligkeit und Text aus dem Kundenprofil', async () => {
    const customer = await makeCustomer({ paymentDueDays: 7, paymentTerms: 'Net 30' });
    const { booking } = await makeBooking(customer, [40]);
    const invoice = await BookingService.createInvoice(String(booking._id), {});
    const days = Math.round((new Date(invoice.dueDate) - new Date(invoice.createdAt)) / DAY_MS);
    check(days === 7, 'Faellig nach 7 Tagen (nicht 30)', days);
    check(invoice.paymentDueDays === 7 && /\b7\b/.test(invoice.paymentTerms), 'Zahlungsziel 7 Tage aus derselben Bedingung', `${invoice.paymentDueDays} / ${invoice.paymentTerms}`);

    const customer2 = await makeCustomer({ paymentDueDays: 7 });
    const { booking: booking2 } = await makeBooking(customer2, [40]);
    const explicit = new Date(Date.now() + 10 * DAY_MS);
    const invoice2 = await BookingService.createInvoice(String(booking2._id), { dueDate: explicit });
    const days2 = Math.round((new Date(invoice2.dueDate) - new Date(invoice2.createdAt)) / DAY_MS);
    check(days2 === 10 && /\b10\b/.test(invoice2.paymentTerms), 'Ausdruecklich gewaehltes Datum gewinnt, Text folgt', `${days2} / ${invoice2.paymentTerms}`);
  });

  // =====================================================================================
  await runSection('8 Einsendelabel: kein zweites Label nach Abgleich, kein Abgleich waehrend laufender Erstellung', async () => {
    const shipmentCalls = [];
    DHLService.getDHLConfig = async () => ({ isActive: true, settings: {} });
    DHLService.createShipment = async (orderId) => {
      shipmentCalls.push(String(orderId));
      return { trackingNumber: '00340434161094000001', labelUrl: 'data:application/pdf;base64,AAAA' };
    };
    BookingService.getBookingShippingLabelMode = async () => 'live';
    // Vollstaendige Versanddaten, damit der alte Ablauf tatsaechlich bis zum DHL-Aufruf kaeme.
    BookingService.buildBookingShipmentData = () => ({
      shipperName: 'McRepair', shipperStreet: 'Shopstrasse', shipperNumber: '1', shipperCity: 'Hamburg', shipperPostalCode: '20095',
      accountNumber: '33333333330101',
      receiverName: 'McRepair Werkstatt', receiverAddress: 'Werkstattweg', receiverNumber: '2', receiverCity: 'Hamburg', receiverPostalCode: '20097',
      senderName: 'Kunde', senderStreet: 'Kundenweg', senderCity: 'Berlin', senderPostalCode: '10115',
    });

    const customer = await makeCustomer();
    const { booking } = await makeBooking(customer, [50]);
    // Zustand nach Abgleich 'created': Sendungsnummer uebernommen, kein PDF.
    await Booking.updateOne({ _id: booking._id }, { $set: { trackingNumber: '00340434161094888888', shippingLabelUrl: '', shippingStatus: 'label-created' } });
    const reconciled = await Booking.findById(booking._id);
    let blocked = null;
    try {
      await BookingService.createShippingLabelForBooking(reconciled, { shipmentData: {} });
    } catch (error) {
      blocked = error;
    }
    const after = await Booking.findById(booking._id).lean();
    check(shipmentCalls.length === 0, 'Kein zweiter DHL-Aufruf', shipmentCalls.length);
    check(after.trackingNumber === '00340434161094888888', 'Abgeglichene Sendungsnummer bleibt erhalten', after.trackingNumber);
    check(blocked && Number(blocked.status || blocked.statusCode) === 409 && /Sendungsnummer|Portal/.test(blocked.message), 'Deutliche 409-Meldung', blocked ? `${blocked.status || blocked.statusCode} ${blocked.message}` : 'kein Fehler');

    // Laufende Erstellung (frische Sperre, kein Abgleich-Vermerk): Abgleich abgelehnt.
    const { booking: booking2 } = await makeBooking(customer, [50]);
    await Booking.updateOne({ _id: booking2._id }, { $set: { shippingLabelCreationInProgress: true, updatedAt: new Date() } });
    let inFlight = null;
    try {
      await BookingService.reconcileBookingInboundLabel(String(booking2._id), { resolution: 'not-created' }, { name: 'Admin' });
    } catch (error) {
      inFlight = error;
    }
    const stillLocked = await Booking.findById(booking2._id).lean();
    check(inFlight && Number(inFlight.status) === 409 && stillLocked.shippingLabelCreationInProgress === true, 'Abgleich waehrend laufender Erstellung abgelehnt, Sperre bleibt', inFlight ? `${inFlight.status} ${inFlight.message}` : 'angenommen');

    // Mit Abgleich-Vermerk (unklare DHL-Antwort) ist der Abgleich erlaubt.
    await Booking.updateOne({ _id: booking2._id }, {
      $push: { timeline: { status: 'Shipping Label Reconciliation Required', description: 'unklar', completedAt: new Date(), staffId: 'system', staffName: 'DHL' } },
    });
    await BookingService.reconcileBookingInboundLabel(String(booking2._id), { resolution: 'not-created' }, { name: 'Admin' });
    const released = await Booking.findById(booking2._id).lean();
    check(released.shippingLabelCreationInProgress === false, 'Mit Vermerk: Abgleich erlaubt, Sperre geloest', released.shippingLabelCreationInProgress);

    // Verwaiste Sperre (Absturz, kein Vermerk) nach Ablauf: Abgleich erlaubt.
    const { booking: booking3 } = await makeBooking(customer, [50]);
    await Booking.updateOne({ _id: booking3._id }, { $set: { shippingLabelCreationInProgress: true, updatedAt: new Date(Date.now() - 60 * 60 * 1000) } });
    await BookingService.reconcileBookingInboundLabel(String(booking3._id), { resolution: 'not-created' }, { name: 'Admin' });
    const released3 = await Booking.findById(booking3._id).lean();
    check(released3.shippingLabelCreationInProgress === false, 'Verwaiste Sperre (>10 Min.): Abgleich erlaubt', released3.shippingLabelCreationInProgress);

    // Normale Erstellung ohne vorhandenes Label funktioniert weiterhin.
    const { booking: booking4 } = await makeBooking(customer, [50]);
    await Order.updateMany({ bookingId: booking4._id }, { $set: { shippingAddress: { street: 'Musterweg 1', city: 'Berlin', zipCode: '10115', country: 'DE' } } });
    const created = await BookingService.createShippingLabelForBooking(await Booking.findById(booking4._id), { shipmentData: {} }).catch((error) => ({ error }));
    check(!created.error || !/Sendungsnummer .* bereits/.test(created.error.message), 'Buchung ohne Label wird nicht durch den neuen Schutz blockiert', created.error ? created.error.message : 'erstellt');
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
