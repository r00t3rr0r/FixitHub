#!/usr/bin/env node

/**
 * Repariert Rechnungen, die vom A2-Fehler betroffen sind: die BRUTTO-Positionssumme
 * wurde als NETTO (subtotal) gespeichert und danach noch einmal 19% MwSt
 * daraufgerechnet - die Rechnung ist dadurch rund 19% zu hoch.
 *
 * Fehlersignatur (beide Bedingungen muessen zutreffen):
 *   round(subtotal * (1 + taxRate/100) - discount) === round(total)
 *   round(sum(items.total))                        === round(subtotal)
 * Die erste Bedingung allein wuerde jede rabattierte Rechnung uebersehen, weil der
 * fehlerhafte Pfad total = subtotal*1.19 - discount gerechnet hat.
 *
 * Korrektur (brutto-first):
 *   total    = round(sum(items.total) - discount)
 *   subtotal = round(total / (1 + taxRate/100))
 *   tax      = round(total - subtotal)
 *
 * WICHTIG - fachliche Entscheidung, keine technische:
 * Bereits VERSENDETE Rechnungen weisen einen falschen MwSt-Betrag aus. Sie sind
 * Rechnungsdokumente nach §14 UStG / GoBD und duerfen NICHT still umgeschrieben
 * werden. Dieses Skript ruehrt sie nicht an, sondern listet sie auf. Der korrekte
 * Weg dort ist eine formale Gutschrift plus Neuausstellung.
 *
 * Aufruf:
 *   node server/scripts/repairGrossNetInvoiceTotals.js            # Dry-Run (Standard)
 *   node server/scripts/repairGrossNetInvoiceTotals.js --confirm  # schreibt
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const mongoose = require('mongoose');
const Invoice = require('../models/Invoice');
const CalculationHelper = require('../services/calculationHelper');

const round = (value) => CalculationHelper.round(value);

function isDamaged(invoice) {
  const items = Array.isArray(invoice.items) ? invoice.items : [];
  if (items.length === 0) return false;

  const subtotal = Number(invoice.subtotal);
  const total = Number(invoice.total);
  const discount = Number(invoice.discount || 0);
  const taxRate = Number.isFinite(Number(invoice.taxRate)) ? Number(invoice.taxRate) : 19;

  if (!Number.isFinite(subtotal) || !Number.isFinite(total)) return false;
  // Reverse Charge (0%) kann per Definition nicht betroffen sein: dort ist netto === brutto.
  if (invoice.isReverseCharge || taxRate === 0) return false;

  const itemsGrossTotal = round(items.reduce((sum, item) => sum + Number(item.total || 0), 0));
  const netFirstTotal = round(subtotal * (1 + taxRate / 100) - discount);

  return netFirstTotal === round(total) && itemsGrossTotal === round(subtotal);
}

function computeCorrection(invoice) {
  const taxRate = Number.isFinite(Number(invoice.taxRate)) ? Number(invoice.taxRate) : 19;
  const discount = Number(invoice.discount || 0);
  const itemsGrossTotal = round(invoice.items.reduce((sum, item) => sum + Number(item.total || 0), 0));

  // Gutschriften sind negativ: auf dem Betrag rechnen und das Vorzeichen einmal
  // am Ende setzen - sonst wuerde Math.max(0, ...) die Gutschrift auf 0 kappen.
  const sign = itemsGrossTotal < 0 ? -1 : 1;
  const total = round(sign * Math.max(0, Math.abs(itemsGrossTotal) - Math.abs(discount)));
  const subtotal = round(total / (1 + taxRate / 100));
  const tax = round(total - subtotal);

  return { total, subtotal, tax, taxRate };
}

// Ein Beleg gilt als ausgeliefert, wenn er eingefroren wurde oder nachweislich
// beim Kunden ist. Solche Dokumente werden nur gemeldet, nie geaendert.
function isProtected(invoice) {
  if (invoice.lockedAt) return { protected: true, reason: 'lockedAt gesetzt' };
  if (invoice.sentAt && ['sent', 'viewed', 'partially_paid', 'paid', 'overdue'].includes(invoice.status)) {
    return { protected: true, reason: `bereits versendet (status: ${invoice.status})` };
  }
  if (['paid', 'credited', 'cancelled'].includes(invoice.status)) {
    return { protected: true, reason: `abgeschlossen (status: ${invoice.status})` };
  }
  return { protected: false, reason: '' };
}

async function run() {
  const confirm = process.argv.includes('--confirm');
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not configured');

  await mongoose.connect(process.env.DATABASE_URL);
  console.log(`A2 gross/net invoice repair started (${confirm ? 'WRITE' : 'dry-run'} mode)`);

  try {
    const invoices = await Invoice.collection.find({}, {
      projection: {
        invoiceNumber: 1, items: 1, subtotal: 1, tax: 1, total: 1, discount: 1,
        taxRate: 1, isReverseCharge: 1, isCreditNote: 1, status: 1, sentAt: 1,
        lockedAt: 1, paidAmount: 1
      }
    }).toArray();

    const repairable = [];
    const blocked = [];

    invoices.forEach((invoice) => {
      if (!isDamaged(invoice)) return;
      const correction = computeCorrection(invoice);
      const guard = isProtected(invoice);
      const entry = { invoice, correction, reason: guard.reason };
      if (guard.protected) blocked.push(entry); else repairable.push(entry);
    });

    console.log(`\nGeprueft: ${invoices.length} Belege`);
    console.log(`Betroffen (A2-Signatur): ${repairable.length + blocked.length}`);

    console.log(`\n--- Reparierbar (${repairable.length}) ---`);
    repairable.forEach(({ invoice, correction }) => {
      console.log(`${invoice.invoiceNumber}: total ${invoice.total} -> ${correction.total}`
        + ` | netto ${invoice.subtotal} -> ${correction.subtotal}`
        + ` | MwSt ${invoice.tax} -> ${correction.tax}`);
    });

    console.log(`\n--- NICHT anfassbar (${blocked.length}) - fachliche Entscheidung erforderlich ---`);
    blocked.forEach(({ invoice, correction, reason }) => {
      console.log(`${invoice.invoiceNumber} [${reason}]: ausgewiesen ${invoice.total} `
        + `(MwSt ${invoice.tax}), korrekt waere ${correction.total} (MwSt ${correction.tax})`);
    });
    if (blocked.length > 0) {
      console.log('\nDiese Rechnungen weisen einen falschen MwSt-Betrag aus und sind bereits');
      console.log('beim Kunden bzw. eingefroren. Sie duerfen NICHT still umgeschrieben werden -');
      console.log('erforderlich ist eine formale Gutschrift mit anschliessender Neuausstellung.');
      console.log('Das ist eine Geschaefts-/Buchhaltungsentscheidung, keine Datenmigration.');
    }

    if (!confirm) {
      console.log('\nDry-Run - es wurde nichts geschrieben. Mit --confirm ausfuehren.');
      return;
    }

    let written = 0;
    for (const { invoice, correction } of repairable) {
      const paidAmount = Number(invoice.paidAmount || 0);
      const balance = CalculationHelper.calculateBalance(correction.total, paidAmount);
      const update = {
        subtotal: correction.subtotal,
        tax: correction.tax,
        total: correction.total,
        invoiceNetTotal: correction.subtotal,
        invoiceTaxTotal: correction.tax,
        invoiceGrossTotal: correction.total,
        updatedAt: new Date()
      };
      // Status nur dort nachziehen, wo er rein zahlungsabhaengig ist.
      if (['draft', 'sent', 'viewed', 'partially_paid', 'overdue'].includes(invoice.status)) {
        update.status = balance.status;
      }
      await Invoice.collection.updateOne({ _id: invoice._id }, { $set: update });
      written += 1;
    }
    console.log(`\nGeschrieben: ${written} Rechnungen.`);
  } finally {
    await mongoose.disconnect();
  }
}

run().catch((error) => {
  console.error('repairGrossNetInvoiceTotals failed:', error);
  process.exit(1);
});
