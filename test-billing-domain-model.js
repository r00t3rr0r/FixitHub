const assert = require('assert');
const CalculationHelper = require('./server/services/calculationHelper');
const OrderRevision = require('./server/models/OrderRevision');
const PaymentAllocation = require('./server/models/PaymentAllocation');
const DunningLevel = require('./server/models/DunningLevel');
const Order = require('./server/models/Order');
const Invoice = require('./server/models/Invoice');
const Payment = require('./server/models/Payment');
const DunningRun = require('./server/models/DunningRun');

console.log('--- 1. Testing CalculationHelper Domain Calculations ---');

// Test 1: Standard Endkunde (119 EUR Brutto, 0% Rabatt)
const endkundeCalc = CalculationHelper.calculateOrderValue(119.00, 0, 19);
console.log('Endkunde calculation:', endkundeCalc);
assert.strictEqual(endkundeCalc.currentGrossAmount, 119.00);
assert.strictEqual(endkundeCalc.dealerDiscountAmount, 0.00);
assert.strictEqual(endkundeCalc.netAmount, 100.00);
assert.strictEqual(endkundeCalc.taxAmount, 19.00);
assert.strictEqual(CalculationHelper.round(endkundeCalc.netAmount + endkundeCalc.taxAmount), 119.00);

// Test 2: Händlerauftrag (100 EUR Listenpreis Brutto, 10% Händlerrabatt)
// Rabatt wird vom Bruttobetrag abgezogen: 100 - 10 = 90 EUR Brutto
// Netto = 90 / 1.19 = 75.63 EUR
// MwSt = 90 - 75.63 = 14.37 EUR
const haendlerCalc = CalculationHelper.calculateOrderValue(100.00, 10, 19);
console.log('Händler calculation (10% rabatt):', haendlerCalc);
assert.strictEqual(haendlerCalc.originalGrossAmount, 100.00);
assert.strictEqual(haendlerCalc.dealerDiscountAmount, 10.00);
assert.strictEqual(haendlerCalc.currentGrossAmount, 90.00);
assert.strictEqual(haendlerCalc.netAmount, 75.63);
assert.strictEqual(haendlerCalc.taxAmount, 14.37);
assert.strictEqual(CalculationHelper.round(haendlerCalc.netAmount + haendlerCalc.taxAmount), 90.00);

// Test 3: Rechnungssumme (Items Total 238 EUR Brutto)
// Netto = 238 / 1.19 = 200 EUR
// MwSt = 38 EUR
const invoiceTotals = CalculationHelper.calculateInvoiceTotals([
  { description: 'Display Reparatur', quantity: 1, unitPrice: 150.00, total: 150.00, type: 'service' },
  { description: 'Akku Tausch', quantity: 1, unitPrice: 88.00, total: 88.00, type: 'service' }
]);
console.log('Invoice Totals calculation:', invoiceTotals);
assert.strictEqual(invoiceTotals.invoiceGrossTotal, 238.00);
assert.strictEqual(invoiceTotals.invoiceNetTotal, 200.00);
assert.strictEqual(invoiceTotals.invoiceTaxTotal, 38.00);

// Test 4: Zahlungsabgleich (Balance calculation)
const balanceFull = CalculationHelper.calculateBalance(238.00, 238.00);
assert.strictEqual(balanceFull.openBalance, 0);
assert.strictEqual(balanceFull.isFullyPaid, true);
assert.strictEqual(balanceFull.status, 'paid');

const balancePartial = CalculationHelper.calculateBalance(238.00, 100.00);
assert.strictEqual(balancePartial.openBalance, 138.00);
assert.strictEqual(balancePartial.isFullyPaid, false);
assert.strictEqual(balancePartial.status, 'partially_paid');

console.log('--- 2. Validating Mongoose Schemas & Models ---');
assert.ok(Order.schema.path('originalGrossAmount'), 'Order schema has originalGrossAmount');
assert.ok(Order.schema.path('dealerDiscountPercent'), 'Order schema has dealerDiscountPercent');
assert.ok(Order.schema.path('dealerDiscountAmount'), 'Order schema has dealerDiscountAmount');
assert.ok(Order.schema.path('netAmount'), 'Order schema has netAmount');
assert.ok(Order.schema.path('taxAmount'), 'Order schema has taxAmount');
assert.ok(Order.schema.path('revisionCount'), 'Order schema has revisionCount');

assert.ok(Invoice.schema.path('invoiceGrossTotal'), 'Invoice schema has invoiceGrossTotal');
assert.ok(Invoice.schema.path('invoiceNetTotal'), 'Invoice schema has invoiceNetTotal');
assert.ok(Invoice.schema.path('invoiceTaxTotal'), 'Invoice schema has invoiceTaxTotal');
assert.ok(Invoice.schema.path('correctionType'), 'Invoice schema has correctionType');

assert.ok(Payment.schema.path('paymentDate'), 'Payment schema has paymentDate');
assert.ok(Payment.schema.path('transactionId'), 'Payment schema has transactionId');
assert.ok(Payment.schema.path('paymentReference'), 'Payment schema has paymentReference');
assert.ok(Payment.schema.path('note'), 'Payment schema has note');

assert.ok(OrderRevision.schema.path('orderId'), 'OrderRevision schema has orderId');
assert.ok(OrderRevision.schema.path('revisionNumber'), 'OrderRevision schema has revisionNumber');
assert.ok(OrderRevision.schema.path('deltaGrossAmount'), 'OrderRevision schema has deltaGrossAmount');

assert.ok(PaymentAllocation.schema.path('paymentId'), 'PaymentAllocation schema has paymentId');
assert.ok(PaymentAllocation.schema.path('invoiceId'), 'PaymentAllocation schema has invoiceId');
assert.ok(PaymentAllocation.schema.path('allocatedAmount'), 'PaymentAllocation schema has allocatedAmount');

assert.ok(DunningLevel.schema.path('level'), 'DunningLevel schema has level');
assert.ok(DunningLevel.schema.path('daysPastDue'), 'DunningLevel schema has daysPastDue');

console.log('All calculations, schemas and validations PASSED successfully!');
