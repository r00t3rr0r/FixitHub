// K11 (Admin): Label-Download im Bereich "Versand" der Auftragsdetailseite.
//  - Vorab: DHL-Integration in e2e_after muss im Dummy-/Testmodus sein (sonst KEIN Label, Abbruch).
//  - Eigene frische Buchung (Kunde partner@e2e.invalid, Warenkorb + Checkout per API) -> das Einsendelabel
//    (Kunde -> McRepair) entsteht beim Checkout im Dummy-Modus (DHL-DUMMY-...).
//  - UI (Admin): Einsendelabel als PDF herunterladen; "An Kunden versenden" im reinen Dummy-Modus (sicherer
//    Fehlschlag, die App hat fuer die Auslieferung KEINEN Dummy-Modus); dann Auslieferung (McRepair -> Kunde)
//    gegen einen LOKALEN DHL-Mock (127.0.0.1, nur waehrend dieses Laufs) erstellen + herunterladen;
//    Richtungen getrennt; Reload behaelt beide; Doppelklick/Wiederholung/parallel -> genau EIN Label.
//  - Negativ: fremder Kunde fremd@e2e.invalid bekommt keines der Labels (403/404).
//  - K11 (Runde 3): beide Karten zeigen Absender/Empfaenger (Einsendung Kunde -> McRepair, Auslieferung
//    McRepair -> Kunde), verglichen mit Kundenstammdaten/Lieferadresse der Buchung, der DHL-Konfiguration
//    und dem Payload, den der lokale Mock erhalten hat; Kunde bekommt die Team-Felder nicht.
//    Benoetigt den Server-Stand mit GET /api/orders/:id/shipments -> shipments.parties (Neustart).
// Provider: Dummy-Modus (Einsendung) bzw. lokaler Mock (Auslieferung) - KEINE echte DHL-Integrationspruefung.
const fs = require('fs'); const path = require('path'); const http = require('http');
const { makeFlow, apiLogin, api, API } = require('./flowlib');
const mongoose = require('/home/adar/Projects/FixitHub/server/node_modules/mongoose');
const DB = 'mongodb://127.0.0.1:27099/e2e_after';
const NETGUARD = path.join(__dirname, 'netguard_after.log');
const RUN = `K11L-${Date.now().toString(36).toUpperCase()}`;
const MOCK_MARKER = `e2e-k11-mock-${RUN}`;

const db = async (fn) => { const c = await mongoose.createConnection(DB).asPromise(); try { return await fn(c); } finally { await c.close(); } };
const oid = (s) => new mongoose.Types.ObjectId(String(s));
const isDhlShipping = (i) => i && i.provider === 'DHL' && i.type === 'shipping' && i.isActive !== false && !/returns/i.test(i.name || '');
const ngSize = () => (fs.existsSync(NETGUARD) ? fs.statSync(NETGUARD).size : 0);

async function rawGet(auth, url) {
  const headers = {};
  if (auth?.token) headers.Authorization = `Bearer ${auth.token}`;
  if (auth?.cookies) headers.Cookie = auth.cookies;
  const res = await fetch(`${API}${url}`, { headers });
  const buf = Buffer.from(await res.arrayBuffer());
  return { status: res.status, buf, type: res.headers.get('content-type') || '' };
}
async function orderState(orderId) {
  return db(async (c) => {
    const o = await c.collection('orders').findOne({ _id: oid(orderId) });
    return {
      status: o?.status, tracking: o?.trackingNumber || '', labelLen: String(o?.shippingLabelUrl || '').length,
      inProgress: o?.shippingLabelCreationInProgress === true, returnTracking: o?.returnTrackingNumber || '',
      labelCreatedEntries: (o?.timeline || []).filter((t) => t.status === 'Shipping Label Created').length,
    };
  });
}
async function bookingState(bookingId) {
  return db(async (c) => {
    const b = await c.collection('bookings').findOne({ _id: oid(bookingId) });
    return {
      number: b?.bookingNumber, tracking: b?.trackingNumber || '', labelLen: String(b?.shippingLabelUrl || '').length,
      returnTracking: b?.returnTrackingNumber || '', inProgress: b?.shippingLabelCreationInProgress === true,
      preparedEntries: (b?.timeline || []).filter((t) => t.status === 'Shipping Label Prepared').length,
    };
  });
}

// ---- K11 Parteien (Absender/Empfaenger) in den Versandkarten ------------------------------------------------
const squash = (s) => String(s || '').replace(/\s+/g, ' ').trim();
async function partyText(card, slot) {
  const loc = card.locator(`[data-party="${slot}"]`);
  return (await loc.count()) ? squash(await loc.innerText()) : '';
}
// Shop-Anschrift so, wie sie in der aktiven DHL-Integration steht (Quelle der Label-Erstellung).
async function expectedShop() {
  const dhl = await db(async (c) => (await c.collection('systemconfigurations').findOne({}))?.integrations?.find(isDhlShipping));
  const s = dhl?.settings || {}; const sh = s.shipper || {};
  const name = squash(s.shipperCompany || sh.company || s.shipperName);
  const street = squash([s.shipperStreet || sh.street, s.shipperNumber || sh.number].filter(Boolean).join(' '));
  const cityLine = squash([s.shipperPostalCode || sh.postalCode, s.shipperCity || sh.city].filter(Boolean).join(' '));
  const complete = Boolean(name && street && /\d/.test(street) && squash(s.shipperPostalCode || sh.postalCode) && squash(s.shipperCity || sh.city));
  return { name, street, cityLine, complete };
}
// Prueft eine McRepair-Partei: vollstaendige Konfiguration -> genau diese Anschrift, sonst "Adresse fehlt".
function shopPartyOk(txt, shop) {
  if (!/McRepair/.test(txt)) return false;
  if (shop.complete) return txt.includes(shop.name) && txt.includes(shop.street) && txt.includes(shop.cityLine) && !/Adresse fehlt/.test(txt);
  return /Adresse fehlt – bitte prüfen/.test(txt);
}
const addrLine = (a) => squash([a?.street, a?.number].filter(Boolean).join(' '));
const cityLineOf = (a) => squash([a?.zipCode || a?.postalCode, a?.city].filter(Boolean).join(' '));

// ---- lokaler DHL-Mock (nur 127.0.0.1; Antwortformat wie Parcel DE Shipping v2) ----------------------------
function pdfEscape(s) { return String(s || '').normalize('NFKD').replace(/ß/g, 'ss').replace(/[^\x20-\x7e]/g, '').replace(/([()\\])/g, '\\$1'); }
function minimalPdf(lines) {
  const stream = ['BT', '/F1 14 Tf', '50 780 Td', ...lines.flatMap((l, i) => [i ? '0 -20 Td' : '', `(${pdfEscape(l)}) Tj`]).filter(Boolean), 'ET'].join('\n');
  const objs = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj',
    '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj',
    `5 0 obj\n<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream\nendobj`,
  ];
  let pdf = '%PDF-1.4\n'; const off = [];
  objs.forEach((o) => { off.push(Buffer.byteLength(pdf)); pdf += `${o}\n`; });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${off.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
  pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return pdf;
}
function startDhlMock() {
  const mock = { tokenCalls: 0, orderCalls: 0, payloads: [], shipmentNos: [] };
  const srv = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      if (req.method === 'POST' && req.url.startsWith('/parcel/de/account/auth/ropc/v1/token')) {
        mock.tokenCalls += 1;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ access_token: 'e2e-mock-access', token_type: 'Bearer', expires_in: 1800 }));
      }
      if (req.method === 'POST' && req.url.startsWith('/parcel/de/shipping/v2/orders')) {
        mock.orderCalls += 1;
        let p = {}; try { p = JSON.parse(body); } catch (e) { /* ignore */ }
        const s = (p.shipments || [])[0] || {};
        mock.payloads.push({ shipper: s.shipper, consignee: s.consignee, refNo: s.refNo, product: s.product, billingNumber: s.billingNumber });
        const no = `DHL-DUMMY-K11M${Date.now().toString().slice(-8)}${mock.orderCalls}`;
        mock.shipmentNos.push(no);
        const pdf = minimalPdf([
          'E2E MOCK DHL - KEIN ECHTES LABEL (lokaler Mock)',
          'Auslieferung McRepair -> Kunde',
          `Sendung: ${no}`,
          `Absender: ${s.shipper?.name1 || ''}, ${s.shipper?.addressStreet || ''} ${s.shipper?.addressHouse || ''}, ${s.shipper?.postalCode || ''} ${s.shipper?.city || ''}`,
          `Empfaenger: ${s.consignee?.name1 || s.consignee?.name || ''}, ${s.consignee?.addressStreet || ''} ${s.consignee?.addressHouse || ''}, ${s.consignee?.postalCode || ''} ${s.consignee?.city || ''}`,
          `Referenz: ${s.refNo || ''}`,
        ]);
        // kurze Verzoegerung: ein zweiter, gleichzeitiger Erstellungsversuch faellt sicher in die laufende Erstellung
        return setTimeout(() => {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: { title: 'OK', statusCode: 200 }, items: [{ shipmentNo: no, sstatus: { title: 'OK', statusCode: 200 }, label: { b64: Buffer.from(pdf).toString('base64'), fileFormat: 'PDF' } }] }));
        }, 1500);
      }
      res.writeHead(404, { 'Content-Type': 'application/json' }); return res.end('{}');
    });
  });
  return new Promise((resolve) => srv.listen(0, '127.0.0.1', () => resolve({ srv, mock, url: `http://127.0.0.1:${srv.address().port}` })));
}
const MOCK_SHOP = { shipperCompany: 'McRepair E2E Werkstatt', shipperStreet: 'Werkstattweg', shipperNumber: '5', shipperPostalCode: '20095', shipperCity: 'Hamburg', shipperCountry: 'DE' };
async function patchDhlForMock(mockUrl) {
  return db(async (c) => {
    const col = c.collection('systemconfigurations');
    const doc = await col.findOne({});
    const idx = (doc?.integrations || []).findIndex(isDhlShipping);
    if (idx < 0) throw new Error('keine aktive DHL-Integration');
    const original = doc.integrations[idx];
    const patched = {
      ...original,
      credentials: { ...(original.credentials || {}), apiEndpoint: mockUrl, clientId: 'e2e-mock-client', clientSecret: 'e2e-mock-secret', username: 'e2e-mock-user', password: 'e2e-mock-pass' },
      settings: { ...(original.settings || {}), environment: 'sandbox', accountId: '33333333330101', ...MOCK_SHOP, e2eMockMarker: MOCK_MARKER },
    };
    await col.updateOne({ _id: doc._id }, { $set: { [`integrations.${idx}`]: patched } });
    return original;
  });
}
async function restoreDhl(original) {
  if (!original) return 'nichts zu tun';
  return db(async (c) => {
    const col = c.collection('systemconfigurations');
    const doc = await col.findOne({});
    const idx = (doc?.integrations || []).findIndex((i) => i?.settings?.e2eMockMarker === MOCK_MARKER);
    if (idx < 0) return 'Mock-Eintrag nicht (mehr) vorhanden';
    const current = doc.integrations[idx];
    const restored = { ...original, settings: { ...(original.settings || {}), bookingLabelMode: current.settings?.bookingLabelMode ?? original.settings?.bookingLabelMode } };
    if (!original.credentials) delete restored.credentials;
    await col.updateOne({ _id: doc._id }, { $set: { [`integrations.${idx}`]: restored } });
    return 'wiederhergestellt';
  });
}

(async () => {
  const f = makeFlow('k11_admin_label_download'); await f.start();
  let a; let mockCtx = null; let dhlOriginal = null; let addedDhlTestIntegration = false;
  const ng0 = ngSize();
  try {
    // ---- 0) DHL-Modus pruefen (Integrationsdokument) ------------------------------------------------------
    // Frisch eingespielte e2e_after ohne DHL-Integration: dieselbe Test-Integration wie flow_k10_k11
    // (nur bookingLabelMode=dummy, keine Zugangsdaten), am Ende wieder entfernt.
    if (!(await db(async (c) => (await c.collection('systemconfigurations').findOne({}))?.integrations?.find(isDhlShipping)))) {
      await db(async (c) => {
        const col = c.collection('systemconfigurations'); const doc = await col.findOne({});
        const entry = { name: 'DHL Paket (E2E)', provider: 'DHL', type: 'shipping', isActive: true, settings: { bookingLabelMode: 'dummy', e2eAddedBy: RUN } };
        if (doc) await col.updateOne({ _id: doc._id }, { $push: { integrations: entry } }); else await col.insertOne({ integrations: [entry] });
      });
      addedDhlTestIntegration = true;
      f.note('   Testkonfiguration: keine DHL-Integration in e2e_after -> Test-Integration wie flow_k10_k11 angelegt (dummy, ohne Zugangsdaten); wird am Ende entfernt');
    }
    const dhl = await db(async (c) => (await c.collection('systemconfigurations').findOne({}))?.integrations?.find(isDhlShipping));
    const mode = String(dhl?.settings?.bookingLabelMode || '').toLowerCase();
    const cred = dhl?.credentials || {};
    const hasLiveCreds = Boolean(cred.clientId || cred.username || cred.password || dhl?.apiKey || dhl?.settings?.accountId || dhl?.settings?.accountNumber);
    f.note(`   DHL-Integration: name="${dhl?.name}" bookingLabelMode=${mode || '(leer)'} Zugangsdaten/EKP hinterlegt=${hasLiveCreds}`);
    if (!f.check(mode === 'dummy' && !hasLiveCreds, 'DHL-Integration in e2e_after ist im Dummy-/Testmodus (keine Zugangsdaten, kein EKP)', mode)) {
      f.note('   ABBRUCH: DHL nicht im Dummy-Modus - es werden KEINE Labels erstellt.');
      await f.finish(); return;
    }

    // ---- 1) Testdaten: frische Buchung als Kunde (Warenkorb + Checkout per API) ---------------------------
    const cust = await apiLogin('customer');
    const svc = await db(async (c) => c.collection('services').findOne({ name: 'Diagnose E2E', isActive: true }));
    const marker = `E2E ${RUN} Labeltest Admin`;
    let r = await api(cust, 'POST', '/api/cart/add-repair-order', { deviceType: 'Smartphone', deviceBrand: 'Apple', deviceModel: 'iPhone 15', services: [String(svc._id)], addOns: [], totalCost: 49.9, errorDescription: marker, waterDamage: 'no', previousRepairAttempts: 'no', itemCondition: 'original', noLock: true });
    f.note(`   Testdaten: Warenkorb (Kunde partner@e2e.invalid, API) Reparatur "${marker}" -> ${r.status}`);
    r = await api(cust, 'POST', '/api/checkout/complete', { paymentMethod: 'paypal', checkoutAttemptId: `e2e-${RUN}` });
    f.note(`   Testdaten: Checkout (API, PayPal ausstehend, keine Zahlung) -> ${r.status} ${r.data?.bookingNumber || JSON.stringify(r.data).slice(0, 200)}`);
    const bookingId = String(r.data?.bookingId || r.data?.booking?._id || '');
    const bookingNumber = r.data?.bookingNumber || r.data?.booking?.bookingNumber;
    if (!bookingId) throw new Error('Checkout lieferte keine Buchung');
    const orders = await db(async (c) => c.collection('orders').find({ bookingId: oid(bookingId) }).toArray());
    f.check(orders.length === 1 && orders[0].errorDescription === marker, 'Testbuchung enthaelt genau den eigenen Auftrag (keine fremden Warenkorbposten)', `${bookingNumber} orders=${orders.length}`);
    const order = orders.find((o) => o.errorDescription === marker) || orders[0];
    const orderId = String(order._id);
    f.note(`   Testdaten: Buchung ${bookingNumber} (${bookingId}), Auftrag ${order.orderNumber} (${orderId})`);
    const b0 = await bookingState(bookingId);
    f.check(/^DHL-DUMMY-/.test(b0.tracking) && b0.labelLen > 100, 'Checkout hat im Dummy-Modus genau ein Einsendelabel (Kunde -> McRepair) an der Buchung erzeugt', b0.tracking);
    const adm = await apiLogin('admin');
    r = await api(adm, 'PUT', `/api/orders/${orderId}/status`, { status: 'quality-check', reason: `E2E ${RUN}: Vorbereitung Auslieferung` });
    f.note(`   Testdaten: Admin setzt Auftrag per API auf "quality-check" (Voraussetzung fuer "An Kunden versenden") -> ${r.status}`);

    // ---- 2) UI Admin: Versand-Tab ------------------------------------------------------------------------
    a = await f.session('admin');
    await f.goto(a, `/orders/${orderId}`, 4000);
    await a.getByRole('tab', { name: /^Versand/ }).click();
    await a.waitForTimeout(2500);
    const inCard = a.locator('section[aria-labelledby="admin-od-inbound-title"]');
    const outCard = a.locator('section[aria-labelledby="admin-od-outbound-title"]');
    await inCard.waitFor({ timeout: 15000 });
    await f.shot(a, 'versand_vor_auslieferung', true);
    let inTxt = (await inCard.innerText()).replace(/\s+/g, ' ');
    let outTxt = (await outCard.innerText()).replace(/\s+/g, ' ');
    f.note(`   Einsendung-Karte: ${inTxt.slice(0, 300)}`);
    f.note(`   Auslieferung-Karte: ${outTxt.slice(0, 300)}`);
    f.check(/Einsendung/.test(inTxt) && /Kunde → McRepair/.test(inTxt) && inTxt.includes(b0.tracking) && inTxt.includes(bookingNumber), 'Einsendung (Kunde → McRepair) zeigt die Sendungsnummer dieser Buchung', b0.tracking);
    f.check(/Testlabel/.test(inTxt), 'Einsendung ist sichtbar als Testlabel gekennzeichnet');
    f.check(/Auslieferung/.test(outTxt) && /McRepair → Kunde/.test(outTxt) && !outTxt.includes(b0.tracking), 'Auslieferung (McRepair → Kunde) getrennt, ohne die Einsende-Sendungsnummer');
    f.check(/Absender ist McRepair, Empfänger die Lieferadresse des Kunden/.test(outTxt), 'Auslieferung nennt Richtung/Parteien (Absender McRepair, Empfänger Lieferadresse Kunde)');
    f.check(/Testmodus – Dummy-Label/.test(await a.locator('#admin-od-shipping').innerText()), 'Hinweis "Testmodus – Dummy-Label (kein echtes DHL-Label)" sichtbar');

    // ---- 2b) K11: Absender/Empfaenger je Richtung (Quelle wie Label-Erstellung) ---------------------------
    // Einsendung (Buchungs-Einsendelabel, BookingService.buildBookingShipmentData): Kunde = Absender mit der
    // Rechnungsadresse des Profils; Auslieferung (resolveDeliveryAddress): Lieferadresse des Auftrags.
    const custDoc = await db(async (c) => c.collection('users').findOne({ email: 'partner@e2e.invalid' }, { projection: { firstName: 1, lastName: 1, name: 1, invoiceAddress: 1, paymentAddress: 1 } }));
    const expName = squash(`${custDoc?.firstName || ''} ${custDoc?.lastName || ''}`) || squash(custDoc?.name);
    const expInbound = custDoc?.invoiceAddress || {};
    const oSnap = order.shippingAddress || {};
    const expDelivery = (oSnap.street || oSnap.city || oSnap.zipCode) ? oSnap
      : (custDoc?.paymentAddress && custDoc.paymentAddress.sameAsInvoice === false ? custDoc.paymentAddress : expInbound);
    f.note(`   erwartet: Kunde "${expName}", Einsende-Absender ${addrLine(expInbound)}, ${cityLineOf(expInbound)} | Auslieferungs-Empfaenger ${addrLine(expDelivery)}, ${cityLineOf(expDelivery)} (Quelle ${oSnap.street ? 'Lieferadresse Auftrag' : 'Profil'})`);
    const shop0 = await expectedShop();
    f.note(`   erwartet: McRepair laut DHL-Integration ${shop0.complete ? `${shop0.name}, ${shop0.street}, ${shop0.cityLine}` : 'unvollstaendig -> "Adresse fehlt – bitte prüfen"'}`);
    let inS = await partyText(inCard, 'inbound-sender'); let inR = await partyText(inCard, 'inbound-recipient');
    let outS = await partyText(outCard, 'outbound-sender'); let outR = await partyText(outCard, 'outbound-recipient');
    f.note(`   UI Einsendung: [${inS}] -> [${inR}]`);
    f.note(`   UI Auslieferung: [${outS}] -> [${outR}]`);
    f.check(/^Absender/.test(inS) && /Kunde/.test(inS) && inS.includes(expName) && inS.includes(addrLine(expInbound)) && inS.includes(cityLineOf(expInbound)) && !/Adresse fehlt/.test(inS),
      'Einsendung: Absender = Kunde (Name + Anschrift wie das Buchungs-Einsendelabel)', inS);
    f.check(/^Empfänger/.test(inR) && shopPartyOk(inR, shop0), 'Einsendung: Empfänger = McRepair (Anschrift aus der DHL-Integration bzw. "Adresse fehlt – bitte prüfen")', inR);
    f.check(/^Absender/.test(outS) && shopPartyOk(outS, shop0), 'Auslieferung: Absender = McRepair (Anschrift aus der DHL-Integration bzw. "Adresse fehlt – bitte prüfen")', outS);
    f.check(/^Empfänger/.test(outR) && /Kunde/.test(outR) && outR.includes(expName) && outR.includes(addrLine(expDelivery)) && outR.includes(cityLineOf(expDelivery)) && !/Adresse fehlt/.test(outR),
      'Auslieferung: Empfänger = Kunde (Lieferadresse wie bei der Label-Erstellung)', outR);
    const partyOrder = await a.locator('#admin-od-shipping [data-party]').evaluateAll((els) => els.map((e) => e.getAttribute('data-party')));
    f.check(JSON.stringify(partyOrder) === JSON.stringify(['inbound-sender', 'inbound-recipient', 'outbound-sender', 'outbound-recipient']),
      'Reihenfolge je Karte: erst Absender, dann Empfänger (Richtung eindeutig)', partyOrder.join(','));
    await f.shot(a, 'versand_parteien_vor_auslieferung', true);
    const statusBtnTxt = ((await a.getByRole('button', { name: /^\s*(Qualitätskontrolle|quality-check)\s*$/ }).first().innerText().catch(() => '')) || '').trim();
    f.check(statusBtnTxt === 'Qualitätskontrolle', 'Kopf "Reparaturstatus" zeigt den deutschen Status (nicht das Roh-Enum "quality-check")', statusBtnTxt || '(nicht gefunden)');

    // ---- 3) UI Admin: Einsendelabel herunterladen --------------------------------------------------------
    const inDl = inCard.getByRole('button', { name: /(Testlabel|Einsendelabel) herunterladen/ });
    const [d1] = await Promise.all([a.waitForEvent('download', { timeout: 20000 }), inDl.click()]);
    const inFile = path.join(f.out, `admin_${d1.suggestedFilename()}`);
    await d1.saveAs(inFile);
    const inPdf = fs.readFileSync(inFile);
    f.check(inPdf.slice(0, 5).toString() === '%PDF-', 'Einsendelabel-Download (Admin) ist eine PDF-Datei', `${d1.suggestedFilename()} ${inPdf.length} B`);
    f.check(d1.suggestedFilename().includes(bookingNumber) && inPdf.toString('latin1').includes(bookingNumber) && inPdf.toString('latin1').includes(b0.tracking),
      'Einsendelabel gehoert zu dieser Buchung (Dateiname + PDF-Inhalt: Buchungsnummer und Sendungsnummer)', d1.suggestedFilename());
    await f.shot(a, 'einsendelabel_heruntergeladen');

    // ---- 4) UI Admin: "An Kunden versenden" im reinen Dummy-Modus (kein Auslieferungs-Dummy in der App) ---
    const ngBeforeDummy = ngSize();
    const createBtn = outCard.getByRole('button', { name: /An Kunden versenden/ });
    f.check(await createBtn.count() === 1 && await createBtn.isEnabled(), '"An Kunden versenden" ist im Status Qualitätsprüfung freigegeben');
    await createBtn.click();
    await a.waitForTimeout(3500);
    const bodyAfterDummy = (await a.locator('body').innerText()).replace(/\s+/g, ' ');
    await f.shot(a, 'auslieferung_dummymodus_fehlermeldung');
    const sDummy = await orderState(orderId);
    f.check(/Versandlabel konnte nicht erstellt werden/.test(bodyAfterDummy), 'Dummy-Modus: klare deutsche Fehlermeldung statt stiller Erstellung', (bodyAfterDummy.match(/Versandlabel konnte nicht erstellt werden.{0,140}/) || [''])[0]);
    f.check(!sDummy.tracking && sDummy.labelLen === 0 && !sDummy.inProgress, 'Dummy-Modus: kein Auslieferungslabel und keine haengende Sperre gespeichert', JSON.stringify(sDummy));
    f.check(ngSize() === ngBeforeDummy, 'Dummy-Modus: kein externer Verbindungsversuch (netguard unveraendert)');

    // ---- 5) Testkonfiguration: lokaler DHL-Mock nur fuer die Auslieferung ---------------------------------
    mockCtx = await startDhlMock();
    dhlOriginal = await patchDhlForMock(mockCtx.url);
    f.note(`   Testdaten: DHL-Integration (e2e_after) temporaer auf LOKALEN Mock ${mockCtx.url} gesetzt (Sandbox, Test-EKP, Test-Shopadresse ${MOCK_SHOP.shipperStreet} ${MOCK_SHOP.shipperNumber}, ${MOCK_SHOP.shipperPostalCode} ${MOCK_SHOP.shipperCity}); bookingLabelMode bleibt dummy`);
    await a.reload({ waitUntil: 'domcontentloaded' }); await a.waitForTimeout(3500);
    await a.getByRole('tab', { name: /^Versand/ }).click(); await a.waitForTimeout(2000);
    // Doppelklick wie ein ungeduldiger Mitarbeiter; WAEHREND die Erstellung beim Provider laeuft (Mock
    // antwortet nach 1,5 s) kommen zusaetzlich zwei gleichzeitige Anfragen ueber die echte Route (zweiter Tab/Retry).
    let uiCreateRequests = 0;
    const countCreate = (req) => { if (req.method() === 'POST' && /\/shipping\/create-label$/.test(req.url())) uiCreateRequests += 1; };
    a.on('request', countCreate);
    await outCard.getByRole('button', { name: /An Kunden versenden/ }).dblclick();
    await a.waitForTimeout(400);
    const inflight = await Promise.all([1, 2].map(() => api(adm, 'POST', `/api/orders/${orderId}/shipping/create-label`, { shipmentData: { labelDirection: 'outbound' } })));
    f.note(`   gleichzeitige Anfragen waehrend der laufenden Erstellung: ${inflight.map((p) => `${p.status} ${p.data?.code || (p.data?.alreadyExists ? 'alreadyExists' : '')}`).join(' | ')}`);
    await a.waitForFunction(() => /Versandlabel für den Kunden erstellt|Versandlabel bereits vorhanden|Versandlabel konnte nicht erstellt werden/.test(document.body.innerText), null, { timeout: 30000 }).catch(() => {});
    await a.waitForTimeout(2500);
    const bodyAfterCreate = (await a.locator('body').innerText()).replace(/\s+/g, ' ');
    await f.shot(a, 'auslieferung_erstellt', true);
    const s1 = await orderState(orderId);
    f.check(/Versandlabel für den Kunden erstellt/.test(bodyAfterCreate), 'UI meldet "Versandlabel für den Kunden erstellt"', (bodyAfterCreate.match(/Versandlabel für den Kunden erstellt.{0,120}/) || [''])[0]);
    f.check(/^DHL-DUMMY-K11M/.test(s1.tracking) && s1.labelLen > 100 && !s1.inProgress && s1.status === 'quality-check', 'Auslieferungslabel am Auftrag gespeichert (Mock-Sendungsnummer, PDF, Sperre geloest)', s1.tracking);
    a.off('request', countCreate);
    f.check(uiCreateRequests === 1, 'Doppelklick in der UI sendet nur EINE Erstellungsanfrage (Button sofort gesperrt)', `UI-Anfragen=${uiCreateRequests}`);
    f.check(inflight.every((p) => p.status === 409 && p.data?.code === 'LABEL_CREATION_IN_PROGRESS'),
      'gleichzeitige Anfragen waehrend der laufenden Erstellung werden vom Server mit 409 LABEL_CREATION_IN_PROGRESS abgewiesen', inflight.map((p) => `${p.status} ${p.data?.code || ''}`).join(' | '));
    f.check(mockCtx.mock.orderCalls === 1 && s1.labelCreatedEntries === 1, 'insgesamt genau EIN Label-Aufruf beim Provider und ein Verlaufseintrag', `orders=${mockCtx.mock.orderCalls} verlauf=${s1.labelCreatedEntries}`);
    const pl = mockCtx.mock.payloads[0] || {};
    f.check(pl.shipper?.name1 === MOCK_SHOP.shipperCompany && pl.shipper?.addressStreet === MOCK_SHOP.shipperStreet && pl.shipper?.postalCode === MOCK_SHOP.shipperPostalCode,
      'Auslieferung an DHL: Absender = konfigurierte Shop-Adresse (McRepair)', JSON.stringify(pl.shipper || {}).slice(0, 160));
    f.check(pl.consignee?.name1 === 'Paula Partner' && pl.consignee?.addressStreet === 'Teststraße' && String(pl.consignee?.addressHouse) === '1' && pl.consignee?.postalCode === '10115' && pl.consignee?.city === 'Berlin',
      'Auslieferung an DHL: Empfänger = Kundenadresse (Paula Partner, Teststraße 1, 10115 Berlin)', JSON.stringify(pl.consignee || {}).slice(0, 200));
    // K11: Karten zeigen nach der Erstellung genau die Parteien, die der Mock erhalten hat.
    await a.waitForFunction(() => /Werkstattweg/.test(document.querySelector('[data-party="outbound-sender"]')?.textContent || ''), null, { timeout: 15000 }).catch(() => {});
    outS = await partyText(outCard, 'outbound-sender'); outR = await partyText(outCard, 'outbound-recipient');
    inR = await partyText(inCard, 'inbound-recipient');
    f.note(`   UI Auslieferung (Mock-Konfiguration): [${outS}] -> [${outR}]`);
    const plShipLine = squash(`${pl.shipper?.addressStreet || ''} ${pl.shipper?.addressHouse || ''}`);
    const plConsLine = squash(`${pl.consignee?.addressStreet || ''} ${pl.consignee?.addressHouse || ''}`);
    f.check(/^Absender/.test(outS) && /McRepair/.test(outS) && outS.includes(pl.shipper?.name1 || '§') && outS.includes(plShipLine) && outS.includes(squash(`${pl.shipper?.postalCode} ${pl.shipper?.city}`)) && !/Adresse fehlt/.test(outS),
      'UI Auslieferung: Absender = Mock-Payload shipper (McRepair E2E Werkstatt, Werkstattweg 5, 20095 Hamburg)', `${outS} || payload ${pl.shipper?.name1}, ${plShipLine}`);
    f.check(/^Empfänger/.test(outR) && outR.includes(pl.consignee?.name1 || '§') && outR.includes(plConsLine) && outR.includes(squash(`${pl.consignee?.postalCode} ${pl.consignee?.city}`))
      && outR.includes(addrLine(expDelivery)) && outR.includes(cityLineOf(expDelivery)),
      'UI Auslieferung: Empfänger = Mock-Payload consignee = Lieferadresse des Auftrags', `${outR} || payload ${pl.consignee?.name1}, ${plConsLine}`);
    f.check(/^Empfänger/.test(inR) && inR.includes(MOCK_SHOP.shipperCompany) && inR.includes(`${MOCK_SHOP.shipperStreet} ${MOCK_SHOP.shipperNumber}`) && inR.includes(`${MOCK_SHOP.shipperPostalCode} ${MOCK_SHOP.shipperCity}`),
      'UI Einsendung: Empfänger McRepair aus derselben DHL-Integration (Mock-Shopadresse)', inR);
    f.check(/maßgeblich ist das bereits erstellte Label/.test(outTxt = squash(await outCard.innerText())), 'Hinweis: Anschriften aus aktuellen Stammdaten, maßgeblich ist das erstellte Label');
    await f.shot(a, 'versand_parteien_nach_auslieferung', true);

    // zweiter Klick ist in der UI nicht mehr moeglich; Wiederholung + parallele Versuche ueber die echte Route
    outTxt = (await outCard.innerText()).replace(/\s+/g, ' ');
    f.check(await outCard.getByRole('button', { name: /An Kunden versenden/ }).count() === 0 && outTxt.includes(s1.tracking), 'UI: nach Erstellung kein zweiter "An Kunden versenden"-Button, Sendungsnummer in der Auslieferung');
    const retry = await api(adm, 'POST', `/api/orders/${orderId}/shipping/create-label`, { shipmentData: { labelDirection: 'outbound' } });
    const par = await Promise.all([1, 2, 3].map(() => api(adm, 'POST', `/api/orders/${orderId}/shipping/create-label`, { shipmentData: { labelDirection: 'outbound' } })));
    const s2 = await orderState(orderId);
    f.check(s2.tracking === s1.tracking && mockCtx.mock.orderCalls === 1 && s2.labelCreatedEntries === 1,
      'Wiederholung + 3 parallele Erstellungsversuche (Provider erreichbar) erzeugen KEIN zweites Label (DB + Mock-Zaehler)',
      `retry=${retry.status}${retry.data?.alreadyExists ? '/alreadyExists' : ''} parallel=${par.map((p) => p.status).join(',')} orders=${mockCtx.mock.orderCalls}`);
    f.note(`   Restore DHL-Konfiguration: ${await restoreDhl(dhlOriginal)}`); dhlOriginal = null;
    await new Promise((res) => mockCtx.srv.close(res));

    // ---- 6) UI Admin: Auslieferungslabel herunterladen ---------------------------------------------------
    const outDl = outCard.getByRole('button', { name: /Versandlabel herunterladen/ });
    const [d2] = await Promise.all([a.waitForEvent('download', { timeout: 20000 }), outDl.click()]);
    const outFile = path.join(f.out, `admin_${d2.suggestedFilename()}`);
    await d2.saveAs(outFile);
    const outPdf = fs.readFileSync(outFile);
    const outPdfTxt = outPdf.toString('latin1');
    f.check(outPdf.slice(0, 5).toString() === '%PDF-', 'Auslieferungslabel-Download (Admin) ist eine PDF-Datei', `${d2.suggestedFilename()} ${outPdf.length} B`);
    f.check(d2.suggestedFilename().includes(order.orderNumber) && outPdfTxt.includes(s1.tracking) && /Paula Partner/.test(outPdfTxt) && /McRepair E2E Werkstatt/.test(outPdfTxt) && !outPdfTxt.includes(b0.tracking),
      'Auslieferungslabel gehoert zu diesem Auftrag (Auftragsnummer, eigene Sendungsnummer, Absender Shop -> Empfänger Kunde) und ist nicht das Einsendelabel', d2.suggestedFilename());

    // ---- 7) Reload: beide Labels bleiben erreichbar ------------------------------------------------------
    await a.evaluate(() => { try { sessionStorage.clear(); } catch (e) { /* ignore */ } });
    await a.reload({ waitUntil: 'domcontentloaded' }); await a.waitForTimeout(4000);
    await a.getByRole('tab', { name: /^Versand/ }).click(); await a.waitForTimeout(2500);
    inTxt = (await inCard.innerText()).replace(/\s+/g, ' ');
    outTxt = (await outCard.innerText()).replace(/\s+/g, ' ');
    await f.shot(a, 'versand_nach_reload', true);
    f.check(inTxt.includes(b0.tracking) && !inTxt.includes(s1.tracking) && await inCard.getByRole('button', { name: /(Testlabel|Einsendelabel) herunterladen/ }).count() === 1,
      'nach Reload: Einsendung mit eigener Sendungsnummer + Download-Button');
    f.check(outTxt.includes(s1.tracking) && !outTxt.includes(b0.tracking) && await outCard.getByRole('button', { name: /Versandlabel herunterladen/ }).count() === 1
      && await outCard.getByRole('button', { name: /An Kunden versenden/ }).count() === 0 && await inCard.getByRole('button', { name: /DHL-Einsendelabel erstellen/ }).count() === 0,
      'nach Reload: Auslieferung mit eigener Sendungsnummer + Download, keine Erstellen-Buttons mehr');
    // K11: nach Wiederherstellung der Konfiguration zeigt McRepair wieder den echten Konfigurationsstand
    // (bei unvollstaendiger Test-Integration ausdruecklich "Adresse fehlt – bitte prüfen", nichts geraten).
    const shop1 = await expectedShop();
    inS = await partyText(inCard, 'inbound-sender'); inR = await partyText(inCard, 'inbound-recipient');
    outS = await partyText(outCard, 'outbound-sender'); outR = await partyText(outCard, 'outbound-recipient');
    f.note(`   UI nach Reload: Einsendung [${inS}] -> [${inR}] | Auslieferung [${outS}] -> [${outR}]`);
    f.check(shopPartyOk(inR, shop1) && shopPartyOk(outS, shop1) && !inR.includes(MOCK_SHOP.shipperStreet) && !outS.includes(MOCK_SHOP.shipperStreet),
      'nach Reload: McRepair-Anschrift folgt der wiederhergestellten DHL-Integration (keine Mock-Adresse mehr)', `${shop1.complete ? 'vollstaendig' : 'unvollstaendig'}`);
    f.check(inS.includes(expName) && inS.includes(addrLine(expInbound)) && outR.includes(expName) && outR.includes(addrLine(expDelivery)),
      'nach Reload: Kundenseite beider Karten unverändert');
    const admShip = await api(adm, 'GET', `/api/orders/${orderId}/shipments`);
    const custShip = await api(cust, 'GET', `/api/orders/${orderId}/shipments`);
    const custDetail = await api(cust, 'GET', `/api/orders/${orderId}`);
    f.check(admShip.status === 200 && admShip.data?.shipments?.parties?.outbound?.recipient?.role === 'customer'
      && custShip.status === 200 && custShip.data?.shipments && !('parties' in custShip.data.shipments)
      && custDetail.status === 200 && !('parties' in (custDetail.data?.order?.shipments || {})),
      'API: Parteien nur für das Team; Kunde (Inhaber) erhält weder in /shipments noch im Auftragsdetail Team-Felder', `${admShip.status}/${custShip.status}/${custDetail.status}`);
    const [d3] = await Promise.all([a.waitForEvent('download', { timeout: 20000 }), inCard.getByRole('button', { name: /(Testlabel|Einsendelabel) herunterladen/ }).click()]);
    const inAgain = fs.readFileSync(await d3.path()).toString('latin1');
    f.check(inAgain.startsWith('%PDF-') && inAgain.includes(b0.tracking), 'nach Reload: erneuter Einsende-Download liefert dasselbe Label');
    const b1 = await bookingState(bookingId); const s3 = await orderState(orderId);
    f.check(b1.tracking === b0.tracking && b1.preparedEntries === 1 && !b1.returnTracking && !s3.returnTracking && s3.tracking === s1.tracking && s3.labelCreatedEntries === 1,
      'DB: genau ein Einsendelabel (Buchung) und genau ein Auslieferungslabel (Auftrag), Downloads erzeugen nichts Neues',
      JSON.stringify({ in: b1.tracking, inEntries: b1.preparedEntries, out: s3.tracking, outEntries: s3.labelCreatedEntries }));

    // ---- 8) Negativ: fremder Kunde / Positivkontrolle Inhaber (nur API) -----------------------------------
    const other = await apiLogin('other');
    const fIn = await rawGet(other, `/api/bookings/${bookingId}/shipping-label`);
    const fOut = await rawGet(other, `/api/orders/${orderId}/shipping-label`);
    const fShip = await rawGet(other, `/api/orders/${orderId}/shipments`);
    const fCreate = await api(other, 'POST', `/api/orders/${orderId}/shipping/create-label`, { shipmentData: {} });
    f.check([403, 404].includes(fIn.status) && !fIn.buf.slice(0, 5).toString().startsWith('%PDF'), 'fremder Kunde: Einsendelabel der Buchung nicht abrufbar', fIn.status);
    f.check([403, 404].includes(fOut.status) && !fOut.buf.slice(0, 5).toString().startsWith('%PDF'), 'fremder Kunde: Auslieferungslabel des Auftrags nicht abrufbar', fOut.status);
    f.check([403, 404].includes(fShip.status) && [403, 404].includes(fCreate.status), 'fremder Kunde: kein Versandstand, keine Label-Erstellung', `${fShip.status}/${fCreate.status}`);
    const oIn = await rawGet(cust, `/api/bookings/${bookingId}/shipping-label`);
    const oOut = await rawGet(cust, `/api/orders/${orderId}/shipping-label`);
    f.check(oIn.status === 200 && oIn.buf.slice(0, 5).toString() === '%PDF-' && oOut.status === 200 && oOut.buf.slice(0, 5).toString() === '%PDF-',
      'Positivkontrolle: der Inhaber (partner) erhaelt beide PDFs ueber dieselben Routen', `${oIn.status}/${oOut.status}`);
    f.check(ngSize() === ng0, 'netguard_after.log ist waehrend des Laufs nicht gewachsen (kein externer Aufruf)', `${ng0} -> ${ngSize()} B`);
  } catch (e) {
    if (a) await f.shot(a, 'DEBUG_abbruch', true).catch(() => {});
    f.check(false, `Ablauf abgebrochen: ${String(e.message).split('\n').slice(0, 4).join(' | ')}`);
  } finally {
    if (dhlOriginal) f.note(`   Restore DHL-Konfiguration (finally): ${await restoreDhl(dhlOriginal).catch((e) => e.message)}`);
    if (mockCtx?.srv?.listening) await new Promise((res) => mockCtx.srv.close(res));
    if (addedDhlTestIntegration) {
      const removed = await db(async (c) => (await c.collection('systemconfigurations').updateOne({}, { $pull: { integrations: { 'settings.e2eAddedBy': RUN } } })).modifiedCount).catch((e) => e.message);
      f.note(`   Testkonfiguration: angelegte DHL-Test-Integration entfernt (${removed})`);
    }
  }
  await f.finish();
})();
