#!/usr/bin/env node

// Regression test for: cart discount not carried over to the order (booking showed
// 42.42 EUR, order showed 49.90 EUR because the discount was never stored on the order).
const assert = require('assert');
const { allocateProportionalAmount } = require('./server/routes/checkoutRoutes');

function testAllocatesDiscountProportionally() {
  // Single order: full discount goes to that order, price matches cart total exactly.
  const shares = allocateProportionalAmount([49.90], 7.48);
  assert.deepStrictEqual(shares, [7.48]);
  assert.strictEqual(Number((49.90 - shares[0]).toFixed(2)), 42.42);
}

function testAllocatesAcrossMultipleOrders() {
  const raw = [30, 70];
  const shares = allocateProportionalAmount(raw, 10);
  // Proportional: 3 and 7
  assert.deepStrictEqual(shares, [3, 7]);
  const totalAllocated = shares.reduce((sum, s) => sum + s, 0);
  assert.strictEqual(Number(totalAllocated.toFixed(2)), 10);
}

function testNoDiscountReturnsZeroShares() {
  const shares = allocateProportionalAmount([10, 20, 30], 0);
  assert.deepStrictEqual(shares, [0, 0, 0]);
}

function testDiscountNeverExceedsRawTotal() {
  const shares = allocateProportionalAmount([10, 10], 1000);
  const totalAllocated = shares.reduce((sum, s) => sum + s, 0);
  assert.strictEqual(totalAllocated, 20);
}

function testRoundingRemainderAssignedConsistently() {
  const raw = [10, 10, 10];
  const shares = allocateProportionalAmount(raw, 10);
  const totalAllocated = Number(shares.reduce((sum, s) => sum + s, 0).toFixed(2));
  assert.strictEqual(totalAllocated, 10);
}

testAllocatesDiscountProportionally();
testAllocatesAcrossMultipleOrders();
testNoDiscountReturnsZeroShares();
testDiscountNeverExceedsRawTotal();
testRoundingRemainderAssignedConsistently();

console.log('[ORDER-DISCOUNT-ALLOCATION] All tests passed');
