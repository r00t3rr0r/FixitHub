#!/usr/bin/env node

/**
 * Gast-Links (guestTrackingToken an Auftrag, Buchung, Reparaturanfrage): Bericht und
 * manuelle Sperre im Einzelfall.
 *
 * Richtlinie (02.10.2026): Gast-Links haben KEINE Ablaufzeit und werden NICHT automatisch
 * gesperrt - der Link ist fuer Gaeste der einzige Zugang zu Status, Nachrichten, Kosten-
 * voranschlag und Labels (auch Wochen spaeter: Abholung, Reklamation). Die Pruefung im Code
 * (routes/middleware/guestAccess.js) laesst jeden jemals ausgegebenen Token zu
 * (Format [A-Za-z0-9_-]{8,256}; ausgegeben wurden immer 64 Hex-Zeichen).
 *
 * 1) Bericht (Standard, nur lesend): je Sammlung Anzahl Gast-Datensaetze, Tokens im erzeugten
 *    Format (64 Hex), Tokens, die die Formatpruefung NICHT bestehen (= Links, die nicht mehr
 *    funktionieren wuerden; erwartet 0), Gast-Datensaetze ohne Token, doppelte Tokens.
 *    Es werden keine Tokens ausgegeben.
 *      node server/scripts/guestTokenPolicy.js
 *
 * 2) Sperre eines einzelnen Links (z. B. Link an falsche Adresse weitergeleitet): erzeugt
 *    einen neuen Token fuer GENAU einen Datensatz; der alte Link funktioniert danach nicht
 *    mehr. Ohne --confirm nur Vorschau. Es wird KEINE E-Mail versendet; der neue Link wird
 *    nur im Terminal ausgegeben und muss dem Kunden vom Team uebermittelt werden.
 *      node server/scripts/guestTokenPolicy.js --rotate ORD-2026-001            # Vorschau
 *      node server/scripts/guestTokenPolicy.js --rotate BKG-2026-0001 --confirm
 *      node server/scripts/guestTokenPolicy.js --rotate RR-1700000000000-00001 --confirm
 *    Rueckgaengig: nicht moeglich (alter Token wird nicht gespeichert) - bei Bedarf erneut
 *    rotieren und den neuen Link senden. Idempotenz: jeder Lauf mit --confirm erzeugt einen
 *    neuen Token (bewusst).
 *
 * Datenbank: DATABASE_URL (aus .env bzw. Umgebung).
 */

const path = require('path');
const crypto = require('crypto');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const mongoose = require('mongoose');
const { GUEST_TOKEN_PATTERN } = require('../routes/middleware/guestAccess');

const ISSUED_FORMAT = /^[0-9a-f]{64}$/;

const COLLECTIONS = [
  { name: 'orders', numberField: 'orderNumber', guestFilter: { 'guestInfo.isGuest': true }, prefix: 'ORD-', path: '/track-order', emailOf: (d) => d.guestInfo?.email },
  { name: 'bookings', numberField: 'bookingNumber', guestFilter: { 'guestInfo.isGuest': true }, prefix: 'BKG-', path: '/track-order/booking', emailOf: (d) => d.guestInfo?.email },
  { name: 'repairrequests', numberField: 'requestNumber', guestFilter: { isGuest: true }, prefix: 'RR-', path: '/guest-repair-tracking', emailOf: (d) => d.customerEmail },
];

const args = process.argv.slice(2);
const confirm = args.includes('--confirm');
const rotateIndex = args.indexOf('--rotate');
const rotateNumber = rotateIndex >= 0 ? String(args[rotateIndex + 1] || '').trim() : '';

async function report(db) {
  const result = {};
  for (const c of COLLECTIONS) {
    const col = db.collection(c.name);
    const withToken = { guestTrackingToken: { $type: 'string', $ne: '' } };
    const [guests, tokens, guestsWithoutToken, duplicates] = await Promise.all([
      col.countDocuments(c.guestFilter),
      col.find(withToken).project({ guestTrackingToken: 1 }).toArray(),
      col.countDocuments({ ...c.guestFilter, $or: [{ guestTrackingToken: { $exists: false } }, { guestTrackingToken: '' }, { guestTrackingToken: null }] }),
      col.aggregate([
        { $match: withToken },
        { $group: { _id: '$guestTrackingToken', n: { $sum: 1 } } },
        { $match: { n: { $gt: 1 } } },
        { $count: 'duplicates' },
      ]).toArray(),
    ]);
    result[c.name] = {
      guestRecords: guests,
      recordsWithToken: tokens.length,
      issuedFormat64Hex: tokens.filter((d) => ISSUED_FORMAT.test(d.guestTrackingToken)).length,
      wouldStopWorking: tokens.filter((d) => !GUEST_TOKEN_PATTERN.test(String(d.guestTrackingToken).trim())).length,
      guestRecordsWithoutToken: guestsWithoutToken,
      duplicateTokens: duplicates[0]?.duplicates || 0,
    };
  }
  return result;
}

async function rotate(db) {
  const target = COLLECTIONS.find((c) => rotateNumber.toUpperCase().startsWith(c.prefix));
  if (!target) throw new Error('Unbekannte Nummer. Erwartet ORD-…, BKG-… oder RR-….');
  const col = db.collection(target.name);
  const doc = await col.findOne({ [target.numberField]: rotateNumber }, { projection: { guestTrackingToken: 1, guestInfo: 1, customerEmail: 1, isGuest: 1, customerId: 1 } });
  if (!doc) throw new Error(`${rotateNumber} nicht gefunden.`);
  const hadToken = Boolean(String(doc.guestTrackingToken || '').trim());
  console.log(`${target.name} ${rotateNumber}: Gast-Link vorhanden: ${hadToken ? 'ja' : 'nein'}${doc.customerId ? ' (Datensatz gehoert einem Kundenkonto)' : ''}`);
  if (!confirm) {
    console.log('Vorschau: mit --confirm wird ein neuer Token erzeugt; der bisherige Link funktioniert danach nicht mehr. Es wird keine E-Mail versendet.');
    return;
  }
  const token = crypto.randomBytes(32).toString('hex');
  const update = await col.updateOne({ _id: doc._id }, { $set: { guestTrackingToken: token, updatedAt: new Date() } });
  if (update.modifiedCount !== 1) throw new Error('Nicht geaendert.');
  const email = String(target.emailOf(doc) || '').toLowerCase();
  console.log('Neuer Token gesetzt. Neuer Link (Pfad, dem Kunden selbst uebermitteln):');
  console.log(`${target.path}?token=${token}&email=${encodeURIComponent(email)}`);
}

async function main() {
  const uri = process.env.DATABASE_URL;
  if (!uri) throw new Error('DATABASE_URL fehlt.');
  await mongoose.connect(uri);
  const { db } = mongoose.connection;
  if (rotateNumber) {
    await rotate(db);
  } else {
    if (rotateIndex >= 0) throw new Error('--rotate braucht eine Nummer (ORD-…, BKG-…, RR-…).');
    console.log(JSON.stringify({ mode: 'report (read-only)', collections: await report(db) }, null, 2));
  }
}

main()
  .then(() => mongoose.disconnect())
  .catch(async (error) => {
    console.error(`Fehler: ${error.message}`);
    try { await mongoose.disconnect(); } catch (e) { /* ignore */ }
    process.exitCode = 1;
  });
