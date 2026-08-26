const assert = require('node:assert/strict');
const checkoutRoutes = require('../routes/checkoutRoutes');

const buildPaypalAmount = checkoutRoutes.buildPaypalAmount;

assert.equal(typeof buildPaypalAmount, 'function', 'buildPaypalAmount should be exported for regression coverage');

const cart = {
  total: 89.9,
  tax: 0,
  discount: 0,
};

const lineItems = [{
  quantity: '1',
  unit_amount: { currency_code: 'EUR', value: '89.90' },
}];

const amount = buildPaypalAmount(cart, lineItems, 'EUR', true, { shippingPreference: 'NO_SHIPPING' });
assert.ok(!Object.prototype.hasOwnProperty.call(amount.breakdown || {}, 'shipping'), 'PayPal NO_SHIPPING payload must not contain shipping breakdown');
assert.equal(amount.value, '89.90');

const staleCart = {
  total: 89.9,
  tax: 0,
  discount: 0,
};
const staleLineItems = [{
  quantity: '2',
  unit_amount: { currency_code: 'EUR', value: '59.95' },
}];
const staleAmount = buildPaypalAmount(staleCart, staleLineItems, 'EUR', true, { shippingPreference: 'NO_SHIPPING' });
assert.equal(staleAmount.value, '119.90', 'PayPal amount must be derived from the actual line-item total instead of stale cart totals');
assert.equal(staleAmount.breakdown.item_total.value, '119.90');

console.log('PayPal NO_SHIPPING order shape is valid');
