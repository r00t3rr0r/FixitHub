// Testkunde "kasse@e2e.invalid" (Rechnungskauf erlaubt, ohne Rabatt) fuer den echten Checkout im Browser.
// NUR Wegwerf-DB e2e_after. Legt einen Reparaturauftrag ueber die echte Warenkorb-API in den Warenkorb.
const fs = require('fs'); const path = require('path');
const SERVER = '/home/adar/Projects/FixitHub/server';
const mongoose = require(path.join(SERVER, 'node_modules/mongoose'));
const { generatePasswordHash } = require(path.join(SERVER, 'utils/password.js'));
const URI = 'mongodb://127.0.0.1:27099/e2e_after';
const PW = fs.readFileSync(path.join(__dirname, '.pw'), 'utf8').trim();
(async () => {
  await mongoose.connect(URI);
  for (const f of fs.readdirSync(path.join(SERVER, 'models')).filter((x) => x.endsWith('.js'))) { try { require(path.join(SERVER, 'models', f)); } catch (e) { /* optional */ } }
  const User = mongoose.model('User'); const Group = mongoose.model('CustomerGroup'); const Service = mongoose.model('Service');
  let group = await Group.findOne({ key: 'e2e-rechnung' });
  if (!group) group = await Group.create({ key: 'e2e-rechnung', name: 'E2E Rechnungskunden', status: 'active', financeProfile: { discountPercent: 0, allowedPaymentMethods: ['invoice'] } });
  await User.deleteOne({ email: 'kasse@e2e.invalid' });
  const addr = { street: 'Kassenweg 2', city: 'Berlin', zipCode: '10115', country: 'DE' };
  const u = await User.create({ email: 'kasse@e2e.invalid', password: await generatePasswordHash(PW), isActive: true, emailVerified: true, name: 'Karl Kasse', firstName: 'Karl', lastName: 'Kasse', role: 'customer', phone: '+49 30 5555555', shippingAddress: addr, invoiceAddress: addr, customerGroupIds: [group._id], primaryCustomerGroupId: group._id });
  const svc = await Service.findOne({ name: 'Diagnose E2E' });
  await mongoose.disconnect();
  const res = await fetch('http://127.0.0.1:5099/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'kasse@e2e.invalid', password: PW }) });
  const body = await res.json(); const cookies = res.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
  const csrf = decodeURIComponent((cookies.match(/(?:^|; )csrf_token=([^;]+)/) || [])[1] || '');
  const add = await fetch('http://127.0.0.1:5099/api/cart/add-repair-order', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${body.accessToken || ''}`, Cookie: cookies, 'X-CSRF-Token': csrf }, body: JSON.stringify({ deviceType: 'Smartphone', deviceBrand: 'Apple', deviceModel: 'iPhone 15', services: [String(svc._id)], addOns: [], totalCost: 49.9, errorDescription: 'Akku entlädt schnell', waterDamage: 'no', previousRepairAttempts: 'no', itemCondition: 'original', noLock: true }) });
  console.log('user', String(u._id), 'login', res.status, 'cart', add.status);
})().catch((e) => { console.error('SETUP FAIL', e.message); process.exit(1); });
