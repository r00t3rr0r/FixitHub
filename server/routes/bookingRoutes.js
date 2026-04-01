const express = require('express');
const router = express.Router();
const { requireUser, requireAdmin, requireStaff } = require('./middleware/auth');
const BookingService = require('../services/bookingService');
const DHLReturnsService = require('../services/dhlReturnsService');

// Description: Get all bookings (admin) or bookings for authenticated user (customer) with pagination
// Endpoint: GET /api/bookings
// Request: { status?: string, billingStatus?: string, limit?: number, skip?: number }
// Response: { success: boolean, bookings: Booking[], count: number, total: number }
router.get('/', requireUser, async (req, res) => {
  try {
    console.log('BookingRoutes: Getting bookings for user:', req.user._id, 'Role:', req.user.role);

    const { status, billingStatus, limit = 20, skip = 0 } = req.query;

    const filters = {};
    if (status) filters.status = status;
    if (billingStatus) filters.billingStatus = billingStatus;
    filters.limit = parseInt(limit);
    filters.skip = parseInt(skip);

    let bookings;
    let total;

    // If admin, get all bookings; otherwise get only customer's bookings
    if (req.user.role === 'admin' || req.user.role === 'staff') {
      console.log('BookingRoutes: Admin/Staff user requesting all bookings');
      bookings = await BookingService.getAllBookings(filters);

      // Get total count for pagination
      const countFilters = {};
      if (status) countFilters.status = status;
      if (billingStatus) countFilters.billingStatus = billingStatus;
      total = await BookingService.getBookingsCount(countFilters);
    } else {
      console.log('BookingRoutes: Regular user requesting their own bookings');
      bookings = await BookingService.getByCustomer(req.user._id, filters);

      // Get total count for pagination
      const countFilters = { customerId: req.user._id };
      if (status) countFilters.status = status;
      if (billingStatus) countFilters.billingStatus = billingStatus;
      total = await BookingService.getBookingsCount(countFilters);
    }

    console.log('BookingRoutes: Retrieved', bookings.length, 'bookings on current page. Total:', total);

    res.json({
      success: true,
      bookings: bookings,
      count: bookings.length,
      total: total,
    });
  } catch (error) {
    console.error('BookingRoutes: Error getting bookings:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Description: Get a specific booking by ID
// Endpoint: GET /api/bookings/:id
// Request: {}
// Response: { success: boolean, booking: Booking }
router.get('/:id', requireUser, async (req, res) => {
  try {
    console.log('BookingRoutes: Getting booking:', req.params.id);

    const booking = await BookingService.getById(req.params.id);

    if (!booking) {
      console.log('BookingRoutes: Booking not found');
      return res.status(404).json({
        success: false,
        error: 'Booking not found',
      });
    }

    // Verify ownership for regular users. Admin/staff can always access booking details.
    const isPrivilegedUser = req.user.role === 'admin' || req.user.role === 'staff';
    const bookingCustomerId = booking.customerId?._id?.toString?.() || booking.customerId?.toString?.();

    if (!isPrivilegedUser && bookingCustomerId !== req.user._id.toString()) {
      console.log('BookingRoutes: Unauthorized access to booking');
      return res.status(403).json({
        success: false,
        error: 'You do not have permission to view this booking',
      });
    }

    console.log('BookingRoutes: Booking retrieved successfully');

    res.json({
      success: true,
      booking: booking,
    });
  } catch (error) {
    console.error('BookingRoutes: Error getting booking:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Description: Group existing orders into a booking (admin only)
// Endpoint: POST /api/bookings/group
// Request: { orderIds: string[], customerId: string }
// Response: { success: boolean, booking: Booking, bookingId: string }
router.post('/group', requireAdmin, async (req, res) => {
  try {
    console.log('BookingRoutes: Grouping orders into booking');

    const { orderIds, customerId } = req.body;

    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      console.log('BookingRoutes: Invalid orderIds');
      return res.status(400).json({
        success: false,
        error: 'orderIds must be a non-empty array',
      });
    }

    if (!customerId) {
      console.log('BookingRoutes: Missing customerId');
      return res.status(400).json({
        success: false,
        error: 'customerId is required',
      });
    }

    const booking = await BookingService.groupOrders(orderIds, customerId);

    console.log('BookingRoutes: Orders grouped successfully into booking:', booking._id);

    res.json({
      success: true,
      booking: booking,
      bookingId: booking._id.toString(),
    });
  } catch (error) {
    console.error('BookingRoutes: Error grouping orders:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Description: Update booking status (admin/staff only)
// Endpoint: PUT /api/bookings/:id/status
// Request: { status: string, description?: string }
// Response: { success: boolean, booking: Booking }
router.put('/:id/status', requireStaff, async (req, res) => {
  try {
    console.log('BookingRoutes: Updating booking status:', req.params.id);

    const { status, description } = req.body;

    if (!status) {
      console.log('BookingRoutes: Missing status');
      return res.status(400).json({
        success: false,
        error: 'status is required',
      });
    }

    const validStatuses = ['pending', 'payment-pending', 'processing', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      console.log('BookingRoutes: Invalid status:', status);
      return res.status(400).json({
        success: false,
        error: `status must be one of: ${validStatuses.join(', ')}`,
      });
    }

    const booking = await BookingService.updateStatus(req.params.id, status, description);

    console.log('BookingRoutes: Booking status updated successfully');

    res.json({
      success: true,
      booking: booking,
    });
  } catch (error) {
    console.error('BookingRoutes: Error updating booking status:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Description: Update booking billing status (admin/staff only)
// Endpoint: PUT /api/bookings/:id/billing-status
// Request: { billingStatus: string, paymentStatus?: string }
// Response: { success: boolean, booking: Booking }
router.put('/:id/billing-status', requireStaff, async (req, res) => {
  try {
    console.log('BookingRoutes: Updating billing status:', req.params.id);

    const { billingStatus, paymentStatus } = req.body;

    if (!billingStatus) {
      console.log('BookingRoutes: Missing billingStatus');
      return res.status(400).json({
        success: false,
        error: 'billingStatus is required',
      });
    }

    const validBillingStatuses = ['unpaid', 'partially-paid', 'paid'];
    if (!validBillingStatuses.includes(billingStatus)) {
      console.log('BookingRoutes: Invalid billingStatus:', billingStatus);
      return res.status(400).json({
        success: false,
        error: `billingStatus must be one of: ${validBillingStatuses.join(', ')}`,
      });
    }

    const booking = await BookingService.updateBillingStatus(req.params.id, billingStatus, paymentStatus);

    console.log('BookingRoutes: Billing status updated successfully');

    res.json({
      success: true,
      booking: booking,
    });
  } catch (error) {
    console.error('BookingRoutes: Error updating billing status:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Description: Get booking summary for display purposes
// Endpoint: GET /api/bookings/:id/summary
// Request: {}
// Response: { success: boolean, summary: object }
router.get('/:id/summary', requireUser, async (req, res) => {
  try {
    console.log('BookingRoutes: Getting booking summary:', req.params.id);

    const summary = await BookingService.getSummary(req.params.id);

    if (!summary) {
      console.log('BookingRoutes: Booking not found');
      return res.status(404).json({
        success: false,
        error: 'Booking not found',
      });
    }

    console.log('BookingRoutes: Booking summary retrieved successfully');

    res.json({
      success: true,
      summary: summary,
    });
  } catch (error) {
    console.error('BookingRoutes: Error getting booking summary:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Description: Get all orders associated with a booking with their current repair progress status
// Endpoint: GET /api/bookings/:id/orders
// Request: {}
// Response: { success: boolean, orders: Array<{orderId, orderNumber, type, device, services, products, status, progress, cost}> }
router.get('/:id/orders', requireUser, async (req, res) => {
  try {
    console.log('BookingRoutes: Getting orders for booking:', req.params.id);

    const orders = await BookingService.getBookingOrders(req.params.id);

    if (!orders || orders.length === 0) {
      console.log('BookingRoutes: No orders found for booking');
      return res.status(404).json({
        success: false,
        error: 'No orders found for this booking',
      });
    }

    console.log('BookingRoutes: Retrieved', orders.length, 'orders for booking');

    res.json({
      success: true,
      orders: orders,
      count: orders.length,
    });
  } catch (error) {
    console.error('BookingRoutes: Error getting booking orders:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Description: Cancel a booking (admin only)
// Endpoint: DELETE /api/bookings/:id
// Request: {}
// Response: { success: boolean, booking: Booking }
router.delete('/:id', requireAdmin, async (req, res) => {  // Keep this admin-only for safety
  try {
    console.log('BookingRoutes: Cancelling booking:', req.params.id);

    const booking = await BookingService.cancel(req.params.id);

    if (!booking) {
      console.log('BookingRoutes: Booking not found');
      return res.status(404).json({
        success: false,
        error: 'Booking not found',
      });
    }

    console.log('BookingRoutes: Booking cancelled successfully');

    res.json({
      success: true,
      booking: booking,
    });
  } catch (error) {
    console.error('BookingRoutes: Error cancelling booking:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Description: Preview invoice for a booking before creation
// Endpoint: GET /api/bookings/:id/invoice/preview
// Request: {}
// Response: { success: boolean, invoicePreview: object }
router.get('/:id/invoice/preview', requireUser, async (req, res) => {
  try {
    console.log('BookingRoutes: Previewing invoice for booking:', req.params.id);

    const invoicePreview = await BookingService.previewInvoice(req.params.id);

    if (!invoicePreview) {
      console.log('BookingRoutes: Could not generate invoice preview');
      return res.status(404).json({
        success: false,
        error: 'Could not generate invoice preview',
      });
    }

    console.log('BookingRoutes: Invoice preview generated successfully');

    res.json({
      success: true,
      invoicePreview: invoicePreview,
    });
  } catch (error) {
    console.error('BookingRoutes: Error previewing invoice:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Description: Create invoice from booking (admin/staff only)
// Endpoint: POST /api/bookings/:id/invoice
// Request: { dueDate?: string, notes?: string, sendImmediately?: boolean }
// Response: { success: boolean, invoice: Invoice }
router.post('/:id/invoice', requireStaff, async (req, res) => {
  try {
    console.log('BookingRoutes: Creating invoice for booking:', req.params.id);

    const { dueDate, notes, sendImmediately } = req.body;

    const invoiceData = {};
    if (dueDate) invoiceData.dueDate = new Date(dueDate);
    if (notes) invoiceData.notes = notes;
    if (sendImmediately !== undefined) invoiceData.sendImmediately = sendImmediately;

    const invoice = await BookingService.createInvoice(req.params.id, invoiceData);

    console.log('BookingRoutes: Invoice created successfully:', invoice._id);

    res.status(201).json({
      success: true,
      invoice: invoice,
    });
  } catch (error) {
    console.error('BookingRoutes: Error creating invoice:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Description: Get all invoices for a booking
// Endpoint: GET /api/bookings/:id/invoices
// Request: {}
// Response: { success: boolean, invoices: Invoice[] }
router.get('/:id/invoices', requireUser, async (req, res) => {
  try {
    console.log('BookingRoutes: Getting invoices for booking:', req.params.id);

    const invoices = await BookingService.getBookingInvoices(req.params.id);

    console.log('BookingRoutes: Retrieved', invoices.length, 'invoices');

    res.json({
      success: true,
      invoices: invoices,
    });
  } catch (error) {
    console.error('BookingRoutes: Error getting invoices:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// ============================================
// DHL RETURNS & SHIPPING ROUTES
// ============================================

// Description: Get outbound shipping tracking information for booking
// Endpoint: GET /api/bookings/:id/shipping-tracking
// Request: {}
// Response: { success: boolean, trackingNumber: string, status: string, description: string, estimatedDelivery?: string, events: Array, booking: object }
router.get('/:id/shipping-tracking', requireUser, async (req, res) => {
  try {
    console.log('BookingRoutes: Getting shipping tracking for booking:', req.params.id)

    const booking = await BookingService.getById(req.params.id)

    if (!booking) {
      return res.status(404).json({ success: false, error: 'Booking not found' })
    }

    const isPrivilegedUser = req.user.role === 'admin' || req.user.role === 'staff'
    const bookingCustomerId = booking.customerId?._id?.toString?.() || booking.customerId?.toString?.()

    if (!isPrivilegedUser && bookingCustomerId !== req.user._id.toString()) {
      return res.status(403).json({ success: false, error: 'You do not have permission to view this booking' })
    }

    if (!booking.trackingNumber) {
      return res.status(404).json({ success: false, error: 'No tracking number found for this booking' })
    }

    const trackingInfo = await require('../services/dhlService').getTrackingInfo(booking.trackingNumber)

    res.json({
      ...trackingInfo,
      booking: {
        bookingNumber: booking.bookingNumber,
        shippingStatus: booking.shippingStatus,
        shippingStatusDescription: booking.shippingStatusDescription,
        shippingCreatedAt: booking.shippingCreatedAt,
        actualDelivery: booking.actualDelivery,
      },
    })
  } catch (error) {
    console.error('BookingRoutes: Error getting booking shipping tracking:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// Description: Update outbound shipment status from DHL API for booking
// Endpoint: PUT /api/bookings/:id/shipping-status/update
// Request: {}
// Response: { success: boolean, booking: Booking, trackingInfo: Object }
router.put('/:id/shipping-status/update', requireUser, async (req, res) => {
  try {
    console.log('BookingRoutes: Updating shipping status for booking:', req.params.id)

    const booking = await BookingService.getById(req.params.id)

    if (!booking) {
      return res.status(404).json({ success: false, error: 'Booking not found' })
    }

    const isPrivilegedUser = req.user.role === 'admin' || req.user.role === 'staff'
    const bookingCustomerId = booking.customerId?._id?.toString?.() || booking.customerId?.toString?.()

    if (!isPrivilegedUser && bookingCustomerId !== req.user._id.toString()) {
      return res.status(403).json({ success: false, error: 'You do not have permission to update this booking' })
    }

    const result = await BookingService.updateShippingStatus(req.params.id)
    res.json(result)
  } catch (error) {
    console.error('BookingRoutes: Error updating booking shipping status:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// Description: Create return label for booking (admin/staff only)
// Endpoint: POST /api/bookings/:id/return-label
// Request: { labelType?: 'PDF' | 'QR' | 'BOTH' }
// Response: { success: boolean, returnId: string, returnTrackingNumber: string, labelUrl: string, qrCodeUrl: string, qrLink: string, message: string }
router.post('/:id/return-label', requireStaff, async (req, res) => {
  try {
    console.log('BookingRoutes: Creating return label for booking:', req.params.id);

    const { labelType } = req.body;
    const options = {};
    if (labelType) {
      options.labelType = labelType;
    }

    const result = await DHLReturnsService.createReturnLabel(req.params.id, options);

    console.log('BookingRoutes: Return label created successfully');

    res.status(200).json(result);
  } catch (error) {
    console.error('BookingRoutes: Error creating return label:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Description: Get return tracking information for booking
// Endpoint: GET /api/bookings/:id/return-tracking
// Request: {}
// Response: { success: boolean, trackingNumber: string, status: string, statusDescription: string, estimatedDelivery?: string, events: Array }
router.get('/:id/return-tracking', requireUser, async (req, res) => {
  try {
    console.log('BookingRoutes: Getting return tracking for booking:', req.params.id);

    const booking = await BookingService.getById(req.params.id);

    if (!booking) {
      console.log('BookingRoutes: Booking not found');
      return res.status(404).json({
        success: false,
        error: 'Booking not found',
      });
    }

    // Verify ownership for regular users. Admin/staff can always access booking details.
    const isPrivilegedUser = req.user.role === 'admin' || req.user.role === 'staff';
    const bookingCustomerId = booking.customerId?._id?.toString?.() || booking.customerId?.toString?.();

    if (!isPrivilegedUser && bookingCustomerId !== req.user._id.toString()) {
      console.log('BookingRoutes: Unauthorized access to booking');
      return res.status(403).json({
        success: false,
        error: 'You do not have permission to view this booking',
      });
    }

    if (!booking.returnTrackingNumber) {
      console.log('BookingRoutes: No return tracking number found');
      return res.status(404).json({
        success: false,
        error: 'No return tracking number found for this booking',
      });
    }

    const trackingInfo = await DHLReturnsService.getReturnTracking(booking.returnTrackingNumber);

    console.log('BookingRoutes: Return tracking retrieved successfully');

    res.json({
      ...trackingInfo,
      booking: {
        bookingNumber: booking.bookingNumber,
        returnShipmentStatus: booking.returnShipmentStatus,
        returnCreatedAt: booking.returnCreatedAt,
        returnReceivedAt: booking.returnReceivedAt,
      },
    });
  } catch (error) {
    console.error('BookingRoutes: Error getting return tracking:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Description: Update return shipment status from DHL API for booking
// Endpoint: PUT /api/bookings/:id/return-status/update
// Request: {}
// Response: { success: boolean, booking: Booking, trackingInfo: Object }
router.put('/:id/return-status/update', requireUser, async (req, res) => {
  try {
    console.log('BookingRoutes: Updating return status for booking:', req.params.id);

    const booking = await BookingService.getById(req.params.id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        error: 'Booking not found',
      });
    }

    const isPrivilegedUser = req.user.role === 'admin' || req.user.role === 'staff';
    const bookingCustomerId = booking.customerId?._id?.toString?.() || booking.customerId?.toString?.();

    if (!isPrivilegedUser && bookingCustomerId !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'You do not have permission to update this booking',
      });
    }

    const result = await DHLReturnsService.updateReturnStatus(req.params.id);

    console.log('BookingRoutes: Return status updated successfully');

    res.json(result);
  } catch (error) {
    console.error('BookingRoutes: Error updating return status:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Description: Test DHL Returns API connection (admin only)
// Endpoint: GET /api/bookings/test-dhl-returns
// Request: {}
// Response: { success: boolean, message: string, environment?: string, receiverId?: string, error?: string }
router.get('/test-dhl-returns', requireAdmin, async (req, res) => {
  try {
    console.log('BookingRoutes: Testing DHL Returns API connection');

    const result = await DHLReturnsService.testConnection();

    console.log('BookingRoutes: DHL Returns API connection test completed');

    res.json(result);
  } catch (error) {
    console.error('BookingRoutes: Error testing DHL Returns API connection:', error);
    res.status(500).json({
      success: false,
      message: 'Error testing DHL Returns API connection',
      error: error.message,
    });
  }
});

module.exports = router;
