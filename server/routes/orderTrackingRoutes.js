const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const Booking = require('../models/Booking');

// Description: Track guest order using tracking token and email
// Endpoint: GET /api/track-order
// Query Params: token (tracking token), email (guest email)
// Response: { success: boolean, order: Order, relatedOrders: Order[], booking: Booking }
router.get('/', async (req, res) => {
  try {
    const { token, email } = req.query;

    console.log('OrderTrackingRoutes: Tracking order with token for email:', email);

    // Validate parameters
    if (!token || !email) {
      return res.status(400).json({
        success: false,
        error: 'Tracking token and email are required'
      });
    }

    // Find order by tracking token
    const order = await Order.findOne({ guestTrackingToken: token })
      .populate('services.serviceId', 'name description price estimatedTime category')
      .populate('shopProducts.productId', 'name price images category')
      .lean();

    if (!order) {
      console.log('OrderTrackingRoutes: Order not found with tracking token');
      return res.status(404).json({
        success: false,
        error: 'Order not found. Please check your tracking link.'
      });
    }

    // Verify email matches
    if (order.guestInfo?.email?.toLowerCase() !== email.toLowerCase()) {
      console.log('OrderTrackingRoutes: Email mismatch for order tracking');
      return res.status(403).json({
        success: false,
        error: 'Email does not match order records'
      });
    }

    console.log('OrderTrackingRoutes: Order found:', order.orderNumber);

    // Find booking and related orders
    let booking = null;
    let relatedOrders = [];

    if (order.bookingId) {
      try {
        booking = await Booking.findById(order.bookingId)
          .populate('orderIds')
          .lean();

        if (booking && booking.orderIds) {
          // Get all orders from this booking
          relatedOrders = booking.orderIds.filter(o => o._id.toString() !== order._id.toString());
        }
      } catch (bookingError) {
        console.error('OrderTrackingRoutes: Error fetching booking:', bookingError);
        // Continue without booking info
      }
    }

    // Prepare response data
    const responseOrder = {
      ...order,
      // Hide sensitive internal information
      unlockPattern: undefined,
      unlockCode: undefined,
      unlockConfirmation: undefined,
      staffNotes: undefined,
      eParts: undefined,
    };

    const responseRelatedOrders = relatedOrders.map(ro => ({
      _id: ro._id,
      orderNumber: ro.orderNumber,
      status: ro.status,
      totalCost: ro.totalCost,
      deviceBrand: ro.deviceBrand,
      deviceModel: ro.deviceModel,
      deviceType: ro.deviceType,
      progress: ro.progress,
      estimatedCompletion: ro.estimatedCompletion,
      createdAt: ro.createdAt
    }));

    res.json({
      success: true,
      order: responseOrder,
      relatedOrders: responseRelatedOrders,
      booking: booking ? {
        _id: booking._id,
        bookingNumber: booking.bookingNumber,
        status: booking.status,
        totalCost: booking.totalCost,
        createdAt: booking.createdAt
      } : null
    });
  } catch (error) {
    console.error('OrderTrackingRoutes: Error tracking order:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Description: Track guest booking using tracking token and email
// Endpoint: GET /api/track-order/booking
// Query Params: token (tracking token), email (guest email)
// Response: { success: boolean, booking: Booking, orders: Order[] }
router.get('/booking', async (req, res) => {
  try {
    const { token, email } = req.query;

    console.log('OrderTrackingRoutes: Tracking booking with token for email:', email);

    // Validate parameters
    if (!token || !email) {
      return res.status(400).json({
        success: false,
        error: 'Tracking token and email are required'
      });
    }

    // Find booking by tracking token
    const booking = await Booking.findOne({ guestTrackingToken: token })
      .populate({
        path: 'orderIds',
        populate: [
          { path: 'services.serviceId', select: 'name description price estimatedTime category' },
          { path: 'shopProducts.productId', select: 'name price images category' }
        ]
      })
      .lean();

    if (!booking) {
      console.log('OrderTrackingRoutes: Booking not found with tracking token');
      return res.status(404).json({
        success: false,
        error: 'Booking not found. Please check your tracking link.'
      });
    }

    // Verify email matches
    if (booking.guestInfo?.email?.toLowerCase() !== email.toLowerCase()) {
      console.log('OrderTrackingRoutes: Email mismatch for booking tracking');
      return res.status(403).json({
        success: false,
        error: 'Email does not match booking records'
      });
    }

    console.log('OrderTrackingRoutes: Booking found:', booking.bookingNumber);

    // Prepare response data - hide sensitive information
    const responseOrders = booking.orderIds.map(order => ({
      ...order,
      unlockPattern: undefined,
      unlockCode: undefined,
      unlockConfirmation: undefined,
      staffNotes: undefined,
      eParts: undefined,
    }));

    const responseBooking = {
      ...booking,
      orderIds: responseOrders
    };

    res.json({
      success: true,
      booking: responseBooking,
      orders: responseOrders
    });
  } catch (error) {
    console.error('OrderTrackingRoutes: Error tracking booking:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Description: Track guest booking using booking number and email
// Endpoint: GET /api/track-order/by-number
// Query Params: bookingNumber (e.g. BKG-2026-0001), email (guest email)
// Response: { success: boolean, booking: Booking, orders: Order[] }
router.get('/by-number', async (req, res) => {
  try {
    const { bookingNumber, email } = req.query;

    if (!bookingNumber || !email) {
      return res.status(400).json({
        success: false,
        error: 'Booking number and email are required'
      });
    }

    const booking = await Booking.findOne({ bookingNumber: bookingNumber.toString().trim() })
      .populate({
        path: 'orderIds',
        populate: [
          { path: 'services.serviceId', select: 'name description price estimatedTime category' },
          { path: 'shopProducts.productId', select: 'name price images category' }
        ]
      })
      .lean();

    if (!booking) {
      return res.status(404).json({
        success: false,
        error: 'Booking not found. Please check your booking number.'
      });
    }

    // Verify email matches (check guestInfo for guests, populate customerId for registered users)
    let bookingEmail = booking.guestInfo?.email;
    if (!bookingEmail && booking.customerId) {
      const User = require('../models/User');
      const user = await User.findById(booking.customerId).select('email').lean();
      bookingEmail = user?.email;
    }
    if (!bookingEmail || bookingEmail.toLowerCase() !== email.toString().trim().toLowerCase()) {
      return res.status(403).json({
        success: false,
        error: 'Email does not match booking records'
      });
    }

    const responseOrders = (booking.orderIds || []).map(order => ({
      ...order,
      unlockPattern: undefined,
      unlockCode: undefined,
      unlockConfirmation: undefined,
      staffNotes: undefined,
      eParts: undefined,
    }));

    res.json({
      success: true,
      booking: { ...booking, orderIds: responseOrders },
      orders: responseOrders
    });
  } catch (error) {
    console.error('OrderTrackingRoutes: Error tracking booking by number:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
