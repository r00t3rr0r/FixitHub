const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const Booking = require('../models/Booking');
const User = require('../models/User');
const InspectionCommunication = require('../models/InspectionCommunication');
const DHLService = require('../services/dhlService');
const OrderHistory = require('../utils/orderHistory');
const {
  guestAccessLimits, normalizeGuestToken, normalizeGuestEmail, guestEmailMatches,
} = require('./middleware/guestAccess');

// Alle Routen dieses Routers sind Gast-Zugriffe ohne Anmeldung (Token oder Buchungsnummer +
// E-Mail): Fehlversuche, Lese- und Schreibvolumen je Client-IP begrenzt (guestAccess.js).
router.use(...guestAccessLimits);

// Interne Felder, die Gaeste zusaetzlich zu OrderHistory.GUEST_INTERNAL_ORDER_FIELDS nie
// erhalten: Zugangsschluessel (der Gast kennt seinen eigenen; Buchungsnummer + E-Mail soll
// nicht zum Link-Token fuehren), Label-Sperren, Idempotenzschluessel des Checkouts.
const GUEST_HIDDEN_ORDER_FIELDS = {
  guestTrackingToken: undefined,
  shippingLabelCreationStartedAt: undefined,
  returnLabelCreationStartedAt: undefined,
};
const GUEST_HIDDEN_BOOKING_FIELDS = {
  guestTrackingToken: undefined,
  checkoutAttemptId: undefined,
  shippingLabelCreationInProgress: undefined,
  shippingLabelCreationStartedAt: undefined,
  returnLabelCreationStartedAt: undefined,
};

// Gast-Sicht auf Verlauf und Fortschritt (HIST-15/HIST-1): Positivliste statt des kompletten
// internen Verlaufs (Pausengruende, Mitarbeiternamen, DHL-Abgleichtexte), dazu ehrliche
// Meilensteine ohne Namen. workflows/assignedStaff tragen Mitarbeiternamen und interne
// Pausengruende - fuer Gaeste nicht bestimmt.
// Dazu dieselbe Projektion personalbezogener Felder wie fuer eingeloggte Kunden
// (OrderHistory.customerOrderOverrides): kein Mitarbeitername in pickupConfirmation, keine
// addOns[].assignedStaff, keine internen Felder (Bedarfsliste, Konditionen, Bearbeitungsstand).
const guestHistoryFields = (order) => ({
  ...OrderHistory.customerOrderOverrides(order, { guest: true }),
  ...GUEST_HIDDEN_ORDER_FIELDS,
  timeline: OrderHistory.toCustomerView(order?.timeline),
  milestones: OrderHistory.buildMilestones(order || {}, { forCustomer: true }),
});

// Oeffentliche Sicht auf eine Versandrichtung - ohne interne Abgleich-/Download-Details.
const publicShipmentDirection = (view = {}) => ({
  direction: view.direction,
  label: view.label,
  hasLabel: Boolean(view.hasLabel),
  trackingNumber: view.trackingNumber || '',
  status: view.status || '',
  statusDescription: view.statusDescription || '',
  estimatedDelivery: view.estimatedDelivery || null,
  actualDelivery: view.actualDelivery || null,
});

/**
 * Versandfelder eines Auftrags fuer die Gast-Sendungsverfolgung.
 * trackingNumber / shippingStatus / shippingLabelUrl / trackingEvents am Auftrag sind die
 * AUSLIEFERUNG (McRepair -> Kunde). Im Altbestand steht dort mitunter eine KOPIE des
 * Einsendelabels (Kunde -> McRepair); die wuerde sonst als "Versand an Sie" angezeigt. Die
 * Werte kommen deshalb aus DHLService.getOrderShipmentState, Einsendung und Auslieferung
 * getrennt unter `shipments`. Die bisherigen Feldnamen bleiben erhalten.
 */
const withShipmentView = async (order) => {
  if (!order || !order._id) {
    return order;
  }
  try {
    const { shipments } = await DHLService.getOrderShipmentState(order._id);
    const outbound = shipments.outbound;
    const legacyCopy = shipments.legacy?.inboundInOutboundSlot === true;
    // Nur Felder ersetzen, die die Antwort bisher schon trug (die Buchungsansicht laedt die
    // Auftraege mit einer schmalen Projektion) - oder wenn es eine echte Auslieferung gibt.
    const hasOutbound = Boolean(outbound.trackingNumber);
    const shippingFields = {
      trackingNumber: outbound.trackingNumber,
      shippingStatus: outbound.status,
      shippingStatusDescription: outbound.statusDescription,
      estimatedDelivery: outbound.estimatedDelivery,
      actualDelivery: outbound.actualDelivery,
      trackingEvents: legacyCopy ? [] : (order.trackingEvents || []),
      shippingLabelUrl: outbound.hasLabel ? (order.shippingLabelUrl || '') : '',
    };
    const replaced = {};
    Object.keys(shippingFields).forEach((key) => {
      if (hasOutbound || Object.prototype.hasOwnProperty.call(order, key)) {
        replaced[key] = shippingFields[key];
      }
    });
    return {
      ...order,
      ...replaced,
      shipments: {
        outbound: publicShipmentDirection(outbound),
        inbound: publicShipmentDirection(shipments.inbound),
      },
    };
  } catch (error) {
    // Im Zweifel keine Versanddaten zeigen statt womoeglich die falsche Richtung: ALLE Felder
    // der (nicht pruefbaren) Auslieferung werden neutralisiert - auch Status ('delivered' einer
    // Einsende-Kopie) und Zustelldaten, sonst sähe der Gast "zugestellt" samt Datum.
    console.error('OrderTrackingRoutes: Shipment state could not be resolved:', error.message);
    const blanked = { ...order };
    const neutral = {
      trackingNumber: '',
      shippingStatus: 'pending',
      shippingStatusDescription: '',
      shippingLabelUrl: '',
      estimatedDelivery: null,
      actualDelivery: null,
      trackingEvents: [],
    };
    Object.keys(neutral).forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(order, key)) blanked[key] = neutral[key];
    });
    return blanked;
  }
};

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
  const normalizedEmail = normalizeGuestEmail(email);
  if (!normalizedEmail) {
    throw new Error('Email is required');
  }

  let booking = null;
  if (token) {
    // Nur ein gueltig geformter Token: ' ' traf frueher (nach trim) Buchungen OHNE Token
    // (Standardwert ''), ein Objekt/Array waere ein Abfrageoperator gewesen.
    const guestToken = normalizeGuestToken(token);
    booking = guestToken ? await Booking.findOne({ guestTrackingToken: guestToken }).lean() : null;
  } else if (bookingNumber && typeof bookingNumber === 'string') {
    booking = await Booking.findOne({ bookingNumber: bookingNumber.trim() }).lean();
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

  if (!guestEmailMatches(bookingEmail, normalizedEmail)) {
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
    const token = normalizeGuestToken(req.query.token);
    const email = normalizeGuestEmail(req.query.email);

    // Validate parameters
    if (!req.query.token || !email) {
      return res.status(400).json({
        success: false,
        error: 'Tracking token and email are required'
      });
    }

    // Find order by tracking token (ungueltig geformter Token = nicht gefunden)
    const order = token ? await Order.findOne({ guestTrackingToken: token })
      .populate('services.serviceId', 'name description price estimatedTime category')
      .populate('shopProducts.productId', 'name price images category')
      .lean() : null;

    if (!order) {
      console.log('OrderTrackingRoutes: Order not found with tracking token');
      return res.status(404).json({
        success: false,
        error: 'Order not found. Please check your tracking link.'
      });
    }

    // Verify email matches
    if (!guestEmailMatches(order.guestInfo?.email, email)) {
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
      ...(await withShipmentView(order)),
      ...guestHistoryFields(order),
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
      createdAt: ro.createdAt,
      // Gleiche Gast-Projektion wie beim Hauptauftrag ("Details ansehen" zeigt sonst einen
      // leeren Verlauf, obwohl es Eintraege gibt).
      timeline: OrderHistory.toCustomerView(ro.timeline),
      milestones: OrderHistory.buildMilestones(ro, { forCustomer: true }),
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
    const token = normalizeGuestToken(req.query.token);
    const email = normalizeGuestEmail(req.query.email);

    // Validate parameters
    if (!req.query.token || !email) {
      return res.status(400).json({
        success: false,
        error: 'Tracking token and email are required'
      });
    }

    // Find booking by tracking token (ungueltig geformter Token = nicht gefunden)
    const booking = token ? await Booking.findOne({ guestTrackingToken: token })
      .populate({
        path: 'orderIds',
        populate: [
          { path: 'services.serviceId', select: 'name description price estimatedTime category' },
          { path: 'shopProducts.productId', select: 'name price images category' }
        ]
      })
      .lean() : null;

    if (!booking) {
      console.log('OrderTrackingRoutes: Booking not found with tracking token');
      return res.status(404).json({
        success: false,
        error: 'Booking not found. Please check your tracking link.'
      });
    }

    // Verify email matches
    if (!guestEmailMatches(booking.guestInfo?.email, email)) {
      console.log('OrderTrackingRoutes: Email mismatch for booking tracking');
      return res.status(403).json({
        success: false,
        error: 'Email does not match booking records'
      });
    }

    console.log('OrderTrackingRoutes: Booking found:', booking.bookingNumber);

    // Prepare response data - hide sensitive information
    const shipmentViews = await Promise.all((booking.orderIds || []).map((order) => withShipmentView(order)));
    const responseOrders = shipmentViews.map(order => ({
      ...order,
      ...guestHistoryFields(order),
      unlockPattern: undefined,
      unlockCode: undefined,
      unlockConfirmation: undefined,
      staffNotes: undefined,
      eParts: undefined,
    }));

    const responseBooking = {
      ...booking,
      ...GUEST_HIDDEN_BOOKING_FIELDS,
      // DHL REVIEW-7: Richtung des Buchungs-Labelplatzes (aus dem ROHEN Verlauf, vor der
      // Kundenansicht). Die Gastseite zeigt den Platz nur bei 'inbound' als Einsendelabel.
      shippingLabelDirection: DHLService.resolveStoredBookingLabelDirection(booking),
      timeline: OrderHistory.toCustomerView(booking.timeline),
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
    const bookingNumber = typeof req.query.bookingNumber === 'string' ? req.query.bookingNumber : '';
    const email = normalizeGuestEmail(req.query.email);

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
    if (!guestEmailMatches(bookingEmail, email)) {
      return res.status(403).json({
        success: false,
        error: 'Email does not match booking records'
      });
    }

    const shipmentViews = await Promise.all((booking.orderIds || []).map((order) => withShipmentView(order)));
    const responseOrders = shipmentViews.map(order => ({
      ...order,
      ...guestHistoryFields(order),
      unlockPattern: undefined,
      unlockCode: undefined,
      unlockConfirmation: undefined,
      staffNotes: undefined,
      eParts: undefined,
    }));

    res.json({
      success: true,
      booking: {
        ...booking,
        ...GUEST_HIDDEN_BOOKING_FIELDS,
        shippingLabelDirection: DHLService.resolveStoredBookingLabelDirection(booking),
        timeline: OrderHistory.toCustomerView(booking.timeline),
        orderIds: responseOrders,
      },
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

    // Derselbe Thread wie im Service (bei Altdaten-Duplikaten immer das aelteste Dokument).
    const communication = await require('../services/inspectionCommunicationService').findThread(orderId).lean();

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

    const communication = await require('../services/inspectionCommunicationService').findThread(orderId);
    if (!canGuestSendMessage(communication)) {
      return res.status(403).json({
        success: false,
        error: 'Guest messages are enabled after staff contact or when feedback/action is pending',
      });
    }

    // Gleicher Speicherweg wie fuer angemeldete Kunden: atomar, idempotent (clientMessageId)
    // und mit Team-Benachrichtigung (zugewiesene Mitarbeiter, sonst alle aktiven Admins).
    const InspectionCommunicationService = require('../services/inspectionCommunicationService');
    const { created } = await InspectionCommunicationService.sendGuestMessage(orderId, {
      guestName,
      guestEmail,
      content,
      clientMessageId: (req.body || {}).clientMessageId,
    });

    const updatedCommunication = await InspectionCommunicationService.findThread(orderId).lean();

    res.status(created ? 201 : 200).json({
      success: true,
      created,
      communication: normalizeGuestCommunication(updatedCommunication),
    });
  } catch (error) {
    const message = error?.message || 'Failed to send message';
    const statusCode = Number(error?.status) || (/required/i.test(message) ? 400 : /not found|does not belong|does not match/i.test(message) ? 404 : 500);
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

    // Gleicher atomarer Pfad wie fuer angemeldete Kunden: nur offene Rueckfragen, nur angebotene
    // Antworten (400), Doppel-Absendungen -> 409, Team-Benachrichtigung genau einmal.
    const InspectionCommunicationService = require('../services/inspectionCommunicationService');
    await InspectionCommunicationService.respondToFeedback(orderId, messageId, response, null, 'Gastkunde', { guestEmail });

    const updatedCommunication = await InspectionCommunicationService.findThread(orderId).lean();

    res.json({
      success: true,
      communication: normalizeGuestCommunication(updatedCommunication),
    });
  } catch (error) {
    const message = error?.message || 'Failed to respond to feedback';
    const statusCode = Number(error?.status) || (/required/i.test(message) ? 400 : /not found|does not belong|does not match/i.test(message) ? 404 : 500);
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

    const InspectionCommunicationService = require('../services/inspectionCommunicationService');
    const communication = await InspectionCommunicationService.findThread(orderId).lean();
    if (!communication) {
      return res.status(404).json({ success: false, error: 'Communication thread not found' });
    }

    const targetMessage = (communication.messages || []).find((message) => message?._id?.toString() === String(messageId));
    if (!targetMessage || !targetMessage.quickAction) {
      return res.status(404).json({ success: false, error: 'Quick action not found' });
    }

    if (targetMessage.quickAction.status !== 'pending') {
      return res.status(409).json({ success: false, error: 'Quick action already completed' });
    }

    // Gleicher Speicherweg wie fuer angemeldete Kunden (aeltester Thread, Rolle 'guest').
    await InspectionCommunicationService.completeQuickAction(orderId, messageId, { role: 'guest' });

    const updatedCommunication = await InspectionCommunicationService.findThread(orderId).lean();

    res.json({
      success: true,
      communication: normalizeGuestCommunication(updatedCommunication),
    });
  } catch (error) {
    const message = error?.message || 'Failed to complete action';
    const statusCode = Number(error?.status) || (/required/i.test(message) ? 400 : /not found|does not belong|does not match/i.test(message) ? 404 : 500);
    res.status(statusCode).json({ success: false, error: message });
  }
});

module.exports = router;
