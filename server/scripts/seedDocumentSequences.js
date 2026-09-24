#!/usr/bin/env node

/**
 * Initialisiert die DocumentSequence-Zaehler aus den bereits vergebenen Belegnummern.
 *
 * MUSS einmal laufen, BEVOR nach der Nummernkreis-Umstellung die erste neue Rechnung
 * erzeugt wird - sonst startet der Zaehler bei 1 und kollidiert mit dem Unique-Index
 * auf invoiceNumber.
 *
 * Es wird KEIN bestehendes Dokument umnummeriert (GoBD / Unveraenderlichkeit).
 *
 * Aufruf:
 *   node server/scripts/seedDocumentSequences.js              # Dry-Run (Standard)
 *   node server/scripts/seedDocumentSequences.js --confirm    # schreibt die Zaehler
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const mongoose = require('mongoose');
const Invoice = require('../models/Invoice');
const DocumentSequence = require('../models/DocumentSequence');

// Tolerant gegenueber allen Altformaten: INV-2026-0007, INV--2026-0008,
// VIP--2026-0008, CN--CN-2026-0004 ... Die Nummern vom Typ INV-<epoch-ms>
// tragen keinen Jahres-/Sequenzblock und werden bewusst uebersprungen.
const NUMBER_PATTERN = /-(\d{4})-(\d+)$/;

function parseNumber(invoiceNumber) {
  const match = String(invoiceNumber || '').match(NUMBER_PATTERN);
  if (!match) return null;
  const year = Number(match[1]);
  const sequence = Number(match[2]);
  if (!Number.isFinite(year) || !Number.isFinite(sequence)) return null;
  return { year, sequence };
}

async function assertUniqueIndex(report) {
  const indexes = await Invoice.collection.indexes();
  const unique = indexes.find((index) => index.unique && index.key && index.key.invoiceNumber === 1);
  report.uniqueIndexPresent = Boolean(unique);
  if (!unique) {
    console.warn('WARNUNG: Es existiert KEIN Unique-Index auf invoiceNumber. '
      + 'Vermutlich konnte er wegen bestehender Duplikate nie gebaut werden.');
  }
}

async function run() {
  const confirm = process.argv.includes('--confirm');
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not configured');

  await mongoose.connect(process.env.DATABASE_URL);
  console.log(`DocumentSequence seeding started (${confirm ? 'WRITE' : 'dry-run'} mode)`);

  const report = {
    scanned: 0,
    unparsable: [],
    duplicates: [],
    uniqueIndexPresent: false
  };

  try {
    await assertUniqueIndex(report);

    const invoices = await Invoice.collection
      .find({}, { projection: { invoiceNumber: 1, isCreditNote: 1 } })
      .toArray();

    // Rechnungen und Gutschriften teilten sich frueher EINEN Zaehler. Damit keine
    // neue Nummer mit einer alten kollidieren kann, wird pro Jahr das Maximum ueber
    // ALLE Dokumente dieses Jahres gebildet und auf BEIDE Nummernkreise angewendet.
    // Das hinterlaesst Luecken - Luecken sind zulaessig, Duplikate nicht.
    const maxByYear = new Map();
    const seenNumbers = new Map();

    invoices.forEach((invoice) => {
      report.scanned += 1;

      const count = (seenNumbers.get(invoice.invoiceNumber) || 0) + 1;
      seenNumbers.set(invoice.invoiceNumber, count);
      if (count === 2) report.duplicates.push(invoice.invoiceNumber);

      const parsed = parseNumber(invoice.invoiceNumber);
      if (!parsed) {
        report.unparsable.push(invoice.invoiceNumber);
        return;
      }
      const current = maxByYear.get(parsed.year) || 0;
      if (parsed.sequence > current) maxByYear.set(parsed.year, parsed.sequence);
    });

    const plan = [];
    for (const [year, maxSequence] of [...maxByYear.entries()].sort((a, b) => a[0] - b[0])) {
      for (const documentType of ['invoice', 'credit_note']) {
        const existing = await DocumentSequence.findOne({ documentType, year }).lean();
        const currentSequence = Number(existing?.sequence || 0);
        // Niemals herunterzaehlen: ein bereits laufender Zaehler bleibt stehen.
        const targetSequence = Math.max(currentSequence, maxSequence);
        plan.push({
          documentType,
          year,
          from: currentSequence,
          to: targetSequence,
          nextNumber: DocumentSequence.formatNumber(documentType, year, targetSequence + 1),
          changed: targetSequence !== currentSequence
        });
      }
    }

    console.log('\n--- Nummernkreise ---');
    plan.forEach((entry) => {
      console.log(`${entry.documentType}/${entry.year}: ${entry.from} -> ${entry.to}`
        + `${entry.changed ? '' : ' (unveraendert)'}  naechste Nummer: ${entry.nextNumber}`);
    });

    console.log('\n--- Report ---');
    console.log(`Geprueft: ${report.scanned} Belege`);
    console.log(`Unique-Index auf invoiceNumber vorhanden: ${report.uniqueIndexPresent ? 'ja' : 'NEIN'}`);
    console.log(`Nummern ohne Jahres-/Sequenzblock (uebersprungen): ${report.unparsable.length}`
      + (report.unparsable.length ? ` -> ${report.unparsable.slice(0, 20).join(', ')}` : ''));
    console.log(`Doppelte Belegnummern: ${report.duplicates.length}`
      + (report.duplicates.length ? ` -> ${report.duplicates.slice(0, 20).join(', ')}` : ''));

    if (report.duplicates.length > 0) {
      console.error('\nABBRUCH: Doppelte Belegnummern gefunden. Diese muessen fachlich geklaert '
        + 'werden, bevor der Unique-Index und die neuen Nummernkreise greifen koennen.');
      process.exitCode = 1;
      return;
    }

    if (!confirm) {
      console.log('\nDry-Run - es wurde nichts geschrieben. Mit --confirm ausfuehren, um die Zaehler zu setzen.');
      return;
    }

    for (const entry of plan) {
      if (!entry.changed) continue;
      await DocumentSequence.updateOne(
        { documentType: entry.documentType, year: entry.year },
        { $set: { sequence: entry.to, updatedAt: new Date() } },
        { upsert: true }
      );
      console.log(`geschrieben: ${entry.documentType}/${entry.year} = ${entry.to}`);
    }
    console.log('\nFertig.');
  } finally {
    await mongoose.disconnect();
  }
}

run().catch((error) => {
  console.error('seedDocumentSequences failed:', error);
  process.exit(1);
});
