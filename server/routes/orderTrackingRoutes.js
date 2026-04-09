const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const Booking = require('../models/Booking');
const User = require('../models/User');
const InspectionCommunication = require('../models/InspectionCommunication');

const normalizeGuestCommunication = (communication) => {
  if (!communication) {
    return null;
  }

  const sortedMessages = [...(communication.messages || [])].sort((a, b) => {
    const dateA = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
    const dateB = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
    return dateA - dateB;
  });

  return {
    _id: communication._id,
    orderId: communication.orderId,
    status: communication.status,
    pendingFeedbackCount: communication.pendingFeedbackCount || 0,
    pendingActionsCount: communication.pendingActionsCount || 0,
    lastMessageAt: communication.lastMessageAt || communication.updatedAt,
    createdAt: communication.createdAt,
    updatedAt: communication.updatedAt,
    messages: sortedMessages,
  };
};

const resolveGuestBookingContext = async ({ token, bookingNumber, email, orderId }) => {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail) {
    throw new Error('Email is required');
  }

  let booking = null;
  if (token) {
    booking = await Booking.findOne({ guestTrackingToken: String(token).trim() }).lean();
  } else if (bookingNumber) {
    booking = await Booking.findOne({ bookingNumber: String(bookingNumber).trim() }).lean();
  } else {
    throw new Error('Tracking token or booking number is required');
  }

  if (!booking) {
    throw new Error('Booking not found');
  }

  let bookingEmail = booking.guestInfo?.email;
  if (!bookingEmail && booking.customerId) {
    const customer = await User.findById(booking.customerId).select('email').lean();
    bookingEmail = customer?.email;
  }

  if (!bookingEmail || bookingEmail.toLowerCase() !== normalizedEmail) {
    throw new Error('Email does not match booking records');
  }

  const order = await Order.findById(orderId)
    .select('_id orderNumber deviceBrand deviceModel guestInfo customerId bookingId')
    .lean();

  if (!order) {
    throw new Error('Order not found');
  }

  const bookingOrderIds = (booking.orderIds || []).map((id) => id.toString());
  const isOrderIdLinked = bookingOrderIds.includes(order._id.toString());
  const isBookingIdLinked = order.bookingId && order.bookingId.toString() === booking._id.toString();

  if (!isOrderIdLinked && !isBookingIdLinked) {
    throw new Error('Order does not belong to booking');
  }

  const guestName = `${order?.guestInfo?.firstName || ''} ${order?.guestInfo?.lastName || ''}`.trim() || 'Guest Customer';

  return {
    booking,
    order,
    guestName,
    guestEmail: normalizedEmail,
  };
};

const canGuestSendMessage = (communication) => {
  if (!communication) {
    return false;
  }

  const hasStaffOrSystemMessage = (communication.messages || []).some(
    (message) => message?.senderType === 'staff' || message?.senderType === 'system'
  );

  return hasStaffOrSystemMessage
    || (communication.pendingFeedbackCount || 0) > 0
    || (communication.pendingActionsCount || 0) > 0;
};

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

// Description: Get booking communication thread for a specific order as guest
// Endpoint: GET /api/track-order/booking/:orderId/communication
// Query Params: email + (token OR bookingNumber)
// Response: { success: boolean, communication: InspectionCommunication | null }
router.get('/booking/:orderId/communication', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { token, bookingNumber, email } = req.query;

    await resolveGuestBookingContext({ token, bookingNumber, email, orderId });

    const communication = await InspectionCommunication.findOne({ orderId }).lean();

    res.json({
      success: true,
      communication: normalizeGuestCommunication(communication),
    });
  } catch (error) {
    const message = error?.message || 'Failed to load communication';
    const statusCode = /required/i.test(message) ? 400 : /not found|does not belong|does not match/i.test(message) ? 404 : 500;
    res.status(statusCode).json({ success: false, error: message });
  }
});

// Description: Send guest message to booking communication thread (only when inbound communication exists)
// Endpoint: POST /api/track-order/booking/:orderId/communication/message
// Body: { email, token?, bookingNumber?, content }
// Response: { success: boolean, communication: InspectionCommunication }
router.post('/booking/:orderId/communication/message', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { token, bookingNumber, email, content } = req.body || {};

    if (!content || !String(content).trim()) {
      return res.status(400).json({ success: false, error: 'Message content is required' });
    }

    const { guestName, guestEmail } = await resolveGuestBookingContext({ token, bookingNumber, email, orderId });

    const communication = await InspectionCommunication.findOne({ orderId });
    if (!canGuestSendMessage(communication)) {
      return res.status(403).json({
        success: false,
        error: 'Guest messages are enabled after staff contact or when feedback/action is pending',
      });
    }

    communication.messages.push({
      senderType: 'customer',
      senderName: guestName,
      senderRole: 'guest',
      messageType: 'text',
      content: String(content).trim(),
      metadata: {
        guestEmail,
      },
      readBy: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    communication.lastMessageAt = new Date();
    await communication.save();

    const updatedCommunication = await InspectionCommunication.findById(communication._id).lean();

    res.status(201).json({
      success: true,
      communication: normalizeGuestCommunication(updatedCommunication),
    });
  } catch (error) {
    const message = error?.message || 'Failed to send message';
    const statusCode = /required/i.test(message) ? 400 : /not found|does not belong|does not match/i.test(message) ? 404 : 500;
    res.status(statusCode).json({ success: false, error: message });
  }
});

// Description: Respond to pending feedback as guest
// Endpoint: POST /api/track-order/booking/:orderId/communication/feedback-response
// Body: { email, token?, bookingNumber?, messageId, response: { label, value } }
// Response: { success: boolean, communication: InspectionCommunication }
router.post('/booking/:orderId/communication/feedback-response', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { token, bookingNumber, email, messageId, response } = req.body || {};

    if (!messageId || !response || !response.value) {
      return res.status(400).json({ success: false, error: 'messageId and response are required' });
    }

    const { guestEmail } = await resolveGuestBookingContext({ token, bookingNumber, email, orderId });

    const communication = await InspectionCommunication.findOne({ orderId });
    if (!communication) {
      return res.status(404).json({ success: false, error: 'Communication thread not found' });
    }

    const targetMessage = communication.messages.find((message) => message?._id?.toString() === String(messageId));
    if (!targetMessage || !targetMessage.feedbackRequest) {
      return res.status(404).json({ success: false, error: 'Feedback request not found' });
    }

    if (targetMessage.feedbackRequest.status !== 'pending') {
      return res.status(409).json({ success: false, error: 'Feedback request already answered' });
    }

    targetMessage.feedbackRequest.response = response;
    targetMessage.feedbackRequest.respondedAt = new Date();
    targetMessage.feedbackRequest.status = 'responded';
    targetMessage.metadata = {
      ...(targetMessage.metadata || {}),
      guestResponderEmail: guestEmail,
    };

    communication.pendingFeedbackCount = Math.max(0, (communication.pendingFeedbackCount || 0) - 1);
    communication.lastMessageAt = new Date();
    await communication.save();

    const updatedCommunication = await InspectionCommunication.findById(communication._id).lean();

    res.json({
      success: true,
      communication: normalizeGuestCommunication(updatedCommunication),
    });
  } catch (error) {
    const message = error?.message || 'Failed to respond to feedback';
    const statusCode = /required/i.test(message) ? 400 : /not found|does not belong|does not match/i.test(message) ? 404 : 500;
    res.status(statusCode).json({ success: false, error: message });
  }
});

// Description: Complete pending quick action as guest
// Endpoint: PUT /api/track-order/booking/:orderId/communication/quick-action/:messageId/complete
// Body: { email, token?, bookingNumber? }
// Response: { success: boolean, communication: InspectionCommunication }
router.put('/booking/:orderId/communication/quick-action/:messageId/complete', async (req, res) => {
  try {
    const { orderId, messageId } = req.params;
    const { token, bookingNumber, email } = req.body || {};

    await resolveGuestBookingContext({ token, bookingNumber, email, orderId });

    const communication = await InspectionCommunication.findOne({ orderId });
    if (!communication) {
      return res.status(404).json({ success: false, error: 'Communication thread not found' });
    }

    const targetMessage = communication.messages.find((message) => message?._id?.toString() === String(messageId));
    if (!targetMessage || !targetMessage.quickAction) {
      return res.status(404).json({ success: false, error: 'Quick action not found' });
    }

    if (targetMessage.quickAction.status !== 'pending') {
      return res.status(409).json({ success: false, error: 'Quick action already completed' });
    }

    targetMessage.quickAction.status = 'completed';
    targetMessage.quickAction.completedAt = new Date();
    communication.pendingActionsCount = Math.max(0, (communication.pendingActionsCount || 0) - 1);
    communication.lastMessageAt = new Date();
    await communication.save();

    const updatedCommunication = await InspectionCommunication.findById(communication._id).lean();

    res.json({
      success: true,
      communication: normalizeGuestCommunication(updatedCommunication),
    });
  } catch (error) {
    const message = error?.message || 'Failed to complete action';
    const statusCode = /required/i.test(message) ? 400 : /not found|does not belong|does not match/i.test(message) ? 404 : 500;
    res.status(statusCode).json({ success: false, error: message });
  }
});

module.exports = router;
