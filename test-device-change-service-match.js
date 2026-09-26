/**
 * T03 - Regressionstest: Services muessen zum TATSAECHLICHEN Geraetemodell passen.
 *
 * Abgesichert (Geraetewechsel-Dialog und Service-Hinzufuegen am Auftrag):
 *   1. Die Liste der passenden Services wird im BACKEND gefiltert - vollstaendig,
 *      ohne Seitenbegrenzung, nur aktive Services.
 *   2. Geraetetyp-Schreibweisen (DeviceType-Schluessel "smartphone" vs. Anzeigename
 *      "Smartphone") fuehren nicht zu einer leeren Liste.
 *   3. Altdaten: ein Service, der sein Modell nur im alten Textfeld `model` traegt,
 *      gilt NICHT als "fuer alle Modelle" und taucht bei einem anderen Modell nicht auf.
 *   4. Ein Service fuer ein anderes Modell (oder ein deaktivierter) wird serverseitig
 *      abgelehnt - beim Geraetewechsel und beim Hinzufuegen - und dabei wird NICHTS
 *      gespeichert.
 *   5. Der gewaehlte Service wird mit richtiger ID, Name, Preis und derselben
 *      Auftragszeile gespeichert und ueberlebt ein erneutes Laden.
 *   6. Der Geraetewechsel rechnet den Auftragswert mit der gemeinsamen Preisregel
 *      (Haendlerrabatt bleibt erhalten) und Rechnungsbrutto === Auftragswert.
 *
 * Aufruf (benoetigt eine WEGWERF-Datenbank, niemals die Entwicklungs-DB):
 *   TEST_MONGODB_URI=mongodb://127.0.0.1:27099/t03 node test-device-change-service-match.js
 */
const path = require('path');
const fs = require('fs');
const mongoose = require(path.join(__dirname, 'server/node_modules/mongoose'));

const MODELS_DIR = path.join(__dirname, 'server/models');
const SERVICES_DIR = path.join(__dirname, 'server/services');
const URI = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27099/t03_device_match';

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

const money = (value) => Number(Number(value || 0).toFixed(2));

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
  const Service = mongoose.model('Service');
  const OrderRevision = mongoose.model('OrderRevision');
  const { DeviceType } = require(path.join(MODELS_DIR, 'Device'));
  const OrderService = require(path.join(SERVICES_DIR, 'orderService'));
  const OrderServiceManagementService = require(path.join(SERVICES_DIR, 'orderServiceManagementService'));
  const DeviceChangeService = require(path.join(SERVICES_DIR, 'deviceChangeService'));
  const ServiceService = require(path.join(SERVICES_DIR, 'serviceService'));
  const FinancialService = require(path.join(SERVICES_DIR, 'financialService'));
  const NotificationService = require(path.join(SERVICES_DIR, 'notificationService'));

  // MOCK: keine echten Benachrichtigungen/E-Mails.
  const sentNotifications = [];
  NotificationService.createNotification = async (data) => {
    sentNotifications.push(data);
    return { _id: new mongoose.Types.ObjectId(), ...data };
  };

  const readStored = async (id) =>
    mongoose.connection.db.collection('orders').findOne({ _id: new mongoose.Types.ObjectId(String(id)) });

  // Geraetetyp wie im Bestand: Schluessel klein, Anzeigename gross.
  await DeviceType.create({ _id: 'smartphone', name: 'Smartphone' });

  const haendler = await User.create({
    name: 'Haendler T03',
    email: 't03-haendler@test.invalid',
    role: 'customer',
    discount: 10,
  });
  const staff = await User.create({ name: 'Techniker T03', email: 't03-staff@test.invalid', role: 'staff' });

  const base = { category: 'display', deviceTypes: ['Smartphone'], manufacturerPrecise: 'Apple', estimatedTime: '60' };
  const display14 = await Service.create({ ...base, name: 'Displaytausch iPhone 14', price: 100, modelPrecise: 'iPhone 14' });
  const display15 = await Service.create({ ...base, name: 'Displaytausch iPhone 15', price: 120, modelPrecise: 'iPhone 15' });
  const legacy14 = await Service.create({
    name: 'Akkutausch (Altdaten)',
    category: 'battery',
    price: 60,
    deviceTypes: ['Smartphone'],
    manufacturer: 'Apple',
    model: 'iPhone 14',
    estimatedTime: '2 hours',
  });
  const genericDiagnose = await Service.create({
    name: 'Diagnose Apple',
    category: 'diagnostic',
    price: 20,
    deviceTypes: ['Smartphone'],
    manufacturerPrecise: 'Apple',
    estimatedTime: '',
  });
  const inactive15 = await Service.create({ ...base, name: 'Alt: Kamera iPhone 15', price: 80, modelPrecise: 'iPhone 15', isActive: false });
  const samsung = await Service.create({ ...base, name: 'Displaytausch Galaxy S24', price: 150, manufacturerPrecise: 'Samsung', modelPrecise: 'Galaxy S24' });
  // Mehr passende Services als eine Seite (Standard-Limit 10) fasst.
  for (let i = 0; i < 25; i += 1) {
    await Service.create({ ...base, name: `iPhone 15 Service ${String(i).padStart(2, '0')}`, price: 10 + i, modelPrecise: 'iPhone 15' });
  }

  console.log('\n[1] Kompatible Services fuer den Geraetewechsel (Backend-Filter)');
  // Die Geraetesuche liefert deviceType als DeviceType-Schluessel ("smartphone").
  const compatible = await DeviceChangeService.getCompatibleServices('smartphone', {
    deviceBrand: 'Apple',
    deviceModel: 'iPhone 15',
  });
  const compatibleNames = compatible.map((s) => s.name);
  check(compatibleNames.includes('Displaytausch iPhone 15'), 'passender Service enthalten', compatibleNames.length);
  check(!compatibleNames.includes('Displaytausch iPhone 14'), 'Service fuer iPhone 14 NICHT enthalten', compatibleNames.includes('Displaytausch iPhone 14'));
  check(!compatibleNames.includes('Akkutausch (Altdaten)'), 'Altdaten-Service fuer iPhone 14 NICHT enthalten', compatibleNames.includes('Akkutausch (Altdaten)'));
  check(!compatibleNames.includes('Alt: Kamera iPhone 15'), 'deaktivierter Service NICHT enthalten', compatibleNames.includes('Alt: Kamera iPhone 15'));
  check(!compatibleNames.includes('Displaytausch Galaxy S24'), 'fremder Hersteller NICHT enthalten', compatibleNames.includes('Displaytausch Galaxy S24'));
  check(compatibleNames.includes('Diagnose Apple'), 'modellunabhaengiger Hersteller-Service enthalten', compatibleNames.includes('Diagnose Apple'));
  check(compatible.length === 27, 'vollstaendige Liste ohne Seitenbegrenzung (25 + Display + Diagnose)', compatible.length);

  console.log('\n[2] Katalogliste mit Modellfilter behandelt Altdaten korrekt');
  const listed = await ServiceService.list(
    { deviceType: 'smartphone', manufacturerPrecise: 'Apple', modelPrecise: 'iPhone 15' },
    { page: 1, limit: 100 },
    {},
  );
  const listedNames = listed.services.map((s) => s.name);
  check(!listedNames.includes('Akkutausch (Altdaten)'), 'Altdaten-Service fuer iPhone 14 NICHT als "alle Modelle" gelistet', listedNames.includes('Akkutausch (Altdaten)'));
  check(listedNames.includes('Diagnose Apple'), 'modellunabhaengiger Service gelistet', listedNames.includes('Diagnose Apple'));
  const listed14 = await ServiceService.list(
    { deviceType: 'Smartphone', manufacturerPrecise: 'Apple', modelPrecise: 'iPhone 14' },
    { page: 1, limit: 100 },
    {},
  );
  check(
    listed14.services.some((s) => s.name === 'Akkutausch (Altdaten)'),
    'Altdaten-Service beim richtigen Modell gelistet',
    listed14.services.map((s) => s.name).join(','),
  );

  // Auftrag: Haendler 10 %, iPhone 14, Display 100 -> 90
  const order = await OrderService.create({
    customerId: haendler._id,
    deviceBrand: 'Apple',
    deviceModel: 'iPhone 14',
    deviceType: 'Smartphone',
    services: [String(display14._id)],
  });
  const orderId = String(order._id);
  let stored = await readStored(orderId);
  check(money(stored.totalCost) === 90, 'Ausgangslage 100 - 10 % = 90,00', stored.totalCost);
  const lineId = String(stored.services[0]._id);

  console.log('\n[3] Geraetewechsel mit Service fuer ein ANDERES Modell wird abgelehnt - nichts gespeichert');
  let wrongModelError = '';
  try {
    await DeviceChangeService.changeDeviceAndRecalculateServices(orderId, {
      deviceBrand: 'Apple',
      deviceModel: 'iPhone 15',
      deviceType: 'smartphone',
      serviceReplacements: [{ oldOrderServiceId: lineId, newServiceId: String(display14._id) }],
    }, staff._id);
  } catch (error) {
    wrongModelError = error.message;
  }
  stored = await readStored(orderId);
  check(Boolean(wrongModelError), 'Fehler gemeldet', wrongModelError || 'kein Fehler');
  check(/passt nicht|nicht verfügbar/.test(wrongModelError), 'Fehlermeldung deutsch', wrongModelError);
  check(stored.deviceModel === 'iPhone 14', 'Geraet NICHT geaendert', stored.deviceModel);
  check(String(stored.services[0].serviceId) === String(display14._id), 'Position NICHT geaendert', String(stored.services[0].serviceId));

  console.log('\n[4] Geraetewechsel mit DEAKTIVIERTEM Service wird abgelehnt');
  let inactiveError = '';
  try {
    await DeviceChangeService.changeDeviceAndRecalculateServices(orderId, {
      deviceBrand: 'Apple',
      deviceModel: 'iPhone 15',
      deviceType: 'smartphone',
      serviceReplacements: [{ oldOrderServiceId: lineId, newServiceId: String(inactive15._id) }],
    }, staff._id);
  } catch (error) {
    inactiveError = error.message;
  }
  stored = await readStored(orderId);
  check(Boolean(inactiveError), 'Fehler gemeldet', inactiveError || 'kein Fehler');
  check(stored.deviceModel === 'iPhone 14', 'Geraet NICHT geaendert', stored.deviceModel);

  console.log('\n[5] Gueltiger Geraetewechsel iPhone 14 -> iPhone 15 (Display 120,00)');
  const result = await DeviceChangeService.changeDeviceAndRecalculateServices(orderId, {
    deviceBrand: 'Apple',
    deviceModel: 'iPhone 15',
    deviceType: 'smartphone',
    serviceReplacements: [{ oldOrderServiceId: lineId, newServiceId: String(display15._id) }],
    reason: 'Kunde hat falsches Modell gebucht',
  }, staff._id);
  check(result.success === true, 'Erfolg gemeldet', result.success);
  stored = await readStored(orderId);
  const line = stored.services[0];
  check(stored.services.length === 1, 'weiterhin genau 1 Position', stored.services.length);
  check(String(line._id) === lineId, 'dieselbe Auftragszeile', String(line._id));
  check(String(line.serviceId) === String(display15._id), 'richtige Service-ID', String(line.serviceId));
  check(line.name === 'Displaytausch iPhone 15', 'Name-Snapshot des neuen Service', line.name);
  check(money(line.price) === 120, 'Listenpreis 120,00', line.price);
  // 120 -> 10 % = 12 -> 108 (nicht 120 - alter Rabatt 10 = 110)
  check(money(stored.discount) === 12, 'Haendlerrabatt neu berechnet = 12,00', stored.discount);
  check(money(stored.totalCost) === 108, 'Auftragswert = 108,00', stored.totalCost);
  check(money(result.pricingChangesSummary.totalCostAfter) === 108, 'Zusammenfassung zeigt 108,00', result.pricingChangesSummary.totalCostAfter);

  // Erneutes Laden ueber die Lese-API (wie nach einem Reload im Browser).
  const reread = await OrderServiceManagementService.getOrderServicesWithPricing(orderId);
  check(reread.services[0].serviceId?.name === 'Displaytausch iPhone 15', 'nach Reload: Service korrekt', reread.services[0].serviceId?.name);
  check(money(reread.pricing.grossTotal) === 108, 'nach Reload: Brutto 108,00', reread.pricing.grossTotal);

  const revisions = await OrderRevision.find({ orderId, triggerReason: 'device_change' }).lean();
  check(revisions.length === 1, 'Geraetewechsel historisiert', revisions.length);
  check(revisions[0] && String(revisions[0].changedBy) === String(staff._id), 'Verursacher festgehalten', revisions[0] && revisions[0].changedBy);
  check(revisions[0] && money(revisions[0].previousGrossAmount) === 90 && money(revisions[0].newGrossAmount) === 108,
    'vorher 90,00 -> nachher 108,00', revisions[0] && `${revisions[0].previousGrossAmount} -> ${revisions[0].newGrossAmount}`);
  check(revisions[0] && /falsches Modell/.test(revisions[0].notes || ''), 'Grund festgehalten', revisions[0] && revisions[0].notes);

  console.log('\n[6] Bestaetigung benachrichtigt den Kunden (Mock, deutsch)');
  await DeviceChangeService.confirmDeviceChange(orderId, true, staff._id);
  check(sentNotifications.length === 1, 'Benachrichtigung erzeugt', sentNotifications.length);
  check(/Gerät/.test(sentNotifications[0]?.title || '') || /Gerät/.test(sentNotifications[0]?.message || ''),
    'deutscher Text mit Umlaut', sentNotifications[0] && `${sentNotifications[0].title} / ${sentNotifications[0].message}`);

  console.log('\n[7] Service fuer ein anderes Modell kann nicht zum Auftrag hinzugefuegt werden');
  let addWrongError = '';
  try {
    await OrderServiceManagementService.addServiceToOrder(orderId, String(samsung._id), { actorId: staff._id });
  } catch (error) {
    addWrongError = error.message;
  }
  stored = await readStored(orderId);
  check(/passt nicht/.test(addWrongError), 'Hinzufuegen abgelehnt (deutsch)', addWrongError || 'kein Fehler');
  check(stored.services.length === 1, 'nichts hinzugefuegt', stored.services.length);
  await OrderServiceManagementService.addServiceToOrder(orderId, String(genericDiagnose._id), { actorId: staff._id });
  stored = await readStored(orderId);
  check(stored.services.length === 2, 'modellunabhaengiger Service darf hinzugefuegt werden', stored.services.length);
  check(stored.services[1].estimatedTime === 0, 'fehlende Zeitangabe -> 0 Minuten (kein NaN)', stored.services[1].estimatedTime);
  // 120 + 20 = 140 -> 14 -> 126
  check(money(stored.totalCost) === 126, 'Auftragswert = 126,00', stored.totalCost);

  console.log('\n[8] Rechnungsbrutto === Auftragswert nach dem Geraetewechsel');
  await Order.updateOne({ _id: orderId }, { $set: { status: 'completed' } });
  const invoice = await FinancialService.generateFromRepairOrders([orderId], {});
  stored = await readStored(orderId);
  check(money(invoice.total) === money(stored.totalCost), 'Rechnungsbrutto === Auftragswert', `${invoice.total} === ${stored.totalCost}`);

  console.log(`\n==== ${pass} bestanden, ${fail} fehlgeschlagen ====`);

  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error('ERROR:', error.message);
  console.error(error.stack);
  process.exit(2);
});
