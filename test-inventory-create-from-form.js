/**
 * Regressionstest (06.10.2026): Teileverwaltung – „Neues Teil erstellen“ und „Teil bearbeiten“ mit genau den Daten,
 * die das Formular (client/src/pages/admin/PartsManagement.tsx) sendet.
 *
 * Vorher:
 *   - POST /api/inventory verlangte noch das Feld „brand“, das seit 0bbd045 (brand -> model) weder im Formular noch im
 *     Modell existiert -> jeder manuelle Anlageversuch endete mit 400 „… manufacturer, and brand are required“.
 *   - Das Formular sendet je Version supplierInfo { name: '' } (es gibt keine Lieferantenfelder); das Modell verlangte
 *     supplierInfo.name -> Validierungsfehler.
 *   - Die SKU (3 Buchstaben der Kategorie + Zähler je Kategorie) kollidierte bei Kategorien mit gleichem Präfix
 *     (microphone / Microfone Flex / microUSB Buchse) oder mit per CSV vergebenen SKUs -> E11000.
 *
 * Echte Express-Route + echte DB (Wegwerf-mongod) + Rollen (Kunde, Staff, Admin).
 *   [A] Formulardaten ohne „brand“ -> 201, Modell/Hersteller/Version gespeichert, versionId vergeben.
 *   [B] Pflichtfelder fehlen -> 400 mit den echten Pflichtfeldern (kein „brand“ mehr), nichts gespeichert.
 *   [C] Keine Version -> 400; leerer Lagerort -> 400; nichts gespeichert.
 *   [D] SKU: Kategorien mit gleichem Präfix und vorhandene CSV-SKUs -> alle 201, SKUs eindeutig.
 *   [E] Bearbeiten mit den Daten aus der Liste (+ neue Version ohne versionId) -> 200, versionIds vorhanden.
 *   [F] Kunde -> 403; Lieferantenname angegeben -> gespeichert.
 *   [G] Liste: Modellfilter und Suche nach Modell (statt „brand“), Sonderzeichen in der Suche -> kein 500, Sortierung wirkt.
 *   [H] Bearbeiten berechnet „niedriger Bestand“ neu; alle Versionen entfernen -> 400, DB unverändert.
 *   [I] Gleichzeitige Anlagen derselben Kategorie -> alle 201, verschiedene SKUs; absurde SKU-Nummer stört nicht.
 *
 * MOCKS: keine. Aufruf (nur WEGWERF-Datenbank):
 *   TEST_MONGODB_URI=mongodb://127.0.0.1:27199/t_inventory_form node test-inventory-create-from-form.js
 */
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');

const ROOT = __dirname;
const SERVER_DIR = path.join(ROOT, 'server');
const LOG_DIR = path.join(SERVER_DIR, 'logs');
const URI = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27199/t_inventory_form';

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

// ---- Keine Dateien im Repository: Schreibzugriffe auf server/logs umleiten ----
const LOG_REDIRECT_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'inventory-test-logs-'));
const redirectLogPath = (target) => {
  const text = typeof target === 'string' ? target : '';
  if (text && path.resolve(text).startsWith(LOG_DIR + path.sep)) {
    return path.join(LOG_REDIRECT_DIR, path.basename(text));
  }
  return target;
};
['appendFileSync', 'writeFileSync', 'mkdirSync'].forEach((name) => {
  const original = fs[name];
  fs[name] = function redirected(target, ...rest) { return original.call(this, redirectLogPath(target), ...rest); };
});

const mongoose = require(path.join(SERVER_DIR, 'node_modules/mongoose'));
const express = require(path.join(SERVER_DIR, 'node_modules/express'));
const jwt = require(path.join(SERVER_DIR, 'node_modules/jsonwebtoken'));

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
const section = async (title, fn) => {
  out(`\n${title}`);
  try { await fn(); } catch (error) {
    fail += 1;
    out(`  FAIL Abschnitt brach ab :: ${error && error.stack ? error.stack.split('\n').slice(0, 5).join(' | ') : error}`);
  }
};

// Genau die Struktur aus PartsManagement.tsx: formData + addVersion()-Vorgabe (supplierInfo mit leerem Namen).
const formVersion = (overrides = {}) => ({
  versionType: 'original',
  quantity: 3,
  minStockLevel: 5,
  reorderLevel: 10,
  unitCost: 4.5,
  sellingPrice: 9.9,
  storageLocation: 'Regal A1',
  supplierInfo: { name: '', contactPerson: '', email: '', phone: '', address: '' },
  leadTime: 7,
  status: 'active',
  notes: '',
  images: [],
  ...overrides,
});
const formPayload = ({ manufacturer = 'Test Ersatzteil', model = 'X1', category = 'other', ...rest } = {}) => ({
  itemName: [manufacturer, model, category].every(Boolean) ? `${manufacturer} ${model} ${category}` : '',
  itemDescription: 'test',
  category,
  manufacturer,
  model,
  date: null,
  compatibleDevices: [],
  specifications: {},
  versions: [formVersion()],
  ...rest,
});

async function main() {
  if (isUnsafeTestUri(URI)) {
    throw new Error('Dieser Test darf nicht gegen die Entwicklungsdatenbank laufen.');
  }
  process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
  await mongoose.connect(URI);
  await mongoose.connection.dropDatabase();
  require(path.join(SERVER_DIR, 'models/User'));
  const Inventory = require(path.join(SERVER_DIR, 'models/Inventory'));
  await Inventory.syncIndexes();

  const app = express();
  app.use(express.json());
  app.use('/api/inventory', require(path.join(SERVER_DIR, 'routes/inventoryRoutes')));
  const server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const User = mongoose.model('User');
  const customer = await User.create({ name: 'Klara Kunde', email: 'inv-kunde@test.invalid', role: 'customer' });
  const staff = await User.create({ name: 'Sophie Technik', email: 'inv-staff@test.invalid', role: 'staff', isActive: true });
  const admin = await User.create({ name: 'Anna Admin', email: 'inv-admin@test.invalid', role: 'admin', isActive: true });

  const tokenFor = (user) => jwt.sign({ sub: String(user._id) }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '10m' });
  const call = async (method, url, user, body) => {
    const response = await fetch(`${baseUrl}${url}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(user ? { Authorization: `Bearer ${tokenFor(user)}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    let json = null;
    try { json = await response.json(); } catch (error) { json = null; }
    return { status: response.status, body: json };
  };
  const count = () => Inventory.countDocuments({});

  try {
    await section('[A] Formulardaten ohne „brand“ -> 201', async () => {
      const res = await call('POST', '/api/inventory', staff, formPayload());
      check(res.status === 201 && res.body?.success === true, 'Staff legt Teil mit Formulardaten an -> 201', `${res.status} ${res.body?.error || ''}`);
      const doc = res.body?.item?._id ? await Inventory.findById(res.body.item._id).lean() : null;
      check(doc && doc.itemName === 'Test Ersatzteil X1 other' && doc.manufacturer === 'Test Ersatzteil' && doc.model === 'X1' && doc.category === 'other',
        'DB: Name, Hersteller, Modell, Kategorie gespeichert', doc ? `${doc.itemName} | ${doc.model}` : 'kein Dokument');
      const version = doc?.versions?.[0];
      check(version && version.versionType === 'original' && version.quantity === 3 && version.unitCost === 4.5 && version.sellingPrice === 9.9
        && version.storageLocation === 'Regal A1' && typeof version.versionId === 'string' && version.versionId.length > 0,
      'DB: Version mit Menge, Preisen, Lagerort und versionId', version ? `${version.versionId} q=${version.quantity}` : 'keine Version');
      check(doc && /^OTH-\d{4}$/.test(doc.sku || ''), 'SKU aus Kategorie erzeugt', doc?.sku);
      const asAdmin = await call('POST', '/api/inventory', admin, formPayload({ model: 'X2' }));
      check(asAdmin.status === 201, 'Admin legt Teil an -> 201', `${asAdmin.status} ${asAdmin.body?.error || ''}`);
    });

    await section('[B] Pflichtfelder fehlen -> 400 mit echten Pflichtfeldern', async () => {
      const before = await count();
      for (const [field, payload] of [
        ['model', formPayload({ model: '' })],
        ['manufacturer', formPayload({ manufacturer: '' })],
        ['category', formPayload({ category: '' })],
      ]) {
        const res = await call('POST', '/api/inventory', staff, payload);
        const message = String(res.body?.error || '');
        check(res.status === 400 && !/brand/i.test(message) && /model/i.test(message) && /manufacturer/i.test(message),
          `ohne ${field} -> 400, Meldung nennt Modell/Hersteller statt „brand“`, `${res.status} ${message}`);
      }
      check(await count() === before, 'nichts gespeichert', `${before} -> ${await count()}`);
    });

    await section('[C] Version fehlt / Lagerort leer -> 400', async () => {
      const before = await count();
      const noVersion = await call('POST', '/api/inventory', staff, formPayload({ versions: [] }));
      check(noVersion.status === 400 && /version/i.test(String(noVersion.body?.error || '')), 'ohne Version -> 400', `${noVersion.status} ${noVersion.body?.error}`);
      const noLocation = await call('POST', '/api/inventory', staff, formPayload({ versions: [formVersion({ storageLocation: '' })] }));
      check(noLocation.status === 400 && /storage ?location/i.test(String(noLocation.body?.error || '')), 'leerer Lagerort -> 400', `${noLocation.status} ${noLocation.body?.error}`);
      check(await count() === before, 'nichts gespeichert', `${before} -> ${await count()}`);
    });

    await section('[D] SKU eindeutig trotz gleichem Präfix und CSV-SKUs', async () => {
      const skus = [];
      for (const category of ['microphone', 'Microfone Flex', 'microUSB Buchse', 'microphone']) {
        const res = await call('POST', '/api/inventory', staff, formPayload({ category, model: `M-${skus.length}` }));
        check(res.status === 201, `Kategorie „${category}“ -> 201`, `${res.status} ${res.body?.error || res.body?.item?.sku}`);
        if (res.body?.item?.sku) skus.push(res.body.item.sku);
      }
      check(skus.length === 4 && new Set(skus).size === 4 && skus.every((sku) => /^MIC-\d{4}$/.test(sku)), 'vier verschiedene MIC-SKUs', skus.join(','));
      // CSV-Import vergibt SKUs selbst (generateUniqueSKU) – z. B. eine Lücke überspringend.
      await Inventory.collection.insertOne({
        itemName: 'CSV Teil', category: 'battery', manufacturer: 'CSV', model: 'C1', sku: 'BAT-0002', isActive: true,
        versions: [{ versionType: 'original', versionId: 'BAT-0002-V1', quantity: 1, minStockLevel: 5, reorderLevel: 10, unitCost: 1, sellingPrice: 2, storageLocation: 'B1' }],
      });
      const batterySkus = [];
      for (let i = 0; i < 2; i += 1) {
        const res = await call('POST', '/api/inventory', staff, formPayload({ category: 'battery', model: `B-${i}` }));
        check(res.status === 201, `Akku-Teil ${i + 1} nach CSV-SKU -> 201`, `${res.status} ${res.body?.error || res.body?.item?.sku}`);
        if (res.body?.item?.sku) batterySkus.push(res.body.item.sku);
      }
      check(batterySkus.length === 2 && !batterySkus.includes('BAT-0002') && new Set(batterySkus).size === 2, 'keine Kollision mit BAT-0002', batterySkus.join(','));
      // Gelöschte Teile (isActive=false) behalten ihre SKU – neue Teile dürfen sie nicht erneut vergeben.
      const created = await call('POST', '/api/inventory', staff, formPayload({ category: 'camera', model: 'K-0' }));
      const del = await call('DELETE', `/api/inventory/${created.body?.item?._id}`, staff);
      const again = await call('POST', '/api/inventory', staff, formPayload({ category: 'camera', model: 'K-1' }));
      check(del.status === 200 && again.status === 201 && again.body?.item?.sku !== created.body?.item?.sku,
        'nach Löschen neues Teil derselben Kategorie -> 201, andere SKU', `${created.body?.item?.sku} -> ${again.status} ${again.body?.item?.sku || again.body?.error}`);
    });

    await section('[E] Bearbeiten mit Listendaten + neue Version', async () => {
      const created = await call('POST', '/api/inventory', staff, formPayload({ category: 'display', model: 'E1' }));
      const id = created.body?.item?._id;
      const list = await call('GET', `/api/inventory?search=${encodeURIComponent('Test Ersatzteil E1')}`, staff);
      const item = (list.body?.items || []).find((entry) => String(entry._id) === String(id));
      check(list.status === 200 && item, 'Teil erscheint in der Liste', `${list.status} ${(list.body?.items || []).length}`);
      // handleEditClick(): formData aus dem Listeneintrag, versions unverändert (inkl. _id/versionId).
      const editData = {
        itemName: item.itemName, itemDescription: 'geändert', category: item.category, manufacturer: item.manufacturer,
        model: item.model, date: new Date('2026-10-01').toISOString(), compatibleDevices: ['iPhone 15'], specifications: {},
        versions: item.versions,
      };
      const unchanged = await call('PUT', `/api/inventory/${id}`, staff, editData);
      check(unchanged.status === 200 && unchanged.body?.item?.itemDescription === 'geändert', 'Bearbeiten ohne neue Version -> 200', `${unchanged.status} ${unchanged.body?.error || ''}`);
      const withNewVersion = await call('PUT', `/api/inventory/${id}`, staff, {
        ...editData, versions: [...item.versions, formVersion({ versionType: 'cheap', quantity: 7, storageLocation: 'Regal B2' })],
      });
      check(withNewVersion.status === 200, 'Bearbeiten + „Add Version“ -> 200', `${withNewVersion.status} ${withNewVersion.body?.error || ''}`);
      const doc = await Inventory.findById(id).lean();
      check(doc.versions.length === 2 && doc.versions.every((v) => typeof v.versionId === 'string' && v.versionId.length > 0)
        && new Set(doc.versions.map((v) => v.versionId)).size === 2 && doc.versions[1].quantity === 7,
      'DB: zwei Versionen mit eindeutiger versionId', doc.versions.map((v) => `${v.versionType}:${v.versionId}`).join(','));
      check(doc.versions[0].versionId === item.versions[0].versionId, 'bestehende versionId unverändert', `${item.versions[0].versionId} -> ${doc.versions[0].versionId}`);
      const quantity = await call('PUT', `/api/inventory/${id}/quantity`, staff, { versionId: String(doc.versions[1]._id), quantity: 2, operation: 'add', reason: 'Test' });
      check(quantity.status === 200, 'Menge der neuen Version änderbar (Endpunkt erwartet die Unterdokument-_id)', `${quantity.status} ${quantity.body?.error || ''}`);
      const badEdit = await call('PUT', `/api/inventory/${id}`, staff, { ...editData, model: '' });
      check(badEdit.status === 400, 'Bearbeiten mit leerem Modell -> 400', `${badEdit.status}`);
    });

    await section('[F] Rollen und Lieferant', async () => {
      const before = await count();
      const res = await call('POST', '/api/inventory', customer, formPayload({ model: 'F1' }));
      check(res.status === 403 && await count() === before, 'Kunde -> 403, nichts gespeichert', `${res.status}`);
      const withSupplier = await call('POST', '/api/inventory', staff, formPayload({
        model: 'F2', versions: [formVersion({ supplierInfo: { name: 'Lieferant GmbH', contactPerson: '', email: '', phone: '', address: '' } })],
      }));
      const doc = withSupplier.body?.item?._id ? await Inventory.findById(withSupplier.body.item._id).lean() : null;
      check(withSupplier.status === 201 && doc?.versions?.[0]?.supplierInfo?.name === 'Lieferant GmbH', 'Lieferantenname gespeichert', `${withSupplier.status} ${doc?.versions?.[0]?.supplierInfo?.name}`);
    });

    await section('[G] Liste: Modellfilter, Suche, Sortierung', async () => {
      await Inventory.collection.insertOne({
        itemName: 'Altbestand Umbenannt', category: 'speaker', manufacturer: 'Alt', model: 'ZZ9 (Pro)', sku: 'SPE-0100', isActive: true,
        versions: [{ versionType: 'original', versionId: 'SPE-0100-V1', quantity: 1, minStockLevel: 5, reorderLevel: 10, unitCost: 1, sellingPrice: 2, storageLocation: 'A0' }],
      });
      const byModel = await call('GET', `/api/inventory?model=${encodeURIComponent('ZZ9 (Pro)')}&limit=100`, staff);
      check(byModel.status === 200 && byModel.body.totalItems === 1 && byModel.body.items[0].model === 'ZZ9 (Pro)', 'Modellfilter liefert nur dieses Modell', `${byModel.status} ${byModel.body?.totalItems}`);
      const all = await call('GET', '/api/inventory?model=all&limit=100', staff);
      check(all.status === 200 && all.body.totalItems > 1, '„All Models“ filtert nicht', `${all.body?.totalItems}`);
      const search = await call('GET', `/api/inventory?search=${encodeURIComponent('ZZ9 (')}`, staff);
      check(search.status === 200 && search.body.totalItems === 1, 'Suche nach Modell mit „(“ -> 200, Treffer über das Modellfeld', `${search.status} ${search.body?.totalItems ?? search.body?.error}`);
      const bracket = await call('GET', `/api/inventory?search=${encodeURIComponent('[')}`, staff);
      check(bracket.status === 200 && bracket.body.totalItems === 0, 'Suche „[“ -> 200 ohne Treffer', `${bracket.status}`);
      const names = async (sortBy, sortOrder) => {
        const res = await call('GET', `/api/inventory?category=microphone&sortBy=${sortBy}&sortOrder=${sortOrder}&limit=100`, staff);
        return { status: res.status, names: (res.body?.items || []).map((item) => item.itemName) };
      };
      const asc = await names('itemName', 'asc');
      const desc = await names('itemName', 'desc');
      check(asc.status === 200 && asc.names.length === 2 && asc.names.join('|') === [...asc.names].sort().join('|') && desc.names.join('|') === [...asc.names].reverse().join('|'),
        'Sortierung nach Name auf-/absteigend', `${asc.names.join(' / ')} || ${desc.names.join(' / ')}`);
      const skuAsc = await call('GET', '/api/inventory?category=microphone&sortBy=partNumber&sortOrder=asc&limit=100', staff);
      const skus = (skuAsc.body?.items || []).map((item) => item.sku);
      check(skus.length === 2 && skus.join('|') === [...skus].sort().join('|'), 'Sortierung nach Teilenummer (SKU)', skus.join(','));
      // Lagerort-Sortierung nach der ersten Version (die Spalte zeigt versions[0])
      await Inventory.collection.insertMany([
        { itemName: 'Ortstest Mehrfach', category: 'sensor', manufacturer: 'Ort', model: 'O1', sku: 'SEN-0101', isActive: true,
          versions: [
            { versionType: 'original', versionId: 'SEN-0101-V1', quantity: 1, minStockLevel: 5, reorderLevel: 10, unitCost: 1, sellingPrice: 2, storageLocation: 'A-erst' },
            { versionType: 'cheap', versionId: 'SEN-0101-V2', quantity: 1, minStockLevel: 5, reorderLevel: 10, unitCost: 1, sellingPrice: 2, storageLocation: 'Z-zweit' },
          ] },
        { itemName: 'Ortstest Einzeln', category: 'sensor', manufacturer: 'Ort', model: 'O2', sku: 'SEN-0102', isActive: true,
          versions: [{ versionType: 'original', versionId: 'SEN-0102-V1', quantity: 1, minStockLevel: 5, reorderLevel: 10, unitCost: 1, sellingPrice: 2, storageLocation: 'M-mitte' }] },
      ]);
      const byLocation = await call('GET', '/api/inventory?category=sensor&sortBy=location&sortOrder=desc&limit=100', staff);
      const shown = (byLocation.body?.items || []).map((item) => item.versions[0].storageLocation);
      check(shown.join('|') === 'M-mitte|A-erst', 'Lagerort-Sortierung folgt dem angezeigten Lagerort (erste Version)', shown.join(','));
      const operator = await call('GET', '/api/inventory?model[$ne]=zz&limit=100', staff);
      const allNow = await call('GET', '/api/inventory?limit=100', staff);
      check(operator.status === 200 && operator.body.totalItems === allNow.body.totalItems, 'model als Objekt (model[$ne]) wird ignoriert, kein Operator', `${operator.status} ${operator.body?.totalItems}`);
      for (const odd of ['__proto__', '$where', 'status']) {
        const res = await call('GET', `/api/inventory?sortBy=${encodeURIComponent(odd)}&sortOrder=asc`, staff);
        check(res.status === 200, `unbekannter Sortierschlüssel „${odd}“ -> 200 (Standardreihenfolge)`, `${res.status}`);
      }
    });

    await section('[H] Bearbeiten: niedriger Bestand und leere Versionsliste', async () => {
      const created = await call('POST', '/api/inventory', staff, formPayload({ category: 'tool', model: 'H1', versions: [formVersion({ quantity: 0, minStockLevel: 5 })] }));
      const id = created.body?.item?._id;
      const lowCount = async () => (await call('GET', '/api/inventory?limit=1', staff)).body?.lowStockCount;
      const listItem = async () => (await call('GET', `/api/inventory?search=${encodeURIComponent('Test Ersatzteil H1')}`, staff)).body.items[0];
      const startLow = await lowCount();
      let item = await listItem();
      check(item.versions[0].lowStockAlert === true, 'Menge 0 -> niedriger Bestand', `${item.versions[0].lowStockAlert}`);
      const edit = (versions) => call('PUT', `/api/inventory/${id}`, staff, {
        itemName: item.itemName, itemDescription: '', category: item.category, manufacturer: item.manufacturer, model: item.model,
        date: null, compatibleDevices: [], specifications: {}, versions,
      });
      const up = await edit([{ ...item.versions[0], quantity: 50 }]);
      item = await listItem();
      check(up.status === 200 && item.versions[0].lowStockAlert === false && await lowCount() === startLow - 1, 'Menge auf 50 -> Kennzeichen weg, Kachel zählt eins weniger', `${up.status} ${item.versions[0].lowStockAlert}`);
      const down = await edit([{ ...item.versions[0], quantity: 2 }, formVersion({ quantity: 3, minStockLevel: 5, storageLocation: 'H2' })]);
      item = await listItem();
      check(down.status === 200 && item.versions.length === 2 && item.versions.every((v) => v.lowStockAlert === true), 'Menge 2 und neue Version mit 3 (Mindestbestand 5) -> beide niedrig', `${down.status} ${item.versions.map((v) => v.lowStockAlert).join(',')}`);
      const zeroMin = await edit([{ ...item.versions[0], quantity: 0, minStockLevel: 0 }, item.versions[1]]);
      item = await listItem();
      check(zeroMin.status === 200 && item.versions[0].minStockLevel === 0 && item.versions[0].lowStockAlert === true, 'Mindestbestand 0 wird gespeichert', `${zeroMin.status} ${item.versions[0].minStockLevel}`);
      const before = await Inventory.findById(id).lean();
      const empty = await edit([]);
      const after = await Inventory.findById(id).lean();
      check(empty.status === 400 && /version/i.test(String(empty.body?.error || '')) && after.versions.length === before.versions.length,
        'alle Versionen entfernt -> 400, DB unverändert', `${empty.status} ${empty.body?.error} ${after.versions.length}`);
      const nullVersions = await edit(null);
      const afterNull = await Inventory.findById(id).lean();
      check(nullVersions.status === 400 && Array.isArray(afterNull.versions) && afterNull.versions.length === before.versions.length,
        'versions: null -> 400, DB unverändert', `${nullVersions.status} ${Array.isArray(afterNull.versions)}`);
    });

    await section('[I0] Absurd lange SKU-Nummer blockiert die Vergabe nicht', async () => {
      await Inventory.collection.insertOne({
        itemName: 'Riesen-SKU', category: 'button', manufacturer: 'X', model: 'R', sku: 'BUT-9007199254740993', isActive: true,
        versions: [{ versionType: 'original', versionId: 'BUT-R-V1', quantity: 1, minStockLevel: 5, reorderLevel: 10, unitCost: 1, sellingPrice: 2, storageLocation: 'R1' }],
      });
      const made = [];
      for (let i = 0; i < 3; i += 1) {
        const res = await call('POST', '/api/inventory', staff, formPayload({ category: 'button', model: `BIG-${i}` }));
        made.push(`${res.status}:${res.body?.item?.sku || res.body?.error}`);
      }
      check(made.every((entry) => entry.startsWith('201:BUT-000')) && new Set(made).size === 3, 'drei Anlagen nach Riesen-SKU -> 201, normale Nummern', made.join(', '));
    });

    await section('[I] Gleichzeitige Anlage derselben Kategorie', async () => {
      const results = await Promise.all([0, 1, 2].map((i) => call('POST', '/api/inventory', staff, formPayload({ category: 'adhesive', model: `I-${i}` }))));
      const skus = results.map((res) => res.body?.item?.sku);
      check(results.every((res) => res.status === 201) && new Set(skus).size === 3, 'drei gleichzeitige Anlagen -> alle 201, verschiedene SKUs', results.map((res) => `${res.status}:${res.body?.item?.sku || res.body?.error}`).join(', '));
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await mongoose.connection.dropDatabase().catch(() => {});
    await mongoose.disconnect();
    fs.rmSync(LOG_REDIRECT_DIR, { recursive: true, force: true });
  }

  out(`\n==== ${pass} bestanden, ${fail} fehlgeschlagen ====`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((error) => {
  out(`FATAL ${error && error.stack ? error.stack : error}`);
  process.exit(1);
});
