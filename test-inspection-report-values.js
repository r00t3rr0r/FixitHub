/**
 * T16 - Regressionstest: Inspektionsbericht zeigt nur tatsaechlich erfasste Werte.
 *
 * Hintergrund (Sophies Abnahmetest vom 24.09.2026):
 *   - "Reparatureinschaetzung: reparierbar Ja" stand im Bericht, obwohl es die Auswahl nicht mehr gibt.
 *     Bis 15.09.2026 hat der Client completionAction='repairable' / isRepairable=true automatisch
 *     gesendet; der Stand in client/dist tut das noch immer.
 *   - Ein fehlender Preis wurde zu 0 EUR (Client: Number(repairCost) || 0), mit Freigabestatus
 *     "awaiting-customer" und "Kostenvoranschlag: EUR 0.00" in der Kunden-E-Mail.
 *   - A -> B -> C: "Gemeldetes Modell" = A (unveraenderlicher Schnappschuss), "tatsaechliches Modell" = C.
 *
 * Invarianten, die dieser Test absichert:
 *   1. Ein fehlender Preis bleibt UNBEKANNT (kein 0, kein Freigabestatus, keine 0 in PDF/E-Mail).
 *   2. Ein ausdruecklich kostenloser Kostenvoranschlag (0 EUR, costSpecified) bleibt als 0 erkennbar.
 *   3. isRepairable / completionAction werden nicht mehr neu geschrieben und nirgends ausgegeben;
 *      historische Werte bleiben in der Datenbank unveraendert.
 *   4. A -> B -> C: PDF zeigt Gemeldet A, tatsaechlich C. Altauftraege ohne Schnappschuss zeigen, was
 *      tatsaechlich bekannt ist (Auftragsverlauf) oder kennzeichnen die Angabe als nicht gesichert.
 *
 * Aufruf (benoetigt eine WEGWERF-Datenbank, niemals die Entwicklungs-DB):
 *   TEST_MONGODB_URI=mongodb://127.0.0.1:27099/t16 node test-inspection-report-values.js
 */
const path = require('path');
const fs = require('fs');
const zlib = require('zlib');
const mongoose = require(path.join(__dirname, 'server/node_modules/mongoose'));

const MODELS_DIR = path.join(__dirname, 'server/models');
const SERVICES_DIR = path.join(__dirname, 'server/services');
const URI = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27099/t16_inspection_report';

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

// Liest den Text einer von pdfkit erzeugten PDF (Standardschriften, WinAnsi, komprimierte Streams).
const extractPdfText = (filePath) => {
  const raw = fs.readFileSync(filePath);
  const lines = [];
  let offset = 0;
  while (true) {
    const start = raw.indexOf('stream\n', offset, 'latin1');
    if (start === -1) break;
    const end = raw.indexOf('\nendstream', start, 'latin1');
    if (end === -1) break;
    const chunk = raw.subarray(start + 7, end);
    offset = end + 10;
    let content;
    try {
      content = zlib.inflateSync(chunk).toString('latin1');
    } catch (error) {
      content = chunk.toString('latin1');
    }
    const tjPattern = /\[(.*?)\]\s*TJ/g;
    let match;
    while ((match = tjPattern.exec(content))) {
      const text = (match[1].match(/<([0-9a-fA-F]*)>/g) || [])
        .map((hex) => Buffer.from(hex.slice(1, -1), 'hex').toString('latin1'))
        .join('');
      if (text) lines.push(text);
    }
  }
  return lines;
};

async function main() {
  if (isUnsafeTestUri(URI)) {
    throw new Error('Dieser Test darf nicht gegen die Entwicklungsdatenbank laufen.');
  }

  await mongoose.connect(URI);
  await mongoose.connection.dropDatabase();

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
  const EmailService = require(path.join(SERVICES_DIR, 'emailService'));
  const OrderService = require(path.join(SERVICES_DIR, 'orderService'));
  const DeviceInspectionService = require(path.join(SERVICES_DIR, 'deviceInspectionService'));

  // Keine echten E-Mails / Benachrichtigungen: Aufrufe nur mitschneiden.
  const sentEmails = [];
  EmailService.sendDiagnosisCompletedEmail = async (to, data) => {
    sentEmails.push({ to, data });
    return { success: true };
  };
  // Seit NOTIF-4 sendet der Abschluss der Eingangspruefung den Trigger 'inspection_completed'
  // (EmailService.sendInspectionCompletedEmail) statt der Diagnose-E-Mail - gleicher Mitschnitt.
  EmailService.sendInspectionCompletedEmail = EmailService.sendDiagnosisCompletedEmail;
  OrderService.updateStatus = async () => null;
  const flushAsync = () => new Promise((resolve) => setTimeout(resolve, 150));

  const customer = await User.create({
    name: 'Testkunde Inspektion',
    email: 't16-kunde@test.invalid',
    role: 'customer',
    customerNumber: 'K-T16',
  });
  const technician = await User.create({
    name: 'Sophie Technik',
    email: 't16-technik@test.invalid',
    role: 'staff',
  });

  let orderCounter = 0;
  const makeOrder = async (model = 'iPhone 12') => {
    orderCounter += 1;
    return Order.create({
      customerId: customer._id,
      orderNumber: `ORD-T16-${String(orderCounter).padStart(3, '0')}`,
      deviceBrand: 'Apple',
      deviceModel: model,
      deviceType: 'Smartphones',
      errorDescription: 'Display',
      services: [],
      totalCost: 0,
      status: 'pending',
    });
  };

  const runSteps = async (orderId, reported, actual) => {
    await DeviceInspectionService.initializeInspection(orderId, customer._id, technician._id);
    await DeviceInspectionService.updateModelVerification(orderId, reported, actual, 'correct', 0, '', null, {});
    await DeviceInspectionService.updateIdentification(orderId, 'Smartphones', '356938035643809', null);
  };

  const pdfLinesFor = async (orderId) => {
    const inspection = await DeviceInspectionService.generateInspectionReport(orderId);
    const filePath = path.join(__dirname, 'server', inspection.reportUrl.replace(/^\//, ''));
    const lines = extractPdfText(filePath);
    fs.unlinkSync(filePath);
    return lines;
  };

  // ------------------------------------------------------------------------------------------
  console.log('\n[1] Veralteter Client: Standardwerte duerfen nicht als Ergebnis gespeichert werden');
  const order1 = await makeOrder();
  const id1 = String(order1._id);
  await runSteps(id1, 'Apple iPhone 12', 'Apple iPhone 12');
  // Genau das, was der Client vom 15.09.2026 (client/dist) beim Abschluss sendet.
  await DeviceInspectionService.completeInspection(
    id1,
    true,
    { cost: 0, timeframe: '3-5 Tage', description: '' },
    'repairable',
    { shouldInform: false, reason: '', note: '', suggestedStatus: '', mailTemplate: '' },
  );
  await flushAsync();
  const stored1 = await mongoose.connection.db.collection('deviceinspections').findOne({ orderId: order1._id });
  check(stored1.isRepairable === undefined, 'isRepairable nicht automatisch gespeichert', stored1.isRepairable);
  check(stored1.completionAction === undefined, 'completionAction nicht automatisch gespeichert', stored1.completionAction);
  check(stored1.repairOffer && stored1.repairOffer.cost === undefined, 'Fehlender Preis bleibt unbekannt (kein 0)', stored1.repairOffer && stored1.repairOffer.cost);
  check(stored1.repairOffer && stored1.repairOffer.timeframe === '3-5 Tage', 'Zeitraum bleibt erhalten', stored1.repairOffer && stored1.repairOffer.timeframe);
  check(stored1.approvalStatus === undefined, 'Kein Freigabestatus ohne Preis', stored1.approvalStatus);
  const json1 = (await DeviceInspection.findOne({ orderId: order1._id })).toJSON();
  check(json1.repairOfferKnownCost === null, 'API: repairOfferKnownCost = null (unbekannt)', json1.repairOfferKnownCost);
  const mail1 = sentEmails.find((entry) => entry.data.orderNumber === order1.orderNumber);
  check(Boolean(mail1), 'Diagnose-E-Mail wurde (gemockt) ausgeloest', Boolean(mail1));
  check(mail1 && mail1.data.isRepairable === undefined, 'E-Mail: keine Reparierbar-Aussage', mail1 && mail1.data.isRepairable);
  check(mail1 && !/0[.,]00/.test(String(mail1.data.recommendedAction)), 'E-Mail: kein "EUR 0.00"', mail1 && mail1.data.recommendedAction);
  const pdf1 = await pdfLinesFor(id1);
  check(!pdf1.some((line) => /reparierbar/i.test(line)), 'PDF: keine Reparierbar-Zeile', pdf1.filter((l) => /reparierbar/i.test(l)).join(' | ') || '-');
  check(!pdf1.some((line) => /Kosten.*\b0[.,]00\b|Kosten: 0 /.test(line)), 'PDF: keine 0-EUR-Kosten', pdf1.filter((l) => /Kosten/.test(l)).join(' | ') || '-');
  check(pdf1.some((line) => /Zeitrahmen: 3-5 Tage/.test(line)), 'PDF: Zeitrahmen gedruckt', pdf1.filter((l) => /Zeitrahmen/.test(l)).join(' | ') || '-');

  // ------------------------------------------------------------------------------------------
  console.log('\n[2] Leere Preisangaben (null, "", undefined) werden nicht zu 0');
  for (const [labelText, cost] of [['null', null], ['leerer String', ''], ['undefined', undefined]]) {
    const order = await makeOrder();
    const id = String(order._id);
    await runSteps(id, 'Apple iPhone 12', 'Apple iPhone 12');
    await DeviceInspectionService.completeInspection(id, undefined, { cost, description: 'Display tauschen' }, undefined, null);
    const doc = await DeviceInspection.findOne({ orderId: order._id });
    const json = doc.toJSON();
    check(json.repairOfferKnownCost === null, `cost=${labelText}: unbekannt`, json.repairOfferKnownCost);
    check(doc.repairOffer && doc.repairOffer.description === 'Display tauschen', `cost=${labelText}: Beschreibung erhalten`, doc.repairOffer && doc.repairOffer.description);
  }

  // ------------------------------------------------------------------------------------------
  console.log('\n[3] Ausdruecklich kostenloser Kostenvoranschlag bleibt als 0 erkennbar');
  const order3 = await makeOrder();
  const id3 = String(order3._id);
  await runSteps(id3, 'Apple iPhone 12', 'Apple iPhone 12');
  await DeviceInspectionService.completeInspection(id3, undefined, { cost: 0, costSpecified: true, description: 'Kulanz' }, undefined, null);
  await flushAsync();
  const json3 = (await DeviceInspection.findOne({ orderId: order3._id })).toJSON();
  check(json3.repairOfferKnownCost === 0, 'API: repairOfferKnownCost = 0 (ausdruecklich)', json3.repairOfferKnownCost);
  check(json3.approvalStatus === 'awaiting-customer', 'Freigabestatus bei echtem Kostenvoranschlag', json3.approvalStatus);
  const pdf3 = await pdfLinesFor(id3);
  check(pdf3.some((line) => /Kosten: 0,00 EUR/.test(line)), 'PDF: "Kosten: 0,00 EUR" gedruckt', pdf3.filter((l) => /Kosten/.test(l)).join(' | ') || '-');
  const mail3 = sentEmails.find((entry) => entry.data.orderNumber === order3.orderNumber);
  check(mail3 && /0,00/.test(String(mail3.data.recommendedAction)), 'E-Mail: kostenloser Kostenvoranschlag genannt', mail3 && mail3.data.recommendedAction);

  console.log('\n[3b] Normaler Kostenvoranschlag 89,90');
  const order3b = await makeOrder();
  const id3b = String(order3b._id);
  await runSteps(id3b, 'Apple iPhone 12', 'Apple iPhone 12');
  await DeviceInspectionService.completeInspection(id3b, undefined, { cost: '89.90', costSpecified: true }, undefined, null);
  const json3b = (await DeviceInspection.findOne({ orderId: order3b._id })).toJSON();
  check(json3b.repairOfferKnownCost === 89.9, 'API: repairOfferKnownCost = 89,90', json3b.repairOfferKnownCost);

  // ------------------------------------------------------------------------------------------
  console.log('\n[4] Altbestand: historische Werte bleiben unveraendert, werden aber nirgends ausgegeben');
  const order4 = await makeOrder();
  const id4 = String(order4._id);
  await runSteps(id4, 'Apple iPhone 12', 'Apple iPhone 12');
  // Zustand, den der alte Client (vor 15.09.2026) automatisch erzeugt hat.
  await mongoose.connection.db.collection('deviceinspections').updateOne(
    { orderId: order4._id },
    { $set: { isRepairable: true, completionAction: 'repairable', repairOffer: { cost: 0, timeframe: '', description: '' }, approvalStatus: 'awaiting-customer' } },
  );
  const json4 = (await DeviceInspection.findOne({ orderId: order4._id })).toJSON();
  check(json4.repairOfferKnownCost === null, 'Alt-Preis 0 ohne Kennzeichnung gilt als unbekannt', json4.repairOfferKnownCost);
  const pdf4 = await pdfLinesFor(id4);
  check(!pdf4.some((line) => /reparierbar|Kosten/i.test(line)), 'PDF: weder "reparierbar" noch 0-Kosten aus Altdaten', pdf4.filter((l) => /reparierbar|Kosten/i.test(l)).join(' | ') || '-');
  // Erneuter Abschluss ohne diese Felder: gespeicherte Historie bleibt unveraendert.
  await DeviceInspectionService.completeInspection(id4, undefined, undefined, undefined, null);
  const stored4 = await mongoose.connection.db.collection('deviceinspections').findOne({ orderId: order4._id });
  check(stored4.isRepairable === true && stored4.completionAction === 'repairable', 'Historische Werte in der DB unveraendert', `${stored4.isRepairable}/${stored4.completionAction}`);

  // ------------------------------------------------------------------------------------------
  console.log('\n[5] A -> B -> C: Gemeldet A, tatsaechlich C (auch im PDF)');
  const order5 = await makeOrder('iPhone 12');
  const id5 = String(order5._id);
  await DeviceInspectionService.initializeInspection(id5, customer._id, technician._id);
  for (const model of ['iPhone 13', 'iPhone 14']) {
    const doc = await Order.findById(id5);
    doc.deviceModel = model;
    await doc.save();
  }
  // Was der Client nach dem Wechsel sendet: Gemeldet (Schnappschuss) A, tatsaechlich C.
  await DeviceInspectionService.updateModelVerification(id5, 'Apple iPhone 12', 'Apple iPhone 14', 'correct', 0, '', null, {});
  const insp5 = await DeviceInspection.findOne({ orderId: order5._id });
  check(insp5.modelVerification.reportedModel === 'Apple iPhone 12', 'Gemeldetes Modell = A', insp5.modelVerification.reportedModel);
  check(insp5.modelVerification.actualModel === 'Apple iPhone 14', 'Tatsaechliches Modell = C', insp5.modelVerification.actualModel);
  const pdf5 = await pdfLinesFor(id5);
  check(pdf5.some((line) => /Gemeldetes Modell: Apple iPhone 12/.test(line)), 'PDF: Gemeldetes Modell A', pdf5.filter((l) => /Modell/.test(l)).join(' | '));
  check(pdf5.some((line) => /Tatsächliches Modell: Apple iPhone 14/.test(line)), 'PDF: Tatsächliches Modell C', pdf5.filter((l) => /Modell/.test(l)).join(' | '));
  // Ein veralteter Entwurf, der A in beiden Feldern sendet, darf C nicht zurueckdrehen.
  await DeviceInspectionService.updateModelVerification(id5, 'Apple iPhone 12', 'Apple iPhone 12', 'correct', 0, '', null, {});
  const insp5b = await DeviceInspection.findOne({ orderId: order5._id });
  check(insp5b.modelVerification.actualModel === 'Apple iPhone 14', 'Veralteter Entwurf dreht C nicht auf A zurueck', insp5b.modelVerification.actualModel);

  // ------------------------------------------------------------------------------------------
  console.log('\n[6] Altauftrag ohne Schnappschuss, Wechsel im Auftragsverlauf dokumentiert');
  const legacyTimeline = (entries) => entries.map(([description, completedAt]) => ({
    status: 'Device Changed', description, completedAt, staffId: 'system', staffName: 'Altbestand',
  }));
  const insertLegacyOrder = async (orderNumber, timeline) => {
    const { insertedId } = await mongoose.connection.db.collection('orders').insertOne({
      customerId: customer._id,
      orderNumber,
      deviceBrand: 'Apple',
      deviceModel: 'iPhone 14',
      deviceType: 'Smartphones',
      errorDescription: 'Display',
      services: [],
      totalCost: 0,
      status: 'pending',
      timeline,
      createdAt: new Date('2026-08-01T10:00:00Z'),
    });
    return String(insertedId);
  };
  const id6 = await insertLegacyOrder('ORD-T16-LEGACY-1', legacyTimeline([
    ['Device changed from Apple iPhone 12 to Apple iPhone 13', new Date('2026-08-02T10:00:00Z')],
    ['Modellwechsel: Apple iPhone 13 -> Apple iPhone 14. Auftragskosten: 0.00 EUR -> 0.00 EUR.', new Date('2026-08-03T10:00:00Z')],
  ]));
  const insp6 = await DeviceInspectionService.initializeInspection(id6, customer._id, technician._id);
  check(insp6.modelVerification.reportedModel === 'Apple iPhone 12', 'Gemeldet = aeltester dokumentierter Stand (A)', insp6.modelVerification.reportedModel);
  check(insp6.modelVerification.actualModel === 'Apple iPhone 14', 'Tatsaechlich = aktuelles Geraet (C)', insp6.modelVerification.actualModel);
  check(insp6.modelVerification.reportedModelSource === 'order-timeline', 'Herkunft = Auftragsverlauf', insp6.modelVerification.reportedModelSource);

  console.log('\n[7] Altauftrag ohne Schnappschuss, Wechsel ohne lesbare Angabe');
  const id7 = await insertLegacyOrder('ORD-T16-LEGACY-2', legacyTimeline([
    ['Geraet angepasst', new Date('2026-08-02T10:00:00Z')],
  ]));
  const insp7 = await DeviceInspectionService.initializeInspection(id7, customer._id, technician._id);
  check(insp7.modelVerification.reportedModelSource === 'order-current-unverified', 'Herkunft als nicht gesichert gekennzeichnet', insp7.modelVerification.reportedModelSource);
  const pdf7 = await pdfLinesFor(id7);
  check(pdf7.some((line) => /nicht gesichert/i.test(line)), 'PDF: Hinweis "nicht gesichert" gedruckt', pdf7.filter((l) => /Modell|gesichert/i.test(l)).join(' | '));

  console.log('\n[8] Normaler Auftrag ohne Wechsel: kein Hinweis');
  const order8 = await makeOrder('iPhone 12');
  const insp8 = await DeviceInspectionService.initializeInspection(String(order8._id), customer._id, technician._id);
  check(insp8.modelVerification.reportedModel === 'Apple iPhone 12', 'Gemeldet = gebuchtes Geraet', insp8.modelVerification.reportedModel);
  check(insp8.modelVerification.reportedModelSource === 'order-snapshot', 'Herkunft = Schnappschuss am Auftrag', insp8.modelVerification.reportedModelSource);

  console.log(`\n==== ${pass} bestanden, ${fail} fehlgeschlagen ====`);

  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error('ERROR:', error.message);
  process.exit(2);
});
