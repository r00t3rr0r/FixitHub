#!/usr/bin/env node
/**
 * Fills gaps in the repair catalog with test repair services and add-on services.
 *
 * For every active device model, the services the repair configurator would show
 * (same ServiceService.list filters as RepairOrderConfigurator step 3) are inspected.
 * Only repair types that are missing for that model are created, with model-specific
 * prices. Re-running the script is safe: already covered repairs are skipped.
 *
 * Usage:
 *   node scripts/seed-test-repair-services.js            # create missing test data
 *   node scripts/seed-test-repair-services.js --dry-run  # report only, no writes
 *   node scripts/seed-test-repair-services.js --remove   # delete everything this script created
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const Service = require('../models/Service');
const AddOnService = require('../models/AddOnService');
const { DeviceModel, DeviceBrand } = require('../models/Device');
const ServiceService = require('../services/serviceService');
const DeviceService = require('../services/deviceService');

const DATABASE_URL = process.env.DATABASE_URL || 'mongodb://localhost:27017/FixitHub';
const SEED_SOURCE = 'test-seed:repair-gap-fill';
const VAT_FACTOR = 1.19;

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has('--dry-run');
const REMOVE = args.has('--remove');

const BATTERY_RE = /akku\s*-?\s*(tausch|wechsel|austausch)|batterie|battery/i;
const MAINBOARD_RE = /mainboard|logic\s*board|platine|motherboard/i;
const CHARGING_PORT_RE = /ladebuchse|lade\s*(anschluss|port)|lightning|usb[\s-]?c|connector|dc[\s-]?buchse|netzteilbuchse/i;
const LIQUID_RE = /flüssigkeit|fluessigkeit|wasserschaden/i;
const KEYBOARD_RE = /tastatur|keyboard/i;

// `covered` decides whether the model already has this repair; `minPrice` is a sanity floor.
const REPAIRS = {
  display: {
    label: 'Display Reparatur',
    category: 'Display',
    covered: (s) => s.category === 'Display',
    description: 'Austausch der defekten Displayeinheit inkl. Touchscreen, Funktionstest und Reinigung.',
    estimatedTime: '1 Werktag',
    scaling: 'full',
    costShare: 0.45,
    minPrice: 59.9,
  },
  battery: {
    label: 'Akkutausch',
    category: 'Power',
    covered: (s) => BATTERY_RE.test(s.name),
    description: 'Austausch des verschlissenen Akkus gegen einen neuen Qualitätsakku inkl. Kapazitätstest.',
    estimatedTime: '1 Werktag',
    scaling: 'damped',
    costShare: 0.3,
    minPrice: 39.9,
  },
  mainboard: {
    label: 'Mainboard Reparatur',
    category: 'Emergency',
    covered: (s) => MAINBOARD_RE.test(s.name),
    description: 'Mikrolöt-Reparatur auf Platinenebene (z. B. kein Bild, kein Laden, Bootschleife) nach Fehlerdiagnose.',
    estimatedTime: '3-5 Werktage',
    scaling: 'full',
    costShare: 0.25,
    minPrice: 119.9,
  },
  chargingPort: {
    label: 'Ladebuchse Reparatur',
    category: 'Power',
    covered: (s) => CHARGING_PORT_RE.test(s.name),
    description: 'Austausch der defekten oder lockeren Ladebuchse inkl. Lade- und Datentest.',
    estimatedTime: '1 Werktag',
    scaling: 'damped',
    costShare: 0.3,
    minPrice: 39.9,
  },
  camera: {
    label: 'Hauptkamera Reparatur',
    category: 'Camera',
    covered: (s) => s.category === 'Camera',
    description: 'Austausch des defekten Hauptkameramoduls inkl. Fokus- und Bildtest.',
    estimatedTime: '1 Werktag',
    scaling: 'full',
    costShare: 0.4,
    minPrice: 49.9,
  },
  webcam: {
    label: 'Webcam Reparatur',
    category: 'Camera',
    covered: (s) => s.category === 'Camera',
    description: 'Austausch der defekten Webcam inkl. Bild- und Mikrofontest.',
    estimatedTime: '2 Werktage',
    scaling: 'damped',
    costShare: 0.35,
    minPrice: 59.9,
  },
  speaker: {
    label: 'Lautsprecher Reparatur',
    category: 'Hardware',
    covered: (s) => s.category === 'Hardware',
    description: 'Austausch des defekten Lautsprechers bei leisem, verzerrtem oder fehlendem Ton.',
    estimatedTime: '1 Werktag',
    scaling: 'damped',
    costShare: 0.3,
    minPrice: 39.9,
  },
  keyboard: {
    label: 'Tastatur Reparatur',
    category: 'Hardware',
    covered: (s) => s.category === 'Hardware' || KEYBOARD_RE.test(s.name),
    description: 'Austausch der defekten Tastatur bzw. des Topcase inkl. Funktionstest aller Tasten.',
    estimatedTime: '2 Werktage',
    scaling: 'damped',
    costShare: 0.4,
    minPrice: 79.9,
  },
  software: {
    label: 'Softwarebehandlung',
    category: 'Software',
    covered: (s) => s.category === 'Software',
    description: 'Fehleranalyse und Neuinstallation bzw. Aktualisierung des Betriebssystems auf Wunsch mit Datensicherung.',
    estimatedTime: '1 Werktag',
    scaling: 'software',
    costShare: 0,
    minPrice: 69.9,
  },
  liquid: {
    label: 'Flüssigkeitsschadenbehandlung',
    category: 'Emergency',
    covered: (s) => LIQUID_RE.test(s.name),
    description: 'Zerlegung, Ultraschallreinigung und Korrosionsbehandlung nach Wasser- oder Flüssigkeitsschaden.',
    estimatedTime: '2-3 Werktage',
    scaling: 'damped',
    costShare: 0.1,
    minPrice: 59.9,
  },
};

const FAMILY_REPAIRS = {
  smartphone: ['display', 'battery', 'mainboard', 'chargingPort', 'camera', 'speaker', 'software', 'liquid'],
  tablet: ['display', 'battery', 'mainboard', 'chargingPort', 'camera', 'speaker', 'software', 'liquid'],
  laptop: ['display', 'battery', 'mainboard', 'chargingPort', 'webcam', 'keyboard', 'software', 'liquid'],
  wearable: ['display', 'battery', 'mainboard', 'software', 'liquid'],
};

// Gross EUR price of a mid-range model (tier ratio 1.0).
const BASE_PRICES = {
  smartphone: { display: 149.9, battery: 69.9, mainboard: 199.9, chargingPort: 69.9, camera: 89.9, speaker: 54.9, software: 79.9, liquid: 79.9 },
  tablet: { display: 189.9, battery: 99.9, mainboard: 249.9, chargingPort: 89.9, camera: 89.9, speaker: 69.9, software: 79.9, liquid: 99.9 },
  laptop: { display: 249.9, battery: 139.9, mainboard: 349.9, chargingPort: 99.9, webcam: 89.9, keyboard: 149.9, software: 99.9, liquid: 129.9 },
  wearable: { display: 169.9, battery: 69.9, mainboard: 179.9, software: 79.9, liquid: 79.9 },
};

const TEST_ADDONS = [
  {
    concept: /hülle|huelle|\bcase\b|cover/i,
    doc: {
      name: 'Schutzhülle (passend zum Gerät)',
      description: 'Passgenaue, stoßfeste Schutzhülle für Ihr Gerät – wird nach der Reparatur direkt angebracht.',
      price: 24.9,
      category: 'Accessory',
    },
  },
  {
    concept: /kamera.*schutz|camera.*protect|lens.*protect/i,
    doc: {
      name: 'Kameraschutzglas anbringen',
      description: 'Gehärtetes Schutzglas für die Kameralinsen gegen Kratzer und Glasbruch.',
      price: 14.9,
      category: 'Protection',
    },
  },
  {
    concept: /ladekabel|netzteil|ladegerät|ladegeraet|charger/i,
    doc: {
      name: 'Ladekabel & Schnellladegerät',
      description: 'Zertifiziertes Ladekabel mit passendem Schnellladegerät für Ihr Gerät.',
      price: 29.9,
      category: 'Accessory',
    },
  },
  {
    concept: /backup|datensicherung/i,
    doc: {
      name: 'Datensicherung vor der Reparatur',
      description: 'Vollständige Sicherung Ihrer Daten (Fotos, Kontakte, Nachrichten) vor Beginn der Reparatur.',
      price: 39.9,
      category: 'Data',
    },
  },
  {
    concept: /leihgerät|leihgeraet|ersatzgerät|loaner/i,
    doc: {
      name: 'Leihgerät für die Reparaturdauer',
      description: 'Funktionsfähiges Leihgerät, damit Sie während der Reparatur erreichbar bleiben (Rückgabe bei Abholung).',
      price: 14.9,
      category: 'Service',
    },
  },
];

const round2 = (value) => Math.round(value * 100) / 100;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const median = (values) => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

// Deterministic per model+repair spread of +/-4 % so neighbouring models do not share one price.
const jitter = (key) => {
  let hash = 0;
  for (const char of key) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return 0.96 + (hash % 1000) / 1000 * 0.08;
};

// German retail style: 144.90, 149.90, ...
const toShelfPrice = (value, minPrice) => Math.max(minPrice, Math.round(value / 5) * 5 - 0.1);

const familyOf = (deviceTypeKey) => {
  const key = String(deviceTypeKey || '').toLowerCase();
  if (key === 'smartphone' || key === 'phone') return 'smartphone';
  if (key === 'tablet') return 'tablet';
  if (key === 'laptop') return 'laptop';
  if (key === 'wearable' || key === 'smartwatch') return 'wearable';
  return null;
};

// Fallback tier when the model has no priced display/battery service to anchor on.
const heuristicTier = (family, modelName) => {
  const n = String(modelName || '').toLowerCase();
  let r = 1.0;

  const iphone = n.match(/iphone\s*(\d+)/);
  const galaxyS = n.match(/galaxy\s*s\s?(\d+)/);
  const galaxyA = n.match(/galaxy\s*[am]\s?(\d+)/);
  const pixel = n.match(/pixel\s*(\d+)/);

  if (iphone) r = 0.55 + (Number(iphone[1]) - 5) * 0.09;
  else if (/iphone\s*se/.test(n)) r = 0.7;
  else if (/fold/.test(n)) r = 1.8;
  else if (/flip/.test(n)) r = 1.5;
  else if (galaxyS) r = Number(galaxyS[1]) >= 20 ? 0.9 + (Number(galaxyS[1]) - 20) * 0.1 : 0.6 + Number(galaxyS[1]) * 0.04;
  else if (galaxyA) r = 0.55 + Math.min(Number(galaxyA[1]), 80) / 80 * 0.35;
  else if (pixel) r = 0.75 + Number(pixel[1]) * 0.07;
  else if (/nexus|tella|\blite\b|redmi|moto\s*[eg]/.test(n)) r = 0.65;
  else if (/macbook\s*pro/.test(n)) r = 1.5;
  else if (/macbook\s*air|surface/.test(n)) r = 1.3;
  else if (/ipad\s*pro/.test(n)) r = 1.6;
  else if (/ipad\s*air|tab\s*s/.test(n)) r = 1.2;

  if (/pro\s*max|ultra/.test(n)) r += 0.25;
  else if (/\bpro\b/.test(n) && family !== 'laptop' && !/ipad/.test(n)) r += 0.15;
  else if (/plus|\+|\bmax\b/.test(n)) r += 0.1;
  if (/\bmini\b/.test(n)) r -= 0.05;

  return clamp(r, 0.55, 1.8);
};

const priceFor = (family, repairKey, tier, modelId) => {
  const repair = REPAIRS[repairKey];
  const base = BASE_PRICES[family][repairKey];
  if (repair.scaling === 'software') {
    const tierPrice = tier < 1.2 ? 79.9 : tier < 1.5 ? 89.9 : 99.9;
    return family === 'laptop' ? tierPrice + 20 : tierPrice;
  }
  const factor = repair.scaling === 'full' ? tier : 1 + (tier - 1) * 0.5;
  return toShelfPrice(base * factor * jitter(`${modelId}:${repairKey}`), repair.minPrice);
};

const displayLabel = (brandName, modelName) => {
  const brand = String(brandName || '').trim();
  const model = String(modelName || '').trim();
  if (!brand || model.toLowerCase().startsWith(brand.toLowerCase())) return model;
  return `${brand} ${model}`;
};

async function loadFamilyAverages() {
  const rows = await Service.aggregate([
    { $match: { isActive: true, price: { $gt: 0 }, source: { $ne: SEED_SOURCE } } },
    { $unwind: '$deviceTypes' },
    { $project: { type: { $toLower: '$deviceTypes' }, category: 1, name: 1, price: 1 } },
  ]);
  const buckets = {};
  for (const row of rows) {
    const family = familyOf(row.type);
    if (!family) continue;
    buckets[family] ||= { display: [], battery: [] };
    if (row.category === 'Display') buckets[family].display.push(row.price);
    else if (BATTERY_RE.test(row.name)) buckets[family].battery.push(row.price);
  }
  const averages = {};
  for (const [family, { display, battery }] of Object.entries(buckets)) {
    averages[family] = { display: median(display), battery: median(battery) };
  }
  return averages;
}

// Tier ratio from the model's own existing display/battery prices relative to its family median.
const anchoredTier = (anchorServices, familyAverage) => {
  if (!familyAverage) return null;
  const priced = anchorServices.filter((s) => s.price > 0 && s.source !== SEED_SOURCE);
  const display = median(priced.filter((s) => s.category === 'Display').map((s) => s.price));
  const battery = median(priced.filter((s) => BATTERY_RE.test(s.name)).map((s) => s.price));
  const ratios = [];
  if (display && familyAverage.display) ratios.push([display / familyAverage.display, 0.7]);
  if (battery && familyAverage.battery) ratios.push([battery / familyAverage.battery, 0.3]);
  if (ratios.length === 0) return null;
  const weight = ratios.reduce((sum, [, w]) => sum + w, 0);
  return clamp(ratios.reduce((sum, [r, w]) => sum + r * w, 0) / weight, 0.55, 1.8);
};

// ServiceService.list logs every call; keep the script output readable.
const quietList = async (filters) => {
  const originalLog = console.log;
  console.log = () => {};
  try {
    return (await ServiceService.list(filters, { page: 1, limit: 1000 }, {})).services;
  } finally {
    console.log = originalLog;
  }
};

async function removeSeedData() {
  const services = DRY_RUN
    ? await Service.countDocuments({ source: SEED_SOURCE })
    : (await Service.deleteMany({ source: SEED_SOURCE })).deletedCount;
  const addonFilter = { name: { $in: TEST_ADDONS.map((a) => a.doc.name) } };
  const addons = DRY_RUN
    ? await AddOnService.countDocuments(addonFilter)
    : (await AddOnService.deleteMany(addonFilter)).deletedCount;
  console.log(`${DRY_RUN ? '[dry-run] Would remove' : 'Removed'} ${services} test repair services and ${addons} test add-ons.`);
}

async function seedRepairServices() {
  const [models, brands, deviceTypes, familyAverages] = await Promise.all([
    DeviceModel.find({ isActive: true }).lean(),
    DeviceBrand.find().lean(),
    DeviceService.getDeviceTypes(),
    loadFamilyAverages(),
  ]);
  const brandNameById = new Map(brands.map((b) => [String(b._id), b.name]));
  const typeNameById = new Map(deviceTypes.map((t) => [String(t._id), t.name]));

  const toCreate = [];
  const stats = { models: 0, skippedFamily: 0, anchored: 0, heuristic: 0, byRepair: {} };
  const samples = [];

  for (const model of models) {
    const family = familyOf(model.deviceType);
    if (!family) {
      stats.skippedFamily += 1;
      continue;
    }
    stats.models += 1;

    const brandName = brandNameById.get(String(model.brandId)) || '';
    const typeName = typeNameById.get(String(model.deviceType)) || model.deviceType;

    // Identical filters to RepairOrderConfigurator step 3.
    const filters = { deviceType: typeName, modelPrecise: model.name };
    if (brandName) filters.manufacturerPrecise = brandName;
    const visible = await quietList(filters);

    // Price anchor ignores the device type, so duplicate models stored under another type still anchor.
    const anchorServices = await quietList({
      modelPrecise: model.name,
      ...(brandName ? { manufacturerPrecise: brandName } : {}),
    });
    let tier = anchoredTier(anchorServices, familyAverages[family]);
    if (tier) stats.anchored += 1;
    else {
      tier = heuristicTier(family, model.name);
      stats.heuristic += 1;
    }

    const label = displayLabel(brandName, model.name);
    const created = [];
    for (const repairKey of FAMILY_REPAIRS[family]) {
      const repair = REPAIRS[repairKey];
      if (visible.some(repair.covered)) continue;

      const price = round2(priceFor(family, repairKey, tier, String(model._id)));
      toCreate.push({
        name: `${label} ${repair.label}`,
        shortDescription: repair.label,
        description: repair.description,
        price,
        priceNet: round2(price / VAT_FACTOR),
        purchasePrice: round2(price * repair.costShare),
        estimatedTime: repair.estimatedTime,
        category: repair.category,
        source: SEED_SOURCE,
        note: 'Testdaten – erzeugt von scripts/seed-test-repair-services.js',
        deviceTypes: [typeName],
        manufacturer: brandName,
        manufacturerPrecise: brandName,
        model: model.name,
        modelPrecise: model.name,
        popularity: 0,
        isActive: true,
      });
      created.push(`${repair.label} ${price.toFixed(2)}`);
      stats.byRepair[repairKey] = (stats.byRepair[repairKey] || 0) + 1;
    }

    if (created.length > 0 && samples.length < 12 && /iphone 1[3-5]|galaxy s2[2-3]|galaxy a1|macbook|ipad pro|watch/i.test(model.name)) {
      samples.push(`${label} [${typeName}, tier ${tier.toFixed(2)}]: ${created.join(', ')}`);
    }
  }

  console.log(`Checked ${stats.models} models (${stats.anchored} priced from existing data, ${stats.heuristic} by heuristic, ${stats.skippedFamily} skipped: unknown device type).`);
  console.log('Missing repairs to create:', stats.byRepair);
  console.log('Examples:');
  samples.forEach((line) => console.log(`  - ${line}`));

  if (DRY_RUN) {
    console.log(`[dry-run] Would create ${toCreate.length} repair services.`);
    return;
  }

  for (let i = 0; i < toCreate.length; i += 1000) {
    await Service.insertMany(toCreate.slice(i, i + 1000), { ordered: false });
  }
  console.log(`Created ${toCreate.length} repair services.`);
}

async function seedAddOns() {
  const existing = await AddOnService.find().lean();
  const missing = TEST_ADDONS.filter(({ concept }) =>
    !existing.some((addon) => concept.test(addon.name) || concept.test(addon.description || ''))
  );

  if (missing.length === 0) {
    console.log('Add-ons: nothing missing.');
    return;
  }
  console.log(`Add-ons missing: ${missing.map((a) => a.doc.name).join(', ')}`);
  if (DRY_RUN) return;

  await AddOnService.insertMany(missing.map(({ doc }) => ({
    ...doc,
    // Configurator reads the first number as days; add-ons do not extend the repair duration.
    estimatedTime: '0',
    compatibility: [],
    bundleDiscount: 0,
    popularity: 0,
    isActive: true,
  })));
  console.log(`Created ${missing.length} add-ons.`);
}

async function main() {
  await mongoose.connect(DATABASE_URL);
  try {
    if (REMOVE) {
      await removeSeedData();
    } else {
      await seedRepairServices();
      await seedAddOns();
    }
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error('seed-test-repair-services failed:', error);
  process.exit(1);
});
