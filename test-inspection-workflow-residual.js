/**
 * P1 inspection-workflow-residual - Regressionstest fuer die Rest-Befunde der Geraeteinspektion.
 *
 * Abgesichert wird:
 *  [1] Erneuter Abschluss einer Inspektion mit UNVERAENDERTEM Kostenvoranschlag setzt eine bereits
 *      getroffene Kundenentscheidung (approved / rejected) NICHT auf "awaiting-customer" zurueck.
 *      Ein GEAENDERTER Preis braucht dagegen wieder eine Freigabe.
 *  [2] Ein Abschluss ohne Preisangabe (z. B. veralteter Client, der nur Zeitrahmen/Beschreibung
 *      sendet) loescht einen bereits bekannten Kostenvoranschlag nicht - auch nicht den
 *      ausdruecklich kostenlosen (0 EUR, costSpecified).
 *  [3] Herkunft "Gemeldetes Modell": Auf dem Geraetewechsel-Pfad von OrderService.updateDevice
 *      wird der Verlaufseintrag (completedAt) VOR dem Speichern gesetzt, der Schnappschuss
 *      Order.reportedDevice.capturedAt erst im pre('save') - wenige Millisekunden spaeter. Ein solcher
 *      Schnappschuss ist trotzdem der echte Stand vor der ersten Aenderung ('order-snapshot'), nicht
 *      'order-timeline'. Ein erst bei einem SPAETEREN Wechsel erfasster Schnappschuss bleibt
 *      weiterhin nachrangig.
 *
 * Aufruf (benoetigt eine WEGWERF-Datenbank, niemals die Entwicklungs-DB):
 *   TEST_MONGODB_URI=mongodb://127.0.0.1:27099/iwr_inspection node test-inspection-workflow-residual.js
 */
const path = require('path');
const fs = require('fs');

const SERVER_DIR = path.join(__dirname, 'server');
const mongoose = require(path.join(SERVER_DIR, 'node_modules/mongoose'));

const URI = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27099/iwr_inspection_residual';

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

async function main() {
  if (isUnsafeTestUri(URI)) {
    throw new Error('Dieser Test darf nicht gegen die Entwicklungsdatenbank laufen.');
  }

  // Keine Logdateien im Arbeitsverzeichnis: Datei-Logging der Server-Logger abschalten.
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

  const User = mongoose.model('User');
  const Order = mongoose.model('Order');
  const DeviceInspection = mongoose.model('DeviceInspection');
  const EmailService = require(path.join(SERVER_DIR, 'services/emailService'));
  const OrderService = require(path.join(SERVER_DIR, 'services/orderService'));
  const DeviceInspectionService = require(path.join(SERVER_DIR, 'services/deviceInspectionService'));

  // MOCK: keine echten E-Mails. Aufrufe werden nur gezaehlt.
  const sentEmails = [];
  EmailService.sendDiagnosisCompletedEmail = async (to, data) => {
    sentEmails.push({ to, data });
    return { success: true, mocked: true };
  };
  const flushAsync = () => new Promise((resolve) => setTimeout(resolve, 100));

  const customer = await User.create({
    name: 'Kunde Rest', email: 'iwr-kunde@test.invalid', role: 'customer', customerNumber: 'K-IWR',
  });
  const technician = await User.create({ name: 'Sophie Technik', email: 'iwr-technik@test.invalid', role: 'staff' });

  let orderCounter = 0;
  const makeOrder = async (model = 'iPhone 12') => {
    orderCounter += 1;
    return Order.create({
      customerId: customer._id,
      orderNumber: `ORD-IWR-${String(orderCounter).padStart(3, '0')}`,
      deviceBrand: 'Apple',
      deviceModel: model,
      deviceType: 'Smartphones',
      errorDescription: 'Display',
      services: [],
      totalCost: 0,
      status: 'pending',
    });
  };
  const prepareInspection = async (orderId) => {
    await DeviceInspectionService.initializeInspection(orderId, customer._id, technician._id);
    await DeviceInspectionService.updateModelVerification(orderId, 'Apple iPhone 12', 'Apple iPhone 12', 'correct', 0, '', null, {});
  };
  const rawInspection = (orderId) => mongoose.connection.db.collection('deviceinspections')
    .findOne({ orderId: new mongoose.Types.ObjectId(String(orderId)) });
  const setApproval = (orderId, approvalStatus) => mongoose.connection.db.collection('deviceinspections')
    .updateOne({ orderId: new mongoose.Types.ObjectId(String(orderId)) }, { $set: { approvalStatus } });

  try {
    // ------------------------------------------------------------------------------------------
    console.log('\n[1] Erneuter Abschluss setzt eine Kundenentscheidung nicht zurueck');
    for (const decision of ['approved', 'rejected']) {
      const order = await makeOrder();
      const id = String(order._id);
      await prepareInspection(id);
      await DeviceInspectionService.completeInspection(id, undefined, { cost: 89.9, costSpecified: true, description: 'Display' }, undefined, null);
      check((await rawInspection(id)).approvalStatus === 'awaiting-customer', `${decision}: erster Kostenvoranschlag wartet auf Freigabe`, (await rawInspection(id)).approvalStatus);
      await setApproval(id, decision);
      // Das Formular sendet beim erneuten Abschluss den bekannten Preis wieder mit (costSpecified).
      await DeviceInspectionService.completeInspection(id, undefined, { cost: 89.9, costSpecified: true, description: 'Display' }, undefined, null);
      const again = await rawInspection(id);
      check(again.approvalStatus === decision, `${decision}: gleicher Preis -> Entscheidung bleibt erhalten`, again.approvalStatus);
      // Auch "89,90" als Zeichenkette ist derselbe Preis.
      await DeviceInspectionService.completeInspection(id, undefined, { cost: '89,90', costSpecified: true }, undefined, null);
      check((await rawInspection(id)).approvalStatus === decision, `${decision}: "89,90" als Text -> Entscheidung bleibt erhalten`, (await rawInspection(id)).approvalStatus);
      // Ein NEUER Preis ist ein neuer Kostenvoranschlag.
      await DeviceInspectionService.completeInspection(id, undefined, { cost: 99.9, costSpecified: true }, undefined, null);
      const changed = await rawInspection(id);
      check(changed.approvalStatus === 'awaiting-customer' && changed.repairOffer.cost === 99.9,
        `${decision}: geaenderter Preis -> wieder "wartet auf Freigabe"`, `${changed.approvalStatus} ${changed.repairOffer.cost}`);
    }

    // Offene Freigabe bleibt offen; eine Altfreigabe zu einem Default-0 ohne Preis wird nicht aktiviert.
    const orderPending = await makeOrder();
    const idPending = String(orderPending._id);
    await prepareInspection(idPending);
    await DeviceInspectionService.completeInspection(idPending, undefined, { cost: 10, costSpecified: true }, undefined, null);
    await DeviceInspectionService.completeInspection(idPending, undefined, { cost: 10, costSpecified: true }, undefined, null);
    check((await rawInspection(idPending)).approvalStatus === 'awaiting-customer', 'Offene Freigabe bleibt offen', (await rawInspection(idPending)).approvalStatus);

    // ------------------------------------------------------------------------------------------
    console.log('\n[2] Abschluss ohne Preisangabe loescht keinen bekannten Kostenvoranschlag');
    const orderKeep = await makeOrder();
    const idKeep = String(orderKeep._id);
    await prepareInspection(idKeep);
    await DeviceInspectionService.completeInspection(idKeep, undefined, { cost: 0, costSpecified: true, description: 'Kulanz' }, undefined, null);
    await setApproval(idKeep, 'approved');
    // Client-Stand vom 15.09.2026: sendet cost 0 OHNE costSpecified (= "kein Preis") plus Zeitrahmen.
    await DeviceInspectionService.completeInspection(idKeep, true, { cost: 0, timeframe: '2 Tage', description: 'Kulanz' }, 'repairable', null);
    const kept = await rawInspection(idKeep);
    check(kept.repairOffer && kept.repairOffer.cost === 0 && kept.repairOffer.costSpecified === true,
      'Ausdruecklich kostenloser Kostenvoranschlag bleibt erhalten', JSON.stringify(kept.repairOffer));
    check(kept.repairOffer && kept.repairOffer.timeframe === '2 Tage', 'Neuer Zeitrahmen wird uebernommen', kept.repairOffer && kept.repairOffer.timeframe);
    check(kept.approvalStatus === 'approved', 'Freigabe bleibt erhalten', kept.approvalStatus);
    const keptJson = (await DeviceInspection.findOne({ orderId: orderKeep._id })).toJSON();
    check(keptJson.repairOfferKnownCost === 0, 'API: repairOfferKnownCost bleibt 0 (kostenlos)', keptJson.repairOfferKnownCost);

    // Ohne bisherigen Preis bleibt es bei "unbekannt" (Regression T16).
    const orderNone = await makeOrder();
    const idNone = String(orderNone._id);
    await prepareInspection(idNone);
    await DeviceInspectionService.completeInspection(idNone, true, { cost: 0, timeframe: '3 Tage' }, 'repairable', null);
    const none = await rawInspection(idNone);
    check(none.repairOffer && none.repairOffer.cost === undefined && none.approvalStatus === undefined,
      'Ohne bekannten Preis: weiterhin unbekannt, kein Freigabestatus', `${none.repairOffer && none.repairOffer.cost} ${none.approvalStatus}`);

    // ------------------------------------------------------------------------------------------
    console.log('\n[3] Herkunft "Gemeldetes Modell" auf dem Geraetewechsel-Pfad');
    const insertLegacyOrder = async (orderNumber, extra = {}) => {
      const { insertedId } = await mongoose.connection.db.collection('orders').insertOne({
        customerId: customer._id,
        orderNumber,
        deviceBrand: 'Apple',
        deviceModel: 'iPhone 12',
        deviceType: 'Smartphones',
        errorDescription: 'Display',
        services: [],
        totalCost: 0,
        status: 'pending',
        timeline: [],
        createdAt: new Date('2026-08-01T10:00:00Z'),
        ...extra,
      });
      return String(insertedId);
    };
    const change = (description, completedAt) => ({
      status: 'Device Changed', description, completedAt, staffId: 'system', staffName: 'Test',
    });

    // 3a: deterministisch - genau die Reihenfolge von OrderService.updateDevice (Verlauf zuerst,
    // Schnappschuss 3 ms spaeter im pre('save')).
    const changeAt = new Date('2026-09-20T10:00:00.000Z');
    const id3a = await insertLegacyOrder('ORD-IWR-LEG-3A', {
      deviceModel: 'iPhone 13',
      reportedDevice: { brand: 'Apple', model: 'iPhone 12', deviceType: 'Smartphones', capturedAt: new Date(changeAt.getTime() + 3) },
      timeline: [change('Device changed from Apple iPhone 12 to Apple iPhone 13', changeAt)],
    });
    const insp3a = await DeviceInspectionService.initializeInspection(id3a, customer._id, technician._id);
    check(insp3a.modelVerification.reportedModel === 'Apple iPhone 12', '3a: Gemeldet = urspruengliches Geraet', insp3a.modelVerification.reportedModel);
    check(insp3a.modelVerification.reportedModelSource === 'order-snapshot', '3a: Schnappschuss 3 ms nach dem Verlaufseintrag gilt als Schnappschuss', insp3a.modelVerification.reportedModelSource);

    // 3b: echter Pfad OrderService.updateDevice auf einem Altauftrag ohne Schnappschuss.
    const id3b = await insertLegacyOrder('ORD-IWR-LEG-3B');
    await OrderService.updateDevice(id3b, { deviceBrand: 'Apple', deviceModel: 'iPhone 13' }, String(technician._id), technician.name);
    const order3b = await Order.findById(id3b).lean();
    const change3b = order3b.timeline.find((entry) => entry.status === 'Device Changed');
    const gap3b = new Date(order3b.reportedDevice.capturedAt).getTime() - new Date(change3b.completedAt).getTime();
    const insp3b = await DeviceInspectionService.initializeInspection(id3b, customer._id, technician._id);
    check(insp3b.modelVerification.reportedModel === 'Apple iPhone 12' && insp3b.modelVerification.reportedModelSource === 'order-snapshot',
      '3b: updateDevice-Pfad -> Gemeldet A aus dem Schnappschuss',
      `${insp3b.modelVerification.reportedModel} / ${insp3b.modelVerification.reportedModelSource} (capturedAt - completedAt = ${gap3b} ms)`);

    // 3c: Schnappschuss erst beim ZWEITEN Wechsel erfasst (enthaelt schon B) -> Verlauf gewinnt.
    const id3c = await insertLegacyOrder('ORD-IWR-LEG-3C', {
      deviceModel: 'iPhone 14',
      reportedDevice: { brand: 'Apple', model: 'iPhone 13', deviceType: 'Smartphones', capturedAt: new Date('2026-09-21T10:00:00.000Z') },
      timeline: [
        change('Device changed from Apple iPhone 12 to Apple iPhone 13', new Date('2026-09-20T10:00:00.000Z')),
        change('Modellwechsel: Apple iPhone 13 -> Apple iPhone 14. Auftragskosten: 0.00 EUR -> 0.00 EUR.', new Date('2026-09-21T10:00:00.000Z')),
      ],
    });
    const insp3c = await DeviceInspectionService.initializeInspection(id3c, customer._id, technician._id);
    check(insp3c.modelVerification.reportedModel === 'Apple iPhone 12' && insp3c.modelVerification.reportedModelSource === 'order-timeline',
      '3c: spaeter erfasster Schnappschuss (B) -> aeltester Verlaufsstand A', `${insp3c.modelVerification.reportedModel} / ${insp3c.modelVerification.reportedModelSource}`);

    // 3d: unlesbarer Verlaufseintrag, Schnappschuss 2 s spaeter -> noch derselbe Vorgang.
    const id3d = await insertLegacyOrder('ORD-IWR-LEG-3D', {
      deviceModel: 'iPhone 13',
      reportedDevice: { brand: 'Apple', model: 'iPhone 12', deviceType: 'Smartphones', capturedAt: new Date(changeAt.getTime() + 2000) },
      timeline: [change('Geraet angepasst', changeAt)],
    });
    const insp3d = await DeviceInspectionService.initializeInspection(id3d, customer._id, technician._id);
    check(insp3d.modelVerification.reportedModelSource === 'order-snapshot', '3d: unlesbarer Eintrag, Schnappschuss im selben Vorgang -> Schnappschuss', insp3d.modelVerification.reportedModelSource);

    // 3e: unlesbarer Verlaufseintrag, Schnappschuss eine Stunde spaeter -> nicht gesichert.
    const id3e = await insertLegacyOrder('ORD-IWR-LEG-3E', {
      deviceModel: 'iPhone 13',
      reportedDevice: { brand: 'Apple', model: 'iPhone 12', deviceType: 'Smartphones', capturedAt: new Date(changeAt.getTime() + 3600000) },
      timeline: [change('Geraet angepasst', changeAt)],
    });
    const insp3e = await DeviceInspectionService.initializeInspection(id3e, customer._id, technician._id);
    check(insp3e.modelVerification.reportedModelSource === 'order-snapshot-unverified', '3e: Schnappschuss deutlich nach dem Wechsel -> nicht gesichert', insp3e.modelVerification.reportedModelSource);

    // ------------------------------------------------------------------------------------------
    console.log('\n[4] Doppelklick auf "Inspektion abschliessen": genau EINE Diagnose-E-Mail');
    await flushAsync();
    const orderDouble = await makeOrder();
    const idDouble = String(orderDouble._id);
    await prepareInspection(idDouble);
    // Deterministische Verschraenkung: das Speichern wartet, bis beide Abschluesse gelesen haben
    // (hoechstens 500 ms). Ohne atomaren Uebergang sehen beide "noch nicht abgeschlossen".
    const originalSave = DeviceInspection.prototype.save;
    let saveArrivals = 0;
    let releaseSaves;
    const saveBarrier = new Promise((resolve) => { releaseSaves = resolve; });
    DeviceInspection.prototype.save = function barrierSave(...args) {
      if (String(this.orderId && (this.orderId._id || this.orderId)) === idDouble && saveArrivals < 2) {
        saveArrivals += 1;
        if (saveArrivals >= 2) releaseSaves();
        return Promise.race([saveBarrier, new Promise((resolve) => setTimeout(resolve, 500))])
          .then(() => originalSave.apply(this, args));
      }
      return originalSave.apply(this, args);
    };
    const mailsBefore = sentEmails.length;
    let doubleResults;
    try {
      doubleResults = await Promise.allSettled([
        DeviceInspectionService.completeInspection(idDouble, undefined, { cost: 49.9, costSpecified: true, description: 'Akku' }, undefined, null),
        DeviceInspectionService.completeInspection(idDouble, undefined, { cost: 49.9, costSpecified: true, description: 'Akku' }, undefined, null),
      ]);
    } finally {
      DeviceInspection.prototype.save = originalSave;
    }
    await flushAsync();
    const doubleMails = sentEmails.slice(mailsBefore).filter((mail) => mail.data && mail.data.orderId === idDouble);
    check(doubleResults.every((result) => result.status === 'fulfilled'), '4: beide Klicks liefern ein Ergebnis (kein Fehler fuer den zweiten)',
      doubleResults.map((result) => (result.status === 'fulfilled' ? 'ok' : result.reason && result.reason.message)).join(' | '));
    check(doubleMails.length === 1, '4: genau eine Diagnose-E-Mail', doubleMails.length);
    const doubleDoc = await rawInspection(idDouble);
    check(doubleDoc.status === 'completed' && doubleDoc.repairOffer && doubleDoc.repairOffer.cost === 49.9 && doubleDoc.approvalStatus === 'awaiting-customer',
      '4: Inspektion abgeschlossen, Kostenvoranschlag gespeichert', `${doubleDoc.status} ${doubleDoc.repairOffer && doubleDoc.repairOffer.cost} ${doubleDoc.approvalStatus}`);

    // Zwei VERSCHIEDENE Abschluesse gleichzeitig: eine E-Mail, keiner der beiden Preise geht verloren
    // (der unterlegene Abschluss wird als erneuter Abschluss angewendet).
    const orderTwo = await makeOrder();
    const idTwo = String(orderTwo._id);
    await prepareInspection(idTwo);
    let twoArrivals = 0;
    let releaseTwo;
    const twoBarrier = new Promise((resolve) => { releaseTwo = resolve; });
    DeviceInspection.prototype.save = function barrierSaveTwo(...args) {
      if (String(this.orderId && (this.orderId._id || this.orderId)) === idTwo && twoArrivals < 2) {
        twoArrivals += 1;
        if (twoArrivals >= 2) releaseTwo();
        return Promise.race([twoBarrier, new Promise((resolve) => setTimeout(resolve, 500))])
          .then(() => originalSave.apply(this, args));
      }
      return originalSave.apply(this, args);
    };
    const mailsBeforeTwo = sentEmails.length;
    try {
      await Promise.all([
        DeviceInspectionService.completeInspection(idTwo, undefined, { cost: 30, costSpecified: true }, undefined, null),
        DeviceInspectionService.completeInspection(idTwo, undefined, { cost: 40, costSpecified: true }, undefined, null),
      ]);
    } finally {
      DeviceInspection.prototype.save = originalSave;
    }
    await flushAsync();
    const twoMails = sentEmails.slice(mailsBeforeTwo).filter((mail) => mail.data && mail.data.orderId === idTwo);
    const twoDoc = await rawInspection(idTwo);
    const completionLogs = (twoDoc.actionLogs || []).filter((entry) => entry.action === 'Inspection completed').length;
    check(twoMails.length === 1 && [30, 40].includes(twoDoc.repairOffer && twoDoc.repairOffer.cost) && completionLogs === 2,
      '4b: eine E-Mail, beide Abschluesse protokolliert, zuletzt gespeicherter Preis gilt',
      `mails=${twoMails.length} cost=${twoDoc.repairOffer && twoDoc.repairOffer.cost} logs=${completionLogs}`);

    // Ein spaeterer, einzelner erneuter Abschluss verschickt weiterhin keine zweite E-Mail.
    const mailsBeforeAgain = sentEmails.length;
    await DeviceInspectionService.completeInspection(idDouble, undefined, { cost: 49.9, costSpecified: true }, undefined, null);
    await flushAsync();
    check(sentEmails.length === mailsBeforeAgain, '4c: erneuter Abschluss -> keine weitere E-Mail', sentEmails.length - mailsBeforeAgain);

    await flushAsync();
  } finally {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }

  console.log(`\n==== ${pass} bestanden, ${fail} fehlgeschlagen ====`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch(async (error) => {
  console.error('ERROR:', error);
  try {
    await mongoose.disconnect();
  } catch (disconnectError) {
    /* ignore */
  }
  process.exit(2);
});
