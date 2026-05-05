const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Order = require('../models/Order');
const Invoice = require('../models/Invoice');
const Payment = require('../models/Payment');
const { WorkSession } = require('../models/TimeEntry');
const CustomerGroup = require('../models/CustomerGroup');
const SystemConfigService = require('./systemConfigService');
const FinancialService = require('./financialService');

const DEFAULT_SETTINGS = {
  labor: {
    defaultHourlyRate: 92,
    includeTrackedTimeOnly: true,
    fallbackProgressWeight: 0.72,
    minimumProgressFactor: 0.18,
    productHandlingMinutes: 8,
  },
  materials: {
    repairMaterialBaseRate: 0.2,
    repairMaterialPerServiceRate: 0.035,
    minimumRepairMaterialRate: 0.18,
    maximumRepairMaterialRate: 0.42,
    productMaterialRate: 0.72,
    fallbackShopProductCostRate: 0.65,
  },
  subcontracting: {
    enabled: true,
    defaultRate: 0.12,
    keywords: ['logic', 'board', 'micro', 'solder', 'wasser', 'water', 'daten', 'data'],
  },
  overhead: {
    monthlyRent: 2600,
    monthlyUtilities: 580,
    monthlyAdminPayroll: 4200,
    monthlySoftware: 480,
    monthlyInsurance: 340,
    monthlyMarketing: 690,
    monthlyOtherFixedCosts: 520,
    targetMonthlyBillableHours: 480,
  },
  depreciation: {
    monthlyEquipmentDepreciation: 780,
  },
  otherCosts: {
    packagingRate: 0.01,
    paymentFeeRate: 0.015,
    paymentFeeFixedAmount: 0,
    flatShippingCostPerBooking: 6.9,
    warrantyReserveRate: 0.02,
  },
  warranty: {
    keywords: ['nacharbeit', 'rework', 'warranty', 'garantie', 'gewaehr'],
    defaultLabel: '90 Tage Standard',
    flaggedLabel: 'Nacharbeit / Gewaehrleistung',
  },
  formula: {
    profitWeights: {
      netRevenue: 1,
      directCosts: 1,
      overheadCost: 1,
      depreciationCost: 1,
      otherOperatingCost: 1,
    },
    operatingCostWeights: {
      packaging: 1,
      paymentFallback: 1,
      paymentGateway: 1,
      warrantyReserve: 1,
      orderShipping: 1,
      bookingFlatShipping: 1,
    },
  },
  accounting: {
    vatRate: 0.19,
    targetGrossMarginRate: 0.3,
    defaultProjectionWorkdays: 22,
  },
};

const safeArray = (value) => (Array.isArray(value) ? value : []);

// Safely convert a raw ObjectId, BSON ObjectId, or accidentally-populated
// document into a 24-character hex string. Returns null for anything invalid.
function toObjectIdString(value) {
  if (!value) return null;
  // Unwrap populated documents (plain objects with an _id field)
  if (typeof value === 'object' && !(value instanceof mongoose.Types.ObjectId) && value._id) {
    value = value._id;
  }
  const str = String(value);
  return mongoose.Types.ObjectId.isValid(str) ? str : null;
}

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};
const roundCurrency = (value) => Math.round((value + Number.EPSILON) * 100) / 100;
const roundHours = (value) => Math.round((value + Number.EPSILON) * 10) / 10;
const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

function parseDate(value) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

function isBusinessDay(date) {
  const day = date.getDay();
  return day >= 1 && day <= 5;
}

function countBusinessDaysInclusive(startDate, endDate) {
  if (!startDate || !endDate) return 0;
  const start = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  const end = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
  if (end < start) return 0;

  let count = 0;
  const current = new Date(start);
  while (current <= end) {
    if (isBusinessDay(current)) count += 1;
    current.setDate(current.getDate() + 1);
  }
  return count;
}

function sumCostBlocks(costs = {}) {
  return roundCurrency(
    toNumber(costs.technicianCost) +
      toNumber(costs.shippingCost) +
      toNumber(costs.additionalCost) +
      toNumber(costs.packagingCost) +
      toNumber(costs.paymentFee)
  );
}

function calculateContributionMarginMetrics({ grossAmount, netAmount, costs, targetGrossMarginRate = 0.3, ppCredit = 0 }) {
  const gross = roundCurrency(toNumber(grossAmount));
  const net = roundCurrency(toNumber(netAmount));
  const totalCosts = sumCostBlocks(costs);
  const contributionMargin = roundCurrency(net - totalCosts);
  const profitability = net !== 0 ? roundCurrency((contributionMargin / net) * 100) : 0;
  const target30Percent = roundCurrency(gross * toNumber(targetGrossMarginRate));
  const contributionVsTarget = roundCurrency(contributionMargin - target30Percent);

  return {
    grossAmount: gross,
    netAmount: net,
    technicianCost: roundCurrency(toNumber(costs.technicianCost)),
    shippingCost: roundCurrency(toNumber(costs.shippingCost)),
    additionalCost: roundCurrency(toNumber(costs.additionalCost)),
    packagingCost: roundCurrency(toNumber(costs.packagingCost)),
    paymentFee: roundCurrency(toNumber(costs.paymentFee)),
    totalCosts,
    contributionMargin,
    profitability,
    target30Percent,
    contributionVsTarget,
    ppCredit: roundCurrency(toNumber(ppCredit)),
  };
}

function deriveNetFromGross(grossAmount, vatRate = 0.19) {
  const gross = toNumber(grossAmount);
  const divisor = 1 + toNumber(vatRate);
  if (divisor <= 0) return roundCurrency(gross);
  return roundCurrency(gross / divisor);
}

function summarizeDeckungsbeitragRows(rows, projectedWorkdays = 22) {
  const totals = rows.reduce(
    (accumulator, row) => ({
      invoiceCount: accumulator.invoiceCount + 1,
      grossAmount: accumulator.grossAmount + toNumber(row.grossAmount),
      netAmount: accumulator.netAmount + toNumber(row.netAmount),
      technicianCost: accumulator.technicianCost + toNumber(row.technicianCost),
      shippingCost: accumulator.shippingCost + toNumber(row.shippingCost),
      additionalCost: accumulator.additionalCost + toNumber(row.additionalCost),
      packagingCost: accumulator.packagingCost + toNumber(row.packagingCost),
      paymentFee: accumulator.paymentFee + toNumber(row.paymentFee),
      totalCosts: accumulator.totalCosts + toNumber(row.totalCosts),
      contributionMargin: accumulator.contributionMargin + toNumber(row.contributionMargin),
      target30Percent: accumulator.target30Percent + toNumber(row.target30Percent),
      contributionVsTarget: accumulator.contributionVsTarget + toNumber(row.contributionVsTarget),
      ppCredit: accumulator.ppCredit + toNumber(row.ppCredit),
    }),
    {
      invoiceCount: 0,
      grossAmount: 0,
      netAmount: 0,
      technicianCost: 0,
      shippingCost: 0,
      additionalCost: 0,
      packagingCost: 0,
      paymentFee: 0,
      totalCosts: 0,
      contributionMargin: 0,
      target30Percent: 0,
      contributionVsTarget: 0,
      ppCredit: 0,
    }
  );

  const dates = rows
    .map((row) => parseDate(row.invoiceDate || row.bookingDate || row.orderDate))
    .filter(Boolean)
    .sort((a, b) => a.getTime() - b.getTime());

  const startDate = dates.length > 0 ? dates[0] : null;
  const endDate = dates.length > 0 ? dates[dates.length - 1] : null;
  const workdays = Math.max(1, countBusinessDaysInclusive(startDate, endDate));

  const roundedTotals = {
    invoiceCount: totals.invoiceCount,
    grossAmount: roundCurrency(totals.grossAmount),
    netAmount: roundCurrency(totals.netAmount),
    technicianCost: roundCurrency(totals.technicianCost),
    shippingCost: roundCurrency(totals.shippingCost),
    additionalCost: roundCurrency(totals.additionalCost),
    packagingCost: roundCurrency(totals.packagingCost),
    paymentFee: roundCurrency(totals.paymentFee),
    totalCosts: roundCurrency(totals.totalCosts),
    contributionMargin: roundCurrency(totals.contributionMargin),
    target30Percent: roundCurrency(totals.target30Percent),
    contributionVsTarget: roundCurrency(totals.contributionVsTarget),
    ppCredit: roundCurrency(totals.ppCredit),
    profitability: totals.netAmount !== 0 ? roundCurrency((totals.contributionMargin / totals.netAmount) * 100) : 0,
  };

  const perWorkday = {
    grossAmount: roundCurrency(roundedTotals.grossAmount / workdays),
    netAmount: roundCurrency(roundedTotals.netAmount / workdays),
    technicianCost: roundCurrency(roundedTotals.technicianCost / workdays),
    shippingCost: roundCurrency(roundedTotals.shippingCost / workdays),
    additionalCost: roundCurrency(roundedTotals.additionalCost / workdays),
    packagingCost: roundCurrency(roundedTotals.packagingCost / workdays),
    paymentFee: roundCurrency(roundedTotals.paymentFee / workdays),
    totalCosts: roundCurrency(roundedTotals.totalCosts / workdays),
    contributionMargin: roundCurrency(roundedTotals.contributionMargin / workdays),
    target30Percent: roundCurrency(roundedTotals.target30Percent / workdays),
    contributionVsTarget: roundCurrency(roundedTotals.contributionVsTarget / workdays),
    ppCredit: roundCurrency(roundedTotals.ppCredit / workdays),
    invoiceCount: roundCurrency(roundedTotals.invoiceCount / workdays),
  };

  const targetDays = Math.max(1, Math.round(toNumber(projectedWorkdays)));

  const projection = {
    grossAmount: roundCurrency(perWorkday.grossAmount * targetDays),
    netAmount: roundCurrency(perWorkday.netAmount * targetDays),
    technicianCost: roundCurrency(perWorkday.technicianCost * targetDays),
    shippingCost: roundCurrency(perWorkday.shippingCost * targetDays),
    additionalCost: roundCurrency(perWorkday.additionalCost * targetDays),
    packagingCost: roundCurrency(perWorkday.packagingCost * targetDays),
    paymentFee: roundCurrency(perWorkday.paymentFee * targetDays),
    totalCosts: roundCurrency(perWorkday.totalCosts * targetDays),
    contributionMargin: roundCurrency(perWorkday.contributionMargin * targetDays),
    target30Percent: roundCurrency(perWorkday.target30Percent * targetDays),
    contributionVsTarget: roundCurrency(perWorkday.contributionVsTarget * targetDays),
    ppCredit: roundCurrency(perWorkday.ppCredit * targetDays),
    invoiceCount: roundCurrency(perWorkday.invoiceCount * targetDays),
    profitability: perWorkday.netAmount !== 0 ? roundCurrency((perWorkday.contributionMargin / perWorkday.netAmount) * 100) : 0,
    workdays: targetDays,
  };

  return {
    totals: roundedTotals,
    workdays,
    range: {
      startDate: startDate ? startDate.toISOString() : null,
      endDate: endDate ? endDate.toISOString() : null,
    },
    perWorkday,
    projection,
  };
}

function buildGroupedPeriodSummaries(rows, granularity = 'day', projectedWorkdays = 22) {
  const groups = new Map();

  for (const row of rows) {
    const date = parseDate(row.invoiceDate || row.bookingDate || row.orderDate);
    if (!date) continue;

    const key =
      granularity === 'month'
        ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
        : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }

  return Array.from(groups.entries())
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([periodKey, periodRows]) => ({
      periodKey,
      ...summarizeDeckungsbeitragRows(periodRows, projectedWorkdays),
    }));
}

const PAYMENT_METHOD_TO_PROVIDER = {
  stripe: 'stripe',
  paypal: 'paypal',
  bank_transfer: 'bank_transfer',
  credit_card: 'stripe',
  debit_card: 'stripe',
  card: 'stripe',
  invoice: 'bank_transfer',
  cash: 'cash',
};

function isObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function deepMerge(base, updates) {
  if (!isObject(base) || !isObject(updates)) {
    return updates === undefined ? base : updates;
  }

  const result = { ...base };
  for (const [key, value] of Object.entries(updates)) {
    result[key] = isObject(value) ? deepMerge(base[key] || {}, value) : value;
  }

  return result;
}

function normalizeSettings(rawSettings) {
  return deepMerge(DEFAULT_SETTINGS, rawSettings || {});
}

function sanitizeSettings(rawSettings) {
  const normalized = normalizeSettings(rawSettings);

  normalized.otherCosts.flatShippingCostPerBooking = clamp(
    toNumber(normalized.otherCosts.flatShippingCostPerBooking),
    0,
    500
  );
  normalized.otherCosts.paymentFeeFixedAmount = clamp(
    toNumber(normalized.otherCosts.paymentFeeFixedAmount),
    -100,
    100
  );
  normalized.accounting.vatRate = clamp(toNumber(normalized.accounting.vatRate), 0, 1);
  normalized.accounting.targetGrossMarginRate = clamp(toNumber(normalized.accounting.targetGrossMarginRate), 0, 1);
  normalized.accounting.defaultProjectionWorkdays = clamp(toNumber(normalized.accounting.defaultProjectionWorkdays), 1, 31);

  normalized.formula.profitWeights.netRevenue = clamp(toNumber(normalized.formula.profitWeights.netRevenue), 0, 3);
  normalized.formula.profitWeights.directCosts = clamp(toNumber(normalized.formula.profitWeights.directCosts), 0, 3);
  normalized.formula.profitWeights.overheadCost = clamp(toNumber(normalized.formula.profitWeights.overheadCost), 0, 3);
  normalized.formula.profitWeights.depreciationCost = clamp(toNumber(normalized.formula.profitWeights.depreciationCost), 0, 3);
  normalized.formula.profitWeights.otherOperatingCost = clamp(toNumber(normalized.formula.profitWeights.otherOperatingCost), 0, 3);

  normalized.formula.operatingCostWeights.packaging = clamp(toNumber(normalized.formula.operatingCostWeights.packaging), 0, 3);
  normalized.formula.operatingCostWeights.paymentFallback = clamp(toNumber(normalized.formula.operatingCostWeights.paymentFallback), 0, 3);
  normalized.formula.operatingCostWeights.paymentGateway = clamp(toNumber(normalized.formula.operatingCostWeights.paymentGateway), 0, 3);
  normalized.formula.operatingCostWeights.warrantyReserve = clamp(toNumber(normalized.formula.operatingCostWeights.warrantyReserve), 0, 3);
  normalized.formula.operatingCostWeights.orderShipping = clamp(toNumber(normalized.formula.operatingCostWeights.orderShipping), 0, 3);
  normalized.formula.operatingCostWeights.bookingFlatShipping = clamp(toNumber(normalized.formula.operatingCostWeights.bookingFlatShipping), 0, 3);

  return normalized;
}

function customerNameFromBooking(booking) {
  const customer = booking.customerId;
  const guest = booking.guestInfo;

  if (customer && typeof customer === 'object') {
    const fullName = [customer.firstName, customer.lastName].filter(Boolean).join(' ').trim();
    if (fullName) return fullName;
    if (typeof customer.name === 'string' && customer.name.trim()) return customer.name.trim();
    if (typeof customer.email === 'string' && customer.email.trim()) return customer.email.trim();
  }

  if (guest && typeof guest === 'object') {
    const guestName = [guest.firstName, guest.lastName].filter(Boolean).join(' ').trim();
    if (guestName) return guestName;
    if (typeof guest.email === 'string' && guest.email.trim()) return guest.email.trim();
  }

  return 'Unbekannt';
}

function customerGroupFromBooking(booking) {
  if (booking?.guestInfo?.isGuest) return 'Gastkunde';
  return booking?.customerId ? 'Bestandskunde' : 'Nicht zugeordnet';
}

function paymentLabelFromBooking(booking) {
  const billingStatus = String(booking?.billingStatus || 'offen');
  const paymentStatus = String(booking?.paymentStatus || 'pending');
  return `${billingStatus} / ${paymentStatus}`;
}

function parseDueDaysFromTerms(paymentTerms = '') {
  if (!paymentTerms) return null;
  const match = String(paymentTerms).match(/(\d{1,3})/);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

function parseEstimatedMinutes(value) {
  if (typeof value === 'number') return Math.max(0, value);
  if (typeof value === 'string') {
    const match = value.match(/\d+(?:[\.,]\d+)?/);
    if (match) return Math.max(0, Number(match[0].replace(',', '.')) || 0);
  }
  return 0;
}

function describeOrder(order, bookingItem) {
  const serviceNames = safeArray(order?.services).map((service) => service?.serviceId?.name || service?.name).filter(Boolean);
  const addOnNames = safeArray(order?.addOns).map((addOn) => addOn?.name).filter(Boolean);
  const partNames = safeArray(order?.eParts).map((entry) => entry?.partId?.itemName).filter(Boolean);
  const productNames = safeArray(order?.shopProducts).map((entry) => entry?.productId?.name).filter(Boolean);
  const names = [...serviceNames, ...addOnNames, ...partNames, ...productNames];

  if (names.length === 0 && bookingItem) {
    const itemServiceNames = safeArray(bookingItem.services).map((service) => service?.name).filter(Boolean);
    const itemProductNames = safeArray(bookingItem.products).map((product) => product?.name).filter(Boolean);
    names.push(...itemServiceNames, ...itemProductNames);
  }

  if (names.length === 0) {
    const deviceLabel = [order?.deviceBrand, order?.deviceModel].filter(Boolean).join(' ').trim();
    return deviceLabel || 'Auftrag';
  }

  if (names.length <= 2) return names.join(' + ');
  return `${names.slice(0, 2).join(' + ')} +${names.length - 2}`;
}

function determineOrderType(order, bookingItem) {
  const hasRepairSignals = safeArray(order?.services).length > 0 || safeArray(order?.addOns).length > 0 || safeArray(order?.eParts).length > 0 || bookingItem?.type === 'repair';
  const hasProductSignals = safeArray(order?.shopProducts).length > 0 || bookingItem?.type === 'product';

  if (hasRepairSignals && hasProductSignals) return 'Reparatur und Produkt';
  if (hasProductSignals) return 'Produktauftrag';
  return 'Reparaturauftrag';
}

function getPlannedHours(order, settings) {
  const serviceMinutes = safeArray(order?.services).reduce((sum, service) => sum + toNumber(service?.estimatedTime), 0);
  const addOnMinutes = safeArray(order?.addOns).reduce((sum, addOn) => sum + parseEstimatedMinutes(addOn?.estimatedTime), 0);
  const productQuantity = safeArray(order?.shopProducts).reduce((sum, product) => sum + Math.max(1, toNumber(product?.quantity) || 1), 0);
  const productMinutes = productQuantity * toNumber(settings.labor.productHandlingMinutes);
  return roundHours((serviceMinutes + addOnMinutes + productMinutes) / 60);
}

function getTrackedHours(orderId, trackedMinutesByOrderId) {
  return roundHours(toNumber(trackedMinutesByOrderId.get(String(orderId))) / 60);
}

function getFallbackActualHours(order, plannedHours, settings) {
  const normalizedStatus = String(order?.status || 'pending').toLowerCase();
  const progressFactor = clamp(toNumber(order?.progress) / 100, toNumber(settings.labor.minimumProgressFactor), 1.12);

  if (normalizedStatus === 'completed' || normalizedStatus === 'ready-for-pickup') {
    return roundHours(Math.max(plannedHours, plannedHours * 1.04));
  }

  if (normalizedStatus === 'in-progress' || normalizedStatus === 'quality-check' || normalizedStatus === 'diagnostic-assessment') {
    return roundHours(plannedHours * Math.max(progressFactor, toNumber(settings.labor.fallbackProgressWeight)));
  }

  if (normalizedStatus === 'cancelled') {
    return roundHours(plannedHours * 0.2);
  }

  return roundHours(plannedHours * Math.max(progressFactor, 0.38));
}

function buildKeywordMatcher(keywords) {
  return safeArray(keywords)
    .map((keyword) => String(keyword || '').trim())
    .filter(Boolean)
    .map((keyword) => new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
}

function hasMatchingKeyword(texts, regexList) {
  return texts.some((text) => regexList.some((regex) => regex.test(String(text || ''))));
}

function getBookingNetRevenue(booking, vatRate = 0.19) {
  const grossRevenue = toNumber(booking.totalCost);
  const tax = toNumber(booking.tax);
  const subtotal = toNumber(booking.subtotal);
  const discount = toNumber(booking.discount);

  if (subtotal > 0) {
    return roundCurrency(subtotal - discount);
  }

  if (tax > 0 || grossRevenue >= 0) {
    const taxDerivedNet = grossRevenue - tax;
    if (Number.isFinite(taxDerivedNet) && taxDerivedNet !== 0) {
      return roundCurrency(taxDerivedNet);
    }
  }

  return deriveNetFromGross(grossRevenue, vatRate);
}

function getOrderRevenueShare(order, bookingItem, totalOrderGross) {
  const gross = toNumber(order?.totalCost) || toNumber(bookingItem?.cost);
  if (totalOrderGross <= 0) return 0;
  return gross / totalOrderGross;
}

function resolvePartUnitCost(partDocument, versionId) {
  const versions = safeArray(partDocument?.versions);
  const normalizedVersionId = String(versionId || '').trim();

  if (!normalizedVersionId) return 0;

  // Orders usually persist the version subdocument _id; keep versionId matching as a fallback.
  const matchingVersion = versions.find(
    (version) =>
      String(version?._id || '') === normalizedVersionId ||
      String(version?.versionId || '') === normalizedVersionId
  );

  return toNumber(matchingVersion?.unitCost);
}

function getMaterialCost(order, bookingItem, netRevenue, settings) {
  const allPartEntries = safeArray(order?.eParts);
  const usedPartEntries = allPartEntries.filter(
    (entry) => String(entry?.status || '').toLowerCase() === 'used'
  );
  const effectivePartEntries = usedPartEntries.length > 0 ? usedPartEntries : allPartEntries;

  const ePartCost = effectivePartEntries.reduce((sum, entry) => {
    const quantity = Math.max(1, toNumber(entry?.quantity) || 1);
    const unitCost = resolvePartUnitCost(entry?.partId, entry?.versionId);
    return sum + quantity * unitCost;
  }, 0);

  const productCost = safeArray(order?.shopProducts).reduce((sum, entry) => {
    const quantity = Math.max(1, toNumber(entry?.quantity) || 1);
    const priceAtOrder = toNumber(entry?.priceAtOrder);
    return sum + quantity * priceAtOrder * toNumber(settings.materials.fallbackShopProductCostRate);
  }, 0);

  // Materialkosten sollen auf den echten Part-Unit-Costs basieren.
  // Wenn keine Parts vorhanden sind, bleiben nur produktbezogene COGS.
  return roundCurrency(ePartCost + productCost);
}

function getSubcontractCost(order, description, netRevenue, settings, subcontractRegexes) {
  if (!settings.subcontracting.enabled) return 0;

  const texts = [
    description,
    order?.deviceBrand,
    order?.deviceModel,
    order?.errorDescription,
    ...safeArray(order?.services).map((service) => service?.serviceId?.name || service?.name),
    ...safeArray(order?.addOns).map((addOn) => addOn?.name),
  ].filter(Boolean);

  return hasMatchingKeyword(texts, subcontractRegexes)
    ? roundCurrency(netRevenue * toNumber(settings.subcontracting.defaultRate))
    : 0;
}

function getWarrantyState(booking, order, description, settings, warrantyRegexes) {
  const texts = [
    description,
    ...safeArray(booking?.timeline).map((entry) => entry?.description),
    ...safeArray(order?.timeline).map((entry) => entry?.description),
    order?.errorDescription,
  ].filter(Boolean);

  const flagged = hasMatchingKeyword(texts, warrantyRegexes);
  return {
    flagged,
    label: flagged ? settings.warranty.flaggedLabel : settings.warranty.defaultLabel,
  };
}

function buildSettingsMeta(settings) {
  const monthlyOverhead =
    toNumber(settings.overhead.monthlyRent) +
    toNumber(settings.overhead.monthlyUtilities) +
    toNumber(settings.overhead.monthlyAdminPayroll) +
    toNumber(settings.overhead.monthlySoftware) +
    toNumber(settings.overhead.monthlyInsurance) +
    toNumber(settings.overhead.monthlyMarketing) +
    toNumber(settings.overhead.monthlyOtherFixedCosts);
  const monthlyDepreciation = toNumber(settings.depreciation.monthlyEquipmentDepreciation);
  const billableHours = Math.max(1, toNumber(settings.overhead.targetMonthlyBillableHours));

  return {
    monthlyOverhead: roundCurrency(monthlyOverhead),
    monthlyDepreciation: roundCurrency(monthlyDepreciation),
    overheadHourlyRate: roundCurrency(monthlyOverhead / billableHours),
    depreciationHourlyRate: roundCurrency(monthlyDepreciation / billableHours),
  };
}

function summarizeBookings(rows) {
  const totals = rows.reduce(
    (accumulator, row) => ({
      bookings: accumulator.bookings + 1,
      orders: accumulator.orders + toNumber(row.orderCount),
      netRevenue: accumulator.netRevenue + toNumber(row.netRevenue),
      directCosts: accumulator.directCosts + toNumber(row.directCosts),
      materialCost: accumulator.materialCost + toNumber(row.materialCost),
      subcontractCost: accumulator.subcontractCost + toNumber(row.subcontractCost),
      laborCost: accumulator.laborCost + toNumber(row.laborCost),
      overheadCost: accumulator.overheadCost + toNumber(row.overheadCost),
      depreciationCost: accumulator.depreciationCost + toNumber(row.depreciationCost),
      paymentGatewayFees: accumulator.paymentGatewayFees + toNumber(row.paymentGatewayFees),
      shippingFlatCost: accumulator.shippingFlatCost + toNumber(row.shippingFlatCost),
      otherOperatingCost: accumulator.otherOperatingCost + toNumber(row.otherOperatingCost),
      profit: accumulator.profit + toNumber(row.profit),
      plannedHours: accumulator.plannedHours + toNumber(row.plannedHours),
      actualHours: accumulator.actualHours + toNumber(row.actualHours),
    }),
    {
      bookings: 0,
      orders: 0,
      netRevenue: 0,
      directCosts: 0,
      materialCost: 0,
      subcontractCost: 0,
      laborCost: 0,
      overheadCost: 0,
      depreciationCost: 0,
      paymentGatewayFees: 0,
      shippingFlatCost: 0,
      otherOperatingCost: 0,
      profit: 0,
      plannedHours: 0,
      actualHours: 0,
    }
  );

  return {
    ...totals,
    netRevenue: roundCurrency(totals.netRevenue),
    directCosts: roundCurrency(totals.directCosts),
    materialCost: roundCurrency(totals.materialCost),
    subcontractCost: roundCurrency(totals.subcontractCost),
    laborCost: roundCurrency(totals.laborCost),
    overheadCost: roundCurrency(totals.overheadCost),
    depreciationCost: roundCurrency(totals.depreciationCost),
    paymentGatewayFees: roundCurrency(totals.paymentGatewayFees),
    shippingFlatCost: roundCurrency(totals.shippingFlatCost),
    otherOperatingCost: roundCurrency(totals.otherOperatingCost),
    profit: roundCurrency(totals.profit),
    plannedHours: roundHours(totals.plannedHours),
    actualHours: roundHours(totals.actualHours),
    varianceHours: roundHours(totals.actualHours - totals.plannedHours),
    marginPercent: totals.netRevenue > 0 ? roundCurrency((totals.profit / totals.netRevenue) * 100) : 0,
    profitableBookings: rows.filter((row) => toNumber(row.profit) >= 0).length,
  };
}

function resolveGatewayProvider(payment) {
  const metadataProvider = String(payment?.metadata?.gatewayProvider || '').trim().toLowerCase();
  if (metadataProvider) return metadataProvider;

  const paymentMethod = String(payment?.paymentMethod || '').trim().toLowerCase();
  return PAYMENT_METHOD_TO_PROVIDER[paymentMethod] || paymentMethod;
}

function resolveGatewayFeeRate(payment, gatewaysById, gatewaysByProvider, defaultRate) {
  const metadataGatewayId = String(payment?.metadata?.gatewayId || '').trim();
  const provider = resolveGatewayProvider(payment);

  const matchedGateway =
    (metadataGatewayId ? gatewaysById.get(metadataGatewayId) : null) ||
    (provider ? gatewaysByProvider.get(provider) : null);

  const configuredFee = toNumber(matchedGateway?.configuration?.processingFee);
  if (configuredFee > 0) {
    // Most gateway configs store processingFee as percentage points (e.g. 2.9).
    return configuredFee > 1 ? configuredFee / 100 : configuredFee;
  }

  return toNumber(defaultRate);
}

function calculateGatewayFeeAmount(payment, gatewaysById, gatewaysByProvider, fallbackRate, fixedAmount = 0) {
  const amount = Math.max(0, toNumber(payment?.amount));
  if (amount <= 0) return 0;

  const rate = resolveGatewayFeeRate(payment, gatewaysById, gatewaysByProvider, fallbackRate);
  return roundCurrency(amount * Math.max(0, toNumber(rate)) + toNumber(fixedAmount));
}

function describeGatewayFeeUsage({ bookingPayments, bookingPaymentMethod, gatewaysByProvider, fallbackRate }) {
  const payments = safeArray(bookingPayments);
  const fallback = toNumber(fallbackRate);

  if (payments.length > 0) {
    const totalsByProvider = new Map();
    for (const payment of payments) {
      const provider = resolveGatewayProvider(payment) || 'unknown';
      const amount = Math.max(0, toNumber(payment?.amount));
      totalsByProvider.set(provider, toNumber(totalsByProvider.get(provider)) + amount);
    }

    const [primaryProvider] = Array.from(totalsByProvider.entries()).sort((a, b) => b[1] - a[1])[0] || ['unknown'];
    const gateway = gatewaysByProvider.get(primaryProvider) || null;
    const configuredFee = toNumber(gateway?.configuration?.processingFee);
    const rate = configuredFee > 1 ? configuredFee / 100 : configuredFee > 0 ? configuredFee : fallback;

    return {
      gatewayProvider: primaryProvider,
      gatewayFeeRate: roundCurrency(rate * 100) / 100,
      gatewayFeePercentLabel: `${roundCurrency(rate * 100)}%`,
      gatewayFeeSource: gateway ? 'payment-gateway-config' : 'settings-fallback',
    };
  }

  const fallbackProvider = PAYMENT_METHOD_TO_PROVIDER[String(bookingPaymentMethod || '').toLowerCase()] || String(bookingPaymentMethod || '').toLowerCase() || 'fallback';
  const fallbackGateway = gatewaysByProvider.get(fallbackProvider) || null;
  const fallbackConfiguredFee = toNumber(fallbackGateway?.configuration?.processingFee);
  const resolvedFallbackRate = fallbackConfiguredFee > 1 ? fallbackConfiguredFee / 100 : fallbackConfiguredFee > 0 ? fallbackConfiguredFee : fallback;

  return {
    gatewayProvider: fallbackProvider,
    gatewayFeeRate: roundCurrency(resolvedFallbackRate * 100) / 100,
    gatewayFeePercentLabel: `${roundCurrency(resolvedFallbackRate * 100)}%`,
    gatewayFeeSource: fallbackGateway ? 'payment-gateway-config-fallback' : 'settings-fallback',
  };
}

class ProfitabilityService {
  static async getSettings() {
    const config = await SystemConfigService.getSystemConfiguration();
    return sanitizeSettings(config?.profitabilitySettings?.toObject ? config.profitabilitySettings.toObject() : config?.profitabilitySettings);
  }

  static async updateSettings(updates) {
    const currentConfig = await SystemConfigService.getSystemConfiguration();
    const currentSettings = sanitizeSettings(currentConfig?.profitabilitySettings?.toObject ? currentConfig.profitabilitySettings.toObject() : currentConfig?.profitabilitySettings);
    const nextSettings = sanitizeSettings(deepMerge(currentSettings, updates || {}));

    await SystemConfigService.updateSystemConfiguration({ profitabilitySettings: nextSettings });
    return nextSettings;
  }

  static async getProfitabilityReport({ limit = 200, startDate = null, endDate = null, projectedWorkdays = null } = {}) {
    const settings = await this.getSettings();
    const financialSettings = await FinancialService.getFinancialSettings();
    const settingsMeta = buildSettingsMeta(settings);
    const subcontractRegexes = buildKeywordMatcher(settings.subcontracting.keywords);
    const warrantyRegexes = buildKeywordMatcher(settings.warranty.keywords);
    const gateways = await FinancialService.getPaymentGateways();
    const gatewaysById = new Map(gateways.map((gateway) => [String(gateway._id), gateway]));
    const gatewaysByProvider = new Map(
      gateways
        .filter((gateway) => gateway?.provider)
        .map((gateway) => [String(gateway.provider).toLowerCase(), gateway])
    );

    const bookingFilter = {};
    const parsedStartDate = parseDate(startDate);
    const parsedEndDate = parseDate(endDate);

    if (parsedStartDate || parsedEndDate) {
      bookingFilter.createdAt = {};
      if (parsedStartDate) bookingFilter.createdAt.$gte = parsedStartDate;
      if (parsedEndDate) bookingFilter.createdAt.$lte = parsedEndDate;
    }

    const bookings = await Booking.find(bookingFilter)
      .sort({ createdAt: -1 })
      .limit(Math.max(1, Math.min(500, toNumber(limit) || 200)))
      .populate('customerId', 'firstName lastName name email paymentTerms discount paymentMethod primaryCustomerGroupId customerGroup')
      .lean();

    const groupIds = Array.from(
      new Set(
        bookings
          .map((booking) => toObjectIdString(booking?.customerId?.primaryCustomerGroupId))
          .filter(Boolean)
      )
    );

    const customerGroups = groupIds.length > 0
      ? await CustomerGroup.find({ _id: { $in: groupIds } })
          .select('_id name key financeProfile')
          .lean()
      : [];

    const customerGroupById = new Map(customerGroups.map((group) => [String(group._id), group]));

    const allOrderIds = [];
    for (const booking of bookings) {
      for (const orderId of safeArray(booking.orderIds)) {
        const id = toObjectIdString(orderId);
        if (id) allOrderIds.push(id);
      }
      for (const item of safeArray(booking.items)) {
        const id = toObjectIdString(item?.orderId);
        if (id) allOrderIds.push(id);
      }
    }

    const uniqueOrderIds = Array.from(new Set(allOrderIds)).filter(Boolean);

    const orders = uniqueOrderIds.length > 0
      ? await Order.find({ _id: { $in: uniqueOrderIds } })
          .populate('services.serviceId', 'name')
          .populate('eParts.partId', 'itemName versions sku')
          .populate('shopProducts.productId', 'name price originalPrice')
          .lean()
      : [];

    const orderMap = new Map(orders.map((order) => [String(order._id), order]));

    const invoices = uniqueOrderIds.length > 0
      ? await Invoice.find({
          $or: [
            { orderId: { $in: uniqueOrderIds } },
            { repairOrderIds: { $in: uniqueOrderIds } },
            { bookingId: { $in: bookings.map((booking) => booking._id).filter(Boolean) } },
          ],
        })
          .select('_id orderId repairOrderIds bookingId invoiceNumber subtotal tax discount total createdAt updatedAt')
          .lean()
      : [];

    const relatedInvoiceIds = invoices.map((invoice) => String(invoice._id));
    const invoiceToOrderIds = new Map();
    const invoicesByBookingId = new Map();
    const invoicesByOrderId = new Map();
    for (const invoice of invoices) {
      const relatedOrderIds = Array.from(
        new Set(
          [
            toObjectIdString(invoice?.orderId),
            ...safeArray(invoice?.repairOrderIds).map((orderId) => toObjectIdString(orderId)),
          ].filter(Boolean)
        )
      );
      invoiceToOrderIds.set(String(invoice._id), relatedOrderIds);

      const bookingId = toObjectIdString(invoice?.bookingId);
      if (bookingId) {
        if (!invoicesByBookingId.has(bookingId)) {
          invoicesByBookingId.set(bookingId, []);
        }
        invoicesByBookingId.get(bookingId).push(invoice);
      }

      for (const orderId of relatedOrderIds) {
        if (!invoicesByOrderId.has(orderId)) {
          invoicesByOrderId.set(orderId, []);
        }
        invoicesByOrderId.get(orderId).push(invoice);
      }
    }

    const payments = (uniqueOrderIds.length > 0 || relatedInvoiceIds.length > 0)
      ? await Payment.find({
          status: { $in: ['completed', 'processing'] },
          $or: [
            ...(uniqueOrderIds.length > 0 ? [{ orderId: { $in: uniqueOrderIds } }] : []),
            ...(relatedInvoiceIds.length > 0 ? [{ invoiceId: { $in: relatedInvoiceIds } }] : []),
          ],
        })
          .select('orderId invoiceId amount paymentMethod metadata status')
          .lean()
      : [];

    const paymentsByOrderId = new Map();
    const paymentsByInvoiceId = new Map();

    for (const payment of payments) {
      const orderId = toObjectIdString(payment?.orderId);
      if (orderId) {
        if (!paymentsByOrderId.has(orderId)) {
          paymentsByOrderId.set(orderId, []);
        }
        paymentsByOrderId.get(orderId).push(payment);
      }

      const invoiceId = toObjectIdString(payment?.invoiceId);
      if (invoiceId) {
        if (!paymentsByInvoiceId.has(invoiceId)) {
          paymentsByInvoiceId.set(invoiceId, []);
        }
        paymentsByInvoiceId.get(invoiceId).push(payment);
      }
    }

    const workSessions = uniqueOrderIds.length > 0
      ? await WorkSession.find({ 'ordersWorked.orderId': { $in: uniqueOrderIds } }).select('ordersWorked').lean()
      : [];

    const trackedMinutesByOrderId = new Map();
    for (const session of workSessions) {
      for (const workedOrder of safeArray(session.ordersWorked)) {
        const orderId = String(workedOrder?.orderId || '');
        if (!orderId) continue;
        trackedMinutesByOrderId.set(orderId, toNumber(trackedMinutesByOrderId.get(orderId)) + toNumber(workedOrder?.duration));
      }
    }
  const resolvedFinancialProfileByCustomerId = new Map();

  const rows = await Promise.all(bookings.map(async (booking) => {
      const bookingNumber = String(booking.bookingNumber || booking._id || '-');
      const bookingOrderIds = Array.from(
        new Set(
          [
            ...safeArray(booking.orderIds).map((orderId) => toObjectIdString(orderId)).filter(Boolean),
            ...safeArray(booking.items).map((item) => toObjectIdString(item?.orderId)).filter(Boolean),
          ].filter(Boolean)
        )
      );
      const bookingItemsByOrderId = new Map(
        safeArray(booking.items)
          .filter((item) => item?.orderId)
          .map((item) => [String(item.orderId), item])
      );
      const bookingOrders = bookingOrderIds
        .map((orderId) => orderMap.get(orderId))
        .filter(Boolean);

      const totalOrderGross = bookingOrders.reduce((sum, order) => sum + toNumber(order?.totalCost), 0) || safeArray(booking.items).reduce((sum, item) => sum + toNumber(item?.cost), 0);
      const bookingNetRevenue = getBookingNetRevenue(booking);
      const paymentLabel = paymentLabelFromBooking(booking);
      const bookingOrderIdSet = new Set(bookingOrderIds);
      const customer = booking?.customerId || null;
      const primaryGroupId = toObjectIdString(customer?.primaryCustomerGroupId);
      const cacheKey = customer?._id ? String(customer._id) : null;

      let resolvedFinancialProfile = null;
      if (cacheKey && resolvedFinancialProfileByCustomerId.has(cacheKey)) {
        resolvedFinancialProfile = resolvedFinancialProfileByCustomerId.get(cacheKey);
      } else {
        resolvedFinancialProfile = await FinancialService.resolveFinancialProfile({ customer });
        if (cacheKey) {
          resolvedFinancialProfileByCustomerId.set(cacheKey, resolvedFinancialProfile);
        }
      }

      const resolvedGroup = resolvedFinancialProfile?.group || (primaryGroupId ? customerGroupById.get(primaryGroupId) : null);
      const bookingFinancialTaxMode = resolvedFinancialProfile?.taxMode || 'default';
      const bookingFinancialCurrency = resolvedFinancialProfile?.currency || financialSettings.defaults.currency;
      const bookingFinancialInvoicePrefix = resolvedFinancialProfile?.invoicePrefix || financialSettings.defaults.invoicePrefix;
      const bookingFinancialPaymentDueDays = resolvedFinancialProfile?.paymentDueDays ?? financialSettings.defaults.paymentDueDays;
      const bookingFinancialPaymentTerms = resolvedFinancialProfile?.paymentTerms || financialSettings.defaults.paymentTerms;
      const bookingFinancialDiscountPercent = resolvedFinancialProfile?.defaultDiscountPercent ?? financialSettings.defaults.defaultDiscount;
      const bookingFinancialCreditLimit = resolvedFinancialProfile?.creditLimit ?? 0;

      const bookingPayments = [];
      const seenTransactions = new Set();

      for (const orderId of bookingOrderIds) {
        for (const payment of paymentsByOrderId.get(orderId) || []) {
          const transactionKey = String(payment?.transactionId || payment?._id || '');
          if (!transactionKey || seenTransactions.has(transactionKey)) continue;
          seenTransactions.add(transactionKey);
          bookingPayments.push(payment);
        }
      }

      for (const [invoiceId, relatedOrderIds] of invoiceToOrderIds.entries()) {
        if (!relatedOrderIds.some((orderId) => bookingOrderIdSet.has(orderId))) continue;
        for (const payment of paymentsByInvoiceId.get(invoiceId) || []) {
          const transactionKey = String(payment?.transactionId || payment?._id || '');
          if (!transactionKey || seenTransactions.has(transactionKey)) continue;
          seenTransactions.add(transactionKey);
          bookingPayments.push(payment);
        }
      }

      const bookingGatewayFees = roundCurrency(
        bookingPayments.reduce(
          (sum, payment) =>
            sum +
            calculateGatewayFeeAmount(
              payment,
              gatewaysById,
              gatewaysByProvider,
              toNumber(settings.otherCosts.paymentFeeRate),
              toNumber(settings.otherCosts.paymentFeeFixedAmount)
            ),
          0
        )
      );
      const bookingGatewayFallbackRate = resolveGatewayFeeRate(
        { paymentMethod: booking?.paymentMethod },
        gatewaysById,
        gatewaysByProvider,
        toNumber(settings.otherCosts.paymentFeeRate)
      );
      const gatewayFeeUsage = describeGatewayFeeUsage({
        bookingPayments,
        bookingPaymentMethod: booking?.paymentMethod,
        gatewaysByProvider,
        fallbackRate: toNumber(settings.otherCosts.paymentFeeRate),
      });
      const bookingFlatShippingCost = roundCurrency(toNumber(settings.otherCosts.flatShippingCostPerBooking));
      const hasGatewayTransactions = bookingPayments.length > 0;
      const operatingCostWeights = settings.formula?.operatingCostWeights || {};
      const targetGrossMarginRate = toNumber(settings.accounting?.targetGrossMarginRate);
      const vatRate = toNumber(settings.accounting?.vatRate);
      const bookingGrossRevenue = roundCurrency(toNumber(booking.totalCost));

      const bookingId = toObjectIdString(booking?._id);
      const bookingInvoices = bookingId
        ? safeArray(invoicesByBookingId.get(bookingId))
        : bookingOrderIds.flatMap((orderId) => safeArray(invoicesByOrderId.get(orderId)));
      const primaryInvoice = bookingInvoices
        .slice()
        .sort((a, b) => {
          const aTime = parseDate(a?.createdAt || a?.updatedAt)?.getTime() || 0;
          const bTime = parseDate(b?.createdAt || b?.updatedAt)?.getTime() || 0;
          return bTime - aTime;
        })[0] || null;

      const orderRows = bookingOrders.map((order, index) => {
        const bookingItem = bookingItemsByOrderId.get(String(order._id));
        const share = getOrderRevenueShare(order, bookingItem, totalOrderGross) || (bookingOrders.length > 0 ? 1 / bookingOrders.length : 1);
        const grossAmount = roundCurrency(bookingGrossRevenue * share);
        const netAmount = roundCurrency(bookingNetRevenue * share);
        const netRevenue = netAmount;
        const plannedHours = getPlannedHours(order, settings);
        const trackedHours = getTrackedHours(order._id, trackedMinutesByOrderId);
        const fallbackHours = getFallbackActualHours(order, plannedHours, settings);
        const actualHours = roundHours(
          trackedHours > 0
            ? trackedHours
            : settings.labor.includeTrackedTimeOnly
              ? 0
              : fallbackHours
        );
        const allocationHours = actualHours > 0 ? actualHours : settings.labor.includeTrackedTimeOnly ? 0 : plannedHours;
        const description = describeOrder(order, bookingItem);
        const materialCost = getMaterialCost(order, bookingItem, netRevenue, settings);
        const subcontractCost = getSubcontractCost(order, description, netRevenue, settings, subcontractRegexes);
        const laborCost = roundCurrency(actualHours * toNumber(settings.labor.defaultHourlyRate));
        const overheadCost = roundCurrency(allocationHours * settingsMeta.overheadHourlyRate);
        const depreciationCost = roundCurrency(allocationHours * settingsMeta.depreciationHourlyRate);
        const warrantyState = getWarrantyState(booking, order, description, settings, warrantyRegexes);
        const paymentGatewayFees = roundCurrency(bookingGatewayFees * share);
        const shippingFlatCost = roundCurrency(bookingFlatShippingCost * share);
        const packagingCostRaw =
          netAmount *
          toNumber(settings.otherCosts.packagingRate) *
          Math.max(0, toNumber(operatingCostWeights.packaging || 1));
        const fallbackPaymentRateCostRaw = hasGatewayTransactions
          ? 0
          : netAmount *
            toNumber(bookingGatewayFallbackRate) *
            Math.max(0, toNumber(operatingCostWeights.paymentFallback || 1));
        const paymentGatewayFeeCostRaw =
          paymentGatewayFees * Math.max(0, toNumber(operatingCostWeights.paymentGateway || 1));
        const warrantyReserveCostRaw = warrantyState.flagged
          ? netAmount *
            toNumber(settings.otherCosts.warrantyReserveRate) *
            Math.max(0, toNumber(operatingCostWeights.warrantyReserve || 1))
          : 0;
        const orderShippingCostRaw =
          toNumber(order?.shippingCost) * Math.max(0, toNumber(operatingCostWeights.orderShipping || 1));
        const bookingShippingCostRaw =
          shippingFlatCost * Math.max(0, toNumber(operatingCostWeights.bookingFlatShipping || 1));
        const packagingCost = roundCurrency(packagingCostRaw);
        const fallbackPaymentRateCost = roundCurrency(fallbackPaymentRateCostRaw);
        const paymentGatewayFeeCost = roundCurrency(paymentGatewayFeeCostRaw);
        const warrantyReserveCost = roundCurrency(warrantyReserveCostRaw);
        const orderShippingCost = roundCurrency(orderShippingCostRaw);
        const bookingShippingCost = roundCurrency(bookingShippingCostRaw);
        const otherOperatingCost = roundCurrency(
          packagingCost +
            fallbackPaymentRateCost +
            paymentGatewayFeeCost +
            warrantyReserveCost +
            orderShippingCost +
            bookingShippingCost
        );
        const directCosts = roundCurrency(materialCost + subcontractCost + laborCost);

        const technicianCost = laborCost;
        const shippingCost = roundCurrency(orderShippingCost + bookingShippingCost);
        const additionalCost = roundCurrency(materialCost + subcontractCost + overheadCost + depreciationCost + warrantyReserveCost);
        const paymentFee = roundCurrency(fallbackPaymentRateCost + paymentGatewayFeeCost);
        const ppCredit = paymentGatewayFees;
        const contribution = calculateContributionMarginMetrics({
          grossAmount,
          netAmount,
          costs: {
            technicianCost,
            shippingCost,
            additionalCost,
            packagingCost,
            paymentFee,
          },
          targetGrossMarginRate,
          ppCredit,
        });
        const profit = contribution.contributionMargin;
        const marginPercent = contribution.profitability;
        const assignedTechnicians = safeArray(order?.assignedStaff)
          .map((entry) => String(entry?.name || '').trim())
          .filter(Boolean);

        return {
          id: `${bookingNumber}-${String(order._id || index)}`,
          orderId: String(order._id),
          orderNumber: String(order.orderNumber || `${bookingNumber}-${index + 1}`),
          internalOrderNumber: String(order.orderNumber || `${bookingNumber}-${index + 1}`),
          externalOrderNumber: String(primaryInvoice?.invoiceNumber || bookingNumber),
          orderDate: order?.createdAt || booking?.createdAt || booking?.updatedAt,
          invoiceDate: primaryInvoice?.createdAt || booking?.createdAt || booking?.updatedAt,
          invoiceNumber: String(primaryInvoice?.invoiceNumber || '-'),
          serviceType: determineOrderType(order, bookingItem),
          status: String(order.status || booking.status || 'pending'),
          progress: toNumber(order.progress),
          paymentLabel,
          paymentType: String(paymentLabel || booking?.paymentMethod || ''),
          warrantyLabel: warrantyState.label,
          companyName: String(customer?.name || '').trim(),
          contactPerson: customerNameFromBooking(booking),
          customerGroup: resolvedGroup?.name || customer?.customerGroup || customerGroupFromBooking(booking),
          description,
          technician: assignedTechnicians.join(', '),
          grossAmount: contribution.grossAmount,
          netAmount: contribution.netAmount,
          netRevenue,
          directCosts,
          materialCost,
          subcontractCost,
          laborCost,
          overheadCost,
          depreciationCost,
          paymentGatewayFees,
          shippingFlatCost,
          otherOperatingCost,
          profit,
          marginPercent,
          technicianCost: contribution.technicianCost,
          shippingCost: contribution.shippingCost,
          additionalCost: contribution.additionalCost,
          packagingCost: contribution.packagingCost,
          paymentFee: contribution.paymentFee,
          gatewayProvider: gatewayFeeUsage.gatewayProvider,
          gatewayFeeRate: gatewayFeeUsage.gatewayFeeRate,
          gatewayFeePercentLabel: gatewayFeeUsage.gatewayFeePercentLabel,
          gatewayFeeSource: gatewayFeeUsage.gatewayFeeSource,
          totalCosts: contribution.totalCosts,
          contributionMargin: contribution.contributionMargin,
          profitability: contribution.profitability,
          target30Percent: contribution.target30Percent,
          contributionVsTarget: contribution.contributionVsTarget,
          ppCredit: contribution.ppCredit,
          plannedHours,
          actualHours,
          hourlyRate: toNumber(settings.labor.defaultHourlyRate),
          varianceHours: roundHours(actualHours - plannedHours),
          trackedHours,
          device: [order.deviceBrand, order.deviceModel].filter(Boolean).join(' ').trim(),
        };
      });

      const totals = summarizeBookings([
        {
          orderCount: orderRows.length,
          netRevenue: orderRows.reduce((sum, row) => sum + row.netRevenue, 0),
          directCosts: orderRows.reduce((sum, row) => sum + row.directCosts, 0),
          materialCost: orderRows.reduce((sum, row) => sum + row.materialCost, 0),
          subcontractCost: orderRows.reduce((sum, row) => sum + row.subcontractCost, 0),
          laborCost: orderRows.reduce((sum, row) => sum + row.laborCost, 0),
          overheadCost: orderRows.reduce((sum, row) => sum + row.overheadCost, 0),
          depreciationCost: orderRows.reduce((sum, row) => sum + row.depreciationCost, 0),
          paymentGatewayFees: orderRows.reduce((sum, row) => sum + row.paymentGatewayFees, 0),
          shippingFlatCost: orderRows.reduce((sum, row) => sum + row.shippingFlatCost, 0),
          otherOperatingCost: orderRows.reduce((sum, row) => sum + row.otherOperatingCost, 0),
          profit: orderRows.reduce((sum, row) => sum + row.profit, 0),
          plannedHours: orderRows.reduce((sum, row) => sum + row.plannedHours, 0),
          actualHours: orderRows.reduce((sum, row) => sum + row.actualHours, 0),
        },
      ]);

      const bookingWarranty = orderRows.some((order) => order.warrantyLabel === settings.warranty.flaggedLabel);
      const itemSummary = orderRows.length > 0 ? orderRows.map((row) => row.description).join(' | ') : 'Keine Positionen';
      const serviceTypes = Array.from(new Set(orderRows.map((order) => order.serviceType)));
      const serviceType = serviceTypes.length === 0 ? 'Reparaturservice' : serviceTypes.length === 1 ? serviceTypes[0] : 'Reparatur und Produkt';
      const bookingContribution = summarizeDeckungsbeitragRows(orderRows, settings.accounting?.defaultProjectionWorkdays || 22).totals;
      const customerCompanyName = String(customer?.name || '').trim();
      const orderDates = orderRows
        .map((order) => parseDate(order.orderDate))
        .filter(Boolean)
        .sort((a, b) => a.getTime() - b.getTime());
      const primaryOrderDate = orderDates[0] ? orderDates[0].toISOString() : (booking.createdAt || booking.updatedAt);
      const primaryPaymentType = String(booking?.paymentMethod || paymentLabel || '').trim();

      return {
        id: String(booking._id || bookingNumber),
        bookingNumber,
        bookingDate: booking.createdAt || booking.updatedAt,
        invoiceDate: primaryInvoice?.createdAt || booking.createdAt || booking.updatedAt,
        invoiceNumber: String(primaryInvoice?.invoiceNumber || '-'),
        orderDate: primaryOrderDate,
        externalOrderNumber: String(primaryInvoice?.invoiceNumber || bookingNumber),
        internalOrderNumber: bookingNumber,
        customerName: customerNameFromBooking(booking),
        companyName: customerCompanyName,
        contactPerson: customerNameFromBooking(booking),
        customerGroup: resolvedGroup?.name || customer?.customerGroup || customerGroupFromBooking(booking),
        customerGroupName: resolvedGroup?.name || customer?.customerGroup || '-',
        customerGroupKey: resolvedGroup?.key || '-',
        customerGroupFinancialCurrency: bookingFinancialCurrency,
        customerGroupFinancialTaxMode: bookingFinancialTaxMode,
        customerGroupFinancialInvoicePrefix: bookingFinancialInvoicePrefix || '-',
        customerGroupFinancialPaymentTerms: bookingFinancialPaymentTerms,
        customerGroupFinancialPaymentDueDays: toNumber(bookingFinancialPaymentDueDays),
        customerGroupFinancialDiscountPercent: toNumber(bookingFinancialDiscountPercent),
        customerGroupFinancialCreditLimit: toNumber(bookingFinancialCreditLimit),
        serviceType,
        paymentLabel,
        paymentType: primaryPaymentType,
        warrantyLabel: bookingWarranty ? settings.warranty.flaggedLabel : settings.warranty.defaultLabel,
        status: String(booking.status || 'pending'),
        description: itemSummary,
        technician: orderRows.map((order) => order.technician).filter(Boolean).join(', '),
        grossAmount: bookingContribution.grossAmount,
        netAmount: bookingContribution.netAmount || deriveNetFromGross(booking.totalCost, vatRate),
        netRevenue: totals.netRevenue,
        directCosts: totals.directCosts,
        materialCost: totals.materialCost,
        subcontractCost: totals.subcontractCost,
        laborCost: totals.laborCost,
        overheadCost: totals.overheadCost,
        depreciationCost: totals.depreciationCost,
        paymentGatewayFees: totals.paymentGatewayFees,
        shippingFlatCost: totals.shippingFlatCost,
        otherOperatingCost: totals.otherOperatingCost,
        profit: totals.profit,
        marginPercent: totals.marginPercent,
        technicianCost: bookingContribution.technicianCost,
        shippingCost: bookingContribution.shippingCost,
        additionalCost: bookingContribution.additionalCost,
        packagingCost: bookingContribution.packagingCost,
        paymentFee: bookingContribution.paymentFee,
        gatewayProvider: gatewayFeeUsage.gatewayProvider,
        gatewayFeeRate: gatewayFeeUsage.gatewayFeeRate,
        gatewayFeePercentLabel: gatewayFeeUsage.gatewayFeePercentLabel,
        gatewayFeeSource: gatewayFeeUsage.gatewayFeeSource,
        totalCosts: bookingContribution.totalCosts,
        contributionMargin: bookingContribution.contributionMargin,
        profitability: bookingContribution.profitability,
        target30Percent: bookingContribution.target30Percent,
        contributionVsTarget: bookingContribution.contributionVsTarget,
        ppCredit: bookingContribution.ppCredit,
        plannedHours: totals.plannedHours,
        actualHours: totals.actualHours,
        hourlyRate: toNumber(settings.labor.defaultHourlyRate),
        varianceHours: totals.varianceHours,
        orderCount: orderRows.length,
        itemSummary,
        orders: orderRows,
      };
    }));

    const targetProjectionDays = projectedWorkdays
      ? Math.max(1, Math.round(toNumber(projectedWorkdays)))
      : Math.max(1, Math.round(toNumber(settings.accounting?.defaultProjectionWorkdays) || 22));

    return {
      rows,
      summary: summarizeBookings(rows),
      periodSummary: summarizeDeckungsbeitragRows(rows, targetProjectionDays),
      dailySummary: buildGroupedPeriodSummaries(rows, 'day', targetProjectionDays),
      monthlySummary: buildGroupedPeriodSummaries(rows, 'month', targetProjectionDays),
      settings,
      settingsMeta,
      calculationMeta: {
        vatRate: toNumber(settings.accounting?.vatRate),
        targetGrossMarginRate: toNumber(settings.accounting?.targetGrossMarginRate),
        projectionWorkdays: targetProjectionDays,
        configurableFormulas: {
          paymentFeeModel: 'payment_fee = amount * rate + fixedAmount',
          dynamicAdditionalCosts: 'additionalCost can be customized via settings.formula and booking/order type rules',
        },
      },
    };
  }
}

module.exports = ProfitabilityService;
