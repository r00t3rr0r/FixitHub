/**
 * T17 / P1-WORKFLOW - Regressionstest Reparatur-Workflow und "Warten auf Kundenrückmeldung".
 *
 * Abgesichert wird:
 *  [A] Zugriff: Der Reparatur-Workflow (interne Notizen, Zwischenfälle, Pausen) ist nur für
 *      Admin/Staff lesbar und nur von ihnen änderbar. Ein Kunde bekam bisher alles (nur requireUser).
 *  [B] Zustandswechsel nur durch ausdrückliche Aktionen: erneutes "Freigeben" setzt einen laufenden
 *      Workflow nicht mehr zurück, ein abgeschlossener Workflow lässt sich nicht pausieren, Lesen
 *      (GET) ändert nichts. Fehlermeldungen sind deutsch und haben passende Statuscodes.
 *  [C] "Warten auf Kundenrückmeldung" wird nur aus Ereignissen abgeleitet, die wirklich eine
 *      Antwort des Kunden anfordern (offene Feedback-Anfrage, angeforderte Entsperrinformation,
 *      offenes Reparaturangebot, zugestellte Rückfrage aus dem Workflow) - nie aus normalen
 *      Nachrichten - und endet mit der Kundenantwort oder einer autorisierten Erledigung.
 *  [D] Vorschlagslogik: ein Smartphone-Auftrag, dessen Gerätetyp klein geschrieben gespeichert ist,
 *      trifft die Smartphone-Vorlage; der allgemeine Workflow kommt nicht als Rückfall zurück.
 *  [E] Gleichzeitige Klicks: Freigeben, Pausieren und Fortsetzen sind atomar - von zwei parallelen
 *      Anfragen wirkt genau eine, die andere bekommt 409 (keine doppelte Mail, keine doppelte Pause).
 *  [F] Ein Zwischenfall auf einem pausierten Workflow überschreibt Grund und Person der laufenden
 *      Pause nicht: die Pause wird mit ihrem Grund abgeschlossen, der Zwischenfall beginnt nahtlos.
 *
 * Der Test schreibt keine Logdateien ins Repository (Datei-Logging der Server-Logger ist abgeschaltet).
 *
 * Aufruf (benötigt eine WEGWERF-Datenbank, niemals die Entwicklungs-DB):
 *   TEST_MONGODB_URI=mongodb://127.0.0.1:27099/t17 node test-repair-workflow-feedback.js
 */
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const SERVER_DIR = path.join(__dirname, 'server');
const mongoose = require(path.join(SERVER_DIR, 'node_modules/mongoose'));
const express = require(path.join(SERVER_DIR, 'node_modules/express'));
const jwt = require(path.join(SERVER_DIR, 'node_modules/jsonwebtoken'));

const URI = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27099/t17_repair_workflow';

// Sicherheitsnetz: Dieser Test ruft dropDatabase() auf. Er darf ausschliesslich gegen eine
// ausdruecklich angegebene Wegwerf-Datenbank laufen - nie gegen die Entwicklungsdatenbank.
// Erlaubt ist nur: lokaler Host, AUSDRUECKLICH angegebener Port ungleich 27017, und ein
// Datenbankname, der nicht der Name der Entwicklungsdatenbank aus .env ist.
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

const isGerman = (text) => typeof text === 'string'
  && text.length > 0
  && !/\b(not found|already|denied|failed|is not|Repair workflow)\b/i.test(text);

async function main() {
  if (isUnsafeTestUri(URI)) {
    throw new Error('Dieser Test darf nicht gegen die Entwicklungsdatenbank laufen.');
  }

  process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');

  // Keine Logdateien im Arbeitsverzeichnis (server/logs/EmailService-*.log usw.): Datei-Logging
  // aller Server-Logger und die JSON-Zustellprotokolle abschalten, BEVOR ein Dienst geladen wird.
  const Logger = require(path.join(SERVER_DIR, 'utils/logger'));
  Logger.prototype.writeFile = () => undefined;
  const { EmailDeliveryTracker } = require(path.join(SERVER_DIR, 'utils/emailLogger'));
  EmailDeliveryTracker.prototype.saveLogFile = () => undefined;

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

  // MOCKS: keine echten E-Mails / Benachrichtigungen. sendTriggerEmail bleibt fuer
  // unbekannte Trigger ECHT (liefert success:false, bevor ein Transport angefasst wird);
  // nur wo ausdruecklich angegeben, wird eine erfolgreiche Zustellung simuliert.
  const EmailService = require(path.join(SERVER_DIR, 'services/emailService'));
  const realSendTriggerEmail = EmailService.sendTriggerEmail.bind(EmailService);
  let simulateDelivery = false;
  const sentTriggers = [];
  EmailService.sendTriggerEmail = async (trigger, to, vars, options) => {
    sentTriggers.push(trigger);
    if (simulateDelivery) return { success: true, mocked: true };
    if (EmailService.TRIGGER_TEMPLATE_MAP[trigger]) {
      return { success: false, mocked: true, error: 'Im Test nicht zugestellt' };
    }
    return realSendTriggerEmail(trigger, to, vars, options);
  };
  EmailService.buildSystemUrl = async (p) => `http://test.invalid${p}`;
  const NotificationService = require(path.join(SERVER_DIR, 'services/notificationService'));
  // Workflow-Kundenbenachrichtigungen laufen seit Welle 2 (NOTIF-5) ueber NotificationService
  // (In-App + E-Mail, returnResult). Nur mit simulateDelivery gelten sie als zugestellt.
  const createdNotifications = [];
  NotificationService.createNotification = async (data, options = {}) => {
    createdNotifications.push(data);
    const doc = { _id: new mongoose.Types.ObjectId(), ...data };
    if (!options.returnResult) return doc;
    return simulateDelivery
      ? { notification: doc, inApp: true, emailDelivery: { status: 'sent' }, deduplicated: false }
      : { notification: null, inApp: false, emailDelivery: { status: 'failed', error: 'Im Test nicht zugestellt' }, deduplicated: false };
  };
  const InspectionCommunicationService = require(path.join(SERVER_DIR, 'services/inspectionCommunicationService'));
  InspectionCommunicationService.notifyMessageRecipients = async () => undefined;

  const repairWorkflowRoutes = require(path.join(SERVER_DIR, 'routes/repairWorkflowRoutes'));
  const WorkflowService = require(path.join(SERVER_DIR, 'services/workflowService'));

  const app = express();
  app.use(express.json());
  app.use('/api/repair-workflows', repairWorkflowRoutes);
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const User = mongoose.model('User');
  const Order = mongoose.model('Order');
  const RepairWorkflow = mongoose.model('RepairWorkflow');
  const { WorkflowTemplate } = require(path.join(SERVER_DIR, 'models/Workflow'));

  const admin = await User.create({ name: 'Admin T17', email: 't17-admin@test.invalid', role: 'admin' });
  const staff = await User.create({ name: 'Sophie T17', email: 't17-staff@test.invalid', role: 'staff' });
  const otherStaff = await User.create({ name: 'Techniker Zwei', email: 't17-staff2@test.invalid', role: 'staff' });
  const customer = await User.create({ name: 'Kunde T17', email: 't17-kunde@test.invalid', role: 'customer' });

  const tokenFor = (user) => jwt.sign({ sub: String(user._id) }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '10m' });
  const call = async (method, url, user, body) => {
    const response = await fetch(`${baseUrl}${url}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenFor(user)}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    let json = null;
    try {
      json = await response.json();
    } catch (error) {
      json = null;
    }
    return { status: response.status, body: json };
  };

  let orderCounter = 0;
  const makeOrder = async (extra = {}) => {
    orderCounter += 1;
    return Order.create({
      customerId: customer._id,
      orderNumber: `ORD-T17-${String(orderCounter).padStart(3, '0')}`,
      deviceBrand: 'Apple',
      deviceModel: 'iPhone 15',
      deviceType: 'Smartphone',
      errorDescription: 'Display defekt',
      totalCost: 100,
      status: 'in-progress',
      ...extra,
    });
  };

  const awaiting = async (user, orderIds) => {
    const query = orderIds ? `?orderIds=${orderIds.map(String).join(',')}` : '';
    return call('GET', `/api/repair-workflows/admin/awaiting-customer-feedback${query}`, user);
  };
  const awaitingIds = (response) => new Set(
    (response.body?.orders || []).map((entry) => String(entry.orderId))
  );

  try {
    // ------------------------------------------------------------------ [A]
    console.log('\n[A] Zugriff auf den Reparatur-Workflow');
    const orderA = await makeOrder();
    const init = await call('POST', `/api/repair-workflows/${orderA._id}/init`, staff, { customerId: String(customer._id) });
    check(init.status === 200 && init.body?.workflow?.status === 'pending-confirmation', 'Staff legt Workflow an', `${init.status} ${init.body?.workflow?.status}`);
    const approve = await call('POST', `/api/repair-workflows/${orderA._id}/approve`, staff, {
      internalNotes: 'Interne Notiz: Kunde wirkt ungeduldig',
      notifyCustomer: false,
    });
    check(approve.status === 200 && approve.body?.workflow?.status === 'in-progress', 'Staff gibt frei und startet', `${approve.status} ${approve.body?.workflow?.status}`);

    const customerRead = await call('GET', `/api/repair-workflows/${orderA._id}`, customer);
    check(customerRead.status === 403, 'Kunde darf den Workflow NICHT lesen (interne Notizen)', `${customerRead.status} notes=${customerRead.body?.workflow?.approvalData?.internalNotes || '-'}`);
    const customerPause = await call('POST', `/api/repair-workflows/${orderA._id}/pause`, customer, { pauseReason: 'Kunde' });
    check(customerPause.status === 403, 'Kunde darf NICHT pausieren', customerPause.status);
    const customerComplete = await call('POST', `/api/repair-workflows/${orderA._id}/complete`, customer);
    check(customerComplete.status === 403, 'Kunde darf NICHT abschliessen', customerComplete.status);
    const afterCustomer = await RepairWorkflow.findOne({ orderId: orderA._id }).lean();
    check(afterCustomer.status === 'in-progress', 'Kundenaufrufe haben den Zustand nicht veraendert', afterCustomer.status);

    const otherStaffRead = await call('GET', `/api/repair-workflows/${orderA._id}`, otherStaff);
    const wf = otherStaffRead.body?.workflow || {};
    check(otherStaffRead.status === 200
      && wf.approvalData?.internalNotes === 'Interne Notiz: Kunde wirkt ungeduldig'
      && Array.isArray(wf.incidents) && Array.isArray(wf.timerData?.pauseHistory),
    'Anderer Staff sieht den VOLLEN Workflow lesend (Notizen, Zwischenfaelle, Pausen)', `${otherStaffRead.status} notes=${wf.approvalData?.internalNotes}`);
    const adminRead = await call('GET', `/api/repair-workflows/${orderA._id}`, admin);
    check(adminRead.status === 200 && adminRead.body?.workflow?.status === 'in-progress', 'Admin sieht den Workflow', adminRead.status);

    // ------------------------------------------------------------------ [B]
    console.log('\n[B] Nur ausdrueckliche Aktionen aendern den Zustand');
    const before = await RepairWorkflow.findOne({ orderId: orderA._id }).lean();
    await call('GET', `/api/repair-workflows/${orderA._id}`, staff);
    await call('GET', `/api/repair-workflows/${orderA._id}`, staff);
    const afterReads = await RepairWorkflow.findOne({ orderId: orderA._id }).lean();
    check(afterReads.status === 'in-progress'
      && String(afterReads.lastStatusChangeAt) === String(before.lastStatusChangeAt)
      && (afterReads.timerData.pauseHistory || []).length === 0,
    'Wiederholtes Oeffnen/Lesen pausiert nicht und aendert nichts', `${afterReads.status} pauses=${(afterReads.timerData.pauseHistory || []).length}`);

    const reApprove = await call('POST', `/api/repair-workflows/${orderA._id}/approve`, staff, { internalNotes: 'neu', notifyCustomer: false });
    const afterReApprove = await RepairWorkflow.findOne({ orderId: orderA._id }).lean();
    check(reApprove.status === 409 && isGerman(reApprove.body?.message), 'Erneutes Freigeben eines laufenden Workflows wird abgelehnt (409, deutsch)', `${reApprove.status} ${reApprove.body?.message}`);
    check(String(afterReApprove.timerData.startedAt) === String(before.timerData.startedAt)
      && afterReApprove.approvalData.internalNotes === 'Interne Notiz: Kunde wirkt ungeduldig',
    'Startzeit und Notizen bleiben erhalten', `${afterReApprove.timerData.startedAt} / ${afterReApprove.approvalData.internalNotes}`);

    const pause1 = await call('POST', `/api/repair-workflows/${orderA._id}/pause`, staff, { pauseReason: 'Mittagspause' });
    check(pause1.status === 200 && pause1.body?.workflow?.status === 'paused', 'Ausdrueckliches Pausieren wirkt', pause1.body?.workflow?.status);
    const pause2 = await call('POST', `/api/repair-workflows/${orderA._id}/pause`, staff, { pauseReason: 'nochmal' });
    check(pause2.status === 409 && isGerman(pause2.body?.message), 'Doppeltes Pausieren: 409 mit deutscher Meldung', `${pause2.status} ${pause2.body?.message}`);
    const pausedRead = await call('GET', `/api/repair-workflows/${orderA._id}`, otherStaff);
    check(pausedRead.status === 200 && pausedRead.body?.workflow?.status === 'paused', 'Pausierter Workflow ist direkt lesbar (kein Fortsetzen noetig)', pausedRead.body?.workflow?.status);
    const resume = await call('POST', `/api/repair-workflows/${orderA._id}/resume`, staff);
    check(resume.status === 200 && resume.body?.workflow?.status === 'in-progress', 'Fortsetzen wirkt', resume.body?.workflow?.status);
    const complete = await call('POST', `/api/repair-workflows/${orderA._id}/complete`, staff);
    check(complete.status === 200 && complete.body?.workflow?.status === 'completed', 'Abschliessen wirkt', complete.body?.workflow?.status);
    const pauseCompleted = await call('POST', `/api/repair-workflows/${orderA._id}/pause`, staff, { pauseReason: 'x' });
    const afterPauseCompleted = await RepairWorkflow.findOne({ orderId: orderA._id }).lean();
    check(pauseCompleted.status === 409 && afterPauseCompleted.status === 'completed', 'Abgeschlossener Workflow laesst sich nicht pausieren', `${pauseCompleted.status} ${afterPauseCompleted.status}`);
    const missingPause = await call('POST', `/api/repair-workflows/${new mongoose.Types.ObjectId()}/pause`, staff, { pauseReason: 'x' });
    check(missingPause.status === 404 && isGerman(missingPause.body?.message), 'Unbekannter Workflow: 404 mit deutscher Meldung', `${missingPause.status} ${missingPause.body?.message}`);

    // ------------------------------------------------------------------ [C]
    console.log('\n[C] Warten auf Kundenrueckmeldung');
    const customerAwaiting = await awaiting(customer);
    check(customerAwaiting.status === 403, 'Kunde darf die Liste nicht abfragen', customerAwaiting.status);

    // C1: normale Nachrichten sind KEIN Warten
    const orderPlain = await makeOrder();
    await InspectionCommunicationService.sendMessage(orderPlain._id, staff._id, staff.name, 'Ihr Geraet ist angekommen.', 'staff', 'staff');
    await InspectionCommunicationService.sendMessage(orderPlain._id, staff._id, staff.name, 'Koennen Sie uns kurz zurueckrufen?', 'staff', 'staff');

    // C2: Feedback-Anfrage (echte Rueckfrage) -> wartet, bis der Kunde antwortet
    const orderFeedback = await makeOrder();
    const feedbackThread = await InspectionCommunicationService.sendFeedbackRequest(
      orderFeedback._id, null, staff._id, staff.name, 'Duerfen wir das Display tauschen?',
      [{ label: 'Ja', value: 'yes' }, { label: 'Nein', value: 'no' }], 'staff'
    );
    const feedbackMessage = feedbackThread.messages.find((message) => message.messageType === 'feedback_request');

    // C3: Entsperrinformation angefordert -> wartet, bis sie kommt oder Staff erledigt
    const orderUnlock = await makeOrder();
    const unlockThread = await InspectionCommunicationService.createQuickAction(
      orderUnlock._id, null, staff._id, staff.name, 'update_unlock_info', 'Code falsch', null, 'staff'
    );
    const unlockMessage = unlockThread.messages.find((message) => message.messageType === 'quick_action');
    // interne Schnellaktion (fordert nichts vom Kunden an) -> kein Warten
    const orderInternalAction = await makeOrder();
    await InspectionCommunicationService.createQuickAction(
      orderInternalAction._id, null, staff._id, staff.name, 'part_replacement', 'Teil bestellt', null, 'staff'
    );

    // C4: Reparaturangebot wartet auf Entscheidung
    const orderOffer = await makeOrder();
    const complaintId = new mongoose.Types.ObjectId();
    await InspectionCommunicationService.sendRepairOfferMessage(orderOffer._id, staff._id, staff.name, {
      complaintId, offerAmount: 39.9, offerDescription: 'Kulanzreparatur',
    });

    // C5: Rueckfrage aus dem Reparatur-Workflow - nur wenn sie den Kunden wirklich erreicht hat
    const orderIncidentUndelivered = await makeOrder();
    await call('POST', `/api/repair-workflows/${orderIncidentUndelivered._id}/init`, staff, {});
    await call('POST', `/api/repair-workflows/${orderIncidentUndelivered._id}/approve`, staff, { notifyCustomer: false });
    simulateDelivery = false;
    const undelivered = await call('POST', `/api/repair-workflows/${orderIncidentUndelivered._id}/incidents`, staff, {
      incidentType: 'customer_info', reason: 'Welche PIN?', additionalData: { notifyCustomer: true },
    });
    check(undelivered.status === 200, 'Rueckfrage (nicht zugestellt) gemeldet', undelivered.status);
    const undeliveredStored = await RepairWorkflow.findOne({ orderId: orderIncidentUndelivered._id }).lean();
    check(!undeliveredStored.incidents[0].emailSentAt, 'Nicht zugestellte Mail wird NICHT als versendet gespeichert', String(undeliveredStored.incidents[0].emailSentAt));

    const orderIncident = await makeOrder();
    await call('POST', `/api/repair-workflows/${orderIncident._id}/init`, staff, {});
    await call('POST', `/api/repair-workflows/${orderIncident._id}/approve`, staff, { notifyCustomer: false });
    simulateDelivery = true;
    const delivered = await call('POST', `/api/repair-workflows/${orderIncident._id}/incidents`, staff, {
      incidentType: 'customer_info', reason: 'Welche PIN?', additionalData: { notifyCustomer: true },
    });
    simulateDelivery = false;
    const deliveredStored = await RepairWorkflow.findOne({ orderId: orderIncident._id }).lean();
    check(delivered.status === 200 && Boolean(deliveredStored.incidents[0].emailSentAt), 'Zugestellte Rueckfrage speichert emailSentAt', String(deliveredStored.incidents[0].emailSentAt));

    const orderIncidentResolve = await makeOrder();
    await call('POST', `/api/repair-workflows/${orderIncidentResolve._id}/init`, staff, {});
    await call('POST', `/api/repair-workflows/${orderIncidentResolve._id}/approve`, staff, { notifyCustomer: false });
    simulateDelivery = true;
    await call('POST', `/api/repair-workflows/${orderIncidentResolve._id}/incidents`, staff, {
      incidentType: 'customer_info', reason: 'Farbe?', additionalData: { notifyCustomer: true },
    });
    simulateDelivery = false;

    const allIds = [orderPlain, orderFeedback, orderUnlock, orderInternalAction, orderOffer,
      orderIncidentUndelivered, orderIncident, orderIncidentResolve].map((order) => order._id);
    const firstRun = await awaiting(staff, allIds);
    const set1 = awaitingIds(firstRun);
    check(firstRun.status === 200, 'Staff darf die Liste abfragen', firstRun.status);
    check(!set1.has(String(orderPlain._id)), 'Normale Nachrichten zaehlen NICHT als Warten', [...set1].length);
    check(set1.has(String(orderFeedback._id)), 'Offene Feedback-Anfrage -> wartet', set1.has(String(orderFeedback._id)));
    check(set1.has(String(orderUnlock._id)), 'Angeforderte Entsperrinformation -> wartet', set1.has(String(orderUnlock._id)));
    check(!set1.has(String(orderInternalAction._id)), 'Interne Schnellaktion -> wartet NICHT', set1.has(String(orderInternalAction._id)));
    check(set1.has(String(orderOffer._id)), 'Offenes Reparaturangebot -> wartet', set1.has(String(orderOffer._id)));
    check(!set1.has(String(orderIncidentUndelivered._id)), 'Nicht zugestellte Workflow-Rueckfrage -> wartet NICHT', set1.has(String(orderIncidentUndelivered._id)));
    check(set1.has(String(orderIncident._id)), 'Zugestellte Workflow-Rueckfrage -> wartet', set1.has(String(orderIncident._id)));
    const feedbackEntry = (firstRun.body?.orders || []).find((entry) => String(entry.orderId) === String(orderFeedback._id));
    check(feedbackEntry && Array.isArray(feedbackEntry.reasons) && feedbackEntry.reasons.every((reason) => isGerman(reason.label)),
      'Gruende tragen deutsche Bezeichnungen', JSON.stringify(feedbackEntry?.reasons?.map((reason) => reason.label)));

    // Aufloesung durch den Kunden bzw. autorisiert
    await InspectionCommunicationService.respondToFeedback(orderFeedback._id, String(feedbackMessage._id), { label: 'Ja', value: 'yes' }, customer._id, customer.name);
    await InspectionCommunicationService.completeQuickAction(orderUnlock._id, String(unlockMessage._id));
    await InspectionCommunicationService.updateRepairOfferStatus(orderOffer._id, complaintId, 'accepted');
    await new Promise((resolve) => setTimeout(resolve, 5));
    await InspectionCommunicationService.sendMessage(orderIncident._id, customer._id, customer.name, 'Die PIN ist 1234.', 'customer', 'customer');
    const resolveIncidentId = (await RepairWorkflow.findOne({ orderId: orderIncidentResolve._id }).lean()).incidents[0]._id;
    const customerResolve = await call('POST', `/api/repair-workflows/${orderIncidentResolve._id}/incidents/${resolveIncidentId}/resolve`, customer, {});
    check(customerResolve.status === 403, 'Kunde darf Rueckfrage nicht als erledigt markieren', customerResolve.status);
    const staffResolve = await call('POST', `/api/repair-workflows/${orderIncidentResolve._id}/incidents/${resolveIncidentId}/resolve`, staff, { note: 'Telefonisch geklaert' });
    check(staffResolve.status === 200, 'Staff markiert Rueckfrage als erledigt', `${staffResolve.status} ${staffResolve.body?.message || ''}`);
    const resolvedStored = await RepairWorkflow.findOne({ orderId: orderIncidentResolve._id }).lean();
    check(resolvedStored.incidents[0].status === 'resolved' && resolvedStored.incidents[0].resolvedByTechnicianName === staff.name,
      'Erledigung wird mit Person gespeichert', `${resolvedStored.incidents[0].status} ${resolvedStored.incidents[0].resolvedByTechnicianName}`);

    const secondRun = await awaiting(staff, allIds);
    const set2 = awaitingIds(secondRun);
    check(!set2.has(String(orderFeedback._id)), 'Kundenantwort auf Feedback beendet das Warten', set2.has(String(orderFeedback._id)));
    check(!set2.has(String(orderUnlock._id)), 'Autorisierte Erledigung der Schnellaktion beendet das Warten', set2.has(String(orderUnlock._id)));
    check(!set2.has(String(orderOffer._id)), 'Entscheidung zum Angebot beendet das Warten', set2.has(String(orderOffer._id)));
    check(!set2.has(String(orderIncident._id)), 'Kundennachricht nach der Rueckfrage beendet das Warten', set2.has(String(orderIncident._id)));
    check(!set2.has(String(orderIncidentResolve._id)), 'Autorisierte Erledigung der Rueckfrage beendet das Warten', set2.has(String(orderIncidentResolve._id)));
    check(set2.size === 0, 'Danach wartet kein Auftrag mehr', set2.size);

    // Kennzeichnung im Dialog (RepairWorkflowProcessDialog): "Wartet auf Kundenrückmeldung" je
    // Zwischenfall kommt aus DIESER Ableitung (Grund workflow_customer_info, sourceId = Zwischenfall-ID).
    // Die fruehere Client-Regel (customer_info && nicht erledigt && emailSentAt) zeigte nach der
    // Kundenantwort weiter "wartet" und widersprach damit der Auftragsliste.
    const incidentReasonIds = (response, orderId) => new Set((((response.body?.orders || [])
      .find((entry) => String(entry.orderId) === String(orderId)) || {}).reasons || [])
      .filter((reason) => reason.type === 'workflow_customer_info' && reason.sourceId)
      .map((reason) => String(reason.sourceId)));
    const repliedIncident = (await RepairWorkflow.findOne({ orderId: orderIncident._id }).lean()).incidents[0];
    const previousDialogRule = (incident) => incident.type === 'customer_info' && incident.status !== 'resolved' && Boolean(incident.emailSentAt);
    check(incidentReasonIds(firstRun, orderIncident._id).has(String(repliedIncident._id)),
      'Dialog: offener Grund traegt die Zwischenfall-ID (Kennzeichnung je Zwischenfall moeglich)', JSON.stringify([...incidentReasonIds(firstRun, orderIncident._id)]));
    check(!incidentReasonIds(secondRun, orderIncident._id).has(String(repliedIncident._id)),
      'Dialog: nach der Kundenantwort keine Kennzeichnung mehr (wie in der Liste)',
      `Server: ${incidentReasonIds(secondRun, orderIncident._id).has(String(repliedIncident._id))}, fruehere Client-Regel: ${previousDialogRule(repliedIncident)}`);

    const unscoped = await awaiting(admin);
    check(unscoped.status === 200 && Array.isArray(unscoped.body?.orders), 'Admin ohne Auftragsfilter bekommt die Liste', unscoped.status);

    // ------------------------------------------------------------------ [D]
    console.log('\n[D] Vorschlagslogik: allgemeiner Workflow nur als Rueckfall');
    await WorkflowTemplate.create({
      name: 'Standard Repair Process', description: 'Allgemein', deviceTypes: [], serviceTypes: [], isActive: true, steps: [],
    });
    await WorkflowTemplate.create({
      name: 'Smartphone Displaytausch', description: 'Spezifisch', deviceTypes: ['Smartphone'], serviceTypes: [], isActive: true, steps: [],
    });
    const lower = await WorkflowService.getSuggestedWorkflows({ deviceType: 'smartphone', serviceCategories: [], serviceIds: [] });
    const lowerNames = lower.map((template) => template.name);
    check(lowerNames.includes('Smartphone Displaytausch') && !lowerNames.includes('Standard Repair Process'),
      'Geraetetyp "smartphone" trifft die Smartphone-Vorlage, kein allgemeiner Rueckfall', JSON.stringify(lowerNames));
    const exact = await WorkflowService.getSuggestedWorkflows({ deviceType: 'Smartphone', serviceCategories: [], serviceIds: [] });
    check(exact.map((template) => template.name).join() === 'Smartphone Displaytausch', 'Exakter Typ unveraendert', JSON.stringify(exact.map((template) => template.name)));
    const laptop = await WorkflowService.getSuggestedWorkflows({ deviceType: 'Laptop', serviceCategories: [], serviceIds: [] });
    check(laptop.map((template) => template.name).join() === 'Standard Repair Process', 'Ohne passende Vorlage bleibt der allgemeine Workflow als Rueckfall (ohne widersprechende Smartphone-Vorlage)', JSON.stringify(laptop.map((template) => template.name)));
    await WorkflowTemplate.deleteOne({ name: 'Standard Repair Process' });
    const laptopNoCatchAll = await WorkflowService.getSuggestedWorkflows({ deviceType: 'Laptop', serviceCategories: [], serviceIds: [] });
    check(laptopNoCatchAll.length > 0, 'Ohne allgemeine Vorlage bleibt der Zuweisungsdialog nicht leer', JSON.stringify(laptopNoCatchAll.map((template) => template.name)));

    // ------------------------------------------------------------------ [E]
    console.log('\n[E] Parallele Klicks wirken genau einmal');
    // Sperre vor dem Speichern: beide Anfragen haben gelesen, bevor eine speichert - genau das
    // Zeitfenster eines Doppelklicks. Ohne atomaren Zustandswechsel wirken dann beide.
    const withParallelSaves = async (run) => {
      const originalSave = RepairWorkflow.prototype.save;
      let waiting = [];
      const release = () => waiting.splice(0).forEach((resolve) => resolve());
      RepairWorkflow.prototype.save = function patchedSave(...args) {
        const doc = this;
        return new Promise((resolve) => {
          waiting.push(resolve);
          if (waiting.length >= 2) release();
          else setTimeout(release, 400);
        }).then(() => originalSave.apply(doc, args));
      };
      try {
        return await run();
      } finally {
        RepairWorkflow.prototype.save = originalSave;
      }
    };
    const statuses = (responses) => responses.map((response) => response.status).sort().join(',');

    const orderRace = await makeOrder();
    await call('POST', `/api/repair-workflows/${orderRace._id}/init`, staff, {});
    simulateDelivery = true;
    sentTriggers.length = 0;
    createdNotifications.length = 0;
    const approves = await withParallelSaves(() => Promise.all([
      call('POST', `/api/repair-workflows/${orderRace._id}/approve`, staff, { internalNotes: 'Erste Freigabe', notifyCustomer: true }),
      call('POST', `/api/repair-workflows/${orderRace._id}/approve`, otherStaff, { internalNotes: 'Zweite Freigabe', notifyCustomer: true }),
    ]));
    const startedMails = createdNotifications.filter((data) => data?.metadata?.event === 'repair_workflow_started').length;
    check(statuses(approves) === '200,409', 'Doppelte Freigabe: genau eine wirkt, die andere 409', statuses(approves));
    check(startedMails === 1, 'Doppelte Freigabe: Start-Mail genau einmal', startedMails);
    const conflict = approves.find((response) => response.status === 409);
    check(conflict && isGerman(conflict.body?.message), 'Konfliktmeldung ist deutsch', conflict && conflict.body?.message);

    sentTriggers.length = 0;
    createdNotifications.length = 0;
    const pauses = await withParallelSaves(() => Promise.all([
      call('POST', `/api/repair-workflows/${orderRace._id}/pause`, staff, { pauseReason: 'Teil holen' }),
      call('POST', `/api/repair-workflows/${orderRace._id}/pause`, otherStaff, { pauseReason: 'Telefon' }),
    ]));
    // Seit Welle 2 (K04/NOTIF-5): Pausieren schickt dem Kunden NIE etwas (der Pausengrund ist intern).
    const pausedMails = sentTriggers.filter((trigger) => trigger === 'repair_workflow_paused').length
      + createdNotifications.filter((data) => String(data?.userId || '') === String(customer._id)).length;
    check(statuses(pauses) === '200,409', 'Doppeltes Pausieren: genau eines wirkt, das andere 409', statuses(pauses));
    check(pausedMails === 0, 'Doppeltes Pausieren: keine Nachricht an den Kunden (Pausengrund intern)', pausedMails);
    const pausedWinner = pauses.find((response) => response.status === 200)?.body?.workflow?.timerData || {};
    const pausedStored = (await RepairWorkflow.findOne({ orderId: orderRace._id }).lean()).timerData;
    check(pausedStored.currentPauseReason === pausedWinner.currentPauseReason,
      'Gespeicherter Pausengrund ist der der wirksamen Anfrage', `${pausedStored.currentPauseReason} / ${pausedWinner.currentPauseReason}`);

    await new Promise((resolve) => setTimeout(resolve, 5));
    const resumes = await withParallelSaves(() => Promise.all([
      call('POST', `/api/repair-workflows/${orderRace._id}/resume`, staff),
      call('POST', `/api/repair-workflows/${orderRace._id}/resume`, otherStaff),
    ]));
    const resumedStored = await RepairWorkflow.findOne({ orderId: orderRace._id }).lean();
    check(statuses(resumes) === '200,409', 'Doppeltes Fortsetzen: genau eines wirkt, das andere 409', statuses(resumes));
    check((resumedStored.timerData.pauseHistory || []).length === 1, 'Pausenverlauf ohne Doppeleintrag', (resumedStored.timerData.pauseHistory || []).length);
    check(resumedStored.timerData.totalPausedMs === resumedStored.timerData.pauseHistory[0].durationMs,
      'Pausenzeit einmal gezaehlt', `${resumedStored.timerData.totalPausedMs} / ${resumedStored.timerData.pauseHistory[0]?.durationMs}`);
    simulateDelivery = false;

    // ------------------------------------------------------------------ [F]
    console.log('\n[F] Zwischenfall auf einem pausierten Workflow');
    const orderPausedIncident = await makeOrder();
    await call('POST', `/api/repair-workflows/${orderPausedIncident._id}/init`, staff, {});
    await call('POST', `/api/repair-workflows/${orderPausedIncident._id}/approve`, staff, { notifyCustomer: false });
    await call('POST', `/api/repair-workflows/${orderPausedIncident._id}/pause`, staff, { pauseReason: 'Mittagspause' });
    const pausedAtBefore = (await RepairWorkflow.findOne({ orderId: orderPausedIncident._id }).lean()).timerData.pausedAt;
    await new Promise((resolve) => setTimeout(resolve, 20));
    const incidentOnPause = await call('POST', `/api/repair-workflows/${orderPausedIncident._id}/incidents`, otherStaff, {
      incidentType: 'spare_part_needed', reason: 'Akku fehlt', additionalData: { notifyCustomer: false },
    });
    check(incidentOnPause.status === 200 && incidentOnPause.body?.workflow?.status === 'incident', 'Zwischenfall auf Pause gemeldet', `${incidentOnPause.status} ${incidentOnPause.body?.workflow?.status}`);
    await new Promise((resolve) => setTimeout(resolve, 20));
    await call('POST', `/api/repair-workflows/${orderPausedIncident._id}/resume`, admin);
    const afterIncidentResume = await RepairWorkflow.findOne({ orderId: orderPausedIncident._id }).lean();
    const history = afterIncidentResume.timerData.pauseHistory || [];
    const manualPause = history.find((entry) => entry.reason === 'Mittagspause');
    check(Boolean(manualPause) && manualPause.pausedByTechnicianName === staff.name,
      'Pausengrund und pausierende Person bleiben erhalten', JSON.stringify(history.map((entry) => `${entry.reason}/${entry.pausedByTechnicianName}`)));
    check(Boolean(manualPause) && String(manualPause.pausedAt) === String(pausedAtBefore),
      'Die Pause beginnt weiterhin zum urspruenglichen Zeitpunkt', manualPause && manualPause.pausedAt);
    const incidentPause = history.find((entry) => /^Zwischenfall/.test(entry.reason || ''));
    check(Boolean(incidentPause) && incidentPause.pausedByTechnicianName === otherStaff.name && /Akku fehlt/.test(incidentPause.reason),
      'Zwischenfall als eigener Abschnitt mit meldender Person', incidentPause && `${incidentPause.reason}/${incidentPause.pausedByTechnicianName}`);
    const summed = history.reduce((sum, entry) => sum + (entry.durationMs || 0), 0);
    const wholePause = new Date(afterIncidentResume.timerData.resumedAt) - new Date(pausedAtBefore);
    check(summed === afterIncidentResume.timerData.totalPausedMs && summed === wholePause,
      'Keine Pausenzeit verloren oder doppelt', `${summed} / ${afterIncidentResume.timerData.totalPausedMs} / ${wholePause}`);
  } finally {
    server.close();
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }

  console.log(`\n${pass} bestanden, ${fail} fehlgeschlagen`);
  if (fail > 0) process.exitCode = 1;
}

main().catch(async (error) => {
  console.error(error);
  try {
    await mongoose.disconnect();
  } catch (disconnectError) {
    /* ignore */
  }
  process.exit(1);
});
