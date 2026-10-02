// Abnahme-Szenario 01.10.2026 - laeuft NUR gegen eine Wegwerf-DB (127.0.0.1:27099/e2e_*) und den
// isolierten Testserver. Baut die Lage aus den Mitarbeiterfotos nach:
//  - Partnerkunde mit 5 % Rabatt bucht ueber Warenkorb + Checkout zwei Geraete (Diagnose 49,90 + Display 129,90)
//  - Kundennachricht im Auftrag, Antwort des Admins, strukturierte Rueckfrage
//  - Gast-Reparaturanfrage
//  - Reklamation; die Genehmigungs-Benachrichtigung wird im ALTEN Format abgelegt (Text aus
//    complaintRoutes.js Zeile 1131), da die echte Genehmigung ein DHL-Label erzeugen wuerde (gesperrt).
// Aufruf: E2E_API=http://127.0.0.1:5098 E2E_DB=mongodb://127.0.0.1:27099/e2e_before node scenario.js
const fs = require('fs');
const path = require('path');
const SERVER = '/home/adar/Projects/FixitHub/server';
const mongoose = require(path.join(SERVER, 'node_modules/mongoose'));
const { generatePasswordHash } = require(path.join(SERVER, 'utils/password.js'));

const API = process.env.E2E_API;
const URI = process.env.E2E_DB;
if (!/^mongodb:\/\/127\.0\.0\.1:27099\/e2e_[a-z0-9_]+$/.test(String(URI))) throw new Error('E2E_DB muss e2e_* auf 127.0.0.1:27099 sein');
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(String(API))) throw new Error('E2E_API muss lokal sein');
const PW = fs.readFileSync(path.join(__dirname, '.pw'), 'utf8').trim();
const ADMIN_PW = fs.readFileSync(path.join(__dirname, '.adminpw'), 'utf8').trim();
const OUT = process.env.E2E_OUT || path.join(__dirname, `scenario.${URI.split('/').pop()}.json`);

const j = (v) => { try { return JSON.stringify(v); } catch (e) { return String(v); } };
async function login(email, password) {
  const res = await fetch(`${API}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
  const body = await res.json().catch(() => ({}));
  const cookies = (res.headers.getSetCookie ? res.headers.getSetCookie() : []).map((c) => c.split(';')[0]).join('; ');
  const token = body.accessToken || body.token || body.data?.accessToken;
  if (res.status !== 200) throw new Error(`Login ${email}: ${res.status} ${j(body).slice(0, 200)}`);
  return { token, cookies };
}
const call = async (auth, method, url, body) => {
  const headers = { ...(body ? { 'Content-Type': 'application/json' } : {}) };
  if (auth?.token) headers.Authorization = `Bearer ${auth.token}`;
  if (auth?.cookies) {
    headers.Cookie = auth.cookies;
    const csrf = (auth.cookies.match(/(?:^|; )csrf_token=([^;]+)/) || [])[1];
    if (csrf) headers['X-CSRF-Token'] = decodeURIComponent(csrf);
  }
  const res = await fetch(`${API}${url}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, data: await res.json().catch(() => ({})) };
};
const step = (label, r) => console.log(`${r.status >= 200 && r.status < 300 ? 'OK  ' : 'FAIL'} ${label} -> ${r.status} ${r.status >= 300 ? j(r.data).slice(0, 300) : ''}`);

(async () => {
  await mongoose.connect(URI);
  fs.readdirSync(path.join(SERVER, 'models')).filter((f) => f.endsWith('.js'))
    .forEach((f) => { try { require(path.join(SERVER, 'models', f)); } catch (e) { /* optional */ } });
  const User = mongoose.model('User');
  const Service = mongoose.model('Service');
  const hash = await generatePasswordHash(PW);
  const upsertUser = async (email, fields) => { await User.deleteOne({ email }); return User.create({ email, password: hash, isActive: true, emailVerified: true, ...fields }); };
  const addr = { street: 'Teststraße 1', city: 'Berlin', zipCode: '10115', country: 'DE' };
  const partner = await upsertUser('partner@e2e.invalid', { name: 'Paula Partner', firstName: 'Paula', lastName: 'Partner', role: 'customer', discount: 5, phone: '+49 30 1111111', shippingAddress: addr, invoiceAddress: addr });
  const other = await upsertUser('fremd@e2e.invalid', { name: 'Fritz Fremd', firstName: 'Fritz', lastName: 'Fremd', role: 'customer', shippingAddress: addr, invoiceAddress: addr });
  const staff = await upsertUser('staff@e2e.invalid', { name: 'Stefan Staff', firstName: 'Stefan', lastName: 'Staff', role: 'staff' });
  await Service.deleteMany({ name: { $in: ['Diagnose E2E', 'Displaytausch E2E'] } });
  const svcDiag = await Service.create({ name: 'Diagnose E2E', description: 'Diagnose', category: 'diagnostic', price: 49.9, estimatedTime: '30', manufacturer: 'Apple', model: 'iPhone 15', deviceType: 'Smartphone', isActive: true });
  const svcDisp = await Service.create({ name: 'Displaytausch E2E', description: 'Display', category: 'screen', price: 129.9, estimatedTime: '60', manufacturer: 'Apple', model: 'iPad Pro 9.7', deviceType: 'Tablet', isActive: true });

  const cust = await login('partner@e2e.invalid', PW);
  const fremd = await login('fremd@e2e.invalid', PW);
  const admin = await login('admin@example.com', ADMIN_PW);

  const already = await mongoose.model('Order').countDocuments({ customerId: partner._id });
  let r = { status: 0, data: {} };
  if (already) console.log('HINWEIS: Auftraege existieren bereits - Szenario wird nicht doppelt angelegt');
  if (!already) {
  r = await call(cust, 'POST', '/api/cart/add-repair-order', { deviceType: 'Smartphone', deviceBrand: 'Apple', deviceModel: 'iPhone 15', services: [String(svcDiag._id)], addOns: [], totalCost: 49.9, errorDescription: 'Gerät startet nicht mehr', waterDamage: 'no', previousRepairAttempts: 'no', itemCondition: 'original', noLock: true });
  step('Warenkorb: iPhone 15 Diagnose', r);
  r = await call(cust, 'POST', '/api/cart/add-repair-order', { deviceType: 'Tablet', deviceBrand: 'Apple', deviceModel: 'iPad Pro 9.7', services: [String(svcDisp._id)], addOns: [], totalCost: 129.9, errorDescription: 'Display gebrochen', waterDamage: 'no', previousRepairAttempts: 'no', itemCondition: 'original', noLock: true });
  step('Warenkorb: iPad Displaytausch', r);
  r = await call(cust, 'POST', '/api/checkout/complete', { paymentMethod: 'paypal' });
  step('Checkout abschliessen (PayPal ausstehend, keine Zahlung)', r);
  }
  const checkout = r.data;

  const Order = mongoose.model('Order');
  const orders = await Order.find({ customerId: partner._id }).sort({ createdAt: 1 }).lean();
  console.log('Auftraege:', orders.map((o) => `${o.orderNumber} ${o.deviceModel} total=${o.totalCost} discount=${o.discount}`).join(' | '));
  const [o1, o2] = orders;

  if (o1) {
    r = await call(cust, 'POST', `/api/inspection-communication/${o1._id}/message`, { content: 'Hallo, wann ist mein iPhone fertig?' });
    step('Kunde schreibt im Auftrag 1', r);
    r = await call(admin, 'POST', `/api/inspection-communication/${o1._id}/message`, { content: 'Wir melden uns nach der Eingangsprüfung.' });
    step('Admin antwortet im Auftrag 1', r);
  }
  if (o2) {
    r = await call(admin, 'POST', `/api/inspection-communication/${o2._id}/feedback-request`, { question: 'Die Reparatur würde 129,90 € kosten. Sollen wir fortfahren?', options: [{ label: 'Ja, bitte reparieren', value: 'approve' }, { label: 'Nein, Gerät zurück', value: 'decline' }] });
    step('Admin stellt strukturierte Rückfrage im Auftrag 2', r);
  }
  r = await call(null, 'POST', '/api/repair-requests/guest', { guestInfo: { firstName: 'Gerda', lastName: 'Gast', email: 'gast@e2e.invalid', phone: '+49 30 2222222' }, deviceType: 'Smartphone', deviceBrand: 'Fairphone', deviceModel: 'Fairphone 5', issueDescription: 'Akku hält nur 2 Stunden' });
  step('Gast-Reparaturanfrage', r);
  const guestRequest = r.data;

  let complaintId = null;
  if (o1) {
    r = await call(admin, 'PUT', `/api/orders/${o1._id}/status`, { status: 'completed' });
    step('Admin setzt Auftrag 1 abgeschlossen (fuer Reklamation)', r);
    r = await call(cust, 'POST', `/api/orders/${o1._id}/complaint`, { reason: 'Gerät funktioniert wieder nicht', description: 'Nach der Reparatur startet es erneut nicht.' });
    step('Kunde legt Reklamation an', r);
    complaintId = r.data?.complaint?._id || r.data?.data?._id || r.data?._id || null;
  }
  const Notification = mongoose.model('Notification');
  const fakePdf = Buffer.from('%PDF-1.4\n% E2E Testlabel - kein echtes DHL-Label\n' + 'x'.repeat(1800)).toString('base64');
  const labelUrl = `data:application/pdf;base64,${fakePdf}`;
  try {
    await Notification.create({
      userId: partner._id, recipientId: partner._id, title: 'Reklamation genehmigt', type: 'order_update', category: 'order',
      message: `Deine Reklamation wurde genehmigt. Versandlabel: ${labelUrl}. Reklamationsauftrag: ${o1?.orderNumber || 'ORD-?'}`,
      data: { complaintId, shippingLabelUrl: labelUrl, orderId: o1?._id }, read: false, isRead: false,
    });
    console.log('OK   Alt-Format-Benachrichtigung "Reklamation genehmigt" (base64) abgelegt');
  } catch (e) { console.log('FAIL Benachrichtigung anlegen:', e.message); }

  const out = { partnerId: String(partner._id), otherId: String(other._id), staffId: String(staff._id), orders: orders.map((o) => ({ id: String(o._id), orderNumber: o.orderNumber, bookingId: String(o.bookingId || ''), model: o.deviceModel })), complaintId, guestRequest: guestRequest?.data?._id || guestRequest?.repairRequest?._id || null, checkoutKeys: Object.keys(checkout || {}) };
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
  console.log('SZENARIO OK ->', OUT);
  await mongoose.disconnect();
})().catch((e) => { console.error('SZENARIO FAIL', e.message); process.exit(1); });
