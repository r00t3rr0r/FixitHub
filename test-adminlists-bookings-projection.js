/**
 * Regressionstest (01.10.2026, Track "adminlists"): Admin-Buchungsliste GET /api/bookings.
 *
 * Laeuft ueber den ECHTEN Express-Router /api/bookings mit echter JWT-Pruefung und echter DB.
 *
 * Abgesichert:
 *   ADMUX-5  Die Listenprojektion (BookingService.getAllBookings) liefert, was die Liste anzeigt:
 *            orderIds, returnShipmentStatus/returnTrackingNumber, finalCost (Altbestand) und
 *            orders[] (Auftragsnummer, Geraet, Status, Fortschritt) fuer die Spalte
 *            "Geraete / Auftraege". Vorher fehlten diese Felder: "Orders" immer 0, "Retoure"
 *            immer "Keine Retoure". Grosse Label-URLs (data:-PDF) werden NICHT mitgeladen.
 *            Altbuchung ohne orderIds: orderIds kommt aus den Auftraegen mit bookingId.
 *   DHL-5    inboundLabelPlaceholder = true fuer ein Dummy-Einsendelabel (DHL-DUMMY-…).
 *   COMMS    Filter communication=unread-customer-response nutzt die EINE Regel aus
 *            server/utils/communicationReadRules.js (pro Benutzer): Kundennachricht ungelesen
 *            -> enthalten; von DIESEM Admin gelesen -> nicht enthalten (fuer einen anderen
 *            Mitarbeiter weiterhin enthalten); nur Team-Nachricht -> nicht enthalten; Gastnachricht
 *            ohne senderId -> enthalten; beantwortete Rueckfrage nach dem Lesen -> enthalten;
 *            total passt zur Liste.
 *   Rollen   Staff sieht dieselbe Projektion; ein Kunde sieht nur eigene Buchungen (keine fremde
 *            Buchung, kein orders[]-Feld fremder Kunden); ohne Anmeldung 401.
 *
 * Keine echten E-Mails / kein Netzwerk (E-Mail und Benachrichtigungen gemockt).
 *
 * Aufruf (nur Wegwerf-Datenbank):
 *   TEST_MONGODB_URI=mongodb://127.0.0.1:27099/t_adminlists_projection node test-adminlists-bookings-projection.js
 */
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const SERVER_DIR = path.join(__dirname, 'server');
const mongoose = require(path.join(SERVER_DIR, 'node_modules/mongoose'));
const express = require(path.join(SERVER_DIR, 'node_modules/express'));
const jwt = require(path.join(SERVER_DIR, 'node_modules/jsonwebtoken'));

const URI = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27099/t_adminlists_projection';

// Sicherheitsnetz: Dieser Test ruft dropDatabase() auf. Er darf ausschliesslich gegen eine
// ausdruecklich angegebene Wegwerf-Datenbank laufen - nie gegen die Entwicklungsdatenbank.
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
  if (condition) { pass += 1; out(`  PASS ${message} :: ${actual}`); } else { fail += 1; out(`  FAIL ${message} :: ${actual}`); }
};
const runSection = async (title, fn) => {
  out(`\n[${title}]`);
  try { await fn(); } catch (error) { fail += 1; out(`  FAIL Abschnitt abgebrochen :: ${error.stack || error.message}`); }
};

async function main() {
  if (isUnsafeTestUri(URI)) throw new Error('Dieser Test darf nicht gegen die Entwicklungsdatenbank laufen.');
  process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');

  await mongoose.connect(URI);
  await mongoose.connection.dropDatabase();
  const MODELS_DIR = path.join(SERVER_DIR, 'models');
  fs.readdirSync(MODELS_DIR).filter((file) => file.endsWith('.js')).forEach((file) => {
    try { require(path.join(MODELS_DIR, file)); } catch (error) { /* optionale Abhaengigkeiten */ }
  });

  // MOCKS: niemals echte Mails / Benachrichtigungen
  const EmailService = require(path.join(SERVER_DIR, 'services/emailService'));
  EmailService.sendTemplateEmail = async () => ({ success: true });
  EmailService.sendTriggerEmail = async () => ({ success: true });
  const NotificationService = require(path.join(SERVER_DIR, 'services/notificationService'));
  NotificationService.createNotification = async (data) => ({ _id: new mongoose.Types.ObjectId(), ...data });

  const bookingRoutes = require(path.join(SERVER_DIR, 'routes/bookingRoutes'));
  const app = express();
  app.use(express.json());
  app.use('/api/bookings', bookingRoutes);
  const server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const User = mongoose.model('User');
  const Order = mongoose.model('Order');
  const Booking = mongoose.model('Booking');
  const InspectionCommunication = mongoose.model('InspectionCommunication');

  const tokenFor = (user) => jwt.sign({ sub: String(user._id) }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '10m' });
  const call = async (url, user) => {
    const response = await fetch(`${baseUrl}${url}`, { headers: user ? { Authorization: `Bearer ${tokenFor(user)}` } : {} });
    let body = null;
    try { body = await response.json(); } catch (error) { body = null; }
    return { status: response.status, body };
  };

  const admin = await User.create({ name: 'Admin Liste', email: 'al-admin@test.invalid', role: 'admin' });
  const staff = await User.create({ name: 'Stefan Staff', email: 'al-staff@test.invalid', role: 'staff' });
  const owner = await User.create({ name: 'Olga Owner', firstName: 'Olga', lastName: 'Owner', email: 'al-owner@test.invalid', role: 'customer' });
  const other = await User.create({ name: 'Fritz Fremd', firstName: 'Fritz', lastName: 'Fremd', email: 'al-other@test.invalid', role: 'customer' });

  let seq = 0;
  const makeBooking = async (customer, devices, extra = {}) => {
    const orders = [];
    for (const [brand, model, status] of devices) {
      seq += 1;
      orders.push(await Order.create({
        customerId: customer._id,
        orderNumber: `ORD-AL-${String(seq).padStart(3, '0')}`,
        deviceBrand: brand,
        deviceModel: model,
        deviceType: 'Smartphone',
        errorDescription: 'Display defekt',
        services: [{ serviceId: new mongoose.Types.ObjectId(), name: 'Displaytausch', price: 49.9, quantity: 1, estimatedTime: 30 }],
        totalCost: 49.9,
        status: status || 'pending',
      }));
    }
    const booking = await Booking.create({
      customerId: customer._id,
      orderIds: orders.map((order) => order._id),
      items: orders.map((order) => ({ type: 'repair', orderId: order._id, orderNumber: order.orderNumber, device: `${order.deviceBrand} ${order.deviceModel}`, cost: 49.9 })),
      totalCost: Math.round(49.9 * orders.length * 100) / 100,
      status: 'processing',
      ...extra,
    });
    await Order.updateMany({ _id: { $in: orders.map((order) => order._id) } }, { $set: { bookingId: booking._id } });
    return { booking, orders };
  };

  const bigDataUrl = `data:application/pdf;base64,${Buffer.alloc(4096, 1).toString('base64')}`;
  const A = await makeBooking(owner, [['Apple', 'iPad Pro 9.7', 'in-progress'], ['Samsung', 'Galaxy S23']], {
    returnShipmentStatus: 'label-created',
    returnTrackingNumber: 'RET-AL-0001',
    returnLabelUrl: bigDataUrl,
    trackingNumber: 'DHL-DUMMY-BKGAL0001-1',
    shippingStatus: 'label-created',
    shippingLabelUrl: bigDataUrl,
  });
  const B = await makeBooking(owner, [['Google', 'Pixel 8']]);
  const C = await makeBooking(owner, [['Apple', 'iPhone 15']]);
  const D = await makeBooking(owner, [['Apple', 'iPhone 12']]);
  const E = await makeBooking(owner, [['Apple', 'iPhone 11']]);
  const F = await makeBooking(other, [['Apple', 'iPhone 13']]);

  // Altbestand: finalCost direkt in der Collection (nicht im Schema) und eine Buchung ohne orderIds.
  await Booking.collection.updateOne({ _id: B.booking._id }, { $set: { finalCost: 189.9 } });
  await Booking.collection.updateOne({ _id: C.booking._id }, { $set: { orderIds: [] } });

  await runSection('ADMUX-5 Projektion der Admin-Liste', async () => {
    const res = await call('/api/bookings?limit=50', admin);
    check(res.status === 200, 'Admin GET /api/bookings -> 200', res.status);
    const rows = res.body?.bookings || [];
    const rowA = rows.find((row) => String(row._id) === String(A.booking._id));
    const rowB = rows.find((row) => String(row._id) === String(B.booking._id));
    const rowC = rows.find((row) => String(row._id) === String(C.booking._id));
    check(rowA && Array.isArray(rowA.orderIds) && rowA.orderIds.length === 2, 'orderIds enthalten (2 Auftraege)', rowA && rowA.orderIds && rowA.orderIds.length);
    check(rowA && rowA.returnShipmentStatus === 'label-created' && rowA.returnTrackingNumber === 'RET-AL-0001', 'returnShipmentStatus + returnTrackingNumber enthalten', rowA && `${rowA.returnShipmentStatus} ${rowA.returnTrackingNumber}`);
    const orderNumbers = (rowA?.orders || []).map((order) => order.orderNumber).sort();
    check(orderNumbers.length === 2 && orderNumbers[0] === A.orders[0].orderNumber && orderNumbers[1] === A.orders[1].orderNumber, 'orders[] mit Auftragsnummern', orderNumbers.join(','));
    const ipad = (rowA?.orders || []).find((order) => order.orderNumber === A.orders[0].orderNumber);
    check(ipad && ipad.deviceBrand === 'Apple' && ipad.deviceModel === 'iPad Pro 9.7' && ipad.status === 'in-progress' && typeof ipad.progress === 'number', 'orders[] mit Geraet, Status und Fortschritt', ipad && JSON.stringify({ b: ipad.deviceBrand, m: ipad.deviceModel, s: ipad.status, p: ipad.progress }));
    check(rowA && rowA.shippingLabelUrl === undefined && rowA.returnLabelUrl === undefined, 'Label-URLs (data:-PDF) werden nicht mitgeladen', rowA && `${typeof rowA.shippingLabelUrl}/${typeof rowA.returnLabelUrl}`);
    check(rowA && rowA.inboundLabelPlaceholder === true, 'DHL-5: Dummy-Einsendelabel -> inboundLabelPlaceholder true', rowA && rowA.inboundLabelPlaceholder);
    check(rowB && rowB.inboundLabelPlaceholder === false, 'ohne Dummy-Label -> inboundLabelPlaceholder false', rowB && rowB.inboundLabelPlaceholder);
    check(rowB && Number(rowB.finalCost) === 189.9, 'finalCost (Altbestand) enthalten', rowB && rowB.finalCost);
    check(rowC && Array.isArray(rowC.orderIds) && rowC.orderIds.length === 1 && String(rowC.orderIds[0]) === String(C.orders[0]._id), 'Altbuchung ohne orderIds: orderIds aus Auftraegen mit bookingId', rowC && JSON.stringify(rowC.orderIds));
    check(rows.some((row) => String(row._id) === String(F.booking._id)), 'Admin sieht auch Buchungen anderer Kunden', rows.length);
  });

  await runSection('Review-Fix: Shop-Auftrag ohne Rohplatzhalter, Buchungslabel-Modus', async () => {
    // Checkout legt Shop-Auftraege mit Platzhaltern an (deviceBrand 'N/A', deviceModel
    // 'Shop Products Order', deviceType 'Shop Products'). Die Liste darf das nie zeigen.
    seq += 1;
    const shopOrder = await Order.create({
      customerId: owner._id,
      orderNumber: `ORD-AL-${String(seq).padStart(3, '0')}`,
      deviceBrand: 'N/A',
      deviceModel: 'Shop Products Order',
      deviceType: 'Shop Products',
      errorDescription: 'Shop-Bestellung',
      totalCost: 19.9,
      status: 'pending',
    });
    seq += 1;
    const shopOnly = await Order.create({
      customerId: owner._id,
      orderNumber: `ORD-AL-${String(seq).padStart(3, '0')}`,
      deviceBrand: 'N/A',
      deviceModel: 'Shop Products Order',
      deviceType: 'Shop Products',
      errorDescription: 'Shop-Bestellung',
      totalCost: 9.9,
      status: 'pending',
    });
    const G = await makeBooking(owner, [['Apple', 'iPhone 14']]);
    await Booking.updateOne({ _id: G.booking._id }, {
      $push: {
        orderIds: { $each: [shopOrder._id, shopOnly._id] },
        items: { $each: [
          { type: 'product', orderId: shopOrder._id, orderNumber: shopOrder.orderNumber, products: [{ name: 'Panzerglas', quantity: 1, price: 19.9, totalPrice: 19.9 }], cost: 19.9 },
          { type: 'product', orderId: shopOnly._id, orderNumber: shopOnly.orderNumber, products: [], cost: 9.9 },
        ] },
      },
    });
    await Order.updateMany({ _id: { $in: [shopOrder._id, shopOnly._id] } }, { $set: { bookingId: G.booking._id } });

    const previousEnvMode = process.env.BOOKING_DHL_LABEL_MODE;
    delete process.env.BOOKING_DHL_LABEL_MODE;
    try {
      let res = await call('/api/bookings?limit=50', admin);
      const rowG = (res.body?.bookings || []).find((row) => String(row._id) === String(G.booking._id));
      const projected = rowG?.orders || [];
      const shopRow = projected.find((order) => order.orderNumber === shopOrder.orderNumber);
      const shopOnlyRow = projected.find((order) => order.orderNumber === shopOnly.orderNumber);
      const repairRow = projected.find((order) => order.orderNumber === G.orders[0].orderNumber);
      check(shopRow && shopRow.type === 'product' && shopRow.device === 'Panzerglas', 'Shop-Auftrag: type product, Etikett = Produktnamen', shopRow && `${shopRow.type} ${shopRow.device}`);
      check(shopOnlyRow && shopOnlyRow.device === 'Shop-Artikel', 'Shop-Auftrag ohne Produktnamen: Etikett "Shop-Artikel"', shopOnlyRow && shopOnlyRow.device);
      check(!JSON.stringify(projected).includes('Shop Products Order') && !projected.some((order) => order.deviceBrand === 'N/A'), 'kein Rohplatzhalter "N/A Shop Products Order" in orders[]', JSON.stringify(projected.map((order) => order.device)));
      check(repairRow && repairRow.type === 'repair' && repairRow.device === 'Apple iPhone 14', 'Reparaturauftrag: type repair, Etikett Marke + Modell', repairRow && `${repairRow.type} ${repairRow.device}`);

      check(res.body?.labelMode === 'dummy', 'DHL-5: Admin-Liste liefert den konfigurierten Modus (Standard dummy)', res.body?.labelMode);
      const SystemConfiguration = mongoose.model('SystemConfiguration');
      await SystemConfiguration.collection.insertOne({
        integrations: [{ name: 'DHL Versand', type: 'shipping', provider: 'DHL', isActive: true, settings: { bookingLabelMode: 'live' } }],
      });
      res = await call('/api/bookings?limit=50', staff);
      check(res.status === 200 && res.body?.labelMode === 'live', 'DHL-5: konfiguriert live -> labelMode live (auch fuer Staff)', `${res.status} ${res.body?.labelMode}`);
      res = await call('/api/bookings?limit=50', owner);
      check(res.status === 200 && res.body?.labelMode === undefined, 'Kunde erhaelt keinen labelMode', `${res.status} ${res.body?.labelMode}`);
    } finally {
      if (previousEnvMode !== undefined) process.env.BOOKING_DHL_LABEL_MODE = previousEnvMode;
    }
  });

  await runSection('Rollen', async () => {
    let res = await call('/api/bookings?limit=50', staff);
    const rowA = (res.body?.bookings || []).find((row) => String(row._id) === String(A.booking._id));
    check(res.status === 200 && rowA && (rowA.orders || []).length === 2, 'Staff erhaelt dieselbe Projektion (orders[])', `${res.status} ${rowA && (rowA.orders || []).length}`);

    res = await call('/api/bookings?limit=50', other);
    const ids = (res.body?.bookings || []).map((row) => String(row._id));
    check(res.status === 200 && ids.length === 1 && ids[0] === String(F.booking._id), 'fremder Kunde sieht nur seine eigene Buchung', ids.join(','));
    check(!ids.includes(String(A.booking._id)), 'keine fremde Buchung im Kundenergebnis', ids.length);

    res = await call('/api/bookings?limit=50&communication=unread-customer-response', other);
    const idsFiltered = (res.body?.bookings || []).map((row) => String(row._id));
    check(res.status === 200 && !idsFiltered.includes(String(A.booking._id)), 'Kunde mit Kommunikationsfilter sieht keine fremden Buchungen', idsFiltered.join(','));

    res = await call('/api/bookings');
    check(res.status === 401, 'ohne Anmeldung -> 401', res.status);
  });

  await runSection('COMMS Filter "Ungelesene Kundenrueckmeldungen" (eine Regel, pro Benutzer)', async () => {
    const t0 = new Date(Date.now() - 60 * 60 * 1000);
    const t1 = new Date(Date.now() - 30 * 60 * 1000);
    const t2 = new Date(Date.now() - 10 * 60 * 1000);
    // A: Kundennachricht, von niemandem gelesen -> enthalten
    await InspectionCommunication.create({ orderId: A.orders[0]._id, status: 'active', messages: [
      { senderId: owner._id, senderType: 'customer', senderName: 'Olga Owner', content: 'Wann ist das Gerät fertig?', createdAt: t1 },
    ] });
    // B: Kundennachricht, vom Admin gelesen -> fuer Admin NICHT, fuer Staff weiterhin enthalten
    await InspectionCommunication.create({ orderId: B.orders[0]._id, status: 'active', messages: [
      { senderId: owner._id, senderType: 'customer', senderName: 'Olga Owner', content: 'Danke!', createdAt: t1, readBy: [{ userId: admin._id, readAt: t2 }] },
    ] });
    // C: nur Team-Nachricht -> nicht enthalten
    await InspectionCommunication.create({ orderId: C.orders[0]._id, status: 'active', messages: [
      { senderId: staff._id, senderType: 'staff', senderName: 'Stefan Staff', content: 'Ihr Gerät ist eingegangen.', createdAt: t1 },
    ] });
    // D: Gastnachricht ohne senderId -> enthalten
    await InspectionCommunication.create({ orderId: D.orders[0]._id, status: 'active', messages: [
      { senderType: 'customer', senderName: 'Gast', content: 'Hallo?', createdAt: t1 },
    ] });
    // E: Rueckfrage, vom Admin VOR der Antwort gelesen, Antwort danach -> enthalten
    await InspectionCommunication.create({ orderId: E.orders[0]._id, status: 'active', messages: [
      {
        senderId: staff._id, senderType: 'staff', senderName: 'Stefan Staff', messageType: 'feedback_request', content: 'Soll das Akku-Teil getauscht werden?', createdAt: t0,
        feedbackRequest: { question: 'Soll das Akku-Teil getauscht werden?', type: 'agreement', options: [{ value: 'yes', label: 'Ja' }, { value: 'no', label: 'Nein' }], status: 'responded', respondedAt: t2, response: { value: 'yes', label: 'Ja' } },
        readBy: [{ userId: admin._id, readAt: t1 }],
      },
    ] });

    let res = await call('/api/bookings?limit=50&communication=unread-customer-response', admin);
    const adminIds = (res.body?.bookings || []).map((row) => String(row._id));
    check(res.status === 200, 'Admin mit Filter -> 200', res.status);
    check(adminIds.includes(String(A.booking._id)), 'ungelesene Kundennachricht -> Buchung enthalten', adminIds.length);
    check(!adminIds.includes(String(B.booking._id)), 'vom Admin gelesene Kundennachricht -> fuer den Admin nicht enthalten', adminIds.includes(String(B.booking._id)));
    check(!adminIds.includes(String(C.booking._id)), 'nur Team-Nachricht -> nicht enthalten', adminIds.includes(String(C.booking._id)));
    check(adminIds.includes(String(D.booking._id)), 'Gastnachricht ohne senderId -> enthalten', adminIds.includes(String(D.booking._id)));
    check(adminIds.includes(String(E.booking._id)), 'Rueckfrage nach dem Lesen beantwortet -> enthalten', adminIds.includes(String(E.booking._id)));
    check(!adminIds.includes(String(F.booking._id)), 'Buchung ohne Gespraech -> nicht enthalten', adminIds.includes(String(F.booking._id)));
    check(res.body?.total === adminIds.length && adminIds.length === 3, 'total passt zur gefilterten Liste (3)', `${res.body?.total}/${adminIds.length}`);

    res = await call('/api/bookings?limit=50&communication=unread-customer-response', staff);
    const staffIds = (res.body?.bookings || []).map((row) => String(row._id));
    check(staffIds.includes(String(B.booking._id)), 'pro Benutzer: fuer einen anderen Mitarbeiter bleibt B ungelesen', staffIds.includes(String(B.booking._id)));
    check(!staffIds.includes(String(C.booking._id)), 'eigene Team-Nachricht zaehlt auch fuer Staff nicht', staffIds.includes(String(C.booking._id)));
  });

  server.close();
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  out(`\nErgebnis: ${pass} PASS, ${fail} FAIL`);
  process.exitCode = fail === 0 ? 0 : 1;
}

main().catch(async (error) => {
  out(`ABBRUCH: ${error.stack || error.message}`);
  try { await mongoose.disconnect(); } catch (e) { /* ignore */ }
  process.exit(1);
});
