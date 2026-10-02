#!/usr/bin/env node

/**
 * BERICHT (nur lesend): Auftraege mit MEHR ALS EINEM Kommunikations-Thread
 * (Sammlung inspectioncommunications).
 *
 * Hintergrund: Bis 01.10.2026 wurde der Thread per findOne-then-save angelegt; zwei
 * gleichzeitige erste Nachrichten konnten zwei Dokumente fuer denselben Auftrag erzeugen.
 * Seitdem: atomares Anlegen (upsert) und ein eindeutiger Index orderId_unique_thread im Modell.
 * Existieren Altduplikate, kann dieser Index nicht aufgebaut werden (die Anwendung laeuft
 * weiter: Lesepfade nehmen den aeltesten Thread, das Postfach fasst alle Dokumente eines
 * Auftrags zusammen).
 *
 * Dieses Skript SCHREIBT NIE (keine Modelle, autoIndex aus). Es listet je betroffenem Auftrag
 * die Thread-IDs, Erstellzeit und Nachrichtenanzahl. Eine Zusammenfuehrung ist eine bewusste
 * Entscheidung (Nachrichten chronologisch in den aeltesten Thread uebernehmen, idempotent ueber
 * die Nachrichten-_id, vorher Export der betroffenen Dokumente als Sicherung).
 *
 * Aufruf:
 *   node server/scripts/reportInspectionCommunicationDuplicates.js [--json]
 * DATABASE_URL muss gesetzt sein (bzw. aus .env gelesen werden).
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const mongoose = require('mongoose');

const WRITE_FLAGS = ['--apply', '--confirm', '--write', '--fix'];

async function run() {
  const argv = process.argv.slice(2);
  if (argv.some((arg) => WRITE_FLAGS.includes(arg))) {
    console.error('Dieses Skript ist nur lesend und schreibt nicht.');
    process.exit(2);
  }
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL ist nicht gesetzt.');
  await mongoose.connect(process.env.DATABASE_URL, { autoIndex: false, autoCreate: false });
  try {
    const duplicates = await mongoose.connection.db.collection('inspectioncommunications').aggregate([
      {
        $group: {
          _id: '$orderId',
          n: { $sum: 1 },
          threads: { $push: { id: '$_id', createdAt: '$createdAt', messages: { $size: { $ifNull: ['$messages', []] } } } },
        },
      },
      { $match: { n: { $gt: 1 } } },
      { $sort: { n: -1 } },
    ]).toArray();

    const orderIds = duplicates.map((entry) => entry._id).filter(Boolean);
    const orders = orderIds.length
      ? await mongoose.connection.db.collection('orders').find({ _id: { $in: orderIds } }, { projection: { orderNumber: 1 } }).toArray()
      : [];
    const numberById = new Map(orders.map((order) => [String(order._id), order.orderNumber || '']));

    const report = duplicates.map((entry) => ({
      orderId: String(entry._id),
      orderNumber: numberById.get(String(entry._id)) || '',
      threadCount: entry.n,
      threads: entry.threads
        .sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0))
        .map((thread) => ({ id: String(thread.id), createdAt: thread.createdAt, messages: thread.messages })),
    }));

    if (argv.includes('--json')) {
      console.log(JSON.stringify({ duplicates: report }, null, 2));
    } else if (!report.length) {
      console.log('Keine Duplikate: jeder Auftrag hat hoechstens einen Kommunikations-Thread. Der eindeutige Index kann aufgebaut werden.');
    } else {
      console.log(`${report.length} Auftrag/Auftraege mit mehreren Threads (nichts wurde veraendert):`);
      report.forEach((entry) => {
        console.log(`- ${entry.orderNumber || entry.orderId}: ${entry.threadCount} Threads`);
        entry.threads.forEach((thread) => console.log(`    ${thread.id}  angelegt ${thread.createdAt ? new Date(thread.createdAt).toISOString() : '-'}  Nachrichten ${thread.messages}`));
      });
    }
  } finally {
    await mongoose.disconnect();
  }
}

run().catch((error) => {
  console.error(`Fehler: ${error.message || error}`);
  process.exit(1);
});
