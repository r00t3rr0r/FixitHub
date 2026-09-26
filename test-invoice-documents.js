/**
 * Regressionstest Track "documents" (T18, T10, T21 und Belegfelder):
 *
 *   1. PDF-Inhalt einer Rechnung: Rechnungs-/Leistungsdatum, Faelligkeit, Netto/MwSt/Brutto,
 *      Rabatt, offener Betrag BEI ERSTELLUNG, Rechnungsadresse, Kunden-, Rechnungs- und
 *      Auftragsnummer, Zahlungsart (deutsch), jede Position einzeln, IMEI/Seriennummer,
 *      Beschreibung einer manuellen Position.
 *   2. Fusszeile exakt, kein Skonto, Bewertungstext exakt, QR-Code nur mit
 *      konfiguriertem Ziel (keine erfundene Adresse).
 *   3. Das PDF wird beim Ausstellen archiviert, identisch erneut ausgeliefert und aendert
 *      sich nach einer spaeteren Zahlung NICHT (aktueller Stand kommt aus dem Saldo).
 *   4. Zugriff (echter Express-Router, echtes JWT): Admin, Mitarbeiter und Eigentuemer
 *      duerfen das PDF laden; ein fremder Kunde wird abgewiesen (deutsch); Entwuerfe sind
 *      fuer Kunden unsichtbar; Mitarbeiter sehen die Rechnungen eines Auftrags.
 *   5. Nummernkreise INV-JJJJ-NNNN / INV-CN-JJJJ-NNNN: atomar, getrennt, eindeutig,
 *      auch bei der allerersten Zaehleranlage unter Parallelitaet; Seed-Skript.
 *   6. Gutschrift-PDF (T21): Netto, gewaehlter Steuersatz, Brutto, Bezug auf
 *      Ursprungsrechnung und Auftrag, Kunde/Datum/Nummer/Fusszeile; keine doppelte
 *      Minderung des Saldos.
 *   7. Versand: persoenliche Nachricht erreicht den Kunden (auch mit einer gespeicherten
 *      Vorlage OHNE Platzhalter), kein roher Platzhalter; ein E-Mail-Fehler erzeugt
 *      keine neue Rechnung und aendert den Belegstatus nicht; Versand einer bezahlten
 *      Rechnung setzt sie nicht auf "versendet" zurueck.
 *
 * Kein Netz: 'qrcode' ist durch einen Stub ersetzt (lokal nicht installiert), der
 * Mail-Transport ist ein Stub, Logger/Zustellprotokoll schreiben nichts ins Repo.
 *
 * Aufruf (benoetigt eine WEGWERF-Datenbank, niemals die Entwicklungs-DB):
 *   TEST_MONGODB_URI=mongodb://127.0.0.1:27099/t_documents node test-invoice-documents.js
 */
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const Module = require('module');
const { execFileSync } = require('child_process');

const SERVER_DIR = path.join(__dirname, 'server');
const mongoose = require(path.join(SERVER_DIR, 'node_modules/mongoose'));
const express = require(path.join(SERVER_DIR, 'node_modules/express'));
const jwt = require(path.join(SERVER_DIR, 'node_modules/jsonwebtoken'));
const PDFDocument = require(path.join(SERVER_DIR, 'node_modules/pdfkit'));

const URI = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27099/t_invoice_documents';

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

const out = (...args) => process.stdout.write(`${args.join(' ')}\n`);
if (!process.env.DEBUG_TEST) {
  console.log = () => {};
  console.warn = () => {};
  console.error = () => {};
}

let pass = 0;
let fail = 0;
const check = (condition, message, actual) => {
  if (condition) {
    pass += 1;
    out(`  PASS ${message} :: ${actual}`);
  } else {
    fail += 1;
    out(`  FAIL ${message} :: ${actual}`);
  }
};
const runSection = async (title, fn) => {
  out(`\n[${title}]`);
  try {
    await fn();
  } catch (error) {
    fail += 1;
    out(`  FAIL Abschnitt abgebrochen :: ${error.stack || error.message}`);
  }
};

// --- 'qrcode' ist lokal nicht installiert: Stub, der die kodierte Adresse protokolliert.
const PNG_1X1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
const qrCalls = [];
const QR_STUB = path.join(SERVER_DIR, 'node_modules', '__qrcode_test_stub__.js');
require.cache[QR_STUB] = {
  id: QR_STUB, filename: QR_STUB, loaded: true,
  exports: { toBuffer: async (value) => { qrCalls.push(String(value)); return PNG_1X1; } },
};
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function resolveWithQrStub(request, ...rest) {
  if (request === 'qrcode') return QR_STUB;
  return originalResolve.call(this, request, ...rest);
};

// --- PDF-Text mitschneiden: jede an doc.text() uebergebene Zeichenkette.
let pdfTexts = null;
const originalText = PDFDocument.prototype.text;
PDFDocument.prototype.text = function recordText(value, ...rest) {
  if (pdfTexts && value != null) pdfTexts.push(String(value));
  return originalText.call(this, value, ...rest);
};
const capturePdf = async (fn) => {
  pdfTexts = [];
  try {
    const buffer = await fn();
    return { buffer, text: pdfTexts.join('\n') };
  } finally {
    pdfTexts = null;
  }
};

const round2 = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
const fmtDate = (value) => new Date(value).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
const de = (value) => Number(value).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

async function main() {
  if (isUnsafeTestUri(URI)) {
    throw new Error('Dieser Test darf nicht gegen die Entwicklungsdatenbank laufen.');
  }
  process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
  process.env.EMAIL_TEST_TRANSPORT = 'stream';
  delete process.env.GOOGLE_REVIEW_URL;

  await mongoose.connect(URI);
  await mongoose.connection.dropDatabase();

  const MODELS_DIR = path.join(SERVER_DIR, 'models');
  fs.readdirSync(MODELS_DIR).filter((file) => file.endsWith('.js')).forEach((file) => {
    try { require(path.join(MODELS_DIR, file)); } catch (error) { /* optional */ }
  });
  const User = mongoose.model('User');
  const Order = mongoose.model('Order');
  const Booking = mongoose.model('Booking');
  const Service = mongoose.model('Service');
  const Invoice = mongoose.model('Invoice');
  const Payment = mongoose.model('Payment');
  const PaymentAllocation = mongoose.model('PaymentAllocation');
  const DocumentSequence = mongoose.model('DocumentSequence');
  await Promise.all([Payment.init(), PaymentAllocation.init(), Invoice.init()]);

  // E-Mail: echter Vorlagenweg, aber Transport/Logger/Zustellprotokoll als Stub (kein SMTP,
  // keine Dateien im Repo).
  const EmailService = require(path.join(SERVER_DIR, 'services/emailService'));
  const silent = { info() {}, warn() {}, error() {}, debug() {} };
  EmailService.logger = silent;
  EmailService.deliveryTracker = { recordDelivery() {} };
  EmailService.retryHandler = {
    executeWithRetry: async (operation) => {
      try {
        return { success: true, result: await operation(), attempts: 1, duration: 0 };
      } catch (error) {
        return { success: false, error, attempts: 1, duration: 0 };
      }
    },
  };
  const mails = [];
  let transportMode = 'ok';
  EmailService.getTransporter = async () => ({
    sendMail: async (options) => {
      if (transportMode === 'fail') throw new Error('SMTP nicht erreichbar (Test)');
      mails.push(options);
      return { messageId: `msg-${mails.length}` };
    },
  });
  EmailService.buildSystemUrl = async (p) => `https://test.invalid${p}`;
  EmailService.getSystemBaseUrl = async () => 'https://test.invalid';
  const NotificationService = require(path.join(SERVER_DIR, 'services/notificationService'));
  NotificationService.createNotification = async (data) => ({ _id: new mongoose.Types.ObjectId(), ...data });

  const FinancialService = require(path.join(SERVER_DIR, 'services/financialService'));
  const PaymentService = require(path.join(SERVER_DIR, 'services/paymentService'));
  const InvoicePdfService = require(path.join(SERVER_DIR, 'services/invoicePdfService'));
  const NotificationTemplateService = require(path.join(SERVER_DIR, 'services/notificationTemplateService'));
  const SystemConfigService = require(path.join(SERVER_DIR, 'services/systemConfigService'));

  const invoiceRoutes = require(path.join(SERVER_DIR, 'routes/invoiceRoutes'));
  const financialRoutes = require(path.join(SERVER_DIR, 'routes/financialRoutes'));
  const app = express();
  app.use(express.json());
  app.use('/api/invoices', invoiceRoutes);
  app.use('/api/admin/financial', financialRoutes);
  const server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const tokenFor = (user) => jwt.sign({ sub: String(user._id) }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '10m' });
  const call = async (method, url, { user = null, body = null, raw = false } = {}) => {
    const response = await fetch(`${baseUrl}${url}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(user ? { Authorization: `Bearer ${tokenFor(user)}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (raw && response.status === 200) {
      return { status: response.status, buffer: Buffer.from(await response.arrayBuffer()), headers: response.headers };
    }
    let json = null;
    try { json = await response.json(); } catch (error) { json = null; }
    return { status: response.status, body: json };
  };

  // --- Stammdaten -----------------------------------------------------------------------
  const admin = await User.create({ name: 'Admin Beleg', email: 'admin-doc@test.invalid', role: 'admin' });
  const staff = await User.create({ name: 'Mitarbeiter Beleg', email: 'staff-doc@test.invalid', role: 'staff' });
  const customer = await User.create({
    name: 'Erika Musterfrau', email: 'erika@test.invalid', role: 'customer', customerNumber: 'K-10042',
    discount: 15,
    invoiceAddress: { street: 'Hauptstraße 5', city: 'Köln', zip: '50667', zipCode: '50667', country: 'DE' },
  });
  const stranger = await User.create({ name: 'Fremder Kunde', email: 'fremd@test.invalid', role: 'customer', customerNumber: 'K-99999' });
  const display = await Service.create({ name: 'Displaytausch', description: 'Display', category: 'screen', price: 49.9 });
  const akku = await Service.create({ name: 'Akkutausch', description: 'Akku', category: 'battery', price: 30 });

  const order = await Order.create({
    customerId: customer._id,
    orderNumber: 'ORD-2026-0101',
    deviceBrand: 'Apple', deviceModel: 'iPhone 14', deviceType: 'Smartphone',
    imei: '356789012345678', serialNumber: 'F2LXK0ABCD',
    errorDescription: 'Display und Akku',
    services: [
      { serviceId: display._id, name: 'Displaytausch', price: 49.9, quantity: 1, estimatedTime: 30 },
      { serviceId: akku._id, name: 'Akkutausch', price: 30, quantity: 1, estimatedTime: 30 },
      { isManual: true, name: 'Rahmen richten', description: 'Gehäuserahmen links ausgebeult', price: 20, quantity: 1, estimatedTime: 0 },
    ],
    totalCost: 84.92, discount: 14.98, paymentMethod: 'paypal',
    status: 'completed',
  });
  const booking = await Booking.create({
    customerId: customer._id,
    orderIds: [order._id],
    items: [{ type: 'repair', orderId: order._id, orderNumber: order.orderNumber, cost: 84.92 }],
    totalCost: 84.92,
    status: 'processing',
  });
  await Order.updateOne({ _id: order._id }, { $set: { bookingId: booking._id } });

  // Vorauszahlung VOR der Rechnung: muss als "bei Erstellung bekannt" im PDF stehen.
  await Payment.create({
    bookingId: booking._id, orderId: order._id, customerId: customer._id, amount: 30,
    paymentMethod: 'paypal', status: 'completed', source: 'checkout', processedAt: new Date('2026-09-20T10:00:00Z'),
  });

  await runSection('0 Allererste Zaehleranlage unter Parallelitaet (noch kein Index)', async () => {
    // Zustand direkt nach einem Deployment auf leerer Sammlung: kein Zaehler, kein Index.
    await DocumentSequence.init().catch(() => {});
    await DocumentSequence.collection.drop().catch(() => {});
    const year = 2031;
    const burst = await Promise.all(Array.from({ length: 25 }, () => DocumentSequence.allocateNumber('invoice', year)));
    const unique = new Set(burst);
    const counters = await DocumentSequence.countDocuments({ documentType: 'invoice', year });
    check(unique.size === 25 && counters === 1, 'erste Zaehleranlage parallel: 25 eindeutige Nummern, genau ein Zaehler', `${unique.size} eindeutig / ${counters} Zaehler`);
    const sorted = [...burst].sort();
    check(sorted[0] === 'INV-2031-0001' && sorted[24] === 'INV-2031-0025', 'lueckenlos 0001..0025', `${sorted[0]} .. ${sorted[24]}`);
    const cnFirst = await Promise.all(Array.from({ length: 6 }, () => DocumentSequence.allocateNumber('credit_note', 2032)));
    check(new Set(cnFirst).size === 6, 'erste Gutschrift-Zaehleranlage parallel: eindeutig', cnFirst.sort().join(','));
  });

  let invoice = null;
  let firstPdf = null;

  await runSection('1 PDF-Inhalt einer Rechnung (alle Pflichtangaben)', async () => {
    invoice = await FinancialService.createInvoiceFromOrder(order._id);
    const bookingDoc = await Booking.findById(booking._id).lean();
    check(round2(invoice.total) === 84.92 && round2(invoice.discount) === 14.98, 'Rechnung = Auftragswert, Rabatt einmal', `${invoice.total} / ${invoice.discount}`);
    const pdf = await capturePdf(async () => InvoicePdfService.generate(await Invoice.findById(invoice._id)));
    const text = pdf.text;
    const invoiceDate = fmtDate(invoice.createdAt);
    check(text.includes(invoice.invoiceNumber), 'Rechnungsnummer', invoice.invoiceNumber);
    check(text.includes(`Rechnungsdatum: ${invoiceDate}`), 'Rechnungsdatum', invoiceDate);
    check(text.includes(`Leistungsdatum: ${invoiceDate}`), 'Leistungsdatum = Rechnungsdatum', invoiceDate);
    check(/F(ä|ae)lligkeitsdatum: \d{2}\.\d{2}\.\d{4}/.test(text) && text.includes('Fälligkeitsdatum'), 'Fälligkeitsdatum (mit Umlaut)', (text.match(/F\S*lligkeitsdatum: [^\n]*/) || [''])[0]);
    check(text.includes('K-10042'), 'Kundennummer', 'K-10042');
    check(text.includes('ORD-2026-0101'), 'Auftragsnummer', 'ORD-2026-0101');
    check(text.includes(bookingDoc.bookingNumber), 'Buchungsnummer', bookingDoc.bookingNumber);
    check(text.includes('Hauptstraße 5') && text.includes('50667 Köln'), 'Rechnungsadresse', 'Hauptstraße 5 / 50667 Köln');
    check(text.includes('Displaytausch') && text.includes('Akkutausch') && text.includes('Rahmen richten'), 'jede Position einzeln', 'Displaytausch, Akkutausch, Rahmen richten');
    check(text.includes('356789012345678') && text.includes('F2LXK0ABCD'), 'IMEI und Seriennummer', 'IMEI/SN');
    check(text.includes('Gehäuserahmen links ausgebeult'), 'Beschreibung der manuellen Position', 'manuell');
    check(text.includes(`${de(14.98)} €`) && /Rabatt/.test(text), 'Rabatt ausgewiesen', de(14.98));
    check(text.includes(`${de(invoice.subtotal)} €`) && text.includes(`${de(invoice.tax)} €`) && text.includes(`${de(84.92)} €`), 'Netto / MwSt / Brutto', `${invoice.subtotal} / ${invoice.tax} / 84,92`);
    check(text.includes('19,00'), 'Steuersatz 19 %', '19,00');
    check(text.includes('Zahlungsart: PayPal'), 'Zahlungsart deutsch (nicht roher Enum-Wert)', (text.match(/Zahlungsart: [^\n]*/) || [''])[0]);
    check(/Offener Betrag bei Rechnungsstellung/.test(text) && text.includes(`${de(54.92)} €`), 'Offener Betrag bei Erstellung (84,92 - 30,00 Vorauszahlung)', de(54.92));
    check(text.includes(`${de(30)} €`) && text.includes('20.09.2026'), 'Zahlung bei Erstellung (Datum, Betrag)', '20.09.2026 / 30,00');
    firstPdf = pdf;
  });

  await runSection('2 Fusszeile exakt, kein Skonto, Bewertung nur mit konfiguriertem Ziel', async () => {
    const text = firstPdf ? firstPdf.text : '';
    const footerParts = [
      'Online Point GmbH', 'Kurfürstenstraße 106', '10787 Berlin', 'Tel. 030 403 688 951', 'kontakt@onlinepoint-gmbh.de',
      'Commerzbank AG', 'IBAN DE95100400000501905400', 'BIC COBADEFFXXX',
      'Amtsgericht Charlottenburg', 'HRB 136735 B', 'Geschäftsführer Julian Szymansky', 'USt-IdNr. DE318981969',
    ];
    const missing = footerParts.filter((part) => !text.includes(part));
    check(missing.length === 0, 'Fusszeile enthaelt alle Pflichtangaben exakt', missing.length ? `fehlt: ${missing.join(' | ')}` : 'vollstaendig');
    check(!/Kurfuerstenstrasse|Geschaeftsfuehrer|Ust-IdNr\./.test(text), 'keine ersetzten Umlaute / falsche Schreibweise', (text.match(/Kurfuerstenstrasse|Geschaeftsfuehrer|Ust-IdNr\./) || ['-'])[0]);
    check(!/skonto/i.test(text), 'kein Skonto im PDF', 'geprueft');
    const review = 'Wenn Sie mit der Reparatur zufrieden waren, bewerten Sie uns gern. Wir freuen uns auf Ihr Feedback!';
    check(text.replace(/\s+/g, ' ').includes(review), 'Bewertungstext exakt', review);
    check(qrCalls.length === 0, 'ohne GOOGLE_REVIEW_URL: kein QR-Code, keine erfundene Adresse', JSON.stringify(qrCalls));

    process.env.GOOGLE_REVIEW_URL = 'https://g.page/r/TEST-KONFIGURIERT/review';
    qrCalls.length = 0;
    await capturePdf(async () => InvoicePdfService.generate(await Invoice.findById(invoice._id)));
    check(qrCalls.length === 1 && qrCalls[0] === 'https://g.page/r/TEST-KONFIGURIERT/review', 'QR-Code kodiert genau das konfigurierte Ziel', JSON.stringify(qrCalls));
    delete process.env.GOOGLE_REVIEW_URL;
  });

  await runSection('3 Archiviertes PDF: identisch erneut abrufbar, unveraendert nach Zahlung', async () => {
    const first = await call('GET', `/api/invoices/${invoice._id}/pdf`, { user: customer, raw: true });
    check(first.status === 200 && first.buffer && first.buffer.slice(0, 4).toString() === '%PDF', 'Kunde laedt PDF (200, %PDF)', first.status);
    const second = await call('GET', `/api/invoices/${invoice._id}/pdf`, { user: admin, raw: true });
    const sha = (buf) => (buf ? crypto.createHash('sha256').update(buf).digest('hex') : '');
    check(second.status === 200 && sha(first.buffer) === sha(second.buffer), 'zweiter Abruf liefert byte-identisches Dokument', `${sha(first.buffer).slice(0, 12)} / ${sha(second.buffer).slice(0, 12)}`);
    const stored = await Invoice.findById(invoice._id).select('+documentArchive.data').lean();
    // Die Bytes liegen in der Archivsammlung (InvoiceDocumentArchive), am Beleg nur der Verweis.
    const archivedDoc = stored.documentArchive && stored.documentArchive.documentId
      ? await mongoose.model('InvoiceDocumentArchive').findById(stored.documentArchive.documentId).lean()
      : null;
    const archivedBytes = archivedDoc && archivedDoc.data ? Buffer.from(archivedDoc.data.read(0, archivedDoc.data.length())) : null;
    check(archivedBytes && sha(archivedBytes) === sha(first.buffer) && stored.documentArchive.sha256 === sha(first.buffer) && !stored.documentArchive.data,
      'PDF ist in der Datenbank archiviert (eigene Archivsammlung, sha256 stimmt, keine Inline-Bytes)', stored.documentArchive ? stored.documentArchive.sha256 : 'kein Archiv');
    check(stored.issueSnapshot && round2(stored.issueSnapshot.openAmount) === 54.92, 'offener Betrag bei Erstellung festgehalten', stored.issueSnapshot ? stored.issueSnapshot.openAmount : '-');

    await FinancialService.addInvoicePayment(invoice._id, { amount: 54.92, paymentMethod: 'sepa', paymentDate: new Date(), note: 'Restzahlung' });
    const afterPayment = await call('GET', `/api/invoices/${invoice._id}/pdf`, { user: customer, raw: true });
    check(afterPayment.status === 200 && sha(afterPayment.buffer) === sha(first.buffer), 'nach spaeterer Zahlung: PDF unveraendert (historisch)', sha(afterPayment.buffer).slice(0, 12));
    const balance = await PaymentService.computeInvoiceBalance(invoice._id);
    check(balance && balance.open === 0 && balance.paymentState === 'paid', 'aktueller Stand kommt aus dem Saldo (bezahlt, offen 0)', balance ? `${balance.paymentState} / ${balance.open}` : '-');
  });

  let draft = null;
  await runSection('4 Zugriff: Admin, Mitarbeiter, Eigentuemer ja - fremder Kunde nein', async () => {
    const staffPdf = await call('GET', `/api/invoices/${invoice._id}/pdf`, { user: staff, raw: true });
    check(staffPdf.status === 200, 'Mitarbeiter laedt PDF', staffPdf.status);
    const foreign = await call('GET', `/api/invoices/${invoice._id}/pdf`, { user: stranger });
    check(foreign.status === 403 && /keine Berechtigung/i.test(foreign.body?.error || ''), 'fremder Kunde: 403 mit deutscher Meldung (PDF)', `${foreign.status} ${foreign.body?.error}`);
    const foreignDetail = await call('GET', `/api/invoices/${invoice._id}`, { user: stranger });
    check(foreignDetail.status === 403 && /keine Berechtigung/i.test(foreignDetail.body?.error || ''), 'fremder Kunde: 403 mit deutscher Meldung (Detail)', `${foreignDetail.status} ${foreignDetail.body?.error}`);
    const foreignList = await call('GET', '/api/invoices', { user: stranger });
    check(foreignList.status === 200 && (foreignList.body?.invoices || []).length === 0, 'fremder Kunde sieht die Rechnung nicht in seiner Liste', (foreignList.body?.invoices || []).length);

    draft = await Invoice.create({
      customerId: customer._id, customerName: customer.name, customerEmail: customer.email,
      items: [{ description: 'Entwurf', quantity: 1, unitPrice: 10, total: 10, type: 'fee' }],
      dueDate: new Date(Date.now() + 7 * 86400000), status: 'draft',
    });
    const draftPdf = await call('GET', `/api/invoices/${draft._id}/pdf`, { user: customer });
    check(draftPdf.status === 404 && /nicht gefunden/i.test(draftPdf.body?.error || ''), 'Entwurf fuer Kunden unsichtbar (404, deutsch)', `${draftPdf.status} ${draftPdf.body?.error}`);

    const staffList = await call('GET', `/api/invoices/for-order/${order._id}`, { user: staff });
    const staffIds = (staffList.body?.invoices || []).map((entry) => String(entry._id));
    check(staffList.status === 200 && staffIds.includes(String(invoice._id)), 'Mitarbeiter: Rechnungen zum Auftrag abrufbar', `${staffList.status} / ${staffIds.length}`);
    const ownList = await call('GET', `/api/invoices/for-order/${order._id}`, { user: customer });
    check(ownList.status === 200 && (ownList.body?.invoices || []).some((entry) => String(entry._id) === String(invoice._id)), 'Kunde: eigene Rechnungen zum Auftrag', ownList.status);
    const strangerList = await call('GET', `/api/invoices/for-order/${order._id}`, { user: stranger });
    check(strangerList.status === 403 || (strangerList.status === 200 && (strangerList.body?.invoices || []).length === 0), 'fremder Kunde: keine Rechnungen eines fremden Auftrags', strangerList.status);
    const detail = await call('GET', `/api/invoices/${invoice._id}`, { user: customer });
    const bookingDoc = await Booking.findById(booking._id).lean();
    check(detail.status === 200 && detail.body?.invoice?.bookingReference?.bookingNumber === bookingDoc.bookingNumber, 'Detail liefert die Buchung zum Sprung "Bestellung"', JSON.stringify(detail.body?.invoice?.bookingReference || null));
  });

  await runSection('5 Nummernkreise: atomar, getrennt, eindeutig', async () => {
    const year = 2031;
    const cn = await Promise.all(Array.from({ length: 5 }, () => DocumentSequence.allocateNumber('credit_note', year)));
    check(new Set(cn).size === 5 && cn.every((n) => /^INV-CN-2031-000[1-5]$/.test(n)), 'Gutschriften: eigener Kreis INV-CN-JJJJ-NNNN ab 0001', cn.sort().join(','));
    const idx = await DocumentSequence.collection.indexes();
    check(idx.some((i) => i.unique && i.key.documentType === 1 && i.key.year === 1), 'Unique-Index auf (documentType, year)', JSON.stringify(idx.map((i) => i.key)));
    const invIdx = await Invoice.collection.indexes();
    check(invIdx.some((i) => i.unique && i.key.invoiceNumber === 1), 'Unique-Index auf invoiceNumber', 'vorhanden');

    // Parallele Rechnungserzeugung ueber das Modell.
    const created = await Promise.all(Array.from({ length: 8 }, (unused, i) => Invoice.create({
      customerId: customer._id, customerName: customer.name, customerEmail: customer.email,
      items: [{ description: `Parallel ${i}`, quantity: 1, unitPrice: 5, total: 5, type: 'fee' }],
      dueDate: new Date(Date.now() + 7 * 86400000), status: 'sent',
    })));
    const nums = created.map((doc) => doc.invoiceNumber);
    const thisYear = new Date().getFullYear();
    check(new Set(nums).size === 8 && nums.every((n) => new RegExp(`^INV-${thisYear}-\\d{4}$`).test(n)), '8 parallele Rechnungen: eindeutig, Format INV-JJJJ-NNNN', nums.sort().join(','));

    // Seed-Skript: Trockenlauf schreibt nichts, --confirm setzt die Zaehler auf das Maximum.
    await Invoice.collection.insertMany([
      { invoiceNumber: 'INV-2029-0041', customerId: customer._id, customerName: 'Alt', customerEmail: 'alt@test.invalid', total: 1, subtotal: 1, dueDate: new Date(), status: 'paid', items: [] },
      { invoiceNumber: 'CN--CN-2029-0044', isCreditNote: true, customerId: customer._id, customerName: 'Alt', customerEmail: 'alt@test.invalid', total: -1, subtotal: -1, dueDate: new Date(), status: 'sent', items: [] },
    ]);
    const script = path.join(SERVER_DIR, 'scripts/seedDocumentSequences.js');
    const env = { ...process.env, DATABASE_URL: URI };
    const dry = execFileSync(process.execPath, [script], { env, encoding: 'utf8' });
    const afterDry = await DocumentSequence.findOne({ documentType: 'invoice', year: 2029 }).lean();
    check(/Dry-Run/.test(dry) && !afterDry, 'Seed-Trockenlauf schreibt nichts', afterDry ? afterDry.sequence : 'kein Zaehler');
    execFileSync(process.execPath, [script, '--confirm'], { env, encoding: 'utf8' });
    const inv2029 = await DocumentSequence.allocateNumber('invoice', 2029);
    const cn2029 = await DocumentSequence.allocateNumber('credit_note', 2029);
    check(inv2029 === 'INV-2029-0045' && cn2029 === 'INV-CN-2029-0045', 'nach Seed: naechste Nummern hinter dem Altbestand, beide Kreise', `${inv2029} / ${cn2029}`);
    const legacy = await Invoice.collection.find({ invoiceNumber: { $in: ['INV-2029-0041', 'CN--CN-2029-0044'] } }).toArray();
    check(legacy.length === 2, 'historische Nummern unveraendert', legacy.map((d) => d.invoiceNumber).join(','));
  });

  await runSection('6 Gutschrift-PDF (T21) und keine doppelte Minderung', async () => {
    const creditOrder = await Order.create({
      customerId: customer._id, orderNumber: 'ORD-2026-0202', deviceBrand: 'Samsung', deviceModel: 'S23', deviceType: 'Smartphone',
      errorDescription: 'Kamera', services: [{ serviceId: display._id, name: 'Displaytausch', price: 100, quantity: 1, estimatedTime: 30 }],
      totalCost: 100, discount: 0, status: 'completed',
    });
    const original = await FinancialService.createInvoiceFromOrder(creditOrder._id);
    const note = await FinancialService.createCreditNote(original._id, {
      items: [{ serviceName: 'Kulanz', description: 'Kulanz Display', quantity: 1, unitPrice: 20, total: 20, type: 'fee' }],
      reason: 'Kulanz wegen Verzögerung', correctionType: 'price_adjustment',
    });
    const pdf = await capturePdf(async () => InvoicePdfService.generate(await Invoice.findById(note._id)));
    const text = pdf.text;
    check(/Gutschrift/.test(text) && text.includes(note.invoiceNumber) && /^INV-CN-\d{4}-\d{4}$/.test(note.invoiceNumber), 'Titel und Nummer der Gutschrift', note.invoiceNumber);
    check(text.includes(original.invoiceNumber), 'Bezug auf Ursprungsrechnung', original.invoiceNumber);
    check(text.includes('ORD-2026-0202'), 'Bezug auf Auftrag', 'ORD-2026-0202');
    check(text.includes('K-10042') && text.includes(fmtDate(note.createdAt)), 'Kundennummer und Datum', 'K-10042');
    check(text.includes(`${de(Math.abs(note.subtotal))} €`) && text.includes(`${de(Math.abs(note.tax))} €`) && text.includes(`${de(20)} €`), 'Netto / MwSt / Brutto der Gutschrift', `${note.subtotal} / ${note.tax} / ${note.total}`);
    check(text.includes('19,00') && !/Offener Betrag bei Rechnungsstellung/.test(text), 'Steuersatz ausgewiesen, keine Rechnungs-Offen-Zeile', 'ok');
    check(text.includes('Kulanz wegen Verzögerung'), 'Grund der Gutschrift sichtbar', 'Kulanz wegen Verzögerung');
    check(text.includes('IBAN DE95100400000501905400'), 'Fusszeile auch auf der Gutschrift', 'IBAN');
    const balance = await PaymentService.computeInvoiceBalance(original._id);
    check(balance && balance.receivable === 80 && balance.open === 80 && balance.credited === 20, 'Saldo: 100 - 20 genau einmal gemindert', balance ? `${balance.receivable} / ${balance.open} / ${balance.credited}` : '-');
  });

  await runSection('7 Versand: persoenliche Nachricht, E-Mail-Fehler, Status', async () => {
    await SystemConfigService.getSystemConfiguration();
    // (a) Standardvorlage
    mails.length = 0;
    const note = 'Bitte beachten Sie: <b>Garantie</b> 12 Monate.\nIhr Team';
    const sent = await FinancialService.sendInvoice(invoice._id, customer.email, note);
    const html = mails[0] ? String(mails[0].html) : '';
    check(sent && sent.success && sent.customMessageDelivered === true && !sent.warning, 'Versand meldet Nachricht als zugestellt', JSON.stringify({ d: sent?.customMessageDelivered, w: sent?.warning }));
    check(html.includes('Bitte beachten Sie: &lt;b&gt;Garantie&lt;/b&gt; 12 Monate.') && html.includes('Ihr Team'), 'Nachricht steht (HTML-escaped) in der E-Mail', html ? 'enthalten?' : 'keine Mail');
    check(!html.includes('{{customMessage}}'), 'kein roher Platzhalter', 'ok');
    check(mails[0] && (mails[0].attachments || []).length === 1, 'PDF angehaengt', (mails[0]?.attachments || []).length);

    // (b) gespeicherte Vorlage OHNE Platzhalter (Altinstallation)
    const SystemConfiguration = mongoose.model('SystemConfiguration');
    const config = await SystemConfiguration.findOne();
    const tpl = (config.notificationTemplates || []).find((t) => t.name === 'Neue Rechnung verfuegbar' && t.type === 'email');
    tpl.content = String(tpl.content).replace(/{{customMessage}}/g, '');
    config.markModified('notificationTemplates');
    await config.save();
    mails.length = 0;
    await FinancialService.sendInvoice(invoice._id, customer.email, 'Persönlicher Hinweis für Sie');
    check(mails[0] && String(mails[0].html).includes('Persönlicher Hinweis für Sie'), 'Nachricht auch mit gespeicherter Vorlage ohne Platzhalter', mails[0] ? 'ok' : 'keine Mail');
    mails.length = 0;
    await FinancialService.sendInvoice(invoice._id, customer.email, '');
    check(mails[0] && !String(mails[0].html).includes('{{customMessage}}'), 'ohne Nachricht: kein Platzhalter-Rest', 'ok');

    // (c) Bezahlte Rechnung erneut senden: Status bleibt 'paid'.
    const paid = await Invoice.findById(invoice._id).lean();
    check(paid.status === 'paid', 'Rechnung ist bezahlt', paid.status);
    // (d) E-Mail-Fehler: keine neue Rechnung, Status unveraendert.
    const countBefore = await Invoice.countDocuments({});
    transportMode = 'fail';
    let error = null;
    try { await FinancialService.sendInvoice(invoice._id, customer.email, 'x'); } catch (e) { error = e; }
    transportMode = 'ok';
    const countAfter = await Invoice.countDocuments({});
    const afterFail = await Invoice.findById(invoice._id).lean();
    check(error && countAfter === countBefore, 'E-Mail-Fehler: keine neue Rechnung', `${countBefore} -> ${countAfter}`);
    check(afterFail.status === 'paid', 'E-Mail-Fehler / erneuter Versand: Status bleibt "bezahlt"', afterFail.status);
    check(error && !/Failed|Invoice/.test(error.message), 'Fehlermeldung deutsch', error ? error.message : '-');

    // (e) Direkt: Render-Schicht ersetzt auch in der Zahlungserinnerung.
    const rendered = await NotificationTemplateService.renderTemplate('Zahlungserinnerung', 'email', {
      customerName: 'X', invoiceNumber: 'INV-1', amountOpen: '1', originalDueDate: '1', dueDate: '1', dunningStage: 'Zahlungserinnerung', invoiceUrl: 'https://test.invalid', customMessage: 'Hinweis zur Zahlungsaufforderung',
    });
    check(rendered && rendered.content.includes('Hinweis zur Zahlungsaufforderung'), 'Zahlungserinnerung traegt die Nachricht', rendered ? 'ok' : 'nicht gerendert');
  });

  out(`\n==== ${pass} bestanden, ${fail} fehlgeschlagen ====`);
  server.close();
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  process.exit(fail === 0 ? 0 : 1);
}

main().catch(async (error) => {
  out('ERROR:', error.stack || error.message);
  try { await mongoose.disconnect(); } catch (e) { /* ignore */ }
  process.exit(2);
});
