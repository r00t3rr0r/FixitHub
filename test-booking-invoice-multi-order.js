#!/usr/bin/env node

const assert = require('assert');

const BookingService = require('./server/services/bookingService');
const Booking = require('./server/models/Booking');
const Order = require('./server/models/Order');
const Invoice = require('./server/models/Invoice');
const SystemConfiguration = require('./server/models/SystemConfiguration');

const TEST_PREFIX = '[BOOKING-INVOICE-MULTI-ORDER]';
const BOOKING_ID = '507f1f77bcf86cd799439011';
const CUSTOMER_ID = '507f1f77bcf86cd799439012';
const ORDER_1_ID = '507f1f77bcf86cd799439013';
const ORDER_2_ID = '507f1f77bcf86cd799439014';

function createBookingDocument({ status = 'processing', discount = 0 } = {}) {
  return {
    _id: BOOKING_ID,
    bookingNumber: 'B-1001',
    status,
    discount,
    orderIds: [ORDER_1_ID, ORDER_2_ID],
    items: [
      { orderId: ORDER_1_ID, device: 'Apple iPhone 14' },
      { orderId: ORDER_2_ID, device: 'Apple iPhone 14' },
    ],
    customerId: {
      _id: CUSTOMER_ID,
      firstName: 'Max',
      lastName: 'Mustermann',
      email: 'max@example.com',
      invoiceAddress: {
        street: 'Musterstrasse 1',
        city: 'Berlin',
        zipCode: '10115',
        country: 'DE',
      },
      paymentAddress: {
        sameAsInvoice: true,
      },
    },
    guestInfo: {},
    save: async function saveBooking() {
      this.updatedByTest = true;
      return this;
    },
  };
}

function createOrders() {
  return [
    {
      _id: ORDER_1_ID,
      orderNumber: 'R-1001',
      deviceBrand: 'Apple',
      deviceModel: 'iPhone 14',
      deviceType: 'Smartphone',
      status: 'completed',
      services: [
        {
          serviceId: { name: 'Displaytausch' },
          price: 100,
        },
      ],
      addOns: [],
      totalCost: 100,
      billingAddress: {
        street: 'Musterstrasse 1',
        city: 'Berlin',
        zipCode: '10115',
        country: 'DE',
      },
      shippingAddress: {
        street: 'Musterstrasse 1',
        city: 'Berlin',
        zipCode: '10115',
        country: 'DE',
      },
      guestInfo: {},
    },
    {
      _id: ORDER_2_ID,
      orderNumber: 'R-1002',
      deviceBrand: 'Apple',
      deviceModel: 'iPhone 14',
      deviceType: 'Smartphone',
      status: 'in-progress',
      services: [
        {
          serviceId: { name: 'Akkutausch' },
          price: 400,
        },
      ],
      addOns: [],
      totalCost: 400,
      billingAddress: {
        street: 'Musterstrasse 1',
        city: 'Berlin',
        zipCode: '10115',
        country: 'DE',
      },
      shippingAddress: {
        street: 'Musterstrasse 1',
        city: 'Berlin',
        zipCode: '10115',
        country: 'DE',
      },
      guestInfo: {},
    },
  ];
}

function createPopulateQuery(result) {
  return {
    populate() {
      return this;
    },
    select() {
      return this;
    },
    lean: async () => result,
    then(resolve, reject) {
      return Promise.resolve(result).then(resolve, reject);
    },
  };
}

function installStubs({ booking, orders, existingInvoicesByFindOne = [], invoicesForFind = [] }) {
  const original = {
    bookingFindById: Booking.findById,
    orderFind: Order.find,
    orderFindById: Order.findById,
    invoiceFindOne: Invoice.findOne,
    invoiceFind: Invoice.find,
    invoiceSave: Invoice.prototype.save,
    systemConfigurationFindOne: SystemConfiguration.findOne,
  };

  const savedInvoices = [];
  const findOneQueue = [...existingInvoicesByFindOne];

  Booking.findById = function findById() {
    return {
      populate: async () => booking,
    };
  };

  Order.find = function find() {
    return createPopulateQuery(orders);
  };

  Order.findById = function findById(orderId) {
    const order = orders.find((item) => String(item._id) === String(orderId)) || null;
    return createPopulateQuery(order);
  };

  Invoice.findOne = function findOne() {
    return createPopulateQuery(findOneQueue.shift() || null);
  };

  Invoice.find = function find() {
    return createPopulateQuery(invoicesForFind);
  };

  Invoice.prototype.save = async function saveInvoice() {
    if (!this._id) this._id = `invoice-${savedInvoices.length + 1}`;
    if (!this.invoiceNumber) this.invoiceNumber = `INV-TEST-${String(savedInvoices.length + 1).padStart(4, '0')}`;
    savedInvoices.push(this);
    return this;
  };

  SystemConfiguration.findOne = function findOne() {
    return createPopulateQuery({
      financialSettings: {
        defaults: {
          taxRate: 19,
        },
      },
    });
  };

  return {
    savedInvoices,
    restore() {
      Booking.findById = original.bookingFindById;
      Order.find = original.orderFind;
      Order.findById = original.orderFindById;
      Invoice.findOne = original.invoiceFindOne;
      Invoice.find = original.invoiceFind;
      Invoice.prototype.save = original.invoiceSave;
      SystemConfiguration.findOne = original.systemConfigurationFindOne;
    },
  };
}

async function testBlocksBookingInvoiceUntilAllOrdersCompleted() {
  const booking = createBookingDocument({ status: 'processing', discount: 100 });
  const orders = createOrders();
  const stubs = installStubs({ booking, orders });

  try {
    await assert.rejects(
      () => BookingService.createInvoice(booking._id, { invoiceMode: 'booking', sendImmediately: false }),
      (error) => {
        assert.match(error.message, /all related orders are completed/i);
        assert.strictEqual(error.statusCode, 400);
        return true;
      }
    );
  } finally {
    stubs.restore();
  }
}

async function testAllowsPartialInvoiceForCompletedOrderWithProratedDiscount() {
  const booking = createBookingDocument({ status: 'processing', discount: 100 });
  const orders = createOrders();
  const stubs = installStubs({ booking, orders, invoicesForFind: [] });

  try {
    const invoice = await BookingService.createInvoice(booking._id, {
      invoiceMode: 'order',
      orderId: ORDER_1_ID,
      sendImmediately: false,
    });

    assert.strictEqual(invoice.repairOrderIds.length, 1);
    assert.strictEqual(String(invoice.repairOrderIds[0]), ORDER_1_ID);
    assert.strictEqual(invoice.discount, 20);
    assert.strictEqual(invoice.total, 80);
    assert.strictEqual(invoice.status, 'draft');
  } finally {
    stubs.restore();
  }
}

async function testAppliesRemainingDiscountToLastPartialInvoice() {
  const booking = createBookingDocument({ status: 'processing', discount: 100 });
  const orders = createOrders().map((order) => ({
    ...order,
    status: 'completed',
  }));
  const priorInvoices = [
    {
      _id: 'invoice-existing',
      discount: 20,
      repairOrderIds: [ORDER_1_ID],
    },
  ];
  const stubs = installStubs({ booking, orders, invoicesForFind: priorInvoices });

  try {
    const invoice = await BookingService.createInvoice(booking._id, {
      invoiceMode: 'order',
      orderId: ORDER_2_ID,
      sendImmediately: false,
    });

    assert.strictEqual(invoice.discount, 80);
    assert.strictEqual(invoice.total, 320);
    assert.strictEqual(String(invoice.repairOrderIds[0]), ORDER_2_ID);
  } finally {
    stubs.restore();
  }
}

async function testBlocksDuplicatePartialInvoiceForSameOrder() {
  const booking = createBookingDocument({ status: 'processing', discount: 0 });
  const orders = createOrders();
  const stubs = installStubs({
    booking,
    orders,
    existingInvoicesByFindOne: [
      {
        _id: 'invoice-existing',
        invoiceNumber: 'INV-EXISTING-1',
        repairOrderIds: [ORDER_1_ID],
      },
    ],
  });

  try {
    await assert.rejects(
      () => BookingService.createInvoice(booking._id, {
        invoiceMode: 'order',
        orderId: ORDER_1_ID,
        sendImmediately: false,
      }),
      (error) => {
        assert.match(error.message, /already exists for the selected order/i);
        assert.strictEqual(error.statusCode, 409);
        return true;
      }
    );
  } finally {
    stubs.restore();
  }
}

async function run() {
  console.log(`${TEST_PREFIX} Starting targeted booking invoice tests`);

  await testBlocksBookingInvoiceUntilAllOrdersCompleted();
  console.log(`${TEST_PREFIX} PASS full invoice blocked until all orders completed`);

  await testAllowsPartialInvoiceForCompletedOrderWithProratedDiscount();
  console.log(`${TEST_PREFIX} PASS partial invoice uses prorated discount`);

  await testAppliesRemainingDiscountToLastPartialInvoice();
  console.log(`${TEST_PREFIX} PASS last partial invoice receives remaining discount`);

  await testBlocksDuplicatePartialInvoiceForSameOrder();
  console.log(`${TEST_PREFIX} PASS duplicate partial invoice blocked`);

  console.log(`${TEST_PREFIX} All targeted booking invoice tests passed`);
}

run().catch((error) => {
  console.error(`${TEST_PREFIX} FAIL`, error);
  process.exit(1);
});