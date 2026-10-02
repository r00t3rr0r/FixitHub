/**
 * Regressionstest (01.10.2026, Track "bookings"): Kundenliste GET /api/bookings ("Meine Buchungen").
 *
 * Laeuft ueber den ECHTEN Express-Router /api/bookings mit echter JWT-Pruefung und echter DB.
 *
 * Abgesichert:
 *   CUSTUX-3  Serverseitige Kundensuche (?search=): findet Buchungsnummer, Auftragsnummer und
 *             Geraet (auch "Marke Modell" und das AKTUELLE Geraet nach Korrektur) ueber alle
 *             Seiten; total passt zur Trefferliste; nur EIGENE Buchungen (fremder Kunde findet
 *             mit der fremden Auftragsnummer nichts); Regex-Sonderzeichen ('.*', '(', '[') werden
 *             als Text behandelt (kein 500, kein "alles gefunden").
 *   CUSTUX-14 items[].device / orderNumber kommen zur Lesezeit aus dem aktuellen Auftrag
 *             (Geraetewechsel durch das Team), der gespeicherte Buchungs-Snapshot bleibt unveraendert.
 *   Nebenbefund: items[].hasComplaint wurde nie geladen (immer false) - jetzt aus dem Auftrag.
 *   Team-Suche (admin/staff) unveraendert: Suche nach Kundenname funktioniert weiter.
 *   paymentBalance bleibt in der Kundenliste enthalten (Gesamt/Bezahlt/Offen der Karte).
 *   DHL REVIEW-7 Gast-Buchungsseite: GET /api/track-order/booking und /by-number liefern
 *             shippingLabelDirection ('outbound' fuer ein aelteres Rueckweg-Label, sonst 'inbound'),
 *             damit die Gastseite den Parcel-Platz nicht als Einsendelabel zeigt; falsche E-Mail -> 403.
 *
 * Keine echten E-Mails / kein Netzwerk (Benachrichtigungen und E-Mail gemockt).
 *
 * Aufruf (nur Wegwerf-Datenbank):
 *   TEST_MONGODB_URI=mongodb://127.0.0.1:27099/t_bookings_customer_list node test-bookings-customer-list.js
 */
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const SERVER_DIR = path.join(__dirname, 'server');
const mongoose = require(path.join(SERVER_DIR, 'node_modules/mongoose'));
const express = require(path.join(SERVER_DIR, 'node_modules/express'));
const jwt = require(path.join(SERVER_DIR, 'node_modules/jsonwebtoken'));

const URI = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27099/t_bookings_customer_list';

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
  const orderTrackingRoutes = require(path.join(SERVER_DIR, 'routes/orderTrackingRoutes'));
  const app = express();
  app.use(express.json());
  app.use('/api/bookings', bookingRoutes);
  app.use('/api/track-order', orderTrackingRoutes);
  const server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const User = mongoose.model('User');
  const Order = mongoose.model('Order');
  const Booking = mongoose.model('Booking');

  const tokenFor = (user) => jwt.sign({ sub: String(user._id) }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '10m' });
  const call = async (url, user) => {
    const response = await fetch(`${baseUrl}${url}`, { headers: user ? { Authorization: `Bearer ${tokenFor(user)}` } : {} });
    let body = null;
    try { body = await response.json(); } catch (error) { body = null; }
    return { status: response.status, body };
  };

  const admin = await User.create({ name: 'Admin Liste', email: 'bcl-admin@test.invalid', role: 'admin' });
  const owner = await User.create({ name: 'Olga Owner', firstName: 'Olga', lastName: 'Owner', email: 'bcl-owner@test.invalid', role: 'customer' });
  const other = await User.create({ name: 'Fritz Fremd', firstName: 'Fritz', lastName: 'Fremd', email: 'bcl-other@test.invalid', role: 'customer' });

  let seq = 0;
  const makeBooking = async (customer, devices, extra = {}) => {
    const orders = [];
    for (const [brand, model] of devices) {
      seq += 1;
      orders.push(await Order.create({
        customerId: customer._id,
        orderNumber: `ORD-BCL-${String(seq).padStart(3, '0')}`,
        deviceBrand: brand,
        deviceModel: model,
        deviceType: 'Smartphone',
        errorDescription: 'Display defekt',
        services: [{ serviceId: new mongoose.Types.ObjectId(), name: 'Displaytausch', price: 49.9, quantity: 1, estimatedTime: 30 }],
        totalCost: 49.9,
        status: 'pending',
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

  // Eigentuemer: 3 Buchungen (iPhone 13 + Galaxy, Pixel, iPhone 15); fremder Kunde: iPhone 13.
  const A = await makeBooking(owner, [['Apple', 'iPhone 13'], ['Samsung', 'Galaxy S23']]);
  const B = await makeBooking(owner, [['Google', 'Pixel 8']]);
  const C = await makeBooking(owner, [['Apple', 'iPhone 15']]);
  const F = await makeBooking(other, [['Apple', 'iPhone 13']]);

  await runSection('CUSTUX-3 Kundensuche serverseitig, nur eigene Buchungen', async () => {
    let res = await call('/api/bookings?search=iPhone', owner);
    const ids = (res.body?.bookings || []).map((b) => String(b._id)).sort();
    check(res.status === 200 && ids.length === 2 && ids.includes(String(A.booking._id)) && ids.includes(String(C.booking._id)), 'search=iPhone -> genau die 2 eigenen iPhone-Buchungen', `${res.status} ${ids.length}`);
    check(res.body?.total === 2, 'total passt zur Trefferliste (nicht alle 3 Buchungen)', res.body?.total);
    check(!ids.includes(String(F.booking._id)), 'fremde iPhone-Buchung nicht enthalten', ids.join(','));

    res = await call('/api/bookings?search=Apple%20iPhone%2013', owner);
    check(res.body?.total === 1 && String(res.body?.bookings?.[0]?._id) === String(A.booking._id), 'Suche "Apple iPhone 13" (Marke + Modell) findet Buchung A', res.body?.total);

    res = await call(`/api/bookings?search=${encodeURIComponent(B.orders[0].orderNumber.toLowerCase())}`, owner);
    check(res.body?.total === 1 && String(res.body?.bookings?.[0]?._id) === String(B.booking._id), 'Suche nach Auftragsnummer (Kleinschreibung) findet Buchung B', res.body?.total);

    res = await call(`/api/bookings?search=${encodeURIComponent(C.booking.bookingNumber)}`, owner);
    check(res.body?.total === 1 && String(res.body?.bookings?.[0]?._id) === String(C.booking._id), 'Suche nach Buchungsnummer findet Buchung C', `${C.booking.bookingNumber} -> ${res.body?.total}`);

    res = await call(`/api/bookings?search=${encodeURIComponent(F.orders[0].orderNumber)}`, owner);
    check(res.status === 200 && res.body?.total === 0 && (res.body?.bookings || []).length === 0, 'fremde Auftragsnummer -> 0 Treffer (kein Fremdzugriff ueber die Suche)', `${res.status} ${res.body?.total}`);

    res = await call('/api/bookings?search=iPhone&limit=1&skip=1', owner);
    check(res.body?.total === 2 && (res.body?.bookings || []).length === 1, 'Suche wirkt ueber alle Seiten (Seite 2 mit limit=1 hat 1 Treffer, total 2)', `${res.body?.total}/${(res.body?.bookings || []).length}`);

    for (const raw of ['.*', '(', '[', 'iPhone|Pixel', '\\']) {
      res = await call(`/api/bookings?search=${encodeURIComponent(raw)}`, owner);
      check(res.status === 200 && res.body?.total === 0, `Sonderzeichen "${raw}" als Text: 200, 0 Treffer`, `${res.status} ${res.body?.total}`);
    }

    res = await call('/api/bookings', owner);
    check(res.body?.total === 3, 'ohne Suche weiterhin alle 3 eigenen Buchungen', res.body?.total);
    const entry = (res.body?.bookings || []).find((b) => String(b._id) === String(A.booking._id));
    check(entry && entry.paymentBalance && Math.abs(Number(entry.paymentBalance.open) - 99.8) < 0.005, 'paymentBalance (Gesamt/Offen) weiterhin in der Kundenliste', entry && JSON.stringify(entry.paymentBalance && { total: entry.paymentBalance.total, open: entry.paymentBalance.open }));

    res = await call('/api/bookings?search=iPhone', other);
    check(res.body?.total === 1 && String(res.body?.bookings?.[0]?._id) === String(F.booking._id), 'fremder Kunde findet nur seine eigene Buchung', res.body?.total);

    res = await call('/api/bookings?search=iPhone');
    check(res.status === 401, 'ohne Anmeldung -> 401', res.status);
  });

  await runSection('Team-Suche unveraendert', async () => {
    const res = await call('/api/bookings?search=Fremd', admin);
    const ids = (res.body?.bookings || []).map((b) => String(b._id));
    check(res.status === 200 && ids.includes(String(F.booking._id)) && res.body?.total >= 1, 'Admin-Suche nach Kundenname findet die Buchung', `${res.status} ${res.body?.total}`);
  });

  await runSection('CUSTUX-14 aktuelles Geraet + Nebenbefund hasComplaint', async () => {
    await Order.updateOne({ _id: A.orders[0]._id }, { $set: { deviceModel: 'iPhone 13 Pro', hasComplaint: true, status: 'completed' } });
    const res = await call('/api/bookings', owner);
    const entry = (res.body?.bookings || []).find((b) => String(b._id) === String(A.booking._id));
    const item = entry?.items?.find((i) => String(i.orderId) === String(A.orders[0]._id));
    check(item && item.device === 'Apple iPhone 13 Pro', 'items[].device = aktuelles Geraet aus dem Auftrag', item && item.device);
    check(item && item.orderNumber === A.orders[0].orderNumber, 'items[].orderNumber aus dem Auftrag', item && item.orderNumber);
    check(item && item.hasComplaint === true && item.status === 'completed', 'hasComplaint/status aus dem Auftrag (Reklamation nicht erneut angeboten)', item && `${item.hasComplaint} ${item.status}`);
    const stored = await Booking.findById(A.booking._id).setOptions({ skipAutoPopulate: true }).lean();
    check(stored.items[0].device === 'Apple iPhone 13', 'gespeicherter Buchungs-Snapshot unveraendert (keine stille Datenaenderung)', stored.items[0].device);
    const found = await call('/api/bookings?search=13%20Pro', owner);
    check(found.body?.total === 1, 'Suche findet das korrigierte Geraet ("13 Pro")', found.body?.total);
  });

  await runSection('Decision O4 Reklamations-Folgeauftraege bleiben in "Meine Buchungen" erreichbar', async () => {
    const followupBase = (source, extra = {}) => ({
      customerId: source.customerId,
      deviceBrand: source.deviceBrand,
      deviceModel: source.deviceModel,
      deviceType: 'Smartphone',
      errorDescription: 'Reklamation',
      services: [{ serviceId: new mongoose.Types.ObjectId(), name: 'Reparaturangebot (Reklamation)', price: 30, quantity: 1, estimatedTime: 0 }],
      totalCost: 30,
      status: 'in-progress',
      progress: 40,
      hasComplaint: false,
      isComplaintFollowup: true,
      parentOrderId: source._id,
      requiresPaymentBeforeCompletion: true,
      ...extra,
    });
    // a) Folgeauftrag mit bookingId (complaintRoutes kopiert den Ursprungsauftrag per toObject)
    const fuA = await Order.create(followupBase(A.orders[0], { orderNumber: 'ORD-BCL-FU1', bookingId: A.booking._id }));
    // b) Folgeauftrag ohne bookingId, nur ueber parentOrderId verknuepft (wie in getBookingOrders)
    const fuB = await Order.create(followupBase(B.orders[0], { orderNumber: 'ORD-BCL-FU2' }));
    // c) Fremder Auftrag mit der bookingId des Eigentuemers (Altdatenfehler) - darf nie erscheinen
    await Order.create(followupBase(F.orders[0], { orderNumber: 'ORD-BCL-FOREIGN', customerId: other._id, bookingId: A.booking._id, parentOrderId: F.orders[0]._id }));

    let res = await call('/api/bookings', owner);
    const entryA = (res.body?.bookings || []).find((b) => String(b._id) === String(A.booking._id));
    const itemA = entryA?.items?.find((i) => String(i.orderId) === String(fuA._id));
    check(Boolean(itemA), 'Folgeauftrag mit bookingId erscheint als eigene Position der Buchung', entryA && entryA.items.map((i) => i.orderNumber).join(','));
    check(itemA && itemA.isComplaintFollowup === true && itemA.parentOrderNumber === A.orders[0].orderNumber && itemA.orderNumber === 'ORD-BCL-FU1',
      'Position traegt isComplaintFollowup + Ursprungsauftrag (Label "Reklamationsauftrag zu ORD-…")', itemA && `${itemA.isComplaintFollowup} ${itemA.parentOrderNumber}`);
    check(itemA && itemA.status === 'in-progress' && itemA.device === `${fuA.deviceBrand} ${fuA.deviceModel}` && itemA.type === 'repair', 'Status/Geraet des Folgeauftrags aus dem Auftrag', itemA && `${itemA.status} ${itemA.device}`);
    check(entryA && !entryA.items.some((i) => i.orderNumber === 'ORD-BCL-FOREIGN'), 'fremder Auftrag mit gleicher bookingId erscheint NICHT', entryA && entryA.items.length);
    check(entryA && entryA.items.filter((i) => String(i.orderId) === String(A.orders[0]._id)).length === 1, 'Ursprungsauftrag nicht doppelt', entryA && entryA.items.length);

    const entryB = (res.body?.bookings || []).find((b) => String(b._id) === String(B.booking._id));
    const itemB = entryB?.items?.find((i) => String(i.orderId) === String(fuB._id));
    check(itemB && itemB.isComplaintFollowup === true && itemB.parentOrderNumber === B.orders[0].orderNumber, 'Folgeauftrag ohne bookingId (nur parentOrderId) erscheint bei der Buchung des Ursprungsauftrags', itemB && itemB.orderNumber);

    const storedA = await Booking.findById(A.booking._id).setOptions({ skipAutoPopulate: true }).lean();
    check(storedA.items.length === 2, 'gespeicherte Buchungspositionen unveraendert (Lesezeit-Position)', storedA.items.length);

    res = await call('/api/bookings?search=ORD-BCL-FU2', owner);
    check(res.body?.total === 1 && String(res.body?.bookings?.[0]?._id) === String(B.booking._id), 'Suche nach der Folgeauftragsnummer findet die Buchung (total passt)', res.body?.total);
    res = await call('/api/bookings?search=ORD-BCL-FU1', other);
    check(res.status === 200 && res.body?.total === 0, 'fremder Kunde findet den Folgeauftrag nicht', `${res.status} ${res.body?.total}`);
    res = await call('/api/bookings', other);
    const foreignItems = (res.body?.bookings || []).flatMap((b) => b.items || []).map((i) => i.orderNumber);
    check(!foreignItems.includes('ORD-BCL-FU1') && !foreignItems.includes('ORD-BCL-FU2'), 'Liste des fremden Kunden ohne Folgeauftraege des Eigentuemers', foreignItems.join(','));
  });

  await runSection('DHL REVIEW-7 Gast-Buchung: Richtung des Buchungslabels', async () => {
    const guestBooking = async (token, number, timeline) => {
      const order = await Order.create({
        orderNumber: `ORD-BCL-G${token}`, deviceBrand: 'Apple', deviceModel: 'iPhone 12', deviceType: 'Smartphone',
        errorDescription: 'Akku', services: [{ serviceId: new mongoose.Types.ObjectId(), name: 'Akkutausch', price: 59, quantity: 1, estimatedTime: 30 }],
        totalCost: 59, status: 'pending', guestInfo: { email: 'gast@test.invalid', firstName: 'Gina', lastName: 'Gast', isGuest: true },
      });
      const booking = await Booking.create({
        bookingNumber: number, orderIds: [order._id], guestTrackingToken: `tok-${token}-${crypto.randomBytes(6).toString('hex')}`,
        guestInfo: { email: 'gast@test.invalid', firstName: 'Gina', lastName: 'Gast', isGuest: true },
        items: [{ type: 'repair', orderId: order._id, orderNumber: order.orderNumber, device: 'Apple iPhone 12', cost: 59 }],
        totalCost: 59, trackingNumber: '00340434160000000001', shippingStatus: 'label-created', timeline,
      });
      await Order.updateOne({ _id: order._id }, { $set: { bookingId: booking._id } });
      return booking;
    };
    const legacy = await guestBooking('out', 'BKG-BCL-G1', [{ status: 'Shipping Label Created', description: 'Versandlabel für den Rückweg an den Kunden erstellt', completedAt: new Date(), staffName: 'Team' }]);
    const fresh = await guestBooking('in', 'BKG-BCL-G2', [{ status: 'Shipping Label Created', description: 'DHL-Einsendelabel (Hinweg) erstellt', completedAt: new Date(), staffName: 'Team' }]);
    let res = await call(`/api/track-order/booking?token=${encodeURIComponent(legacy.guestTrackingToken)}&email=gast@test.invalid`);
    check(res.status === 200 && res.body?.booking?.shippingLabelDirection === 'outbound', 'aelteres Rueckweg-Label -> shippingLabelDirection outbound', `${res.status} ${res.body?.booking?.shippingLabelDirection}`);
    check(!(res.body?.booking?.timeline || []).some((entry) => entry.staffName), 'Gastverlauf ohne Mitarbeiternamen (Kundenansicht bleibt)', JSON.stringify((res.body?.booking?.timeline || []).map((e) => Object.keys(e))));
    res = await call(`/api/track-order/booking?token=${encodeURIComponent(fresh.guestTrackingToken)}&email=gast@test.invalid`);
    check(res.status === 200 && res.body?.booking?.shippingLabelDirection === 'inbound', 'Einsendelabel (Hinweg) -> inbound', `${res.status} ${res.body?.booking?.shippingLabelDirection}`);
    res = await call(`/api/track-order/by-number?bookingNumber=BKG-BCL-G1&email=gast@test.invalid`);
    check(res.status === 200 && res.body?.booking?.shippingLabelDirection === 'outbound', '/by-number liefert dieselbe Richtung', `${res.status} ${res.body?.booking?.shippingLabelDirection}`);
    res = await call(`/api/track-order/booking?token=${encodeURIComponent(legacy.guestTrackingToken)}&email=fremd@test.invalid`);
    check(res.status === 403 && !res.body?.booking, 'falsche E-Mail -> 403 ohne Buchungsdaten', res.status);
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
