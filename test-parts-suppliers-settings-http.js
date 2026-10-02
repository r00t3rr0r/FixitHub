/**
 * Regressionstest (01.10.2026) Ersatzteilbestellungen, Lieferanten, Einstellungen.
 *
 * Laeuft ueber die ECHTEN Express-Router mit echter JWT-Pruefung und echter Datenbank:
 *   /api/epart-orders, /api/need-lists, /api/system-config, /api/admin/analytics.
 *
 * Abgesichert (Befund-IDs aus parts-settings.md):
 *   SP-2  manuelle Bestellung mit Inventar-Teil (itemName) -> 201, partName gespeichert;
 *         leere Teil-ID / Menge 0 -> 400 deutsch, nichts gespeichert.
 *   SP-3  Sendungsnummer setzen / loeschen (""), Verlaufseintrag, Status "received"
 *         per PUT verboten, ungueltiger Zahlungsstatus -> 400 deutsch.
 *   SP-4  Wareneingang: Teil- und Restbuchung, Mehrbuchung blockiert (Lager unveraendert),
 *         parallele Doppelbuchung bucht nicht doppelt, Status-Regeln.
 *   SP-5  parallele Bestellungen -> eindeutige EPO-Nummern; Zaehler richtet sich nach
 *         Altbestand aus; parallele Bedarfslisten-Umwandlung -> genau 1 Bestellung + 409.
 *   SP-6  Lieferanten: E-Mail-Pruefung, Dublette 409, Deaktivieren/Wieder aktivieren,
 *         Inaktiv-Filter, Rollen (Kunde 403, Gast 401, Loeschen nur Admin).
 *   SP-7  Paging page/limit + pagination.total.
 *   SP-8  Statistik "Bestellwert gesamt" ohne Stornos.
 *   SET-1 PUT /api/system-config mischt abschnittsweise; Analyse-Einstellungen werden
 *         durch einen veralteten Gesamtstand nicht mehr zurueckgesetzt.
 *   SET-4 Steuersatz -5 / "abc" / Waehrung CHF -> 400 deutsch, gespeicherter Wert bleibt.
 *
 * Keine E-Mails, keine externen Hosts (Benachrichtigungen gemockt).
 *
 * Aufruf (nur Wegwerf-Datenbank):
 *   TEST_MONGODB_URI=mongodb://127.0.0.1:27099/t_parts_http node test-parts-suppliers-settings-http.js
 */
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const SERVER_DIR = path.join(__dirname, 'server');
const mongoose = require(path.join(SERVER_DIR, 'node_modules/mongoose'));
const express = require(path.join(SERVER_DIR, 'node_modules/express'));
const jwt = require(path.join(SERVER_DIR, 'node_modules/jsonwebtoken'));

const URI = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27099/t_parts_suppliers_settings';

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
const looksGerman = (text) => /[äöüß]|Bitte|muss|nicht|bereits|Position|Lieferant|Steuersatz|Standardwährung|Wareneingang|Bestellung|offen/i.test(String(text || ''))
  && !/validation failed|Cast to|Path `/i.test(String(text || ''));

async function main() {
  if (isUnsafeTestUri(URI)) {
    throw new Error('Dieser Test darf nicht gegen die Entwicklungsdatenbank laufen.');
  }

  process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');

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

  // MOCKS: keine echten Benachrichtigungen / E-Mails.
  const NotificationService = require(path.join(SERVER_DIR, 'services/notificationService'));
  NotificationService.createNotification = async (data) => ({ _id: new mongoose.Types.ObjectId(), ...data });

  const epartOrderRoutes = require(path.join(SERVER_DIR, 'routes/epartOrderRoutes'));
  const needListRoutes = require(path.join(SERVER_DIR, 'routes/needListRoutes'));
  const systemConfigRoutes = require(path.join(SERVER_DIR, 'routes/systemConfigRoutes'));
  const adminAnalyticsRoutes = require(path.join(SERVER_DIR, 'routes/adminAnalyticsRoutes'));

  const app = express();
  app.use(express.json({ limit: '10mb' })); // wie server.js (requestLimit)
  app.use('/api/epart-orders', epartOrderRoutes);
  app.use('/api/need-lists', needListRoutes);
  app.use('/api/system-config', systemConfigRoutes);
  app.use('/api/admin/analytics', adminAnalyticsRoutes);
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const User = mongoose.model('User');
  const Inventory = mongoose.model('Inventory');
  const NeedList = mongoose.model('NeedList');
  const { Supplier, EPartOrder } = require(path.join(SERVER_DIR, 'models/EPartOrder'));
  const db = mongoose.connection.db;

  const admin = await User.create({ name: 'Admin Parts', email: 'parts-admin@test.invalid', role: 'admin' });
  const staff = await User.create({ name: 'Staff Parts', email: 'parts-staff@test.invalid', role: 'staff' });
  const customer = await User.create({ name: 'Kunde Parts', email: 'parts-customer@test.invalid', role: 'customer' });
  const tokenFor = (user) => jwt.sign({ sub: String(user._id) }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '10m' });

  const call = async (method, url, user, body) => {
    const headers = { 'Content-Type': 'application/json' };
    if (user) headers.Authorization = `Bearer ${tokenFor(user)}`;
    const response = await fetch(`${baseUrl}${url}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    let json = null;
    try {
      json = await response.json();
    } catch (error) {
      json = null;
    }
    return { status: response.status, body: json };
  };

  const stockOf = async (partId) => {
    const doc = await db.collection('inventories').findOne({ _id: new mongoose.Types.ObjectId(String(partId)) });
    return (doc?.versions || []).reduce((sum, v) => sum + Number(v.quantity || 0), 0);
  };

  try {
    // ------------------------------------------------------------------ Lieferanten
    console.log('\n[1] SP-6 Lieferanten: Rollen, Validierung, Dubletten, Deaktivieren/Reaktivieren');
    const guestList = await call('GET', '/api/epart-orders/suppliers', null);
    check(guestList.status === 401, 'Gast ohne Token -> 401', guestList.status);
    const customerList = await call('GET', '/api/epart-orders/suppliers', customer);
    check(customerList.status === 403, 'Kunde -> 403', customerList.status);
    const customerCreate = await call('POST', '/api/epart-orders/suppliers', customer, { name: 'X', email: 'x@y.invalid' });
    check(customerCreate.status === 403, 'Kunde darf keinen Lieferanten anlegen', customerCreate.status);

    const badEmail = await call('POST', '/api/epart-orders/suppliers', staff, { name: 'Teile GmbH', email: 'keine-mail' });
    check(badEmail.status === 400 && looksGerman(badEmail.body?.error), 'ungueltige E-Mail -> 400 deutsch', `${badEmail.status} ${badEmail.body?.error}`);
    const noName = await call('POST', '/api/epart-orders/suppliers', staff, { name: '   ', email: 'a@b.invalid' });
    check(noName.status === 400 && looksGerman(noName.body?.error), 'leerer Name -> 400 deutsch', `${noName.status} ${noName.body?.error}`);
    check(await Supplier.countDocuments() === 0, 'nach Fehlern kein Lieferant gespeichert', await Supplier.countDocuments());

    const created = await call('POST', '/api/epart-orders/suppliers', staff, {
      name: '  Teile GmbH ', email: ' Bestellung@Teile.INVALID ', leadTime: '5',
      _id: '000000000000000000000001', createdAt: '2000-01-01', paymentInformation: { iban: 'de12 3456' }
    });
    check(created.status === 201, 'gueltiger Lieferant -> 201', created.status);
    const supplierId = created.body?.supplier?._id;
    const storedSupplier = await db.collection('suppliers').findOne({ _id: new mongoose.Types.ObjectId(String(supplierId)) });
    check(storedSupplier?.name === 'Teile GmbH' && storedSupplier?.email === 'bestellung@teile.invalid', 'DB: Name getrimmt, E-Mail klein', `${storedSupplier?.name} / ${storedSupplier?.email}`);
    check(String(storedSupplier?._id) !== '000000000000000000000001', 'Client-_id wird ignoriert', String(storedSupplier?._id));
    check(storedSupplier?.leadTime === 5 && storedSupplier?.paymentInformation?.iban === 'DE123456', 'Lieferzeit Zahl, IBAN normalisiert', `${storedSupplier?.leadTime} ${storedSupplier?.paymentInformation?.iban}`);

    const duplicate = await call('POST', '/api/epart-orders/suppliers', staff, { name: 'TEILE gmbh', email: 'bestellung@teile.invalid' });
    check(duplicate.status === 409 && looksGerman(duplicate.body?.error), 'Dublette (Name+E-Mail) -> 409 deutsch', `${duplicate.status} ${duplicate.body?.error}`);
    check(await Supplier.countDocuments() === 1, 'Dublette nicht gespeichert', await Supplier.countDocuments());
    const sameNameOtherMail = await call('POST', '/api/epart-orders/suppliers', staff, { name: 'Teile GmbH', email: 'zweig@teile.invalid' });
    check(sameNameOtherMail.status === 201, 'gleicher Name, andere E-Mail erlaubt', sameNameOtherMail.status);

    const badLead = await call('PUT', `/api/epart-orders/suppliers/${supplierId}`, staff, { leadTime: -3 });
    check(badLead.status === 400 && looksGerman(badLead.body?.error), 'Lieferzeit -3 -> 400 deutsch', `${badLead.status} ${badLead.body?.error}`);

    const deactivate = await call('PUT', `/api/epart-orders/suppliers/${supplierId}`, staff, { ...created.body.supplier, isActive: false });
    check(deactivate.status === 200 && deactivate.body?.supplier?.isActive === false, 'Deaktivieren mit vollem Objekt (inkl. _id/__v) -> 200', deactivate.status);
    const activeList = await call('GET', '/api/epart-orders/suppliers?isActive=true', staff);
    check(!activeList.body.suppliers.some((s) => s._id === supplierId), 'aktive Liste ohne deaktivierten Lieferanten', activeList.body.suppliers.length);
    const inactiveList = await call('GET', '/api/epart-orders/suppliers?isActive=false', staff);
    check(inactiveList.body.suppliers.some((s) => s._id === supplierId), 'Inaktiv-Filter zeigt deaktivierten Lieferanten', inactiveList.body.suppliers.length);
    const allList = await call('GET', '/api/epart-orders/suppliers', staff);
    check(allList.body.suppliers.length === 2, '"Alle" zeigt aktive und inaktive', allList.body.suppliers.length);

    // Waehrend inaktiv: neuer aktiver Lieferant mit gleichen Daten -> erlaubt; Reaktivierung -> 409.
    const replacement = await call('POST', '/api/epart-orders/suppliers', staff, { name: 'Teile GmbH', email: 'bestellung@teile.invalid' });
    check(replacement.status === 201, 'gleiche Daten erlaubt, solange Original inaktiv', replacement.status);
    const reactivateConflict = await call('PUT', `/api/epart-orders/suppliers/${supplierId}`, staff, { isActive: true });
    check(reactivateConflict.status === 409, 'Reaktivierung trotz aktiver Dublette -> 409', reactivateConflict.status);
    const staffDelete = await call('DELETE', `/api/epart-orders/suppliers/${replacement.body.supplier._id}`, staff);
    check(staffDelete.status === 403, 'Deaktivieren per DELETE nur Admin (Staff 403)', staffDelete.status);
    const adminDelete = await call('DELETE', `/api/epart-orders/suppliers/${replacement.body.supplier._id}`, admin);
    check(adminDelete.status === 200, 'Admin DELETE -> 200 (deaktiviert)', adminDelete.status);
    const reactivate = await call('PUT', `/api/epart-orders/suppliers/${supplierId}`, staff, { isActive: true });
    check(reactivate.status === 200 && reactivate.body?.supplier?.isActive === true, '"Wieder aktivieren" -> 200', reactivate.status);
    const activeAgain = await call('GET', '/api/epart-orders/suppliers?isActive=true', staff);
    check(activeAgain.body.suppliers.some((s) => s._id === supplierId), 'reaktivierter Lieferant wieder in aktiver Liste', activeAgain.body.suppliers.length);
    const badId = await call('GET', '/api/epart-orders/suppliers/not-an-id', staff);
    check(badId.status === 400 && looksGerman(badId.body?.error), 'ungueltige ID -> 400 deutsch (kein CastError)', `${badId.status} ${badId.body?.error}`);

    // ------------------------------------------------------------------ Bestellung anlegen
    console.log('\n[2] SP-2 / SP-5 manuelle Bestellung, Nummernkreis');
    const makePart = (name, sku, qty) => Inventory.create({
      itemName: name,
      category: 'Display',
      manufacturer: 'Apple',
      model: 'iPhone 13',
      sku,
      versions: [{
        versionType: 'original', versionId: `${sku}-V1`, quantity: qty, minStockLevel: 0, reorderLevel: 0,
        unitCost: 50, sellingPrice: 90, storageLocation: 'A1'
      }]
    });
    const partA = await makePart('Display iPhone 13', 'DSP-13', 1);
    const partB = await makePart('Akku iPhone 13', 'AKU-13', 0);

    // Altbestand mit hoher Nummer (direkt in die Collection, wie vor der Umstellung).
    await db.collection('epartorders').insertOne({
      orderNumber: 'EPO-000050', supplierId: new mongoose.Types.ObjectId(String(supplierId)), items: [],
      status: 'received', subtotal: 0, tax: 0, shippingCost: 0, totalCost: 0, createdBy: admin._id,
      orderDate: new Date('2026-01-01'), timeline: []
    });

    const customerOrder = await call('POST', '/api/epart-orders', customer, { supplierId, items: [{ partId: String(partA._id), quantity: 1 }] });
    check(customerOrder.status === 403, 'Kunde darf keine Ersatzteilbestellung anlegen', customerOrder.status);

    const countBefore = await EPartOrder.countDocuments();
    const emptyPart = await call('POST', '/api/epart-orders', staff, { supplierId, items: [{ partId: '', quantity: 1, unitPrice: 1 }] });
    check(emptyPart.status === 400 && /Position 1/.test(emptyPart.body?.error || '') && looksGerman(emptyPart.body?.error), 'leere Teil-ID -> 400 "Position 1: ..."', `${emptyPart.status} ${emptyPart.body?.error}`);
    const zeroQty = await call('POST', '/api/epart-orders', staff, { supplierId, items: [{ partId: String(partA._id), quantity: 0 }] });
    check(zeroQty.status === 400 && looksGerman(zeroQty.body?.error), 'Menge 0 -> 400 deutsch', `${zeroQty.status} ${zeroQty.body?.error}`);
    const negPrice = await call('POST', '/api/epart-orders', staff, { supplierId, items: [{ partId: String(partA._id), quantity: 1, unitPrice: -1 }] });
    check(negPrice.status === 400, 'negativer Einzelpreis -> 400', negPrice.status);
    const noSupplier = await call('POST', '/api/epart-orders', staff, { items: [{ partId: String(partA._id), quantity: 1 }] });
    check(noSupplier.status === 400 && looksGerman(noSupplier.body?.error), 'ohne Lieferant -> 400 deutsch', `${noSupplier.status} ${noSupplier.body?.error}`);
    const inactiveSupplierOrder = await call('POST', '/api/epart-orders', staff, { supplierId: replacement.body.supplier._id, items: [{ partId: String(partA._id), quantity: 1 }] });
    check(inactiveSupplierOrder.status === 400, 'inaktiver Lieferant -> 400', `${inactiveSupplierOrder.status} ${inactiveSupplierOrder.body?.error}`);
    check(await EPartOrder.countDocuments() === countBefore, 'nach Validierungsfehlern keine Bestellung gespeichert', await EPartOrder.countDocuments());

    const createdOrder = await call('POST', '/api/epart-orders', staff, {
      supplierId,
      items: [{ partId: String(partA._id), quantity: 2, unitPrice: 12.5 }, { partId: String(partB._id), quantity: 3, unitPrice: 8 }],
      tax: 0, shippingCost: 4.9, status: 'confirmed'
    });
    check(createdOrder.status === 201, 'Bestellung mit Inventar-Teil -> 201 (vorher immer 400 partName)', `${createdOrder.status} ${createdOrder.body?.error || ''}`);
    const order = createdOrder.body?.order;
    check(order?.items?.[0]?.partName === 'Display iPhone 13' && order?.items?.[0]?.sku === 'DSP-13', 'partName = itemName, SKU uebernommen', `${order?.items?.[0]?.partName} / ${order?.items?.[0]?.sku}`);
    check(order?.orderNumber === 'EPO-000051', 'erste neue Nummer folgt dem Altbestand (EPO-000051)', order?.orderNumber);
    const reread = await call('GET', `/api/epart-orders/${order._id}`, staff);
    check(reread.body?.order?.items?.[0]?.partName === 'Display iPhone 13', 'GET /:id liefert denselben partName', reread.body?.order?.items?.[0]?.partName);
    const storedOrder = await db.collection('epartorders').findOne({ _id: new mongoose.Types.ObjectId(order._id) });
    check(Math.abs(storedOrder.totalCost - (25 + 24 + 4.9)) < 0.0001, 'DB: Gesamt = Positionen + Versand', storedOrder.totalCost);

    const parallel = await Promise.all(Array.from({ length: 5 }, () => call('POST', '/api/epart-orders', staff, {
      supplierId, items: [{ partId: String(partB._id), quantity: 1, unitPrice: 1 }]
    })));
    const numbers = parallel.map((r) => r.body?.order?.orderNumber);
    check(parallel.every((r) => r.status === 201), '5 parallele Bestellungen -> alle 201 (kein E11000)', parallel.map((r) => r.status).join(','));
    check(new Set(numbers).size === 5 && numbers.every((n) => /^EPO-\d{6}$/.test(n || '')), '5 eindeutige Nummern im Format EPO-NNNNNN', numbers.join(','));
    const counter = await db.collection('documentsequences').findOne({ documentType: 'epart_order', year: 0 });
    check(counter?.sequence === 56, 'DocumentSequence epart_order steht auf 56', counter?.sequence);

    // ------------------------------------------------------------------ Lieferung & Zahlung
    console.log('\n[3] SP-3 Sendungsnummer, Status-Regeln, Zahlungsstatus');
    const setTracking = await call('PUT', `/api/epart-orders/${order._id}`, staff, { trackingNumber: '  JJD001  ' });
    check(setTracking.status === 200 && setTracking.body?.order?.trackingNumber === 'JJD001', 'Sendungsnummer setzen (getrimmt)', setTracking.body?.order?.trackingNumber);
    const changeTracking = await call('PUT', `/api/epart-orders/${order._id}`, staff, { trackingNumber: 'JJD002' });
    check(changeTracking.body?.order?.timeline?.some((t) => /Sendungsnummer geändert: JJD001 → JJD002/.test(t.description)), 'Verlauf: "Sendungsnummer geändert: alt → neu"', changeTracking.body?.order?.timeline?.length);
    const clearTracking = await call('PUT', `/api/epart-orders/${order._id}`, staff, { trackingNumber: '' });
    const afterClear = await db.collection('epartorders').findOne({ _id: new mongoose.Types.ObjectId(order._id) });
    check(clearTracking.status === 200 && !afterClear.trackingNumber, 'leere Sendungsnummer loescht das Feld (vorher blieb alter Wert)', String(afterClear.trackingNumber));
    const longTracking = await call('PUT', `/api/epart-orders/${order._id}`, staff, { trackingNumber: 'X'.repeat(65) });
    check(longTracking.status === 400, 'Sendungsnummer > 64 Zeichen -> 400', longTracking.status);
    const setDate = await call('PUT', `/api/epart-orders/${order._id}`, staff, { expectedDeliveryDate: '2026-10-15' });
    check(setDate.status === 200 && String(setDate.body?.order?.expectedDeliveryDate || '').startsWith('2026-10-15'), 'Lieferdatum setzen', setDate.body?.order?.expectedDeliveryDate);
    const clearDate = await call('PUT', `/api/epart-orders/${order._id}`, staff, { expectedDeliveryDate: '' });
    check(clearDate.status === 200 && !clearDate.body?.order?.expectedDeliveryDate, 'Lieferdatum leeren', clearDate.body?.order?.expectedDeliveryDate);

    const stockBeforeStatus = await stockOf(partA._id);
    const forceReceived = await call('PUT', `/api/epart-orders/${order._id}`, staff, { status: 'received' });
    check(forceReceived.status === 400 && looksGerman(forceReceived.body?.error), 'Status "received" per PUT -> 400 deutsch', `${forceReceived.status} ${forceReceived.body?.error}`);
    check(await stockOf(partA._id) === stockBeforeStatus, 'Lager unveraendert nach verbotenem Statuswechsel', await stockOf(partA._id));
    const bogusStatus = await call('PUT', `/api/epart-orders/${order._id}`, staff, { status: 'bogus' });
    check(bogusStatus.status === 400 && looksGerman(bogusStatus.body?.error), 'unbekannter Status -> 400 deutsch', bogusStatus.body?.error);
    const shipped = await call('PUT', `/api/epart-orders/${order._id}`, staff, { status: 'shipped' });
    check(shipped.status === 200 && shipped.body?.order?.status === 'shipped', 'Status Bestellt -> Versendet', shipped.body?.order?.status);
    check(shipped.body?.order?.timeline?.some((t) => /Bestellt → Versendet/.test(t.description)), 'Verlauf deutsch "Bestellt → Versendet"', '');
    const bogusPayment = await call('PUT', `/api/epart-orders/${order._id}`, staff, { paymentStatus: 'bogus' });
    check(bogusPayment.status === 400 && looksGerman(bogusPayment.body?.error), 'ungueltiger Zahlungsstatus -> 400 deutsch', bogusPayment.body?.error);
    const paid = await call('PUT', `/api/epart-orders/${order._id}`, staff, { paymentStatus: 'paid' });
    check(paid.status === 200 && paid.body?.order?.paymentStatus === 'paid', 'Zahlungsstatus Bezahlt', paid.body?.order?.paymentStatus);
    const customerPut = await call('PUT', `/api/epart-orders/${order._id}`, customer, { trackingNumber: 'HACK' });
    check(customerPut.status === 403, 'Kunde darf Bestellung nicht aendern', customerPut.status);

    // ------------------------------------------------------------------ Wareneingang
    console.log('\n[4] SP-4 Wareneingang');
    const itemA = shipped.body.order.items.find((i) => i.partName === 'Display iPhone 13');
    const itemB = shipped.body.order.items.find((i) => i.partName === 'Akku iPhone 13');
    const stockA0 = await stockOf(partA._id);
    const stockB0 = await stockOf(partB._id);
    const zeroReceive = await call('POST', `/api/epart-orders/${order._id}/receive`, staff, { items: [{ itemId: itemA._id, quantity: 0 }] });
    check(zeroReceive.status === 400 && looksGerman(zeroReceive.body?.error), 'nur Nullmengen -> 400 deutsch', zeroReceive.body?.error);
    const partial = await call('POST', `/api/epart-orders/${order._id}/receive`, staff, { items: [{ itemId: itemA._id, quantity: 1 }, { itemId: itemB._id, quantity: 0 }] });
    check(partial.status === 200 && partial.body?.order?.status === 'partial', 'Teilbuchung -> "partial"', `${partial.status} ${partial.body?.order?.status}`);
    check(!partial.body?.order?.timeline?.some((t) => /\b0 ×/.test(t.description)), 'keine "0 Stück"-Verlaufseintraege', '');
    const over = await call('POST', `/api/epart-orders/${order._id}/receive`, staff, { items: [{ itemId: itemA._id, quantity: 5 }] });
    check(over.status === 400 && /nur noch 1 Stück offen/.test(over.body?.error || ''), 'Mehrbuchung -> 400 "nur noch 1 Stück offen"', `${over.status} ${over.body?.error}`);
    check(await stockOf(partA._id) === stockA0 + 1, 'Lager nach Mehrbuchungsversuch unveraendert (+1 aus Teilbuchung)', await stockOf(partA._id));

    // Parallele identische Restbuchung: genau eine darf greifen.
    const rest = { items: [{ itemId: itemA._id, quantity: 1 }, { itemId: itemB._id, quantity: 3 }] };
    const [r1, r2] = await Promise.all([
      call('POST', `/api/epart-orders/${order._id}/receive`, staff, rest),
      call('POST', `/api/epart-orders/${order._id}/receive`, staff, rest),
    ]);
    const okCount = [r1, r2].filter((r) => r.status === 200).length;
    check(okCount === 1 && [r1, r2].some((r) => [400, 409].includes(r.status)), 'parallele Doppelbuchung: genau eine 200, die andere 409/400', `${r1.status},${r2.status}`);
    const finalOrder = await db.collection('epartorders').findOne({ _id: new mongoose.Types.ObjectId(order._id) });
    check(finalOrder.status === 'received', 'Bestellung danach "received"', finalOrder.status);
    check(finalOrder.items.every((i) => i.receivedQuantity === i.quantity), 'erhaltene Menge = bestellte Menge (keine Mehrbuchung)', finalOrder.items.map((i) => `${i.receivedQuantity}/${i.quantity}`).join(','));
    check(await stockOf(partA._id) === stockA0 + 2 && await stockOf(partB._id) === stockB0 + 3, 'Lagerzugang exakt = bestellte Menge (2 und 3)', `${await stockOf(partA._id)} ${await stockOf(partB._id)}`);

    const draftOrder = parallel[0].body.order;
    const receiveDraft = await call('POST', `/api/epart-orders/${draftOrder._id}/receive`, staff, { items: [{ itemId: draftOrder.items[0]._id, quantity: 1 }] });
    check(receiveDraft.status === 400 && looksGerman(receiveDraft.body?.error), 'Wareneingang fuer Entwurf -> 400 deutsch', receiveDraft.body?.error);
    const statusOnReceived = await call('PUT', `/api/epart-orders/${order._id}`, staff, { status: 'pending' });
    check(statusOnReceived.status === 400, 'Status einer erhaltenen Bestellung nicht mehr aenderbar', statusOnReceived.status);
    const paymentOnReceived = await call('PUT', `/api/epart-orders/${order._id}`, staff, { paymentStatus: 'partial' });
    check(paymentOnReceived.status === 200, 'Zahlungsstatus bleibt auch nach Erhalt aenderbar', paymentOnReceived.status);

    // ------------------------------------------------------------------ Review-Befunde (01.10.)
    console.log('\n[4b] SP-4 Review: parallele Buchung verschiedener Positionen, Altdaten-Lager, Kompensation, deutsche Texte');
    const EPartOrderService = require(path.join(SERVER_DIR, 'services/epartOrderService'));
    const originalAutoAssign = EPartOrderService.autoAssignConvertedNeedListOrderItems;
    let autoAssignCalls = 0;
    EPartOrderService.autoAssignConvertedNeedListOrderItems = async function countingAutoAssign(...args) {
      autoAssignCalls += 1;
      return originalAutoAssign.apply(this, args);
    };
    const partC = await makePart('Kamera iPhone 13', 'KAM-13', 0);
    const partD = await makePart('Lautsprecher iPhone 13', 'LSP-13', 0);
    const RACE_RUNS = 6;
    let stuck = 0;
    let raceBad = 0;
    autoAssignCalls = 0;
    for (let run = 0; run < RACE_RUNS; run += 1) {
      const raceOrder = await call('POST', '/api/epart-orders', staff, {
        supplierId, status: 'confirmed',
        items: [{ partId: String(partC._id), quantity: 1, unitPrice: 1 }, { partId: String(partD._id), quantity: 1, unitPrice: 1 }]
      });
      const ro = raceOrder.body.order;
      const [ra, rb] = await Promise.all([
        call('POST', `/api/epart-orders/${ro._id}/receive`, staff, { items: [{ itemId: ro.items[0]._id, quantity: 1 }] }),
        call('POST', `/api/epart-orders/${ro._id}/receive`, staff, { items: [{ itemId: ro.items[1]._id, quantity: 1 }] }),
      ]);
      if (ra.status !== 200 || rb.status !== 200) raceBad += 1;
      const stored = await db.collection('epartorders').findOne({ _id: new mongoose.Types.ObjectId(ro._id) });
      const allIn = stored.items.every((i) => i.receivedQuantity === i.quantity && i.status === 'received');
      if (!(allIn && stored.status === 'received' && stored.actualDeliveryDate)) stuck += 1;
    }
    check(raceBad === 0, `parallele Buchung verschiedener Positionen: beide 200 (${RACE_RUNS} Laeufe)`, raceBad);
    check(stuck === 0, 'keine Bestellung bleibt auf "partial" haengen, alle Positionen "received"', stuck);
    check(autoAssignCalls === RACE_RUNS, 'Bedarfslisten-Zuweisung genau einmal je Bestellung', `${autoAssignCalls}/${RACE_RUNS}`);
    check(await stockOf(partC._id) === RACE_RUNS && await stockOf(partD._id) === RACE_RUNS, 'Lagerzugang exakt je Position', `${await stockOf(partC._id)} ${await stockOf(partD._id)}`);
    EPartOrderService.autoAssignConvertedNeedListOrderItems = originalAutoAssign;

    // Altdaten: Lagerteil ohne Pflichtfeld (versions.0.versionId fehlt) -> Buchung darf nicht scheitern.
    const legacyPartId = new mongoose.Types.ObjectId();
    await db.collection('inventories').insertOne({
      _id: legacyPartId, itemName: 'Display X Altbestand', category: 'Display', sku: 'LEG-0001',
      versions: [{ _id: new mongoose.Types.ObjectId(), versionType: 'original', quantity: 1, minStockLevel: 0, reorderLevel: 0 }]
    });
    const legacyOrderRes = await call('POST', '/api/epart-orders', staff, {
      supplierId, status: 'confirmed', items: [{ partId: String(legacyPartId), quantity: 2, unitPrice: 3 }]
    });
    check(legacyOrderRes.status === 201, 'Bestellung fuer Altdaten-Lagerteil -> 201', `${legacyOrderRes.status} ${legacyOrderRes.body?.error || ''}`);
    const lo = legacyOrderRes.body.order;
    const legacyReceive = await call('POST', `/api/epart-orders/${lo._id}/receive`, staff, { items: [{ itemId: lo.items[0]._id, quantity: 2 }] });
    const legacyStored = await db.collection('epartorders').findOne({ _id: new mongoose.Types.ObjectId(lo._id) });
    check(legacyReceive.status === 200 && legacyStored.status === 'received', 'Wareneingang mit Altdaten-Lagerteil -> 200, "received"', `${legacyReceive.status} ${legacyStored.status} ${legacyReceive.body?.error || ''}`);
    check(await stockOf(legacyPartId) === 3, 'Altdaten-Lager atomar erhoeht (1 + 2)', await stockOf(legacyPartId));
    check(legacyStored.timeline.filter((t) => t.status === 'items_received').length === 1, 'genau ein Verlaufseintrag "Wareneingang gebucht"', legacyStored.timeline.length);
    const legacyInv = await db.collection('inventories').findOne({ _id: legacyPartId });
    check(!('versionId' in legacyInv.versions[0]), 'Altdaten nicht stillschweigend umgeschrieben (versionId weiterhin fehlend)', JSON.stringify(Object.keys(legacyInv.versions[0])));

    // Kompensation: Lagerbuchung scheitert nach dem Claim -> Bestellung unveraendert, Retry moeglich.
    const compOrderRes = await call('POST', '/api/epart-orders', staff, {
      supplierId, status: 'confirmed',
      items: [{ partId: String(partC._id), quantity: 2, unitPrice: 1 }, { partId: String(partD._id), quantity: 1, unitPrice: 1 }]
    });
    const co = compOrderRes.body.order;
    const stockC1 = await stockOf(partC._id);
    const stockD1 = await stockOf(partD._id);
    const originalFindOneAndUpdate = Inventory.findOneAndUpdate;
    Inventory.findOneAndUpdate = function failingForD(filter, ...rest) {
      if (filter && String(filter._id) === String(partD._id)) {
        return { select() { return this; }, lean() { return Promise.reject(new Error('Simulierter Lagerfehler')); } };
      }
      return originalFindOneAndUpdate.call(this, filter, ...rest);
    };
    let compFail;
    try {
      compFail = await call('POST', `/api/epart-orders/${co._id}/receive`, staff, {
        items: [{ itemId: co.items[0]._id, quantity: 2 }, { itemId: co.items[1]._id, quantity: 1 }]
      });
    } finally {
      Inventory.findOneAndUpdate = originalFindOneAndUpdate;
    }
    const compStored = await db.collection('epartorders').findOne({ _id: new mongoose.Types.ObjectId(co._id) });
    check(compFail.status === 409 && looksGerman(compFail.body?.error), 'Lagerfehler nach Claim -> 409 deutsch', `${compFail.status} ${compFail.body?.error}`);
    check(compStored.items.every((i) => (i.receivedQuantity || 0) === 0) && compStored.status === 'confirmed', 'Claim zurueckgenommen: receivedQuantity 0, Status "confirmed"', `${compStored.items.map((i) => i.receivedQuantity).join(',')} ${compStored.status}`);
    check(!compStored.timeline.some((t) => t.status === 'items_received'), 'kein Verlaufseintrag fuer die gescheiterte Buchung', compStored.timeline.length);
    check(await stockOf(partC._id) === stockC1 && await stockOf(partD._id) === stockD1, 'Lager unveraendert (bereits gebuchte Position zurueckgebucht)', `${await stockOf(partC._id)} ${await stockOf(partD._id)}`);
    const compRetry = await call('POST', `/api/epart-orders/${co._id}/receive`, staff, {
      items: [{ itemId: co.items[0]._id, quantity: 2 }, { itemId: co.items[1]._id, quantity: 1 }]
    });
    check(compRetry.status === 200 && compRetry.body?.order?.status === 'received', 'Retry nach Fehler -> 200 "received"', `${compRetry.status} ${compRetry.body?.order?.status}`);
    check(await stockOf(partC._id) === stockC1 + 2 && await stockOf(partD._id) === stockD1 + 1, 'Retry bucht Lager genau einmal', `${await stockOf(partC._id)} ${await stockOf(partD._id)}`);

    // Statuswechsel mit veraltetem Stand ueberschreibt "received" nicht.
    const staleOrder = await EPartOrder.findById(co._id);
    staleOrder.status = 'shipped'; // simuliert gelesenen Altstand
    staleOrder.$where = { status: 'confirmed' };
    let staleError = null;
    try { await EPartOrderService.saveGuarded(staleOrder); } catch (error) { staleError = error; }
    check(staleError && staleError.status === 409 && looksGerman(staleError.message), 'veralteter Statuswechsel -> 409 deutsch', staleError && `${staleError.status} ${staleError.message}`);
    check((await db.collection('epartorders').findOne({ _id: new mongoose.Types.ObjectId(co._id) })).status === 'received', '"received" bleibt erhalten', '');

    // SP-10: deutsche Texte fuer Ruecksendung/Umtausch und Upload-Fehler.
    const returnReq = await call('POST', `/api/epart-orders/${co._id}/return-exchange`, staff, {
      type: 'return', reason: 'Defekt', description: 'Display flackert', affectedItems: [{ itemId: co.items[0]._id, quantity: 1 }]
    });
    check(returnReq.status === 200 && returnReq.body?.order?.timeline?.some((t) => /^Rücksendung angefordert: Defekt$/.test(t.description)), 'Verlauf "Rücksendung angefordert: …"', `${returnReq.status} ${returnReq.body?.error || ''}`);
    const badReturnStatus = await call('PUT', `/api/epart-orders/${co._id}/return-exchange`, staff, { status: 'bogus' });
    check(badReturnStatus.status === 400 && looksGerman(badReturnStatus.body?.error) && !/Invalid/.test(badReturnStatus.body?.error), 'ungueltiger Ruecksendestatus -> 400 deutsch', badReturnStatus.body?.error);
    const approveReturn = await call('PUT', `/api/epart-orders/${co._id}/return-exchange`, staff, { status: 'approved' });
    check(approveReturn.status === 200 && approveReturn.body?.order?.timeline?.some((t) => t.description === 'Rücksendung/Umtausch: genehmigt'), 'Verlauf "Rücksendung/Umtausch: genehmigt"', approveReturn.status);
    const form = new FormData();
    form.append('invoice', new Blob(['MZ'], { type: 'application/x-msdownload' }), 'virus.exe');
    const badUpload = await fetch(`${baseUrl}/api/epart-orders/${co._id}/invoice`, { method: 'POST', headers: { Authorization: `Bearer ${tokenFor(staff)}` }, body: form });
    const badUploadJson = await badUpload.json().catch(() => null);
    check(badUpload.status === 400 && /Dateien .* sind erlaubt/.test(badUploadJson?.error || '') && !/Only/.test(badUploadJson?.error || ''), 'falscher Dateityp -> 400 JSON deutsch (statt HTML-500)', `${badUpload.status} ${badUploadJson?.error}`);

    // ------------------------------------------------------------------ Paging + Statistik
    console.log('\n[5] SP-7 Paging, SP-8 Statistik ohne Stornos, Suche mit Sonderzeichen');
    for (let i = 0; i < 24; i += 1) {
      await call('POST', '/api/epart-orders', staff, { supplierId, items: [{ partId: String(partB._id), quantity: 1, unitPrice: 2 }] });
    }
    const total = await EPartOrder.countDocuments();
    const page2 = await call('GET', '/api/epart-orders?page=2&limit=25', staff);
    check(page2.status === 200 && page2.body.pagination.total === total && page2.body.orders.length === total - 25, `Seite 2 enthaelt ${total - 25} von ${total}`, `${page2.body.orders.length} / ${page2.body.pagination.total} / pages ${page2.body.pagination.pages}`);
    const hugeLimit = await call('GET', '/api/epart-orders?limit=100000', staff);
    check(hugeLimit.body.pagination.limit === 100, 'limit wird auf 100 begrenzt', hugeLimit.body.pagination.limit);
    const weirdSearch = await call('GET', `/api/epart-orders?search=${encodeURIComponent('(EPO')}`, staff);
    check(weirdSearch.status === 200, 'Suche mit "(" -> 200 statt 500', weirdSearch.status);

    const toCancel = parallel[1].body.order;
    const cancel = await call('POST', `/api/epart-orders/${toCancel._id}/cancel`, staff, { reason: 'Test' });
    check(cancel.status === 200 && cancel.body?.order?.status === 'cancelled', 'Stornieren -> 200', cancel.body?.order?.status);
    const cancelAgain = await call('POST', `/api/epart-orders/${toCancel._id}/cancel`, staff, { reason: 'Test' });
    check(cancelAgain.status === 400 && looksGerman(cancelAgain.body?.error), 'erneutes Stornieren -> 400 deutsch', cancelAgain.body?.error);
    const stats = await call('GET', '/api/epart-orders/statistics', staff);
    const allOrders = await db.collection('epartorders').find({}).toArray();
    const expectedSpent = allOrders.filter((o) => o.status !== 'cancelled').reduce((sum, o) => sum + Number(o.totalCost || 0), 0);
    check(Math.abs(stats.body.totalSpent - expectedSpent) < 0.0001 && stats.body.totalSpentExcludesCancelled === true, 'Bestellwert gesamt ohne Stornos', `${stats.body.totalSpent} vs ${expectedSpent}`);

    // ------------------------------------------------------------------ Bedarfsliste
    console.log('\n[6] SP-5 Bedarfsliste: parallele Umwandlung');
    const needList = await NeedList.create({
      name: 'Bedarf Oktober', createdBy: admin._id, status: 'ready',
      items: [{ part: partA._id, partNumber: 'DSP-13', partName: 'Display iPhone 13', quantity: 2, unitPrice: 10, supplier: supplierId }]
    });
    const ordersBeforeConvert = await EPartOrder.countDocuments();
    const [c1, c2] = await Promise.all([
      call('POST', `/api/need-lists/${needList._id}/convert-to-order`, staff, {}),
      call('POST', `/api/need-lists/${needList._id}/convert-to-order`, staff, {}),
    ]);
    const statuses = [c1.status, c2.status].sort();
    check(statuses[0] === 201 && statuses[1] === 409, 'parallel: genau 201 + 409', statuses.join(','));
    check([c1, c2].some((r) => r.status === 409 && looksGerman(r.body?.error)), '409 mit deutscher Meldung', [c1, c2].map((r) => r.body?.error).join(' | '));
    check(await EPartOrder.countDocuments() === ordersBeforeConvert + 1, 'genau eine Bestellung erzeugt', (await EPartOrder.countDocuments()) - ordersBeforeConvert);
    const storedNeedList = await db.collection('needlists').findOne({ _id: needList._id });
    const convertedOrder = await db.collection('epartorders').findOne({ _id: storedNeedList.convertedToOrder });
    check(Boolean(convertedOrder) && storedNeedList.status === 'ordered', 'Bedarfsliste verweist auf existierende Bestellung, Status ordered', `${convertedOrder?.orderNumber} ${storedNeedList.status}`);

    // ------------------------------------------------------------------ Einstellungen
    console.log('\n[7] SET-1 / SET-4 Systemkonfiguration abschnittsweise speichern');
    const staffConfig = await call('PUT', '/api/system-config', staff, { siteName: 'Hack' });
    check(staffConfig.status === 403, 'Staff darf Systemkonfiguration nicht speichern', staffConfig.status);
    const customerConfig = await call('GET', '/api/system-config', customer);
    check(customerConfig.status === 403, 'Kunde darf Systemkonfiguration nicht lesen', customerConfig.status);

    const snapshot = (await call('GET', '/api/system-config', admin)).body.config;
    await call('PUT', '/api/system-config', admin, { financialSettings: { defaults: { paymentDueDays: 30 }, invoiceMetadata: { sellerName: 'Firma X' } } });
    const analyticsPut = await call('PUT', '/api/admin/analytics/profitability/settings', admin, { labor: { defaultHourlyRate: 110 } });
    check(analyticsPut.status === 200, 'Analyse-Stundensatz 110 gespeichert', analyticsPut.status);

    const taxPut = await call('PUT', '/api/system-config', admin, { financialSettings: { defaults: { taxRate: 7 } } });
    const afterTax = taxPut.body?.config?.financialSettings;
    check(taxPut.status === 200 && afterTax?.defaults?.taxRate === 7, 'Steuersatz 7 gespeichert', afterTax?.defaults?.taxRate);
    check(afterTax?.defaults?.paymentDueDays === 30 && afterTax?.invoiceMetadata?.sellerName === 'Firma X' && afterTax?.defaults?.currency === 'EUR',
      'Teil-Abschnitt setzt Geschwister NICHT auf Standard zurueck (Zahlungsziel 30, Verkaeufer Firma X)', `${afterTax?.defaults?.paymentDueDays} ${afterTax?.invoiceMetadata?.sellerName}`);
    check(JSON.stringify(taxPut.body?.updatedSections) === JSON.stringify(['financialSettings']), 'Antwort nennt updatedSections', JSON.stringify(taxPut.body?.updatedSections));

    const sitePut = await call('PUT', '/api/system-config', admin, { siteName: 'McRepair Test' });
    const afterSite = (await call('GET', '/api/system-config', admin)).body.config;
    check(sitePut.status === 200 && afterSite.siteName === 'McRepair Test' && afterSite.financialSettings.defaults.taxRate === 7,
      'Systemkonfiguration (siteName) laesst Finanz-Steuersatz 7 stehen', `${afterSite.siteName} ${afterSite.financialSettings.defaults.taxRate}`);

    // Veralteter Gesamtstand (wie frueher von beiden Seiten gesendet) inkl. alter Analyse-Werte.
    const stale = await call('PUT', '/api/system-config', admin, { ...snapshot, financialSettings: undefined, siteName: 'Stale Save' });
    check(stale.status === 200 && (stale.body?.ignoredSections || []).includes('profitabilitySettings'), 'profitabilitySettings im Gesamtstand wird ignoriert', `${stale.status} ${stale.body?.error || ''} ${JSON.stringify(stale.body?.ignoredSections)}`);
    const analyticsAfter = await call('GET', '/api/admin/analytics/profitability/settings', admin);
    check(analyticsAfter.body?.settings?.labor?.defaultHourlyRate === 110, 'Analyse-Stundensatz bleibt 110 (vorher Rueckfall auf 92)', analyticsAfter.body?.settings?.labor?.defaultHourlyRate);
    const notificationTemplatesCount = (await db.collection('systemconfigurations').findOne({})).notificationTemplates?.length || 0;
    check(notificationTemplatesCount === (snapshot.notificationTemplates || []).length, 'Benachrichtigungsvorlagen unveraendert', notificationTemplatesCount);

    for (const [label, patch] of [
      ['Steuersatz -5', { defaults: { taxRate: -5 } }],
      ['Steuersatz "abc"', { defaults: { taxRate: 'abc' } }],
      ['Steuersatz 150', { defaults: { taxRate: 150 } }],
      ['Waehrung CHF', { defaults: { currency: 'CHF' } }],
      ['Zahlungsziel 10,5', { defaults: { paymentDueDays: 10.5 } }],
      ['Rabatt 101', { defaults: { defaultDiscount: 101 } }],
      ['Absender-E-Mail ungueltig', { invoiceMetadata: { issuerEmail: 'kein-mail' } }],
    ]) {
      const response = await call('PUT', '/api/system-config', admin, { financialSettings: patch });
      check(response.status === 400 && looksGerman(response.body?.error), `${label} -> 400 deutsch`, `${response.status} ${response.body?.error}`);
    }
    const afterInvalid = (await call('GET', '/api/system-config', admin)).body.config.financialSettings;
    check(afterInvalid.defaults.taxRate === 7 && afterInvalid.defaults.currency === 'EUR' && afterInvalid.defaults.paymentDueDays === 30,
      'gespeicherte Werte nach abgelehnten Eingaben unveraendert', `${afterInvalid.defaults.taxRate} ${afterInvalid.defaults.currency} ${afterInvalid.defaults.paymentDueDays}`);
    const stringTax = await call('PUT', '/api/system-config', admin, { financialSettings: { defaults: { taxRate: '19' } } });
    check(stringTax.status === 200 && stringTax.body?.config?.financialSettings?.defaults?.taxRate === 19, 'Steuersatz "19" als Zahl gespeichert', stringTax.body?.config?.financialSettings?.defaults?.taxRate);
    const castError = await call('PUT', '/api/system-config', admin, { cartSettings: { maxItems: 'viele' } });
    check(castError.status === 400, 'Typfehler in anderem Abschnitt -> 400 statt 500', `${castError.status} ${castError.body?.error}`);
    const cartAfter = (await call('GET', '/api/system-config', admin)).body.config.cartSettings;
    check(cartAfter.maxItems === snapshot.cartSettings.maxItems && cartAfter.enableGuestCheckout === snapshot.cartSettings.enableGuestCheckout, 'cartSettings nach Typfehler unveraendert', cartAfter.maxItems);

    // ------------------------------------------------------------------ Seed-Skript
    console.log('\n[8] SP-5 Seed-Schritt epart_order (Dry-Run Standard, --confirm idempotent)');
    const { execFileSync } = require('child_process');
    await db.collection('epartorders').insertOne({
      orderNumber: 'EPO-000900', supplierId: new mongoose.Types.ObjectId(String(supplierId)), items: [],
      status: 'received', subtotal: 0, tax: 0, shippingCost: 0, totalCost: 0, createdBy: admin._id, orderDate: new Date(), timeline: []
    });
    const seedScript = path.join(SERVER_DIR, 'scripts/seedDocumentSequences.js');
    const seedEnv = { ...process.env, DATABASE_URL: URI };
    const counterBeforeSeed = (await db.collection('documentsequences').findOne({ documentType: 'epart_order', year: 0 }))?.sequence;
    const dryOut = execFileSync(process.execPath, [seedScript, '--epart-only'], { env: seedEnv, encoding: 'utf8' });
    const counterAfterDry = (await db.collection('documentsequences').findOne({ documentType: 'epart_order', year: 0 }))?.sequence;
    check(/Dry-Run/.test(dryOut) && /EPO-000900/.test(dryOut) && counterAfterDry === counterBeforeSeed, 'Dry-Run zeigt Plan, schreibt nichts', `${counterBeforeSeed} -> ${counterAfterDry}`);
    execFileSync(process.execPath, [seedScript, '--epart-only', '--confirm'], { env: seedEnv, encoding: 'utf8' });
    execFileSync(process.execPath, [seedScript, '--epart-only', '--confirm'], { env: seedEnv, encoding: 'utf8' });
    const counterAfterSeed = (await db.collection('documentsequences').findOne({ documentType: 'epart_order', year: 0 }))?.sequence;
    check(counterAfterSeed === 900, '--confirm (2x) hebt Zaehler idempotent auf 900', counterAfterSeed);
    const afterSeedOrder = await call('POST', '/api/epart-orders', staff, { supplierId, items: [{ partId: String(partB._id), quantity: 1, unitPrice: 1 }] });
    check(afterSeedOrder.body?.order?.orderNumber === 'EPO-000901', 'naechste Bestellung EPO-000901', afterSeedOrder.body?.order?.orderNumber);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await mongoose.connection.dropDatabase().catch(() => {});
    await mongoose.disconnect();
  }

  console.log(`\nErgebnis: ${pass} PASS, ${fail} FAIL`);
  process.exitCode = fail === 0 ? 0 : 1;
}

main().catch(async (error) => {
  console.error('Testlauf abgebrochen:', error);
  try {
    await mongoose.disconnect();
  } catch (disconnectError) {
    /* ignorieren */
  }
  process.exit(1);
});
