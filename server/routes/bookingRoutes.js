const express = require('express');
const router = express.Router();
const { requireUser, requireAdmin } = require('./middleware/auth');
const BookingService = require('../services/bookingService');

// Description: Get all bookings (admin) or bookings for authenticated user (customer)
// Endpoint: GET /api/bookings
// Request: { status?: string, billingStatus?: string, limit?: number, skip?: number }
// Response: { success: boolean, bookings: Booking[], count: number }
router.get('/', requireUser, async (req, res) => {
  try {
    console.log('BookingRoutes: Getting bookings for user:', req.user._id, 'Role:', req.user.role);

    const { status, billingStatus, limit = 50, skip = 0 } = req.query;

    const filters = {};
    if (status) filters.status = status;
    if (billingStatus) filters.billingStatus = billingStatus;
    filters.limit = parseInt(limit);
    filters.skip = parseInt(skip);

    let bookings;

    // If admin, get all bookings; otherwise get only customer's bookings
    if (req.user.role === 'admin' || req.user.role === 'staff') {
      console.log('BookingRoutes: Admin/Staff user requesting all bookings');
      bookings = await BookingService.getAllBookings(filters);
    } else {
      console.log('BookingRoutes: Regular user requesting their own bookings');
      bookings = await BookingService.getByCustomer(req.user._id, filters);
    }

    console.log('BookingRoutes: Retrieved', bookings.length, 'bookings');

    res.json({
      success: true,
      bookings: bookings,
      count: bookings.length,
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

    // Verify ownership
    if (booking.customerId._id.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
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

// Description: Update booking status (admin only)
// Endpoint: PUT /api/bookings/:id/status
// Request: { status: string, description?: string }
// Response: { success: boolean, booking: Booking }
router.put('/:id/status', requireAdmin, async (req, res) => {
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

// Description: Update booking billing status (admin only)
// Endpoint: PUT /api/bookings/:id/billing-status
// Request: { billingStatus: string, paymentStatus?: string }
// Response: { success: boolean, booking: Booking }
router.put('/:id/billing-status', requireAdmin, async (req, res) => {
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

// Description: Cancel a booking (admin only)
// Endpoint: DELETE /api/bookings/:id
// Request: {}
// Response: { success: boolean, booking: Booking }
router.delete('/:id', requireAdmin, async (req, res) => {
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

module.exports = router;
