/**
 * Regressionstest (Abschluss 02.10.2026): Vorlagen-Option „Überspringen erlaubt“ (canSkip) wird vom Server
 * durchgesetzt – nicht nur von der Oberfläche.
 *
 * Vorher: POST /api/admin/orders/:id/workflows/:wf/steps/:step/skip übersprang jeden Schritt, auch wenn die
 * Vorlage canSkip=false hatte (die Oberfläche blendete den Knopf nur aus).
 *
 * Echte Express-Route + echte DB (Wegwerf-mongod) + Rollen (Kunde, Staff).
 *   [A] Schritt mit canSkip=false -> 409 WORKFLOW_STEP_NOT_SKIPPABLE (deutsch), DB unverändert, kein Verlaufseintrag.
 *   [B] Schritt mit canSkip=true  -> 200, Status „skipped“, nächster Schritt läuft, Verlaufseintrag mit Grund.
 *   [C] Vorlage gelöscht / Schritt nicht in der Vorlage -> 409 (wie die Oberfläche: kein Knopf ohne Vorlagenschritt).
 *   [D] GET …/workflows liefert canSkip genau so, wie der Server es durchsetzt (Quelle der Oberfläche).
 *   [E] Kunde -> 403; bereits übersprungener Schritt -> 409 WORKFLOW_STEP_ALREADY_DONE.
 *
 * MOCKS: keine Fachlogik. E-Mails -> Stream-Transport; DHL wird nicht aufgerufen.
 * Aufruf (nur WEGWERF-Datenbank):
 *   EMAIL_TEST_TRANSPORT=stream TEST_MONGODB_URI=mongodb://127.0.0.1:27199/t_close_skip node test-workflow-skip-canskip.js
 */
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const Module = require('module');

const ROOT = __dirname;
const SERVER_DIR = path.join(ROOT, 'server');
const LOG_DIR = path.join(SERVER_DIR, 'logs');
const URI = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27199/t_close_skip';
process.env.EMAIL_TEST_TRANSPORT = 'stream';

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
const LOG_REDIRECT_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'skip-test-logs-'));
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
['appendFile', 'writeFile'].forEach((name) => {
  const original = fs.promises[name];
  fs.promises[name] = function redirected(target, ...rest) { return original.call(this, redirectLogPath(target), ...rest); };
});
const originalAppendFile = fs.appendFile;
fs.appendFile = function redirected(target, ...rest) { return originalAppendFile.call(this, redirectLogPath(target), ...rest); };

// 'qrcode' fehlt lokal (nur PDF-Erzeugung).
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function resolve(request, parent, ...rest) {
  if (request === 'qrcode') return 'qrcode-test-stub';
  return originalResolve.call(this, request, parent, ...rest);
};
require.cache['qrcode-test-stub'] = {
  id: 'qrcode-test-stub', filename: 'qrcode-test-stub', loaded: true,
  exports: { toDataURL: async () => 'data:image/png;base64,', toBuffer: async () => Buffer.from('') },
};

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
const isGerman = (text) => typeof text === 'string' && text.length > 0 && !/\b(not found|already|failed|is not|Invalid|cannot)\b/i.test(text);

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

  const DHLService = require(path.join(SERVER_DIR, 'services/dhlService'));
  DHLService.getTrackingInfo = async () => { throw new Error('DHL darf in diesem Test nicht aufgerufen werden'); };
  DHLService.createShipment = async () => { throw new Error('DHL darf in diesem Test nicht aufgerufen werden'); };

  const app = express();
  app.use(express.json());
  app.use('/api/admin/orders', require(path.join(SERVER_DIR, 'routes/adminOrderRoutes')));
  const server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const User = mongoose.model('User');
  const Order = mongoose.model('Order');
  const { WorkflowTemplate } = require(path.join(SERVER_DIR, 'models/Workflow'));

  const customer = await User.create({ name: 'Klara Kunde', email: 'skip-kunde@test.invalid', role: 'customer' });
  const staff = await User.create({ name: 'Sophie Technik', email: 'skip-staff@test.invalid', role: 'staff', isActive: true });
  const admin = await User.create({ name: 'Anna Admin', email: 'skip-admin@test.invalid', role: 'admin', isActive: true });

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

  const template = await WorkflowTemplate.create({
    name: 'Displaytausch', description: 'Test', category: 'repair', isActive: true, createdBy: admin._id,
    deviceTypes: ['Smartphone'], serviceTypes: ['Displaytausch'],
    steps: [
      { name: 'Eingangsprüfung', description: 'x', order: 1, estimatedTime: 10, category: 'repair', canSkip: false },
      { name: 'Reinigung', description: 'x', order: 2, estimatedTime: 5, category: 'repair', canSkip: true },
      { name: 'Endkontrolle', description: 'x', order: 3, estimatedTime: 5, category: 'repair' },
    ],
  });
  const [tplStrict, tplSkippable, tplDefault] = template.steps.map((step) => String(step._id));

  let counter = 0;
  const stored = async (id) => Order.findById(id).setOptions({ skipAutoPopulate: true }).lean();
  const newOrderWithWorkflow = async ({ templateId = template._id, stepIds = [tplStrict, tplSkippable, tplDefault], current = 0 } = {}) => {
    counter += 1;
    const order = await Order.create({
      customerId: customer._id,
      orderNumber: `ORD-SKIP-${String(counter).padStart(3, '0')}`,
      deviceBrand: 'Apple', deviceModel: 'iPhone 15', deviceType: 'Smartphone',
      errorDescription: 'Display defekt', totalCost: 49.9, status: 'in-progress',
      workflows: [{
        workflowTemplateId: templateId, workflowName: 'Displaytausch', status: 'in-progress', currentStepIndex: current,
        steps: stepIds.map((stepId, index) => ({
          stepId, stepName: ['Eingangsprüfung', 'Reinigung', 'Endkontrolle'][index] || `Schritt ${index + 1}`,
          status: index < current ? 'completed' : (index === current ? 'in-progress' : 'pending'),
        })),
      }],
    });
    const wf = (await stored(order._id)).workflows[0];
    return { id: String(order._id), wfId: String(wf._id), steps: wf.steps.map((step) => String(step._id)) };
  };
  const skipUrl = (o, index) => `/api/admin/orders/${o.id}/workflows/${o.wfId}/steps/${o.steps[index]}/skip`;
  const skippedHistory = (doc) => (doc.timeline || []).filter((entry) => entry && (entry.key === 'Workflow Step Skipped' || entry.status === 'Workflow Step Skipped'));

  try {
    await section('[A] canSkip=false -> 409, DB unveraendert', async () => {
      const o = await newOrderWithWorkflow();
      const before = await stored(o.id);
      const res = await call('POST', skipUrl(o, 0), staff, { reason: 'Kunde hat es eilig' });
      const after = await stored(o.id);
      check(res.status === 409 && res.body?.code === 'WORKFLOW_STEP_NOT_SKIPPABLE' && isGerman(res.body?.error),
        'Schritt ohne „Überspringen erlaubt“ -> 409 WORKFLOW_STEP_NOT_SKIPPABLE deutsch', `${res.status} ${res.body?.code} ${res.body?.error}`);
      check(after.workflows[0].steps.map((s) => s.status).join(',') === 'in-progress,pending,pending'
        && after.workflows[0].currentStepIndex === 0 && after.workflows[0].status === 'in-progress',
      'DB: Schritte und Workflow unveraendert', after.workflows[0].steps.map((s) => s.status).join(','));
      check(skippedHistory(after).length === 0 && Number(after.progress || 0) === Number(before.progress || 0),
        'kein Verlaufseintrag „uebersprungen“, Fortschritt unveraendert', `${skippedHistory(after).length} ${after.progress}`);
      const asAdmin = await call('POST', skipUrl(o, 0), admin, { reason: 'x' });
      check(asAdmin.status === 409 && asAdmin.body?.code === 'WORKFLOW_STEP_NOT_SKIPPABLE', 'auch Admin -> 409 (Vorlage gilt fuer alle)', `${asAdmin.status} ${asAdmin.body?.code}`);
      // Schritt ohne ausdruecklichen Wert (Schema-Standard false)
      const o3 = await newOrderWithWorkflow({ current: 2 });
      const def = await call('POST', skipUrl(o3, 2), staff, { reason: 'x' });
      check(def.status === 409 && def.body?.code === 'WORKFLOW_STEP_NOT_SKIPPABLE', 'Vorlagenschritt ohne Angabe (Standard aus) -> 409', `${def.status} ${def.body?.code}`);
    });

    await section('[B] canSkip=true -> 200, naechster Schritt, Verlauf', async () => {
      const o = await newOrderWithWorkflow({ current: 1 });
      const res = await call('POST', skipUrl(o, 1), staff, { reason: 'Gerät war sauber' });
      const after = await stored(o.id);
      check(res.status === 200, 'Schritt mit „Überspringen erlaubt“ -> 200', `${res.status} ${res.body?.error || ''}`);
      check(after.workflows[0].steps[1].status === 'skipped' && after.workflows[0].steps[2].status === 'in-progress' && after.workflows[0].currentStepIndex === 2,
        'DB: Schritt uebersprungen, naechster Schritt laeuft', after.workflows[0].steps.map((s) => s.status).join(','));
      const entries = skippedHistory(after);
      check(entries.length === 1 && JSON.stringify(entries[0]).includes('Gerät war sauber'), 'genau ein Verlaufseintrag mit Grund', entries.length);
      const again = await call('POST', skipUrl(o, 1), staff, { reason: 'nochmal' });
      check(again.status === 409 && again.body?.code === 'WORKFLOW_STEP_ALREADY_DONE', 'erneut ueberspringen -> 409 WORKFLOW_STEP_ALREADY_DONE', `${again.status} ${again.body?.code}`);
    });

    await section('[C] ohne Vorlagenschritt -> 409', async () => {
      const missingTemplate = await newOrderWithWorkflow({ templateId: new mongoose.Types.ObjectId() });
      const res1 = await call('POST', skipUrl(missingTemplate, 0), staff, { reason: 'x' });
      check(res1.status === 409 && res1.body?.code === 'WORKFLOW_STEP_NOT_SKIPPABLE', 'Vorlage geloescht -> 409', `${res1.status} ${res1.body?.code}`);
      const foreignStep = await newOrderWithWorkflow({ stepIds: ['unbekannt', tplSkippable, tplDefault] });
      const res2 = await call('POST', skipUrl(foreignStep, 0), staff, { reason: 'x' });
      check(res2.status === 409 && res2.body?.code === 'WORKFLOW_STEP_NOT_SKIPPABLE', 'Schritt nicht in der Vorlage -> 409', `${res2.status} ${res2.body?.code}`);
      const after = await stored(foreignStep.id);
      check(after.workflows[0].steps[0].status === 'in-progress', 'DB unveraendert', after.workflows[0].steps[0].status);
    });

    await section('[D] Oberflaechen-Quelle (GET …/workflows) = Serverregel', async () => {
      const o = await newOrderWithWorkflow();
      const res = await call('GET', `/api/admin/orders/${o.id}/workflows`, staff);
      const steps = res.body?.workflows?.[0]?.steps || [];
      check(res.status === 200 && steps.length === 3 && steps[0].canSkip === false && steps[1].canSkip === true && steps[2].canSkip === false,
        'canSkip im Lese-Endpunkt: false/true/false wie durchgesetzt', `${res.status} ${steps.map((s) => s.canSkip).join(',')}`);
    });

    await section('[E] Rollen', async () => {
      const o = await newOrderWithWorkflow({ current: 1 });
      const res = await call('POST', skipUrl(o, 1), customer, { reason: 'x' });
      const after = await stored(o.id);
      check(res.status === 403 && after.workflows[0].steps[1].status === 'in-progress', 'Kunde -> 403, DB unveraendert', `${res.status} ${after.workflows[0].steps[1].status}`);
    });
  } finally {
    server.close();
    await mongoose.connection.dropDatabase().catch(() => {});
    await mongoose.disconnect();
    fs.rmSync(LOG_REDIRECT_DIR, { recursive: true, force: true });
  }

  out(`\nErgebnis: ${pass} bestanden, ${fail} fehlgeschlagen`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((error) => {
  out(`FATAL ${error && error.stack ? error.stack : error}`);
  process.exit(1);
});
