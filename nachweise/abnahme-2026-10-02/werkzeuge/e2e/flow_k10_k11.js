// K10/K11: echter Checkout im Browser -> "Bestellung erfolgreich" zeigt die DHL-Hauptaktion.
// A) Labelerstellung schlaegt fehl (Modus "live" OHNE Zugangsdaten; netguard blockiert jeden externen Aufruf ->
//    garantiert kein echtes/kostenpflichtiges Label) -> klare Fehlermeldung + "DHL-Einsendelabel erstellen".
// B) Modus "dummy" -> Kunde klickt erneut -> genau EIN Testlabel; Download liefert PDF; Reload zeigt dasselbe Label;
//    parallele Erstellungsversuche erzeugen kein zweites Label.
const fs = require('fs'); const path = require('path');
const { makeFlow, apiLogin, api } = require('./flowlib');
const SERVER = '/home/adar/Projects/FixitHub/server';
const mongoose = require(path.join(SERVER, 'node_modules/mongoose'));

async function setDhlMode(mode) {
  const conn = await mongoose.createConnection('mongodb://127.0.0.1:27099/e2e_after').asPromise();
  const col = conn.collection('systemconfigurations');
  const doc = await col.findOne({});
  const integrations = (doc?.integrations || []).filter((i) => !(i.provider === 'DHL' && i.type === 'shipping' && !/returns/i.test(i.name || '')));
  integrations.push({ name: 'DHL Paket (E2E)', provider: 'DHL', type: 'shipping', isActive: true, settings: { bookingLabelMode: mode } });
  if (doc) await col.updateOne({ _id: doc._id }, { $set: { integrations } });
  else await col.insertOne({ integrations });
  await conn.close();
}
async function bookingLabels(bookingNumber) {
  const conn = await mongoose.createConnection('mongodb://127.0.0.1:27099/e2e_after').asPromise();
  const b = await conn.collection('bookings').findOne({ bookingNumber });
  const orders = b ? await conn.collection('orders').find({ bookingId: b._id }).toArray() : [];
  await conn.close();
  return { booking: b, tracking: b?.trackingNumber || null, returnTracking: b?.returnTrackingNumber || null, labelLen: String(b?.shippingLabelUrl || '').length,
    orderLabels: orders.map((o) => ({ tracking: o.trackingNumber || null, ret: o.returnTrackingNumber || null })) };
}

(async () => {
  const f = makeFlow('k10_k11'); await f.start();
  let cust;
  try {
    await setDhlMode('live');
    f.note('   Testkonfiguration: DHL-Buchungslabel-Modus = live (ohne Zugangsdaten, externe Verbindungen blockiert)');
    cust = await f.session('kasse');
    await f.goto(cust, '/cart', 3000);
    await cust.getByRole('button', { name: /Zur Kasse/ }).click();
    await cust.waitForTimeout(1500);
    await cust.getByText('Zahlung nach Rechnungsstellung').first().click();
    await cust.getByRole('checkbox').first().click();
    await f.shot(cust, 'checkout_dialog_rechnung');
    await cust.getByRole('button', { name: /Jetzt bezahlen|zahlungspflichtig bestellen/i }).click();
    await cust.waitForURL(/order-success/, { timeout: 60000 });
    await cust.waitForTimeout(4000);
    await f.shot(cust, 'bestellung_erfolgreich_labelfehler', true);
    const txt = await cust.locator('body').innerText();
    const bnr = (txt.match(/BKG-\d{4}-\d{4}/) || [])[0];
    f.check(!!bnr, 'Erfolgsseite nennt die Buchungsnummer', bnr);
    f.check(/Gerät an McRepair senden/i.test(txt), 'Erfolgsseite: Abschnitt "Gerät an McRepair senden" sichtbar (ohne Menue-Suche)');
    const createBtn = cust.getByRole('button', { name: /DHL-Einsendelabel erstellen/ });
    f.check(await createBtn.count() > 0, 'Labelfehler: Schaltflaeche "DHL-Einsendelabel erstellen" (erneut versuchen) wird angeboten');
    f.note(`   Erfolgsseite Text (Auszug): ${txt.replace(/\s+/g, ' ').slice(0, 600)}`);
    let st = await bookingLabels(bnr);
    f.check(!st.tracking && !st.returnTracking, 'nach Fehlschlag ist KEIN Label gespeichert', JSON.stringify({ t: st.tracking, r: st.returnTracking }));

    // B) Testmodus -> Kunde versucht erneut
    await setDhlMode('dummy');
    f.note('   Testkonfiguration: DHL-Buchungslabel-Modus = dummy');
    await createBtn.first().click();
    await cust.waitForTimeout(5000);
    await f.shot(cust, 'label_nach_erneutem_versuch', true);
    st = await bookingLabels(bnr);
    f.check(!!st.tracking && /^DHL-DUMMY-/.test(st.tracking), 'erneuter Versuch erzeugt genau ein Testlabel', st.tracking);
    const dl = cust.getByRole('button', { name: /(Test|Einsende)label herunterladen/ }).first();
    f.check(await dl.count() > 0, 'Hauptaktion jetzt "…label herunterladen"');
    const [download] = await Promise.all([cust.waitForEvent('download', { timeout: 20000 }), dl.click()]);
    const file = path.join(f.out, download.suggestedFilename());
    await download.saveAs(file);
    const head = fs.readFileSync(file).slice(0, 5).toString();
    f.check(head === '%PDF-', 'Download liefert eine PDF-Datei', `${download.suggestedFilename()} ${head}`);
    // Reload: Label bleibt erreichbar (Backend-Daten, nicht sessionStorage)
    await cust.evaluate(() => { try { sessionStorage.clear(); } catch (e) { /* ignore */ } });
    await cust.reload({ waitUntil: 'domcontentloaded' }); await cust.waitForTimeout(4000);
    f.check(await cust.getByRole('button', { name: /(Test|Einsende)label herunterladen/ }).count() > 0, 'nach Reload (sessionStorage geleert) ist dasselbe Label erreichbar');
    await f.shot(cust, 'erfolgsseite_nach_reload', true);
    // Zweiter Download erzeugt kein neues Label
    const [d2] = await Promise.all([cust.waitForEvent('download', { timeout: 20000 }), cust.getByRole('button', { name: /(Test|Einsende)label herunterladen/ }).first().click()]);
    await d2.path();
    const st2 = await bookingLabels(bnr);
    f.check(st2.tracking === st.tracking, '"Erneut herunterladen" erzeugt KEIN neues Label (Sendungsnummer unveraendert)', st2.tracking);
    // Parallele Erstellungsversuche (Doppelklick/Timeout-Simulation) ueber die echte Route
    const k = await apiLogin('kasse');
    const bk = await api(k, 'GET', '/api/bookings?limit=5');
    const bid = String(st.booking._id);
    const routes = ['/api/bookings/' + bid + '/inbound-label', '/api/bookings/' + bid + '/shipping/inbound-label', '/api/bookings/' + bid + '/inbound-label/create'];
    let used = null; let results = [];
    for (const r of routes) {
      const probe = await api(k, 'POST', r, {});
      if (probe.status !== 404) { used = r; results.push(probe.status); break; }
    }
    if (used) {
      const par = await Promise.all([1, 2, 3].map(() => api(k, 'POST', used, {})));
      results = results.concat(par.map((p) => p.status));
      const st3 = await bookingLabels(bnr);
      f.check(st3.tracking === st.tracking, `parallele Erstellungsversuche (${used}) erzeugen kein zweites Label`, `${results.join(',')} -> ${st3.tracking}`);
    } else f.note('   (Erstellungsroute fuer Parallel-Test nicht gefunden - nur UI-Pfad geprueft)');
    // Fremder Kunde kann das Label nicht laden
    const other = await apiLogin('other');
    const foreign = await api(other, 'GET', `/api/bookings/${bid}/shipping-label`);
    f.check([403, 404].includes(foreign.status), 'fremder Kunde: kein Zugriff auf das Label', foreign.status);
  } catch (e) {
    if (cust) await f.shot(cust, 'DEBUG_abbruch', true).catch(() => {});
    f.check(false, `Ablauf abgebrochen: ${String(e.message).split('\n').slice(0, 3).join(' | ')}`);
  }
  await f.finish();
})();
