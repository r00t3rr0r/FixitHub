/**
 * Regressionstest (Track workflow, Runde 3, 02.10.2026) - K06:
 *   [A] Workflow-VORLAGEN: die Schalter "Bei Start/Abschluss/Verzögerung benachrichtigen"
 *       (step.notificationSettings) und Automatisierungsregeln (auch "send_notification") werden vom
 *       Server NICHT ausgewertet. Zwei Vorlagen, die sich nur in diesen Optionen unterscheiden, erzeugen
 *       beim echten Ablauf (zuweisen -> starten -> Schritte abschliessen, echte Admin-Routen) exakt dieselben
 *       Kundenbenachrichtigungen und E-Mails - die automatischen Statusmeldungen (Start, Fortschritt,
 *       Reparatur fertig). Die gespeicherten Werte bleiben unveraendert (keine Daten geloescht).
 *       => Die Oberflaeche sperrt diese Schalter (StepManagementDialog) und sagt ehrlich, was wirklich passiert.
 *   [B] Reparatur-Workflow "Kunde informieren" beim Abschluss: E-Mail-Fehler -> Abschluss gespeichert (200),
 *       Ergebnis getrennt als "failed" (In-App angekommen, E-Mail fehlgeschlagen) gemeldet; "Benachrichtigung
 *       erneut senden" sendet NUR die E-Mail (keine zweite In-App-Zeile), genau einmal - auch bei drei
 *       parallelen Klicks; danach "duplicate". Geaenderter Text -> neue Nachricht (In-App + E-Mail).
 *       AUS -> nichts verlaesst das Team. Rollen: Kunde darf nicht wiederholen (403).
 *
 * Echte Express-Routen + echte DB (Wegwerf-mongod). E-Mails gehen an den Stream-Transport und werden
 * mitgelesen; der E-Mail-Fehler wird am Transport simuliert (sendMail wirft). Keine externen Hosts.
 * Aufruf (nur WEGWERF-Datenbank):
 *   EMAIL_TEST_TRANSPORT=stream TEST_MONGODB_URI=mongodb://127.0.0.1:27099/t_r3_workflow_template node test-workflow-template-notify.js
 */
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const Module = require('module');

const ROOT = __dirname;
const SERVER_DIR = path.join(ROOT, 'server');
const LOG_DIR = path.join(SERVER_DIR, 'logs');
const URI = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27099/t_r3_workflow_template';
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
const LOG_REDIRECT_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'workflow-template-test-logs-'));
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
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
  await mongoose.model('Notification').createIndexes();
  await mongoose.model('NotificationDedupeClaim').createIndexes();

  const EmailService = require(path.join(SERVER_DIR, 'services/emailService'));
  EmailService.buildSystemUrl = async (p) => `http://test.invalid${p}`;
  EmailService.retryHandler.baseDelay = 1;
  EmailService.retryHandler.maxBackoffDelay = 5;
  const delivered = [];
  let mailFails = false;
  const realGetTransporter = EmailService.getTransporter.bind(EmailService);
  EmailService.getTransporter = async () => {
    const transporter = await realGetTransporter();
    if (!transporter.__captureWrapped) {
      const original = transporter.sendMail.bind(transporter);
      transporter.sendMail = async (options) => {
        if (mailFails) {
          const error = new Error('550 Mailbox nicht verfügbar (Testfehler)');
          error.responseCode = 550;
          throw error;
        }
        const info = await original(options);
        delivered.push(options);
        return info;
      };
      transporter.__captureWrapped = true;
    }
    return transporter;
  };
  const mailsTo = (email) => delivered.filter((mail) => String(mail.to).toLowerCase() === email.toLowerCase());

  const DHLService = require(path.join(SERVER_DIR, 'services/dhlService'));
  DHLService.getTrackingInfo = async () => { throw new Error('DHL darf in diesem Test nicht aufgerufen werden'); };
  DHLService.createShipment = async () => { throw new Error('DHL darf in diesem Test nicht aufgerufen werden'); };

  const app = express();
  app.use(express.json());
  app.use('/api/repair-workflows', require(path.join(SERVER_DIR, 'routes/repairWorkflowRoutes')));
  app.use('/api/admin/orders', require(path.join(SERVER_DIR, 'routes/adminOrderRoutes')));
  const server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const User = mongoose.model('User');
  const Order = mongoose.model('Order');
  const RepairWorkflow = mongoose.model('RepairWorkflow');
  const Notification = mongoose.model('Notification');
  const { WorkflowTemplate } = require(path.join(SERVER_DIR, 'models/Workflow'));

  const customerA = await User.create({ name: 'Vera Vorlage', firstName: 'Vera', lastName: 'Vorlage', email: 'tpl-kunde-a@test.invalid', role: 'customer' });
  const customerB = await User.create({ name: 'Bernd Vorlage', firstName: 'Bernd', lastName: 'Vorlage', email: 'tpl-kunde-b@test.invalid', role: 'customer' });
  const customer = await User.create({ name: 'Rita Retry', firstName: 'Rita', lastName: 'Retry', email: 'tpl-retry@test.invalid', role: 'customer' });
  const staff = await User.create({ name: 'Sven Technik', firstName: 'Sven', lastName: 'Technik', email: 'tpl-staff@test.invalid', role: 'staff', isActive: true });

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

  let counter = 0;
  const newOrder = async (owner, extra = {}) => {
    counter += 1;
    return Order.create({
      customerId: owner._id,
      orderNumber: `ORD-TPL-${String(counter).padStart(3, '0')}`,
      deviceBrand: 'Apple',
      deviceModel: 'iPhone 15',
      deviceType: 'Smartphone',
      errorDescription: 'Display defekt',
      totalCost: 49.9,
      status: 'diagnostic-assessment',
      ...extra,
    });
  };
  const notesOf = async (user, filter = {}) => Notification.find({ userId: user._id, ...filter }).sort({ createdAt: 1, _id: 1 }).lean();

  try {
    // ------------------------------------------------------------------ [A]
    await section('[A] Vorlagen-Optionen (Benachrichtigungsschalter, Automatisierungsregeln) wirken nicht', async () => {
      const baseStep = (order, name, extra = {}) => ({
        name, description: `${name} (Test)`, estimatedTime: 10, order, category: 'repair', ...extra,
      });
      const allOff = { notificationSettings: { onStart: false, onComplete: false, onDelay: false }, automationRules: [] };
      const allOn = {
        notificationSettings: { onStart: true, onComplete: true, onDelay: true },
        automationRules: [
          { trigger: 'step_completion', action: 'send_notification', isActive: true, actionData: { message: 'AUTOMATIK-REGEL-TEXT' } },
          { trigger: 'time_delay', action: 'send_notification', isActive: true, actionData: { message: 'AUTOMATIK-REGEL-TEXT' } },
        ],
      };
      const tplOff = await WorkflowTemplate.create({
        name: 'Vorlage AUS', description: 'Test', deviceTypes: [], serviceTypes: [],
        steps: [baseStep(1, 'Zerlegen', allOff), baseStep(2, 'Display tauschen', allOff)],
      });
      const tplOn = await WorkflowTemplate.create({
        name: 'Vorlage AN', description: 'Test', deviceTypes: [], serviceTypes: [],
        steps: [baseStep(1, 'Zerlegen', allOn), baseStep(2, 'Display tauschen', allOn)],
        globalAutomationRules: [{ trigger: 'manual', action: 'send_notification', isActive: true }],
      });
      const storedOnBefore = JSON.stringify((await WorkflowTemplate.findById(tplOn._id).lean()).steps.map((s) => [s.notificationSettings, s.automationRules]));

      const runTemplate = async (owner, template) => {
        const order = await newOrder(owner);
        const assign = await call('POST', `/api/admin/orders/${order._id}/workflows`, staff, { workflowTemplateId: String(template._id) });
        const assigned = await Order.findById(order._id).setOptions({ skipAutoPopulate: true }).lean();
        const wf = assigned.workflows[0];
        const start = await call('POST', `/api/admin/orders/${order._id}/workflows/${wf._id}/start`, staff, {});
        const statuses = [assign.status, start.status];
        for (const step of wf.steps) {
          // eslint-disable-next-line no-await-in-loop
          const done = await call('POST', `/api/admin/orders/${order._id}/workflows/${wf._id}/steps/${step._id}/complete`, staff, {});
          statuses.push(done.status);
        }
        await sleep(40);
        const notes = await notesOf(owner, { orderId: order._id });
        const finalOrder = await Order.findById(order._id).setOptions({ skipAutoPopulate: true }).lean();
        return { statuses, notes, mails: mailsTo(owner.email), finalStatus: finalOrder.status };
      };

      const off = await runTemplate(customerA, tplOff);
      const on = await runTemplate(customerB, tplOn);
      check(off.statuses.every((s) => s === 200) && on.statuses.every((s) => s === 200), 'echter Ablauf: zuweisen/starten/2 Schritte abschliessen -> 200', `${off.statuses} | ${on.statuses}`);
      check(off.finalStatus === 'ready-for-pickup' && on.finalStatus === 'ready-for-pickup', 'beide Auftraege: Reparatur abgeschlossen (ready-for-pickup)', `${off.finalStatus} ${on.finalStatus}`);
      const shape = (notes) => notes.map((n) => `${n.type}|${n.title}`).join(' ; ');
      check(off.notes.length === on.notes.length && shape(off.notes) === shape(on.notes),
        'Schalter AN vs. AUS: identische Kundenbenachrichtigungen (Server wertet notificationSettings nicht aus)', `${off.notes.length} vs ${on.notes.length}`);
      check(off.notes.length === 3, 'genau die automatischen Statusmeldungen: Start, Fortschritt, Reparatur fertig', shape(off.notes));
      check(off.mails.length === on.mails.length, 'Schalter AN vs. AUS: gleiche Anzahl E-Mails', `${off.mails.length} vs ${on.mails.length}`);
      const allText = JSON.stringify(on.notes) + on.mails.map((m) => `${m.subject}\n${m.text || ''}\n${m.html || ''}`).join('\n');
      check(!/AUTOMATIK-REGEL-TEXT/.test(allText), 'Automatisierungsregel "send_notification" verschickt nichts', 'kein Regeltext');
      const storedOnAfter = JSON.stringify((await WorkflowTemplate.findById(tplOn._id).lean()).steps.map((s) => [s.notificationSettings, s.automationRules]));
      check(storedOnAfter === storedOnBefore, 'gespeicherte Vorlagenwerte bleiben unveraendert erhalten', 'unveraendert');
    });

    // ------------------------------------------------------------------ [B]
    await section('[B] Reparatur-Workflow: Abschluss + E-Mail-Fehler -> getrennt gemeldet, Wiederholen ohne Duplikat', async () => {
      const initAndApprove = async (order) => {
        await call('POST', `/api/repair-workflows/${order._id}/init`, staff, {});
        return call('POST', `/api/repair-workflows/${order._id}/approve`, staff, { notifyCustomer: false });
      };

      // AUS: nichts verlaesst das Team
      const quiet = await newOrder(customer);
      await initAndApprove(quiet);
      const quietDone = await call('POST', `/api/repair-workflows/${quiet._id}/complete`, staff, { notifyCustomer: false });
      await sleep(30);
      check(quietDone.status === 200 && (await notesOf(customer, { orderId: quiet._id })).length === 0 && mailsTo(customer.email).length === 0,
        'Abschluss mit "Kunde informieren" AUS: keine Benachrichtigung, keine E-Mail', `${quietDone.status}`);

      // AN + E-Mail-Fehler
      const order = await newOrder(customer);
      await initAndApprove(order);
      mailFails = true;
      let done;
      try {
        done = await call('POST', `/api/repair-workflows/${order._id}/complete`, staff, { notifyCustomer: true, customerMessage: 'Ihr Gerät ist fertig repariert (Test).' });
      } finally {
        mailFails = false;
      }
      await sleep(30);
      const wfAfter = await RepairWorkflow.findOne({ orderId: order._id }).lean();
      const cn = done.body?.customerNotification || {};
      check(done.status === 200 && wfAfter.status === 'completed', 'Abschluss gespeichert (200, Workflow abgeschlossen) trotz E-Mail-Fehler', `${done.status} ${wfAfter.status}`);
      check(cn.status === 'failed' && cn.inApp === true && cn.email === 'failed' && (done.body?.warnings || []).length > 0,
        'Ergebnis getrennt gemeldet: In-App angekommen, E-Mail fehlgeschlagen, Warnung', JSON.stringify({ s: cn.status, i: cn.inApp, e: cn.email, w: (done.body?.warnings || []).length }));
      check(wfAfter.completionNotification?.status === 'failed', 'fehlgeschlagenes Ergebnis am Workflow gespeichert', wfAfter.completionNotification?.status);
      const rowsAfterFail = await notesOf(customer, { orderId: order._id });
      check(rowsAfterFail.length === 1 && mailsTo(customer.email).length === 0, 'nach Fehler: 1 In-App-Zeile, 0 zugestellte E-Mails', `${rowsAfterFail.length} ${mailsTo(customer.email).length}`);

      const customerRetry = await call('POST', `/api/repair-workflows/${order._id}/notify-customer`, customer, { target: 'completion' });
      check(customerRetry.status === 403, 'Kunde darf die Benachrichtigung nicht ausloesen (403)', customerRetry.status);

      const retry = await call('POST', `/api/repair-workflows/${order._id}/notify-customer`, staff, { target: 'completion' });
      await sleep(30);
      const rowsAfterRetry = await notesOf(customer, { orderId: order._id });
      const retryMails = mailsTo(customer.email);
      check(retry.status === 200 && retry.body?.customerNotification?.status === 'sent' && retry.body?.customerNotification?.email === 'sent',
        '"Benachrichtigung erneut senden": gesendet', `${retry.status} ${retry.body?.customerNotification?.status} ${retry.body?.customerNotification?.email}`);
      check(rowsAfterRetry.length === 1, 'Wiederholen erzeugt KEINE zweite In-App-Zeile (nur E-Mail wiederholt)', rowsAfterRetry.length);
      check(retryMails.length === 1 && /Ihr Gerät ist fertig repariert \(Test\)/.test(`${retryMails[0]?.text || ''}${retryMails[0]?.html || ''}`),
        'genau eine E-Mail mit dem urspruenglichen Kundentext', retryMails.length);
      const wfRetried = await RepairWorkflow.findOne({ orderId: order._id }).lean();
      check(wfRetried.completionNotification?.status === 'sent' && wfRetried.completionNotification?.inApp === true,
        'gespeichertes Ergebnis: sent (In-App vorhanden)', `${wfRetried.completionNotification?.status} ${wfRetried.completionNotification?.inApp}`);
      const again = await call('POST', `/api/repair-workflows/${order._id}/notify-customer`, staff, { target: 'completion' });
      check(again.body?.customerNotification?.status === 'duplicate' && mailsTo(customer.email).length === 1 && (await notesOf(customer, { orderId: order._id })).length === 1,
        'erneutes Wiederholen nach Erfolg: duplicate, nichts gesendet', again.body?.customerNotification?.status);

      // Drei parallele Klicks nach einem E-Mail-Fehler -> genau eine E-Mail, keine zweite In-App-Zeile
      const order2 = await newOrder(customer);
      await initAndApprove(order2);
      mailFails = true;
      try {
        await call('POST', `/api/repair-workflows/${order2._id}/complete`, staff, { notifyCustomer: true });
      } finally {
        mailFails = false;
      }
      const mailsBeforeParallel = mailsTo(customer.email).length;
      const parallel = await Promise.all([1, 2, 3].map(() => call('POST', `/api/repair-workflows/${order2._id}/notify-customer`, staff, { target: 'completion' })));
      await sleep(50);
      const statuses = parallel.map((r) => r.body?.customerNotification?.status).sort();
      const rows2 = await notesOf(customer, { orderId: order2._id });
      check(statuses.filter((s) => s === 'sent').length === 1 && statuses.filter((s) => s === 'duplicate').length === 2
        && mailsTo(customer.email).length - mailsBeforeParallel === 1 && rows2.length === 1,
      'paralleles Wiederholen: genau eine E-Mail, eine In-App-Zeile', `${statuses} mails=${mailsTo(customer.email).length - mailsBeforeParallel} rows=${rows2.length}`);

      // Geaenderter Text beim Wiederholen -> neue Nachricht (In-App + E-Mail mit neuem Text)
      const order3 = await newOrder(customer);
      await initAndApprove(order3);
      mailFails = true;
      try {
        await call('POST', `/api/repair-workflows/${order3._id}/complete`, staff, { notifyCustomer: true, customerMessage: 'Alter Text (Test).' });
      } finally {
        mailFails = false;
      }
      const mailsBefore3 = mailsTo(customer.email).length;
      const changed = await call('POST', `/api/repair-workflows/${order3._id}/notify-customer`, staff, { target: 'completion', customerMessage: 'Neuer Text (Test).' });
      await sleep(30);
      const rows3 = await notesOf(customer, { orderId: order3._id });
      const newMails3 = mailsTo(customer.email).slice(mailsBefore3);
      check(changed.body?.customerNotification?.status === 'sent' && rows3.length === 2 && rows3[1].message === 'Neuer Text (Test).'
        && newMails3.length === 1 && /Neuer Text \(Test\)/.test(`${newMails3[0]?.text || ''}${newMails3[0]?.html || ''}`),
      'geaenderter Text: neue Nachricht in Glocke und E-Mail', `${changed.body?.customerNotification?.status} rows=${rows3.length} mails=${newMails3.length}`);
    });
  } finally {
    server.close();
    await mongoose.connection.dropDatabase().catch(() => {});
    await mongoose.disconnect();
    try { fs.rmSync(LOG_REDIRECT_DIR, { recursive: true, force: true }); } catch (error) { /* egal */ }
  }

  console.log(`\nErgebnis: ${pass} bestanden, ${fail} fehlgeschlagen`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
