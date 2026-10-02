#!/usr/bin/env node

/**
 * FIN-2: Geldfelder alter Buchungen (subtotal / discount / tax) aus ihren Auftraegen neu
 * ableiten - mit DERSELBEN Funktion wie der laufende Betrieb
 * (BookingService.computeBookingTotalsFromOrders -> OrderService.buildOrderPricingSummary).
 *
 * Hintergrund: Frueher zog FinancialService.syncOrderAndBookingValue nach einer
 * Auftragsaenderung nur booking.totalCost nach; Zwischensumme, Rabatt und MwSt. blieben
 * alt. Buchungen ohne Checkout-Snapshot (manuelle Buchung, umgewandelte Reparaturanfrage)
 * wurden mit tax 0 gespeichert. Neue Buchungen und jede neue Auftragsaenderung sind
 * bereits korrekt - dieses Skript betrifft nur den Altbestand.
 *
 * Regeln:
 *  - Dry-Run ist Standard: es wird nur die Auswirkung ausgegeben (alt -> neu).
 *  - Geschrieben wird nur mit --confirm, und NUR wenn der Gesamtbetrag (totalCost) bereits
 *    mit der Summe der Auftraege uebereinstimmt (Abweichung <= 0,01 €). Dann aendern sich
 *    nur subtotal/discount/tax, der Betrag, den der Kunde schuldet, bleibt gleich.
 *  - Buchungen, deren totalCost von der Auftragssumme abweicht (z. B. manueller
 *    Buchungsrabatt), werden nur GEMELDET ("manuell pruefen") und nie geaendert.
 *  - Kunden mit Steuerprofil reverse_charge / tax_free: MwSt. der Buchung = 0 (wie der
 *    Checkout). Eine MwSt.-Erhoehung von 0 auf > 0 bei einer Checkout-Buchung
 *    (checkoutAttemptId) oder bei unlesbarem Kundenprofil wird nur gemeldet.
 *  - Rechnungen, Zahlungen und Zuordnungen werden nicht angefasst.
 *  - Idempotent: ein zweiter Lauf findet nichts mehr.
 *  - Sicherung: vor dem Schreiben werden die alten Werte als JSON gesichert
 *    (--backup <datei>, Standard: Systemtemp-Verzeichnis). Rueckweg: die Werte aus der
 *    Sicherung per updateOne({_id}, {$set: {subtotal, discount, tax}}) zuruecksetzen.
 *
 * Aufruf:
 *   node server/scripts/recomputeBookingTotals.js                    # Dry-Run
 *   node server/scripts/recomputeBookingTotals.js --confirm          # schreibt
 *   node server/scripts/recomputeBookingTotals.js --confirm --backup /pfad/sicherung.json
 */

const path = require('path');
const fs = require('fs');
const os = require('os');

const TOLERANCE = 0.01;
const round2 = (value) => Math.round((Number(value) || 0) * 100) / 100;
const differs = (a, b) => Math.abs(round2(a) - round2(b)) > TOLERANCE;

/**
 * Ermittelt die Korrekturen ohne zu schreiben.
 * @returns {Promise<{checked:number, fixable:Array, reviewOnly:Array}>}
 */
async function planBookingTotalCorrections() {
  const Booking = require('../models/Booking');
  const Order = require('../models/Order');
  const BookingService = require('../services/bookingService');

  const bookings = await Booking.find({})
    .setOptions({ skipAutoPopulate: true })
    .select('_id bookingNumber subtotal discount tax totalCost status customerId checkoutAttemptId')
    .lean();

  const fixable = [];
  const reviewOnly = [];
  const exemptByCustomer = new Map();

  for (const booking of bookings) {
    const orders = await Order.find({ bookingId: booking._id }).lean();
    if (orders.length === 0) continue;
    // Steuerprofil des Kunden (reverse_charge / tax_free => MwSt. 0), wie im laufenden
    // Betrieb (BookingService.resolveCustomerTaxExempt). Ergebnis je Kunde zwischengespeichert.
    const customerKey = booking.customerId ? String(booking.customerId) : '';
    if (!exemptByCustomer.has(customerKey)) {
      exemptByCustomer.set(customerKey, await BookingService.resolveCustomerTaxExempt(booking.customerId || null));
    }
    const taxExempt = exemptByCustomer.get(customerKey);
    // FIN-13: Standardsatz nur fuer Auftraege ohne gespeicherten Satz (gespeicherte 0 bleibt 0).
    const defaultTaxRate = await require('../services/orderService').resolveDefaultTaxRate(orders); // eslint-disable-line global-require
    const next = BookingService.computeBookingTotalsFromOrders(orders, { taxExempt: taxExempt === true, defaultTaxRate });
    const old = {
      subtotal: round2(booking.subtotal),
      discount: round2(booking.discount),
      tax: round2(booking.tax),
      totalCost: round2(booking.totalCost),
    };
    const changed = ['subtotal', 'discount', 'tax', 'totalCost'].some((key) => differs(old[key], next[key]));
    if (!changed) continue;

    const entry = { _id: String(booking._id), bookingNumber: booking.bookingNumber || '', status: booking.status || '', old, next };
    const taxRaisedFromZero = old.tax <= TOLERANCE && next.tax > TOLERANCE;
    if (differs(old.totalCost, next.totalCost)) {
      entry.reason = `Gesamtbetrag ${old.totalCost} weicht von der Auftragssumme ${next.totalCost} ab – manuell prüfen, wird nicht geändert`;
      reviewOnly.push(entry);
    } else if (taxRaisedFromZero && (taxExempt === null || booking.checkoutAttemptId)) {
      // MwSt. 0 -> > 0 nur, wenn sicher kein Checkout-Wert nach Steuerprofil vorliegt.
      // Checkout-Buchung oder unlesbares Kundenprofil: nur melden, nie ueberschreiben.
      entry.reason = taxExempt === null
        ? `MwSt. 0 -> ${next.tax}: Steuerprofil des Kunden nicht lesbar – manuell prüfen, wird nicht geändert`
        : `MwSt. 0 -> ${next.tax}: Buchung aus dem Checkout (MwSt. nach Kundenprofil berechnet) – manuell prüfen, wird nicht geändert`;
      reviewOnly.push(entry);
    } else {
      fixable.push(entry);
    }
  }

  return { checked: bookings.length, fixable, reviewOnly };
}

/**
 * Schreibt die geplanten Korrekturen (nur subtotal/discount/tax). Die Bedingung im
 * updateOne wiederholt die Pruefung atomar: hat sich die Buchung inzwischen geaendert,
 * wird sie uebersprungen.
 */
async function applyBookingTotalCorrections(plan, { backupFile } = {}) {
  const Booking = require('../models/Booking');
  const target = backupFile || path.join(os.tmpdir(), `booking-totals-backup-${Date.now()}.json`);
  fs.writeFileSync(target, JSON.stringify(plan.fixable.map(({ _id, bookingNumber, old }) => ({ _id, bookingNumber, old })), null, 2));

  let written = 0;
  for (const entry of plan.fixable) {
    const result = await Booking.collection.updateOne(
      { _id: new (require('mongoose').Types.ObjectId)(entry._id), totalCost: { $gte: entry.old.totalCost - TOLERANCE, $lte: entry.old.totalCost + TOLERANCE } },
      { $set: { subtotal: entry.next.subtotal, discount: entry.next.discount, tax: entry.next.tax, updatedAt: new Date() } }
    );
    if (result.modifiedCount === 1) written += 1;
  }
  return { written, backupFile: target };
}

function printPlan(plan) {
  console.log(`\nGeprüft: ${plan.checked} Buchungen`);
  console.log(`\n--- Korrigierbar (${plan.fixable.length}) – Gesamtbetrag unverändert ---`);
  plan.fixable.forEach(({ bookingNumber, _id, old, next }) => {
    console.log(`${bookingNumber || _id}: Zwischensumme ${old.subtotal} -> ${next.subtotal} | Rabatt ${old.discount} -> ${next.discount}`
      + ` | MwSt. ${old.tax} -> ${next.tax} | Gesamt ${old.totalCost} (bleibt)`);
  });
  console.log(`\n--- Nur Meldung (${plan.reviewOnly.length}) ---`);
  plan.reviewOnly.forEach(({ bookingNumber, _id, reason }) => console.log(`${bookingNumber || _id}: ${reason}`));
}

async function run() {
  require('dotenv').config({ path: path.join(__dirname, '../../.env') });
  const mongoose = require('mongoose');
  const confirm = process.argv.includes('--confirm');
  const backupIndex = process.argv.indexOf('--backup');
  const backupFile = backupIndex > -1 ? process.argv[backupIndex + 1] : undefined;
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not configured');

  await mongoose.connect(process.env.DATABASE_URL);
  console.log(`Buchungssummen neu ableiten (${confirm ? 'SCHREIBEN' : 'Dry-Run'})`);
  try {
    const plan = await planBookingTotalCorrections();
    printPlan(plan);
    if (!confirm) {
      console.log('\nDry-Run – es wurde nichts geschrieben. Mit --confirm ausführen.');
      return;
    }
    const result = await applyBookingTotalCorrections(plan, { backupFile });
    console.log(`\nGeschrieben: ${result.written} Buchungen. Sicherung der alten Werte: ${result.backupFile}`);
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  run().catch((error) => {
    console.error('recomputeBookingTotals failed:', error);
    process.exit(1);
  });
}

module.exports = { planBookingTotalCorrections, applyBookingTotalCorrections };
