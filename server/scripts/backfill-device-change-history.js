#!/usr/bin/env node

require('dotenv').config();
const mongoose = require('mongoose');
require('../models/User');
require('../models/Service');
const Order = require('../models/Order');

function parseArgs(argv) {
  const args = {
    apply: false,
    all: false,
    orderId: null,
    orderNumber: null,
    staffName: 'System',
    dryRun: true,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];

    if (token === '--apply') {
      args.apply = true;
      args.dryRun = false;
      continue;
    }

    if (token === '--dry-run') {
      args.dryRun = true;
      args.apply = false;
      continue;
    }

    if (token === '--all') {
      args.all = true;
      continue;
    }

    if (token === '--order-id' && argv[i + 1]) {
      args.orderId = argv[i + 1];
      i += 1;
      continue;
    }

    if (token === '--order-number' && argv[i + 1]) {
      args.orderNumber = argv[i + 1];
      i += 1;
      continue;
    }

    if (token === '--staff-name' && argv[i + 1]) {
      args.staffName = argv[i + 1];
      i += 1;
      continue;
    }
  }

  return args;
}

function hasDeviceChangeEntry(order) {
  if (!Array.isArray(order.timeline)) return false;

  return order.timeline.some((entry) => {
    const status = String(entry?.status || '');
    const description = String(entry?.description || '');

    return (
      /device\s*change(d)?/i.test(status) ||
      /device\s*change(d)?\s*from/i.test(description)
    );
  });
}

function buildBackfillDescription(order) {
  const brand = order.deviceBrand || 'Unbekannt';
  const model = order.deviceModel || 'Unbekannt';
  const type = order.deviceType || 'Unbekannt';
  return `Gerätänderung (nachgetragen): aktuelles Zielgerät ${brand} ${model} (${type})`;
}

async function main() {
  const args = parseArgs(process.argv);
  const dbUrl = process.env.DATABASE_URL || 'mongodb://localhost:27017/McRepair.de';

  if (!args.all && !args.orderId && !args.orderNumber) {
    console.log('Bitte Ziel einschränken: --order-id <id> oder --order-number <nr>.');
    console.log('Für alle Orders explizit --all verwenden.');
    process.exit(1);
  }

  await mongoose.connect(dbUrl);
  console.log('Connected to MongoDB');

  const filter = {};
  if (args.orderId) filter._id = args.orderId;
  if (args.orderNumber) filter.orderNumber = args.orderNumber;

  const orders = await Order.find(filter)
    .setOptions({ skipAutoPopulate: true })
    .sort({ updatedAt: -1 });

  if (!orders.length) {
    console.log('Keine passenden Orders gefunden.');
    await mongoose.disconnect();
    process.exit(0);
  }

  let inspected = 0;
  let skippedHasHistory = 0;
  let candidates = 0;
  let updated = 0;

  for (const order of orders) {
    inspected += 1;

    if (hasDeviceChangeEntry(order)) {
      skippedHasHistory += 1;
      continue;
    }

    candidates += 1;

    const timelineEntry = {
      status: 'Device Changed',
      description: buildBackfillDescription(order),
      completedAt: order.updatedAt || new Date(),
      staffId: 'system',
      staffName: args.staffName,
    };

    if (args.dryRun) {
      console.log(
        `[DRY-RUN] Würde Eintrag hinzufügen: Order ${order.orderNumber || order._id} -> ${timelineEntry.description}`
      );
      continue;
    }

    order.timeline.push(timelineEntry);
    await order.save();
    updated += 1;

    console.log(`Aktualisiert: Order ${order.orderNumber || order._id}`);
  }

  console.log('--- Zusammenfassung ---');
  console.log(`Geprüft: ${inspected}`);
  console.log(`Bereits mit Gerätewechsel-Historie: ${skippedHasHistory}`);
  console.log(`Kandidaten ohne Gerätewechsel-Historie: ${candidates}`);
  console.log(`Tatsächlich aktualisiert: ${updated}`);
  console.log(`Modus: ${args.dryRun ? 'DRY-RUN' : 'APPLY'}`);

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error('Backfill fehlgeschlagen:', error.message);
  try {
    await mongoose.disconnect();
  } catch (_err) {
    // ignore disconnect errors in failure path
  }
  process.exit(1);
});
