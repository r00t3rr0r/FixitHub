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
 * Verhalten (Stand 25.09.2026, nach Pruefung):
 *  - Geschrieben werden AUSSCHLIESSLICH nicht ausgestellte Belege (Status 'draft' oder
 *    'pending_approval') ohne lockedAt, ohne sentAt und ohne archiviertes PDF. Frueher
 *    galt ein Beleg nur mit gesetztem sentAt als "versendet": eine ausgestellte Rechnung
 *    im Status 'sent'/'viewed'/'overdue'/'partially_paid' OHNE sentAt (z.B. aus
 *    createInvoiceFromOrder oder Altbestand) wurde mit --confirm still umgeschrieben.
 *  - Jeder ausgestellte Beleg (alle anderen Status, auch Gutschriften) wird nur
 *    GEMELDET - Korrektur nur per Storno-Gutschrift + Neuausstellung.
 *  - Der Status wird nie geaendert (frueher setzte --confirm ihn aus paidAmount neu und
 *    konnte so einen Entwurf faktisch ausstellen).
 *
 * Aufruf:
 *   node server/scripts/repairGrossNetInvoiceTotals.js            # Dry-Run (Standard)
 *   node server/scripts/repairGrossNetInvoiceTotals.js --confirm  # schreibt (nur Entwuerfe)
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

// Nur ein NICHT ausgestellter Beleg darf korrigiert werden. Alles andere ist ein
// Rechnungsdokument (ausgestellt, ggf. beim Kunden) und wird nur gemeldet.
const EDITABLE_STATUSES = ['draft', 'pending_approval'];
function isProtected(invoice) {
  if (!EDITABLE_STATUSES.includes(String(invoice.status || ''))) {
    return { protected: true, reason: `ausgestellt (Status: ${invoice.status || 'unbekannt'}) – wird nicht geändert, Korrektur nur per Storno-Gutschrift + Neuausstellung` };
  }
  if (invoice.lockedAt) return { protected: true, reason: 'lockedAt gesetzt – wird nicht geändert' };
  if (invoice.sentAt) return { protected: true, reason: 'bereits versendet (sentAt) – wird nicht geändert' };
  if (invoice.documentArchive && invoice.documentArchive.sha256) {
    return { protected: true, reason: 'PDF bereits archiviert – wird nicht geändert' };
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
        lockedAt: 1, paidAmount: 1, 'documentArchive.sha256': 1
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
      const update = {
        subtotal: correction.subtotal,
        tax: correction.tax,
        total: correction.total,
        invoiceNetTotal: correction.subtotal,
        invoiceTaxTotal: correction.tax,
        invoiceGrossTotal: correction.total,
        updatedAt: new Date()
      };
      // Bedingung wiederholt den Schutz atomar: wurde der Entwurf inzwischen ausgestellt,
      // wird nichts geschrieben. Der Status bleibt unveraendert.
      const result = await Invoice.collection.updateOne(
        { _id: invoice._id, status: { $in: EDITABLE_STATUSES }, lockedAt: { $in: [null] }, sentAt: { $in: [null] }, 'documentArchive.sha256': { $in: [null] } },
        { $set: update }
      );
      if (result.modifiedCount !== 1) {
        console.log(`${invoice.invoiceNumber}: inzwischen ausgestellt/gesperrt – nicht geändert.`);
        continue;
      }
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
