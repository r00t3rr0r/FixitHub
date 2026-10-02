// K03: Zentrales Postfach (/messages, Admin) - faellt EINE Quelle im Backend wirklich aus, sieht der Benutzer einen
// verstaendlichen deutschen Hinweis statt "keine Nachrichten"; die anderen Quellen listen ihre Gespraeche weiter, die
// Zaehler "Ungelesen" / "Antwort ausstehend" bleiben fuer die gesunden Quellen sichtbar. Nach der Wiederherstellung
// raeumt "Erneut versuchen" (und ein Reload) den Hinweis ab.
// Echter Backend-Fehler: MongoDB-Failpoint "failCommand" (mongod mit enableTestCommands=1), NUR fuer
// find auf e2e_after.contactmessages (diese Sammlung liest im Postfach ausschliesslich die Quelle "Kontaktanfragen";
// keine andere Ablaufdatei nutzt sie). Kleine "times", Abschalten immer im finally-Block.
const fs = require('fs'); const path = require('path');
const { makeFlow, apiLogin, api, S } = require('./flowlib');
const mongoose = require('/home/adar/Projects/FixitHub/server/node_modules/mongoose');

const DB_URI = 'mongodb://127.0.0.1:27099/e2e_after';
const NS = 'e2e_after.contactmessages';
const SERVER_LOG = path.join(__dirname, 'server_after.log');
const MAILBOX = path.join(S, 'mailbox');
const stamp = Date.now().toString().slice(-7);

async function withDb(fn) {
  const c = await mongoose.createConnection(DB_URI).asPromise();
  try { return await fn(c); } finally { await c.close(); }
}
async function failPoint(times) {
  return withDb((c) => c.db.admin().command(times === 'off'
    ? { configureFailPoint: 'failCommand', mode: 'off' }
    : { configureFailPoint: 'failCommand', mode: { times }, data: { failCommands: ['find'], namespace: NS, errorCode: 2 } }));
}
const logLines = (re) => { try { return (fs.readFileSync(SERVER_LOG, 'utf8').match(re) || []).length; } catch (e) { return -1; } };
const mailFiles = () => { try { return fs.readdirSync(MAILBOX).filter((n) => n.endsWith('.eml')); } catch (e) { return []; } };

(async () => {
  const f = makeFlow('k03_source_error'); await f.start();
  let adm; let armed = false; let contactId = null;
  const mailsBefore = new Set(mailFiles());
  try {
    // ------------------------------------------------------------ Testdaten (eigene, frische Datensaetze)
    const cust = await apiLogin('customer');
    const rrRes = await api(cust, 'POST', '/api/repair-requests', {
      deviceSource: 'manual', deviceType: 'Smartphone', deviceBrand: 'Fairphone', deviceModel: 'Fairphone 5',
      issueDescription: `E2E-K03 ${stamp}: Akku entlaedt sich schnell`,
    });
    const rr = rrRes.data?.request || {};
    const rrId = String(rr._id || rr.id || '');
    if (rrRes.status !== 201 || !rrId) throw new Error(`Testdaten: Reparaturanfrage nicht angelegt (${rrRes.status})`);
    const CUST_MSG = `E2E-K03 ${stamp}: Gibt es schon einen Termin?`;
    const msgRes = await api(cust, 'POST', `/api/repair-request-communication/${rrId}/message`, { content: CUST_MSG, clientMessageId: `e2e-k03-${stamp}` });
    if (![200, 201].includes(msgRes.status)) throw new Error(`Testdaten: Kundennachricht nicht gespeichert (${msgRes.status})`);
    f.note(`Testdaten: Reparaturanfrage ${rr.requestNumber} (Kunde partner@e2e.invalid, API) + Kundennachricht "${CUST_MSG}" (API)`);

    const CONTACT_NAME = `E2E K03 Kontakt ${stamp}`;
    contactId = await withDb(async (c) => {
      const now = new Date();
      const r = await c.collection('contactmessages').insertOne({
        messageNumber: `E2E-K03-${stamp}`, name: CONTACT_NAME, email: `k03-${stamp}@e2e.invalid`, phone: '',
        subject: 'other', message: `E2E-K03 ${stamp}: Testanfrage ueber das Kontaktformular`, orderNumber: '',
        status: 'new', isSpam: false, replies: [], createdAt: now, updatedAt: now,
      });
      return r.insertedId;
    });
    f.note(`Testdaten: Kontaktanfrage "${CONTACT_NAME}" (E2E-K03-${stamp}, Status neu) direkt in e2e_after.contactmessages eingefuegt`);

    // Nachpruefung per API (ohne Failpoint): alle Quellen gesund, beide Testdatensaetze vorhanden
    const admApi = await apiLogin('admin');
    const base = await api(admApi, 'GET', '/api/communications/inbox?source=all&limit=50');
    const baseKeys = (base.data?.items || []).map((i) => i.key);
    f.check(base.status === 200 && (base.data?.sourceErrors || []).length === 0, 'Ausgangslage (API): Postfach ohne Quellenfehler', `${base.status} errors=${JSON.stringify(base.data?.sourceErrors)}`);
    f.check(baseKeys.includes(`repair_request:${rrId}`) && baseKeys.includes(`contact:${contactId}`),
      'Ausgangslage (API): Test-Reparaturanfrage und Test-Kontaktanfrage werden gelistet', `contact.all=${base.data?.counts?.bySource?.contact?.all}`);

    // ------------------------------------------------------------ UI: Admin oeffnet das Postfach
    adm = await f.session('admin');
    const inboxResponses = [];
    adm.on('response', async (r) => {
      if (r.url().includes('/api/communications/inbox') && r.request().method() === 'GET') {
        try { inboxResponses.push({ url: r.url(), status: r.status(), body: await r.json() }); } catch (e) { /* ignore */ }
      }
    });
    const lastInbox = () => inboxResponses[inboxResponses.length - 1] || null;
    const hint = () => adm.getByRole('alert').filter({ hasText: 'Nicht alle Nachrichten konnten geladen werden' });
    const rrRow = () => adm.getByRole('button', { name: new RegExp(`Reparaturanfrage ${rr.requestNumber}`) });
    const contactRow = () => adm.getByRole('button', { name: new RegExp(CONTACT_NAME) });
    const chipCount = async (label) => {
      const t = await adm.getByRole('button', { name: new RegExp(`^${label} \\(\\d+\\)$`) }).first().textContent().catch(() => '');
      const m = String(t || '').match(/\((\d+)\)/); return m ? Number(m[1]) : null;
    };
    const header = async () => (await adm.locator('header p[aria-live="polite"]').first().innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
    const logBefore = logLines(/CommunicationInboxService: source contact failed/g);

    // A) Quelle "Kontaktanfragen" faellt aus -> Ansicht "Alle"
    await failPoint(8); armed = true;
    f.note(`   Failpoint aktiv: failCommand find auf ${NS}, errorCode 2, times 8`);
    inboxResponses.length = 0;
    await f.goto(adm, '/messages', 4500);
    await hint().first().waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
    const rA = lastInbox();
    f.check(rA && rA.status === 200 && (rA.body.sourceErrors || []).some((e) => e.source === 'contact'),
      'Server meldet den echten Quellenfehler (sourceErrors enthaelt "contact")', JSON.stringify(rA?.body?.sourceErrors || null));
    const hintTextA = (await hint().first().innerText().catch(() => '')).replace(/\s+/g, ' ');
    f.check(await hint().count() > 0 && await hint().first().isVisible(), 'Hinweis "Nicht alle Nachrichten konnten geladen werden" sichtbar', hintTextA.slice(0, 200));
    f.check(/Kontaktanfragen konnten nicht geladen werden\./.test(hintTextA), 'Hinweis nennt die ausgefallene Quelle verstaendlich auf Deutsch');
    f.check(await hint().first().getByRole('button', { name: /Erneut versuchen/ }).count() > 0, 'Hinweis bietet "Erneut versuchen" an');
    f.check(await adm.getByText('Noch keine Nachrichten.').count() === 0 && await adm.getByText('Keine Gespräche für diesen Filter.').count() === 0,
      'kein irrefuehrendes "keine Nachrichten" in der Ansicht "Alle"');
    f.check(await rrRow().count() > 0, `gesunde Quelle listet weiter: Reparaturanfrage ${rr.requestNumber} sichtbar`);
    const rowsA = await adm.locator('aside[aria-label="Gespräche"] ul > li').count();
    f.check(rowsA > 0, 'Liste zeigt weiterhin Gespraeche der anderen Quellen', `${rowsA} Zeilen`);
    f.check(await contactRow().count() === 0, 'Kontaktanfrage der ausgefallenen Quelle wird nicht (veraltet) angezeigt');
    // Zaehler fuer die gesunden Quellen
    const unreadA = await chipCount('Ungelesen'); const awaitA = await chipCount('Antwort ausstehend'); const headA = await header();
    const cA = rA?.body?.counts || {};
    f.check(unreadA !== null && unreadA >= 1 && unreadA === cA.unread, 'Zaehler "Ungelesen" sichtbar (gesunde Quellen, = Serverwert, Test-Anfrage ungelesen)', `UI ${unreadA} / Server ${cA.unread}`);
    f.check(awaitA !== null && awaitA >= 1 && awaitA === cA.awaitingReply, 'Zaehler "Antwort ausstehend" sichtbar (= Serverwert)', `UI ${awaitA} / Server ${cA.awaitingReply}`);
    f.check(new RegExp(`^${cA.unread} ungelesen · ${cA.awaitingReply} Antwort ausstehend$`).test(headA), 'Kopfzeile zeigt die Zaehler weiterhin', headA);
    f.check(cA.bySource && cA.bySource.contact && cA.bySource.contact.all === 0 && (cA.bySource.repair_request?.unread || 0) >= 1,
      'Zaehler stammen nur aus den gesunden Quellen (Kontaktanfragen nicht mitgezaehlt)', JSON.stringify(cA.bySource || {}));
    await f.shot(adm, 'hinweis_quelle_ausgefallen_alle');

    // B) Filter auf die ausgefallene Quelle -> Hinweis statt "keine Nachrichten"
    await failPoint(8);
    f.note('   Failpoint erneut gesetzt (times 8) vor dem Filterwechsel');
    inboxResponses.length = 0;
    await adm.getByRole('button', { name: 'Kontaktanfragen', exact: true }).click();
    await adm.waitForTimeout(3000);
    const rB = lastInbox();
    f.check(rB && /source=contact/.test(rB.url) && (rB.body.sourceErrors || []).some((e) => e.source === 'contact'),
      'Filter "Kontaktanfragen": Server meldet weiterhin den Quellenfehler', `${rB?.url?.replace(/^.*\?/, '?')} ${JSON.stringify(rB?.body?.sourceErrors || null)}`);
    const hintTextB = (await hint().first().innerText().catch(() => '')).replace(/\s+/g, ' ');
    f.check(/Kontaktanfragen konnten nicht geladen werden\./.test(hintTextB), 'Filter "Kontaktanfragen": Hinweis auf den Ladefehler sichtbar', hintTextB.slice(0, 200));
    const emptyB = (await adm.locator('aside[aria-label="Gespräche"]').innerText().catch(() => '')).replace(/\s+/g, ' ');
    f.check(!/Keine Gespräche für diesen Filter\.|Noch keine Nachrichten\./.test(emptyB),
      'Filter "Kontaktanfragen": KEIN "Keine Gespräche"/"keine Nachrichten" bei ausgefallener Quelle', emptyB.slice(0, 400));
    f.check(/Gespräche konnten nicht vollständig geladen werden/.test(emptyB), 'Filter "Kontaktanfragen": Listenbereich verweist auf den Ladefehler statt "leer"');
    f.check(!/Andere Nachrichten werden angezeigt/.test(hintTextB), 'Filter "Kontaktanfragen": Hinweis behauptet nicht, andere Nachrichten wuerden angezeigt');
    await f.shot(adm, 'hinweis_filter_kontaktanfragen');

    // C) Wiederherstellung -> "Erneut versuchen"
    await failPoint('off'); armed = false;
    f.note('   Failpoint abgeschaltet (Quelle wieder gesund)');
    inboxResponses.length = 0;
    await hint().first().getByRole('button', { name: /Erneut versuchen/ }).click();
    await adm.waitForTimeout(3000);
    const rC = lastInbox();
    f.check(rC && rC.status === 200 && (rC.body.sourceErrors || []).length === 0, '"Erneut versuchen" laedt neu, Server ohne Quellenfehler', JSON.stringify(rC?.body?.sourceErrors || null));
    f.check(await hint().count() === 0, 'nach "Erneut versuchen" ist der Hinweis verschwunden');
    f.check(await contactRow().count() > 0, `Test-Kontaktanfrage "${CONTACT_NAME}" ist wieder sichtbar`);
    await f.shot(adm, 'nach_wiederherstellung_erneut_versuchen');

    // Reload + Ansicht "Alle": alle Quellen, Zaehler inkl. Kontaktanfragen
    inboxResponses.length = 0;
    await adm.reload({ waitUntil: 'domcontentloaded' }); await adm.waitForTimeout(3500);
    f.check(await hint().count() === 0 && await contactRow().count() > 0, 'nach Reload (Filter Kontaktanfragen): kein Hinweis, Kontaktanfrage sichtbar');
    inboxResponses.length = 0;
    await adm.getByRole('button', { name: 'Alle', exact: true }).first().click();
    await adm.waitForTimeout(3000);
    const rD = lastInbox(); const cD = rD?.body?.counts || {};
    f.check(await hint().count() === 0 && await rrRow().count() > 0 && await contactRow().count() > 0,
      'Ansicht "Alle" nach Wiederherstellung: Reparaturanfrage UND Kontaktanfrage, kein Hinweis');
    const unreadD = await chipCount('Ungelesen');
    f.check((cD.bySource?.contact?.unread || 0) >= 1 && unreadD === cD.unread, 'Zaehler zaehlen die Kontaktanfragen wieder mit', `UI Ungelesen ${unreadD} / Server ${cD.unread} contact=${JSON.stringify(cD.bySource?.contact || null)}`);
    await f.shot(adm, 'nach_wiederherstellung_alle');

    const logAfter = logLines(/CommunicationInboxService: source contact failed/g);
    f.check(logAfter > logBefore, 'Serverprotokoll belegt den echten Datenbankfehler der Quelle "contact"', `${logBefore} -> ${logAfter}`);
  } catch (e) {
    if (adm) await f.shot(adm, 'DEBUG_abbruch', true).catch(() => {});
    f.check(false, `Ablauf abgebrochen: ${String(e.message).split('\n').slice(0, 3).join(' | ')}`);
  } finally {
    try { await failPoint('off'); f.note(`   Failpoint im finally abgeschaltet${armed ? ' (war noch aktiv)' : ''}`); } catch (e) { f.check(false, `Failpoint konnte nicht abgeschaltet werden: ${e.message}`); }
    // eigene Test-Kontaktanfrage schliessen, damit sie die Zaehler anderer Ablaeufe nicht beeinflusst
    if (contactId) {
      await withDb((c) => c.collection('contactmessages').updateOne({ _id: contactId }, { $set: { status: 'closed', updatedAt: new Date() } })).catch(() => {});
      f.note('Testdaten: eigene Kontaktanfrage auf Status "geschlossen" gesetzt (Aufraeumen)');
    }
    const newMails = mailFiles().filter((n) => !mailsBefore.has(n));
    const rcpts = newMails.map((n) => { try { return (fs.readFileSync(path.join(MAILBOX, n), 'utf8').match(/^To: (.*)$/m) || [])[1] || '?'; } catch (e) { return '?'; } });
    f.note(`   neue .eml-Dateien waehrend des Laufs (auch parallele Ablaeufe): ${newMails.length} -> ${[...new Set(rcpts)].join(', ').slice(0, 300)}`);
  }
  await f.finish();
})();
