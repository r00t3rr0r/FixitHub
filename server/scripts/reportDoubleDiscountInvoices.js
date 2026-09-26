#!/usr/bin/env node

/**
 * BERICHT (nur lesend): Rechnungen mit DOPPELT angewandtem Kundengruppenrabatt.
 *
 * Hintergrund: Zwischen dem 22.09.2026 und der Korrektur in FinancialService
 * (createInvoiceFromOrder / generateFromRepairOrders) wurde beim Erzeugen einer
 * Rechnung aus einem Auftrag der Gruppenrabatt ein zweites Mal auf den bereits
 * rabattierten Auftragswert gerechnet. Beispiel Sophie, INV-2026-0007:
 *   Auftrag: Liste 49,90 - Rabatt 7,48 = 42,42
 *   Rechnung: Rabatt 13,84 (= 7,48 + 15 % von 42,42), Brutto 36,06
 *
 * Verfahren je Rechnung mit Auftragsbezug (orderId / repairOrderIds, ersatzweise die
 * Auftraege der Buchung), keine Gutschriften:
 *   Treffer, wenn  invoice.discount > Summe(order.discount)
 *             und  invoice.total    < Summe(order.totalCost)
 * Ausgegeben werden je Treffer der Stand vorher und ein Vorschlag (Rabatt und Brutto wie
 * im Auftrag, Netto/MwSt brutto-first daraus), der Zahlungsstand und ob die Abweichung
 * genau der Signatur "Auftragsrabatt + Gruppenprozentsatz vom Auftragswert" entspricht.
 * Faelle, die sich nicht eindeutig beurteilen lassen (fehlender/stornierter Auftrag,
 * Positionen passen nicht zum Auftrag, abweichender Zusatzrabatt), stehen in einer
 * eigenen Liste UNKLAR.
 *
 * Das Skript SCHREIBT NIE: keine Modelle (kein Index-Aufbau), nur Lesezugriffe auf die
 * Sammlungen. Die betroffenen Rechnungen wurden an Kunden versendet - die Korrektur ist
 * eine fachliche Entscheidung (Storno-Gutschrift + neue Rechnung), keine Datenmigration.
 *
 * Aufruf:
 *   node server/scripts/reportDoubleDiscountInvoices.js [--from 2026-09-22] [--to 2026-10-31] [--json]
 * DATABASE_URL muss gesetzt sein (bzw. aus .env gelesen werden).
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const mongoose = require('mongoose');

const WRITE_FLAGS = ['--apply', '--confirm', '--write', '--fix'];

const round2 = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
const euro = (value) => `${Number(value || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const dateDe = (value) => (value ? new Date(value).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-');
const idOf = (value) => (value && value._id ? String(value._id) : String(value || ''));

const STATUS_LABELS = {
  draft: 'Entwurf', pending_approval: 'zur Freigabe', sent: 'versendet', viewed: 'angesehen', partially_paid: 'teilbezahlt',
  paid: 'bezahlt', overdue: 'überfällig', cancelled: 'storniert', credited: 'gutgeschrieben',
};

function parseArgs(argv) {
  const args = { from: new Date('2026-09-22T00:00:00'), to: null, json: false };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--from' && argv[i + 1]) { args.from = new Date(`${argv[i + 1]}T00:00:00`); i += 1; }
    else if (argv[i] === '--to' && argv[i + 1]) { args.to = new Date(`${argv[i + 1]}T23:59:59`); i += 1; }
    else if (argv[i] === '--json') args.json = true;
  }
  if (Number.isNaN(args.from.getTime())) throw new Error('Ungültiges Datum bei --from (Format JJJJ-MM-TT).');
  if (args.to && Number.isNaN(args.to.getTime())) throw new Error('Ungültiges Datum bei --to (Format JJJJ-MM-TT).');
  return args;
}

/** Reine Bewertung einer Rechnung gegen ihre Auftraege (exportiert fuer Tests). */
function assessInvoice(invoice, orders, { missingOrderIds = [], groupPercent = null } = {}) {
  const reasons = [];
  if (missingOrderIds.length > 0) reasons.push(`Auftrag nicht gefunden (${missingOrderIds.join(', ')})`);
  if (orders.some((order) => order.status === 'cancelled')) reasons.push('ein zugehöriger Auftrag ist storniert');

  const orderDiscount = round2(orders.reduce((sum, order) => sum + Number(order.discount || 0), 0));
  const orderTotal = round2(orders.reduce((sum, order) => sum + Number(order.totalCost || 0), 0));
  const invoiceDiscount = round2(Number(invoice.discount || 0));
  const invoiceTotal = round2(Math.abs(Number(invoice.total || 0)));
  const taxRate = Number.isFinite(Number(invoice.taxRate)) ? Number(invoice.taxRate) : 19;
  const itemsGross = round2((invoice.items || []).reduce((sum, item) => sum + Number(item.total || 0), 0));
  const orderListGross = round2(orderTotal + orderDiscount);

  const hit = invoiceDiscount > orderDiscount + 0.01 && invoiceTotal < orderTotal - 0.01;
  if (missingOrderIds.length > 0) return { kind: 'ambiguous', reasons, orderDiscount, orderTotal, invoiceDiscount, invoiceTotal };
  if (!hit) return { kind: 'ok', reasons, orderDiscount, orderTotal, invoiceDiscount, invoiceTotal };

  if ((invoice.items || []).length > 0 && Math.abs(itemsGross - orderListGross) > 0.01) {
    reasons.push(`Positionen (${euro(itemsGross)}) entsprechen nicht dem Auftrag (${euro(orderListGross)}) – evtl. Teil- oder Sammelrechnung`);
  }
  // Signatur des Fehlers: Auftragsrabatt + Gruppenprozentsatz vom bereits rabattierten Wert.
  let signature = null;
  if (Number.isFinite(groupPercent) && groupPercent > 0) {
    const expected = round2(orderDiscount + round2(orderTotal * groupPercent / 100));
    if (Math.abs(expected - invoiceDiscount) <= 0.02) {
      signature = `${euro(orderDiscount).replace(' €', '')} + ${groupPercent} % von ${euro(orderTotal).replace(' €', '')} = ${euro(expected).replace(' €', '')}`;
    }
  }
  if (!signature) reasons.push('Abweichung entspricht nicht der Signatur "Gruppenrabatt doppelt" – evtl. bewusster Zusatzrabatt');

  const proposedTotal = orderTotal;
  const proposedNet = round2(proposedTotal / (1 + taxRate / 100));
  const proposal = {
    discount: orderDiscount,
    total: proposedTotal,
    net: proposedNet,
    tax: round2(proposedTotal - proposedNet),
    difference: round2(proposedTotal - invoiceTotal),
  };
  return {
    kind: reasons.length > 0 ? 'ambiguous' : 'hit',
    reasons,
    signature,
    orderDiscount,
    orderTotal,
    invoiceDiscount,
    invoiceTotal,
    before: { discount: invoiceDiscount, total: invoiceTotal, net: round2(Number(invoice.subtotal || 0)), tax: round2(Number(invoice.tax || 0)) },
    proposal,
  };
}

async function run() {
  const argv = process.argv.slice(2);
  if (argv.some((arg) => WRITE_FLAGS.includes(arg))) {
    console.error('Dieses Skript ist nur lesend und schreibt nicht. Korrekturen erfolgen fachlich per Storno-Gutschrift + neuer Rechnung.');
    process.exit(2);
  }
  const args = parseArgs(argv);
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL ist nicht gesetzt.');

  // autoIndex aus und keine Modelle: es entsteht kein einziger Schreibzugriff.
  await mongoose.connect(process.env.DATABASE_URL, { autoIndex: false, autoCreate: false });
  const db = mongoose.connection.db;
  const col = (name) => db.collection(name);

  try {
    const createdAt = { $gte: args.from, ...(args.to ? { $lte: args.to } : {}) };
    const invoices = await col('invoices').find({
      isCreditNote: { $ne: true },
      createdAt,
      $or: [{ orderId: { $ne: null } }, { 'repairOrderIds.0': { $exists: true } }, { bookingId: { $ne: null } }],
    }, {
      projection: {
        invoiceNumber: 1, customerId: 1, customerName: 1, orderId: 1, repairOrderIds: 1, bookingId: 1, items: 1,
        discount: 1, total: 1, subtotal: 1, tax: 1, taxRate: 1, status: 1, createdAt: 1, sentAt: 1,
      },
    }).sort({ createdAt: 1 }).toArray();

    const hits = [];
    const ambiguous = [];
    for (const invoice of invoices) {
      const orderIds = new Set([idOf(invoice.orderId), ...(invoice.repairOrderIds || []).map(idOf)].filter(Boolean));
      let viaBooking = false;
      if (orderIds.size === 0 && invoice.bookingId) {
        const booking = await col('bookings').findOne({ _id: invoice.bookingId }, { projection: { orderIds: 1 } });
        (booking?.orderIds || []).forEach((id) => orderIds.add(idOf(id)));
        viaBooking = true;
      }
      if (orderIds.size === 0) continue;
      const objectIds = [...orderIds].filter((id) => mongoose.Types.ObjectId.isValid(id)).map((id) => new mongoose.Types.ObjectId(id));
      const orders = await col('orders').find({ _id: { $in: objectIds } }, { projection: { orderNumber: 1, totalCost: 1, discount: 1, status: 1 } }).toArray();
      const found = new Set(orders.map((order) => String(order._id)));
      const missingOrderIds = [...orderIds].filter((id) => !found.has(id));

      let groupPercent = null;
      if (invoice.customerId) {
        const customer = await col('users').findOne({ _id: invoice.customerId }, { projection: { discount: 1, primaryCustomerGroupId: 1 } });
        if (typeof customer?.discount === 'number' && customer.discount > 0) groupPercent = customer.discount;
        else if (customer?.primaryCustomerGroupId) {
          const group = await col('customergroups').findOne({ _id: customer.primaryCustomerGroupId }, { projection: { 'financeProfile.discountPercent': 1 } });
          const pct = Number(group?.financeProfile?.discountPercent);
          if (Number.isFinite(pct) && pct > 0) groupPercent = pct;
        }
      }

      const assessment = assessInvoice(invoice, orders, { missingOrderIds, groupPercent });
      if (assessment.kind === 'ok') continue;

      const allocations = await col('paymentallocations').find({ invoiceId: invoice._id }, { projection: { allocatedAmount: 1 } }).toArray();
      const allocated = round2(allocations.reduce((sum, row) => sum + Number(row.allocatedAmount || 0), 0));
      const record = {
        invoiceId: String(invoice._id),
        invoiceNumber: invoice.invoiceNumber || String(invoice._id),
        createdAt: invoice.createdAt,
        customerName: invoice.customerName || '',
        status: invoice.status,
        orders: orders.map((order) => order.orderNumber || String(order._id)),
        viaBooking,
        allocated,
        ...assessment,
      };
      if (assessment.kind === 'hit') hits.push(record); else ambiguous.push(record);
    }

    if (args.json) {
      console.log(JSON.stringify({ readOnly: true, from: args.from, to: args.to, checked: invoices.length, hits, ambiguous }, null, 2));
      return;
    }

    console.log('Bericht: doppelt angewandter Kundengruppenrabatt auf Rechnungen (NUR LESEND – es wird nichts geschrieben)');
    console.log(`Zeitraum: ab ${dateDe(args.from)}${args.to ? ` bis ${dateDe(args.to)}` : ''} | geprüft: ${invoices.length} Rechnungen mit Auftrags-/Buchungsbezug`);

    console.log(`\nTREFFER (${hits.length})`);
    hits.forEach((record) => {
      console.log(`${record.invoiceNumber} | ${dateDe(record.createdAt)} | ${record.customerName} | Status: ${STATUS_LABELS[record.status] || record.status} | Aufträge: ${record.orders.join(', ')}${record.viaBooking ? ' (über Buchung)' : ''}`);
      console.log(`  vorher:    Rabatt ${euro(record.before.discount)} | Brutto ${euro(record.before.total)} | Netto ${euro(record.before.net)} | MwSt ${euro(record.before.tax)}`);
      console.log(`  Vorschlag: Rabatt ${euro(record.proposal.discount)} | Brutto ${euro(record.proposal.total)} | Netto ${euro(record.proposal.net)} | MwSt ${euro(record.proposal.tax)} | Differenz ${euro(record.proposal.difference)} zu wenig berechnet`);
      if (record.signature) console.log(`  Signatur:  ${record.signature} (Gruppenrabatt doppelt)`);
      console.log(`  Zahlungsstand: ${euro(record.allocated)} zugeordnet`);
      console.log('  Korrektur: fachliche Entscheidung – Storno-Gutschrift + neue Rechnung; keine stille Änderung des versendeten Belegs.');
    });

    console.log(`\nUNKLAR (${ambiguous.length}) – bitte manuell prüfen`);
    ambiguous.forEach((record) => {
      console.log(`${record.invoiceNumber} | ${dateDe(record.createdAt)} | ${record.customerName} | Status: ${STATUS_LABELS[record.status] || record.status}`
        + ` | Rechnung: Rabatt ${euro(record.invoiceDiscount)}, Brutto ${euro(record.invoiceTotal)} | Aufträge: Rabatt ${euro(record.orderDiscount)}, Wert ${euro(record.orderTotal)}`);
      console.log(`  Grund: ${record.reasons.join('; ')}`);
    });
    console.log('\nEs wurde nichts geschrieben.');
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  run().catch((error) => {
    console.error('reportDoubleDiscountInvoices fehlgeschlagen:', error.message);
    process.exit(1);
  });
}

module.exports = { assessInvoice };
