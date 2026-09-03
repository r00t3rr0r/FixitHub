#!/usr/bin/env node

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const mongoose = require('mongoose');
const Invoice = require('../models/Invoice');

function resolveServiceName(item) {
  const existingServiceName = typeof item?.serviceName === 'string' ? item.serviceName.trim() : '';
  if (existingServiceName) return existingServiceName;

  const description = typeof item?.description === 'string' ? item.description.trim() : '';
  if (item?.type === 'service') {
    const separatorIndex = description.lastIndexOf(' – ');
    if (separatorIndex >= 0) return description.slice(separatorIndex + 3).trim() || description;
  }

  return description;
}

async function run() {
  const applyChanges = process.argv.includes('--apply');
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not configured');

  await mongoose.connect(process.env.DATABASE_URL);
  console.log(`Invoice service-name backfill started (${applyChanges ? 'apply' : 'dry-run'} mode)`);

  try {
    const invoices = await Invoice.collection.find({
      items: {
        $elemMatch: {
          $or: [
            { serviceName: { $exists: false } },
            { serviceName: null },
            { serviceName: '' },
          ],
        },
      },
    }, { projection: { invoiceNumber: 1, items: 1 } }).toArray();

    const operations = [];
    let matchedItems = 0;

    for (const invoice of invoices) {
      let invoiceChanged = false;
      const items = invoice.items.map((item) => {
        if (typeof item.serviceName === 'string' && item.serviceName.trim()) return item;

        const serviceName = resolveServiceName(item);
        if (!serviceName) return item;

        matchedItems += 1;
        invoiceChanged = true;
        return { ...item, serviceName };
      });

      if (!invoiceChanged) continue;
      operations.push({
        updateOne: {
          filter: { _id: invoice._id },
          update: { $set: { items } },
        },
      });
      console.log(`- ${invoice.invoiceNumber || invoice._id}: ${items.filter((item) => item.serviceName).length} position(s)`);
    }

    console.log(`Matched ${operations.length} invoice(s) and ${matchedItems} position(s).`);

    if (!applyChanges) {
      console.log('No changes made. Re-run with --apply to persist the service names.');
      return;
    }

    if (operations.length === 0) {
      console.log('No invoice positions require an update.');
      return;
    }

    const result = await Invoice.collection.bulkWrite(operations);
    console.log(`Updated ${result.modifiedCount} invoice(s).`);
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  run().catch(async (error) => {
    console.error('Invoice service-name backfill failed:', error.message);
    await mongoose.disconnect();
    process.exitCode = 1;
  });
}

module.exports = { resolveServiceName };