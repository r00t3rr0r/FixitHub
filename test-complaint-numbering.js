/**
 * Regressionstest (02.10.2026): Reklamationsnummern sind lesbar, eindeutig und kollisionsfrei.
 * Vorher: POST /api/orders/:id/complaint ueberschrieb die Nummer mit "R<Auftrags-ID>" (Anzeige
 * "R6ABEA5183DD4CAE5381D7087"), das Modell selbst vergab countDocuments()+1 (Dubletten bei Parallelitaet
 * oder nach Loeschungen). Jetzt: atomarer DocumentSequence-Zaehler, auf Altbestand ausgerichtet.
 * Echte Route + echte DB. Aufruf (nur Wegwerf-DB):
 *   TEST_MONGODB_URI=mongodb://127.0.0.1:27099/t_complaint_no node test-complaint-numbering.js
 */
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const SERVER_DIR = path.join(__dirname, 'server');
const mongoose = require(path.join(SERVER_DIR, 'node_modules/mongoose'));
const express = require(path.join(SERVER_DIR, 'node_modules/express'));
const jwt = require(path.join(SERVER_DIR, 'node_modules/jsonwebtoken'));
const URI = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27099/t_complaint_numbering';
process.env.EMAIL_TEST_TRANSPORT = 'stream';

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
const check = (c, m, a) => { if (c) { pass += 1; console.log(`  PASS ${m} :: ${a}`); } else { fail += 1; console.log(`  FAIL ${m} :: ${a}`); } };

async function main() {
  if (isUnsafeTestUri(URI)) throw new Error('Dieser Test darf nicht gegen die Entwicklungsdatenbank laufen.');
  process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
  await mongoose.connect(URI);
  await mongoose.connection.dropDatabase();
  fs.readdirSync(path.join(SERVER_DIR, 'models')).filter((f) => f.endsWith('.js')).forEach((f) => { try { require(path.join(SERVER_DIR, 'models', f)); } catch (e) { /* optional */ } });
  const NotificationService = require(path.join(SERVER_DIR, 'services/notificationService'));
  NotificationService.createNotification = async (d) => ({ _id: new mongoose.Types.ObjectId(), ...d });
  const app = express();
  app.use(express.json());
  app.use('/api/orders', require(path.join(SERVER_DIR, 'routes/orderRoutes')));
  const server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const User = mongoose.model('User'); const Order = mongoose.model('Order'); const Complaint = mongoose.model('Complaint');
  const tokenFor = (u) => jwt.sign({ sub: String(u._id) }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '10m' });
  const year = new Date().getFullYear();
  // Altbestand: hoechste vorhandene Nummer 0007 und eine alte "R<id>"-Nummer (bleibt unveraendert)
  const legacyOwner = await User.create({ name: 'Alt', email: 'alt@test.invalid', role: 'customer' });
  await Complaint.collection.insertOne({ complaintNumber: `CMP-${year}-0007`, customerId: legacyOwner._id, subject: 'Alt', description: 'Alt', status: 'resolved', createdAt: new Date() });
  await Complaint.collection.insertOne({ complaintNumber: `R${new mongoose.Types.ObjectId()}`, customerId: legacyOwner._id, subject: 'Alt R', description: 'Alt', status: 'resolved', createdAt: new Date() });

  const customers = [];
  for (let i = 0; i < 6; i += 1) {
    const c = await User.create({ name: `Kunde ${i}`, email: `cn${i}@test.invalid`, role: 'customer' });
    const o = await Order.create({ customerId: c._id, orderNumber: `ORD-CN-${i}`, deviceBrand: 'Apple', deviceModel: 'iPhone 15', deviceType: 'Smartphone', errorDescription: 'x', totalCost: 49.9, status: 'completed' });
    customers.push({ c, o });
  }
  const post = (c, o) => fetch(`${baseUrl}/api/orders/${o._id}/complaint`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenFor(c)}` }, body: JSON.stringify({ reason: 'Display flackert', description: 'Nach der Reparatur flackert das Display.' }) }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));
  const results = await Promise.all(customers.map(({ c, o }) => post(c, o)));
  check(results.every((r) => r.status === 201), '6 parallele Reklamationen ueber die echte Route angelegt', results.map((r) => r.status).join(','));
  const created = await Complaint.find({ orderId: { $in: customers.map((x) => x.o._id) } }).setOptions({ skipAutoPopulate: true }).lean();
  const numbers = created.map((c) => c.complaintNumber).sort();
  check(numbers.length === 6 && new Set(numbers).size === 6, 'alle Nummern eindeutig', numbers.join(' '));
  check(numbers.every((n) => new RegExp(`^CMP-${year}-\\d{4}$`).test(n)), 'Format CMP-JJJJ-NNNN (keine "R<ID>"-Nummer)', numbers[0]);
  check(numbers.every((n) => Number(n.slice(-4)) > 7), 'Zaehler beginnt oberhalb des Altbestands (0007)', numbers[0]);
  check(created.every((c) => c.subject === `Reklamation für Auftrag ${customers.find((x) => String(x.o._id) === String(c.orderId)).o.orderNumber}`), 'Betreff mit "für" statt "fuer"', created[0].subject);
  // Nach einer Loeschung keine Dublette (countDocuments+1 haette hier kollidiert)
  await Complaint.deleteOne({ _id: created[0]._id });
  const extra = await User.create({ name: 'Nach Loeschung', email: 'cn-x@test.invalid', role: 'customer' });
  const extraOrder = await Order.create({ customerId: extra._id, orderNumber: 'ORD-CN-X', deviceBrand: 'Apple', deviceModel: 'iPhone 15', deviceType: 'Smartphone', errorDescription: 'x', totalCost: 49.9, status: 'completed' });
  const r = await post(extra, extraOrder);
  const extraNo = (await Complaint.findOne({ orderId: extraOrder._id }).lean())?.complaintNumber;
  check(r.status === 201 && extraNo && !numbers.includes(extraNo), 'nach Loeschung neue, eindeutige Nummer', `${r.status} ${extraNo}`);
  const legacyR = await Complaint.findOne({ subject: 'Alt R' }).setOptions({ skipAutoPopulate: true }).lean();
  check(/^R[0-9a-f]{24}$/.test(legacyR.complaintNumber), 'Altbestand "R<ID>" wird nicht still umgeschrieben', legacyR.complaintNumber);

  console.log(`\n==== ${pass} bestanden, ${fail} fehlgeschlagen ====`);
  server.close();
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  process.exit(fail === 0 ? 0 : 1);
}
main().catch((e) => { console.error('ERROR:', e.stack || e.message); process.exit(2); });
