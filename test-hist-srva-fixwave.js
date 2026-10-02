/**
 * Regressionstest Fix-Welle srvA (02.10.2026) - echte Express-Routen + echte Wegwerf-DB + Rollen.
 *
 *  [A] EUR-FORMAT: Aenderungsbeleg "Auftrag angelegt" im deutschen Geldformat (49,90 €, nie "49.90 EUR")
 *  [B] K08-CASE + EUR-FORMAT + PAR-6c: Geraetewechsel mit Katalog-Geraetetyp 'smartphone' -
 *      kein Eintrag 'Gerätetyp: Smartphone → smartphone', gespeicherter Typ bleibt 'Smartphone';
 *      Verlaufstext/Revision/Zahlungshinweis in "59,90 €"; Pruefbericht-Parser liest den Text weiter
 *  [C] PAR-4: E-Teil entfernen / Status / Bedarfsliste schreiben deutsche Verlaufstexte mit type 'parts'
 *  [D] PAR-3: Buchung 'Abgeschlossen' - Versandbuchung bekommt KEINE Abholmail, reine Abholbuchung schon;
 *      Statushinweis ohne rohe Enum-Werte
 *  [E] HIST-LABEL: Einsendelabel der Buchung (Testlabel) erscheint im Kundenverlauf JEDES Auftrags
 *      genau einmal; fremder Kunde 403
 *  [F] K09-INSPECTION-CANCELLED: Inspektions-Schreibzugriffe auf stornierten Auftrag -> 409, keine
 *      Benachrichtigung, Inspektion unveraendert; Lesen erlaubt; offener Auftrag funktioniert weiter
 *
 * Keine echten E-Mails/Benachrichtigungen (sendTriggerEmail und createNotification werden mitgeschnitten),
 * keine DHL-Aufrufe (Testlabel-Modus, DHL-Aufrufe werfen).
 *
 * Aufruf (nur gegen eine WEGWERF-Datenbank):
 *   TEST_MONGODB_URI=mongodb://127.0.0.1:27099/t_fix_srvA_hist node test-hist-srva-fixwave.js
 */
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const SERVER_DIR = path.join(__dirname, 'server');
const mongoose = require(path.join(SERVER_DIR, 'node_modules/mongoose'));
const express = require(path.join(SERVER_DIR, 'node_modules/express'));
const jwt = require(path.join(SERVER_DIR, 'node_modules/jsonwebtoken'));

const URI = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27099/t_fix_srvA_hist';

// Sicherheitsnetz (aus test-percent-rounding-consistency.js): dieser Test ruft dropDatabase()
// auf und darf nur gegen eine ausdruecklich angegebene Wegwerf-Datenbank laufen.
function isUnsafeTestUri(uri) {
  const text = String(uri || '');
  const match = text.match(/^mongodb:\/\/(?:[^@/]*@)?(\[[^\]]+\]|[^:/,?]+)(?::(\d+))?\/([^/?]+)/i);
  if (!match) return true;
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

process.env.BOOKING_DHL_LABEL_MODE = 'dummy';
process.env.EMAIL_TEST_TRANSPORT = 'stream';

let pass = 0;
let fail = 0;
const check = (condition, message, actual) => {
  if (condition) {
    pass += 1;
    console.log(`  PASS ${message} :: ${actual}`);
  } else {
    fail += 1;
    console.log(`  FAIL ${message} :: ${actual}`);
  }
};
const section = async (title, fn) => {
  console.log(`\n${title}`);
  try {
    await fn();
  } catch (error) {
    fail += 1;
    console.log(`  FAIL Abschnitt brach ab :: ${error && error.stack ? error.stack.split('\n').slice(0, 5).join(' | ') : error}`);
  }
};
const show = (value) => {
  try { return JSON.stringify(value); } catch (e) { return String(value); }
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const ENGLISH_MONEY = /\d\.\d\d EUR/;

async function main() {
  if (isUnsafeTestUri(URI)) {
    throw new Error('Dieser Test darf nicht gegen die Entwicklungsdatenbank laufen.');
  }
  process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
  await mongoose.connect(URI);
  await mongoose.connection.dropDatabase();

  fs.readdirSync(path.join(SERVER_DIR, 'models')).filter((file) => file.endsWith('.js')).forEach((file) => {
    try { require(path.join(SERVER_DIR, 'models', file)); } catch (error) { /* optionale Abhaengigkeiten */ }
  });

  const EmailService = require(path.join(SERVER_DIR, 'services/emailService'));
  const sentMails = [];
  EmailService.sendTriggerEmail = async (trigger, to, data) => {
    sentMails.push({ trigger, to, data });
    return { success: true, mocked: true };
  };
  EmailService.sendOrderConfirmationEmail = async () => ({ success: true, mocked: true });
  EmailService.buildSystemUrl = async (p) => `https://test.invalid${p}`;
  EmailService.resolveDeviceModelImageUrl = async () => '';

  const DHLService = require(path.join(SERVER_DIR, 'services/dhlService'));
  DHLService.getTrackingInfo = async () => { throw new Error('DHL darf in diesem Test nicht aufgerufen werden'); };
  DHLService.createShipment = async () => { throw new Error('DHL darf in diesem Test nicht aufgerufen werden'); };

  const NotificationService = require(path.join(SERVER_DIR, 'services/notificationService'));
  const notifications = [];
  NotificationService.createNotification = async (data) => {
    notifications.push(data);
    const notification = { _id: new mongoose.Types.ObjectId(), ...data };
    return { notification, emailDelivery: { status: 'sent' }, ...notification };
  };

  const BookingService = require(path.join(SERVER_DIR, 'services/bookingService'));
  const DeviceInspectionService = require(path.join(SERVER_DIR, 'services/deviceInspectionService'));

  const app = express();
  app.use(express.json());
  app.use('/api/orders', require(path.join(SERVER_DIR, 'routes/orderRoutes')));
  app.use('/api/admin/orders', require(path.join(SERVER_DIR, 'routes/adminOrderRoutes')));
  app.use('/api/bookings', require(path.join(SERVER_DIR, 'routes/bookingRoutes')));
  app.use('/api/device-inspections', require(path.join(SERVER_DIR, 'routes/deviceInspectionRoutes')));
  const server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const User = mongoose.model('User');
  const Order = mongoose.model('Order');
  const Booking = mongoose.model('Booking');
  const Service = mongoose.model('Service');
  const Inventory = mongoose.model('Inventory');
  const OrderRevision = mongoose.model('OrderRevision');
  const DeviceInspection = mongoose.model('DeviceInspection');
  const { DeviceType } = require(path.join(SERVER_DIR, 'models/Device'));
  await Booking.syncIndexes();

  const customer = await User.create({
    name: 'Klara Kunde', firstName: 'Klara', lastName: 'Kunde', email: 'srva-kunde@test.invalid', role: 'customer', isActive: true,
    invoiceAddress: { street: 'Rechnungsallee 1', city: 'München', zipCode: '80331', country: 'DE' },
  });
  const stranger = await User.create({ name: 'Fremd Kunde', email: 'srva-fremd@test.invalid', role: 'customer', isActive: true });
  const staff = await User.create({ name: 'Sophie Technik', email: 'srva-staff@test.invalid', role: 'staff', isActive: true });
  const admin = await User.create({ name: 'Anna Admin', email: 'srva-admin@test.invalid', role: 'admin', isActive: true });

  const tokenFor = (user) => jwt.sign({ sub: String(user._id) }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '10m' });
  const call = async (method, url, user, body) => {
    const response = await fetch(`${baseUrl}${url}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(user ? { Authorization: `Bearer ${tokenFor(user)}` } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    let json = null;
    try { json = await response.json(); } catch (error) { json = null; }
    return { status: response.status, body: json };
  };
  const history = async (orderId, user) => call('GET', `/api/orders/${orderId}/history?limit=300`, user);

  await DeviceType.create({ _id: 'smartphone', name: 'Smartphone' });
  const base = { category: 'display', deviceTypes: ['Smartphone'], manufacturerPrecise: 'Apple', estimatedTime: '60' };
  const display14 = await Service.create({ ...base, name: 'Displaytausch iPhone 14', price: 49.9, modelPrecise: 'iPhone 14' });
  const display15 = await Service.create({ ...base, name: 'Displaytausch iPhone 15', price: 59.9, modelPrecise: 'iPhone 15' });

  let seq = 0;
  const makeOrder = (fields = {}) => {
    seq += 1;
    return Order.create({
      orderNumber: `ORD-SRVA-${String(seq).padStart(3, '0')}`,
      deviceBrand: 'Apple', deviceModel: 'iPhone 14', deviceType: 'Smartphone',
      errorDescription: 'Display', totalCost: 49.9, status: 'pending', customerId: customer._id,
      shippingAddress: { street: 'Rechnungsallee 1', number: '1', city: 'München', zipCode: '80331', country: 'DE' },
      ...fields,
    });
  };

  let orderId = '';
  try {
    await section('[A] EUR-FORMAT: Aenderungsbeleg "Auftrag angelegt" (POST /api/orders als Kundin)', async () => {
      const created = await call('POST', '/api/orders', customer, {
        deviceType: 'Smartphone', deviceBrand: 'Apple', deviceModel: 'iPhone 14',
        services: [String(display14._id)], errorDescription: 'Display gesprungen',
      });
      check(created.status === 201, 'Auftrag angelegt (201)', `${created.status} ${show(created.body?.error)}`);
      const order = await Order.findOne({ customerId: customer._id }).sort({ createdAt: -1 }).lean();
      orderId = String(order._id);
      const revision = await OrderRevision.findOne({ orderId: order._id, triggerReason: 'initial_creation' }).lean();
      check(revision && revision.notes === 'Auftrag angelegt: Positionen 49,90 €, Rabatt 0,00 €, Auftragswert 49,90 € (brutto)',
        'Belegnotiz im deutschen Geldformat', revision && revision.notes);
      const res = await history(orderId, staff);
      const entry = (res.body?.entries || []).find((item) => /Auftrag angelegt/.test(item.description || ''));
      check(res.status === 200 && entry && /49,90 €/.test(entry.description) && !ENGLISH_MONEY.test(entry.description),
        'Teamverlauf zeigt "49,90 €" (kein "49.90 EUR")', entry && entry.description);
    });

    await section('[B] K08-CASE + EUR-FORMAT: Geraetewechsel mit Katalogtyp "smartphone" (POST change-device)', async () => {
      const stored = await Order.findById(orderId).setOptions({ skipAutoPopulate: true }).lean();
      const res = await call('POST', `/api/admin/orders/${orderId}/change-device`, staff, {
        deviceBrand: 'Apple', deviceModel: 'iPhone 15', deviceType: 'smartphone',
        serviceReplacements: [{ oldOrderServiceId: String(stored.services[0]._id), newServiceId: String(display15._id) }],
        reason: 'Kunde hat falsches Modell gebucht',
      });
      check(res.status === 200, 'Geraetewechsel 200', `${res.status} ${show(res.body?.error)}`);
      const after = await Order.findById(orderId).setOptions({ skipAutoPopulate: true }).lean();
      check(after.deviceType === 'Smartphone', 'Geraetetyp bleibt "Smartphone" (nur Gross-/Kleinschreibung verschieden)', after.deviceType);
      check(after.deviceModel === 'iPhone 15', 'Modell geaendert', after.deviceModel);
      const entry = [...(after.timeline || [])].reverse().find((item) => item.status === 'Device Changed');
      const changeFields = (entry?.changes || []).map((change) => change.field);
      check(entry && !changeFields.includes('deviceType'), 'kein Aenderungseintrag "Gerätetyp: Smartphone → smartphone"', show(entry?.changes));
      check(entry && changeFields.includes('deviceModel'), 'Modellaenderung weiterhin protokolliert', changeFields.join(','));
      check(entry && /Auftragskosten: 49,90 € -> 59,90 €\./.test(entry.description) && !ENGLISH_MONEY.test(entry.description),
        'Verlaufstext im deutschen Geldformat', entry && entry.description);
      check(entry && /Noch offen: 59,90 €\./.test(entry.description), 'Zahlungshinweis im deutschen Geldformat (PAR-6c)', entry && entry.description);
      check(DeviceInspectionService._parseDeviceChangeOrigin(entry?.description) === 'Apple iPhone 14',
        'Pruefbericht liest das Ursprungsgeraet weiter', DeviceInspectionService._parseDeviceChangeOrigin(entry?.description));
      const revision = await OrderRevision.findOne({ orderId, triggerReason: 'device_change' }).lean();
      check(revision && /„Displaytausch iPhone 14“ → „Displaytausch iPhone 15“ \(59,90 €\)/.test(revision.notes)
        && /Auftragswert 49,90 € → 59,90 €/.test(revision.notes) && !ENGLISH_MONEY.test(revision.notes),
        'Aenderungsbeleg im deutschen Geldformat', revision && revision.notes);
      check(res.body?.pricingChangesSummary?.newDevice?.type === 'Smartphone', 'Zusammenfassung meldet den gespeicherten Typ', res.body?.pricingChangesSummary?.newDevice?.type);
    });

    await section('[C] PAR-4: E-Teil-Verlaufseintraege deutsch mit type "parts"', async () => {
      const part = await Inventory.create({
        itemName: 'Display iPhone 15', category: 'Display', manufacturer: 'Apple', model: 'iPhone 15', sku: 'DSP-15-SRVA',
        versions: [{ versionType: 'original', versionId: 'DSP-15-SRVA-V1', quantity: 5, minStockLevel: 0, reorderLevel: 0, unitCost: 50, sellingPrice: 90, storageLocation: 'A1' }],
      });
      const versionId = String(part.versions[0]._id);
      let res = await call('POST', `/api/admin/orders/${orderId}/eparts`, staff, { partId: String(part._id), versionId, quantity: 1 });
      check(res.status === 200, 'E-Teil zugewiesen', `${res.status} ${show(res.body?.error)}`);
      let order = await Order.findById(orderId).setOptions({ skipAutoPopulate: true }).lean();
      const ePartId = String(order.eParts[0]._id);
      res = await call('PUT', `/api/admin/orders/${orderId}/eparts/${ePartId}/status`, staff, { status: 'used' });
      check(res.status === 200, 'E-Teil-Status geaendert', `${res.status} ${show(res.body?.error)}`);
      res = await call('DELETE', `/api/admin/orders/${orderId}/eparts/${ePartId}`, staff);
      check(res.status === 200, 'E-Teil entfernt', `${res.status} ${show(res.body?.error)}`);
      res = await call('POST', `/api/admin/orders/${orderId}/eparts/need-list`, staff, { partId: String(part._id), quantity: 2, needListName: 'Wochenbestellung' });
      check(res.status === 200, 'Bedarfsliste vermerkt', `${res.status} ${show(res.body?.error)}`);
      order = await Order.findById(orderId).setOptions({ skipAutoPopulate: true }).lean();
      const byKey = (key) => (order.timeline || []).find((item) => item.status === key);
      const statusEntry = byKey('EPart Status Updated');
      const removedEntry = byKey('EPart Removed');
      const needEntry = byKey('EPart Need List Added');
      check(statusEntry && statusEntry.description === 'Status von Display iPhone 15: Zugewiesen → Verbaut' && statusEntry.type === 'parts',
        'Status: deutscher Text, type parts', statusEntry && `${statusEntry.description} / ${statusEntry.type}`);
      check(removedEntry && removedEntry.description === 'Display iPhone 15 (original) ×1 vom Auftrag entfernt' && removedEntry.type === 'parts',
        'Entfernen: deutscher Text, type parts', removedEntry && `${removedEntry.description} / ${removedEntry.type}`);
      check(needEntry && needEntry.description === 'Display iPhone 15 ×2 auf Bedarfsliste „Wochenbestellung“ gesetzt' && needEntry.type === 'parts',
        'Bedarfsliste: deutscher Text, type parts', needEntry && `${needEntry.description} / ${needEntry.type}`);
      check([statusEntry, removedEntry, needEntry].every((item) => item && item.staffName === 'Sophie Technik'),
        'handelnde Person statt "Staff Member"', [statusEntry, removedEntry, needEntry].map((item) => item && item.staffName).join(','));
      const staffView = await history(orderId, staff);
      const partsEntries = (staffView.body?.entries || []).filter((item) => /^EPart (Status Updated|Removed|Need List Added)$/.test(item.key));
      check(partsEntries.length === 3 && partsEntries.every((item) => item.type === 'parts' && !/removed|status changed|added to need list/i.test(item.description)),
        'Teamverlauf: 3 deutsche Ersatzteil-Eintraege', partsEntries.map((item) => `${item.type}:${item.description}`).join(' | '));
      const customerView = await history(orderId, customer);
      check(customerView.status === 200 && !(customerView.body?.entries || []).some((item) => /^EPart/.test(item.key)),
        'Kundenverlauf zeigt keine Ersatzteil-Eintraege', (customerView.body?.entries || []).map((item) => item.key).join(','));
    });

    await section('[D] PAR-3: Buchung "Abgeschlossen" - Versand vs. Abholung (PUT /api/bookings/:id/status)', async () => {
      const waitForMail = async (bookingNumber, predicate = () => true) => {
        for (let i = 0; i < 40; i += 1) {
          const mail = sentMails.find((item) => item.data?.bookingNumber === bookingNumber && predicate(item));
          if (mail) return mail;
          await sleep(50);
        }
        return null;
      };
      // Versandbuchung: Einsendelabel (Kunde -> McRepair) an der Buchung.
      const shipOrder = await makeOrder();
      const shipBooking = await BookingService.create({ customerId: customer._id, orderIds: [shipOrder._id], status: 'processing', paymentStatus: 'pending', billingStatus: 'unpaid', createShippingLabel: false });
      await Booking.updateOne({ _id: shipBooking._id }, {
        $set: { trackingNumber: '00340434161096009999', shippingLabelUrl: 'data:application/pdf;base64,JVBERi0xLjQ=', carrier: 'DHL', shippingStatus: 'label-created' },
        $push: { timeline: { status: 'Shipping Label Created', description: 'DHL-Versandlabel für die Buchung erstellt (Hinweg: Kunde an McRepair). Sendungsnummer: 00340434161096009999', completedAt: new Date() } },
      });
      // Abholbuchung: kein Label.
      const pickupOrder = await makeOrder();
      const pickupBooking = await BookingService.create({ customerId: customer._id, orderIds: [pickupOrder._id], status: 'pending', paymentStatus: 'pending', billingStatus: 'unpaid', createShippingLabel: false });
      await sleep(200);
      sentMails.length = 0;

      let res = await call('PUT', `/api/bookings/${pickupBooking._id}/status`, customer, { status: 'completed' });
      check(res.status === 403, 'Kundin darf den Buchungsstatus nicht setzen', res.status);

      res = await call('PUT', `/api/bookings/${pickupBooking._id}/status`, staff, { status: 'processing' });
      check(res.status === 200, 'Abholbuchung -> In Bearbeitung', `${res.status} ${show(res.body?.error)}`);
      const processingMail = await waitForMail(pickupBooking.bookingNumber, (item) => item.trigger === 'booking_status_updated');
      check(processingMail && processingMail.data.statusNote === 'Status geändert: Ausstehend → In Bearbeitung',
        'Statushinweis ohne rohe Enum-Werte', processingMail && processingMail.data.statusNote);
      check(processingMail && processingMail.data.bookingStatus === 'In Bearbeitung', 'Betreff-Status deutsch', processingMail && processingMail.data.bookingStatus);

      res = await call('PUT', `/api/bookings/${shipBooking._id}/status`, staff, { status: 'completed' });
      check(res.status === 200, 'Versandbuchung -> Abgeschlossen', `${res.status} ${show(res.body?.error)}`);
      const shipMail = await waitForMail(shipBooking.bookingNumber);
      check(shipMail && shipMail.trigger === 'booking_status_updated', 'Versandbuchung: KEINE Abholmail', shipMail && shipMail.trigger);
      check(shipMail && /Rückversand/.test(shipMail.data.statusNote) && !/Abholung/.test(shipMail.data.statusNote),
        'Versandbuchung: Hinweis auf den Rueckversand', shipMail && shipMail.data.statusNote);
      check(shipMail && shipMail.data.bookingStatus === 'Abgeschlossen', 'Status "Abgeschlossen" deutsch', shipMail && shipMail.data.bookingStatus);

      res = await call('PUT', `/api/bookings/${pickupBooking._id}/status`, staff, { status: 'completed' });
      check(res.status === 200, 'Abholbuchung -> Abgeschlossen', `${res.status} ${show(res.body?.error)}`);
      const pickupMail = await waitForMail(pickupBooking.bookingNumber, (item) => item.data?.bookingStatus === 'Abgeschlossen');
      check(pickupMail && pickupMail.trigger === 'booking_ready_for_pickup', 'reine Abholbuchung: Abholmail', pickupMail && pickupMail.trigger);
    });

    await section('[E] HIST-LABEL: Einsendelabel der Buchung im Auftragsverlauf (POST /api/bookings/:id/inbound-label)', async () => {
      const first = await makeOrder();
      const second = await makeOrder({ deviceModel: 'iPhone 13' });
      const booking = await BookingService.create({ customerId: customer._id, orderIds: [first._id, second._id], status: 'pending', paymentStatus: 'pending', billingStatus: 'unpaid', createShippingLabel: false });
      let res = await call('POST', `/api/bookings/${booking._id}/inbound-label`, stranger);
      check(res.status === 403, 'fremder Kunde: 403', res.status);
      res = await call('POST', `/api/bookings/${booking._id}/inbound-label`, customer);
      check(res.status === 200 && res.body?.created === true, 'Inhaberin erstellt das Testlabel', `${res.status} ${show(res.body?.error || res.body?.created)}`);
      res = await call('POST', `/api/bookings/${booking._id}/inbound-label`, customer);
      check(res.status === 200 && res.body?.alreadyExists === true, 'Wiederholung: kein zweites Label', `${res.status} ${show(res.body?.alreadyExists)}`);
      for (const order of [first, second]) {
        const view = await history(order._id, customer);
        const labelEntries = (view.body?.entries || []).filter((item) => item.title === 'DHL-Einsendelabel erstellt');
        check(view.status === 200 && labelEntries.length === 1, `${order.orderNumber}: Kundenverlauf zeigt "DHL-Einsendelabel erstellt" genau einmal`,
          (view.body?.entries || []).map((item) => item.title).join(' | '));
        check(labelEntries[0] && !('staffName' in labelEntries[0]) && !/0034|DUMMY|Dummy|Sendungsnummer/.test(show(labelEntries[0])),
          'Kundeneintrag ohne Akteur und interne Details', show(labelEntries[0]));
        const staffView = await history(order._id, staff);
        const staffEntries = (staffView.body?.entries || []).filter((item) => item.key === 'Booking Inbound Label Created');
        check(staffEntries.length === 1 && /Testlabel der Buchung/.test(staffEntries[0].description || ''), 'Teamverlauf: ein Eintrag mit Testlabel-Hinweis',
          staffEntries.map((item) => item.description).join(' | '));
        // Der Schluessel 'Inbound Label Created' beendet im Auftragsverlauf einen offenen Retoure-Abgleich
        // (DHLService.hasPendingInboundReconciliation) - das Buchungslabel darf ihn nicht verwenden.
        const storedOrder = await Order.findById(order._id).lean();
        check(!(storedOrder.timeline || []).some((item) => item.status === 'Inbound Label Created' || item.key === 'Inbound Label Created'),
          'Buchungslabel schreibt nicht den Retoure-Schluessel "Inbound Label Created" in den Auftragsverlauf',
          (storedOrder.timeline || []).map((item) => item.status || item.key).join(' | '));
      }
      const strangerView = await history(first._id, stranger);
      check(strangerView.status === 403, 'fremder Kunde liest den Verlauf nicht', strangerView.status);

      // Automatisches Label beim Anlegen der Buchung (Checkout-Pfad, createShippingLabel Standard).
      const autoOrder = await makeOrder();
      const autoBooking = await BookingService.create({ customerId: customer._id, orderIds: [autoOrder._id], status: 'pending', paymentStatus: 'pending', billingStatus: 'unpaid' });
      const autoStored = await Booking.findById(autoBooking._id).setOptions({ skipAutoPopulate: true }).lean();
      check(Boolean(autoStored.trackingNumber), 'Buchung mit automatischem Testlabel', autoStored.trackingNumber);
      const autoView = await history(autoOrder._id, customer);
      check((autoView.body?.entries || []).filter((item) => item.title === 'DHL-Einsendelabel erstellt').length === 1,
        'automatisches Label: Kundenverlauf zeigt den Eintrag genau einmal', (autoView.body?.entries || []).map((item) => item.title).join(' | '));
    });

    await section('[F] K09: Inspektion auf storniertem Auftrag gesperrt (Lesen erlaubt)', async () => {
      const offer = { cost: 79.9, costSpecified: true, timeframe: '2 Tage', description: 'Displaytausch' };
      const info = { shouldInform: true, reason: 'Zusatzdefekt', customerMessage: 'Wir haben einen weiteren Defekt gefunden.' };

      // 1) storniert, noch keine Inspektion
      const cancelledNew = await makeOrder({ status: 'cancelled' });
      let res = await call('POST', '/api/device-inspections/init', customer, { orderId: String(cancelledNew._id) });
      check(res.status === 403, 'Kundin: 403 (Rollenpruefung vor Statuspruefung)', res.status);
      res = await call('POST', '/api/device-inspections/init', staff, { orderId: String(cancelledNew._id) });
      check(res.status === 409 && res.body?.code === 'INSPECTION_ORDER_CANCELLED' && /^Der Auftrag ist storniert – /.test(res.body?.error || ''),
        'Start auf storniertem Auftrag: 409 deutsch', `${res.status} ${res.body?.error}`);
      check(!(await DeviceInspection.exists({ orderId: cancelledNew._id })), 'keine Inspektion angelegt', 'none');

      // 2) Inspektion laeuft, dann wird der Auftrag storniert
      const running = await makeOrder();
      res = await call('POST', '/api/device-inspections/init', staff, { orderId: String(running._id) });
      check(res.status === 200, 'Start auf offenem Auftrag: 200', `${res.status} ${show(res.body?.error)}`);
      await Order.updateOne({ _id: running._id }, { $set: { status: 'cancelled' } });
      const before = await DeviceInspection.findOne({ orderId: running._id }).lean();
      const notificationsBefore = notifications.length;
      const mailsBefore = sentMails.length;
      const writes = [
        ['PUT', 'model-verification', { reportedModel: 'Apple iPhone 14', actualModel: 'Apple iPhone 15', verificationStatus: 'incorrect', actualModelConfirmed: true }],
        ['PUT', 'identification', { deviceType: 'Smartphone', imei: '356938035643809' }],
        ['PUT', 'accessories', { simTray: true }],
        ['PUT', 'external-inspection', { overallCondition: 'good' }],
        ['PUT', 'device-tests', { testName: 'display', result: 'fail' }],
        ['PUT', 'apple-specific', { findMyStatus: 'off' }],
        ['PUT', 'complete', { repairOffer: offer, customerInformation: info }],
      ];
      for (const [method, step, body] of writes) {
        res = await call(method, `/api/device-inspections/${running._id}/${step}`, staff, body);
        check(res.status === 409 && res.body?.code === 'INSPECTION_ORDER_CANCELLED', `${step}: 409`, `${res.status} ${res.body?.error}`);
      }
      res = await call('POST', '/api/device-inspections/init', staff, { orderId: String(running._id) });
      check(res.status === 409, 'erneuter Start: 409', res.status);
      const afterInspection = await DeviceInspection.findOne({ orderId: running._id }).lean();
      check(JSON.stringify(afterInspection) === JSON.stringify(before), 'Inspektion unveraendert', `${before?.status} -> ${afterInspection?.status}`);
      check(notifications.length === notificationsBefore && sentMails.length === mailsBefore, 'keine Benachrichtigung, keine E-Mail',
        `${notifications.length - notificationsBefore} / ${sentMails.length - mailsBefore}`);
      res = await call('GET', `/api/device-inspections/${running._id}`, staff);
      check(res.status === 200 && res.body?.inspection, 'Lesen bleibt erlaubt (Team)', res.status);
      res = await call('GET', `/api/device-inspections/${running._id}/report`, staff);
      const afterReport = await DeviceInspection.findOne({ orderId: running._id }).lean();
      check(res.status === 409 && res.body?.code === 'INSPECTION_ORDER_CANCELLED' && !afterReport.reportGenerated,
        'Pruefbericht fuer laufende Inspektion eines stornierten Auftrags: 409, nichts geschrieben', `${res.status} ${res.body?.error}`);

      // 3) offener Auftrag: Abschluss mit Kundeninformation funktioniert weiter
      const open = await makeOrder();
      res = await call('POST', '/api/device-inspections/init', staff, { orderId: String(open._id) });
      check(res.status === 200, 'offener Auftrag: Start 200', res.status);
      const openNotificationsBefore = notifications.length;
      res = await call('PUT', `/api/device-inspections/${open._id}/complete`, staff, { repairOffer: offer, customerInformation: info });
      check(res.status === 200 && res.body?.inspection?.status === 'completed', 'offener Auftrag: Abschluss 200', `${res.status} ${show(res.body?.error || res.body?.inspection?.status)}`);
      check(notifications.slice(openNotificationsBefore).some((item) => item.title === 'Information zu einem Defekt an Ihrem Gerät'),
        'offener Auftrag: Kundeninformation wird gesendet', notifications.slice(openNotificationsBefore).map((item) => item.title).join(' | '));
    });
  } finally {
    server.close();
  }

  console.log(`\n==== ${pass} bestanden, ${fail} fehlgeschlagen ====`);
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error('ERROR:', error.message);
  console.error(error.stack);
  process.exit(2);
});
