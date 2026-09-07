#!/usr/bin/env node

const assert = require('assert');
const BookingService = require('./server/services/bookingService');

function testKeepsCheckoutGrossTotal() {
  const pricing = BookingService.resolveBookingPricing({
    orderGrossTotal: 119,
    bookingData: {
      checkoutPricing: {
        subtotal: 119,
        totalDiscount: 20,
        tax: 15.81,
        total: 99,
      },
    },
  });

  assert.deepStrictEqual(pricing, {
    subtotal: 119,
    discount: 20,
    tax: 15.81,
    totalCost: 99,
  });
}

function testDoesNotAddTaxToGrossOrderTotal() {
  const pricing = BookingService.resolveBookingPricing({
    orderGrossTotal: 119,
    bookingData: { discount: 20 },
  });

  assert.deepStrictEqual(pricing, {
    subtotal: 119,
    discount: 20,
    tax: 0,
    totalCost: 99,
  });
}

testKeepsCheckoutGrossTotal();
testDoesNotAddTaxToGrossOrderTotal();
console.log('[BOOKING-PRICING] All booking pricing tests passed');