const express = require('express');
const router = express.Router();
const { requireUser, requireRole } = require('./middleware/auth');
const KanbanService = require('../services/kanbanService');

// Description: Get orders grouped by status for Kanban view
// Endpoint: GET /api/kanban/orders
// Request: { search?: string, priority?: string }
// Response: { columns: { [status]: { label: string, orders: Order[] } } }
router.get('/orders', requireUser, requireRole(['admin', 'staff']), async (req, res) => {
  try {
    console.log('[KanbanRoutes] GET /api/kanban/orders - User:', req.user.email);

    const { search, priority } = req.query;
    const filters = {};

    if (search) filters.search = search;
    if (priority) filters.priority = priority;

    const groupedOrders = await KanbanService.getOrdersKanban(filters);

    res.json({ columns: groupedOrders });
  } catch (error) {
    console.error('[KanbanRoutes] Error fetching orders Kanban:', error);
    res.status(500).json({ error: error.message });
  }
});

// Description: Get bookings grouped by status for Kanban view
// Endpoint: GET /api/kanban/bookings
// Request: { search?: string, billingStatus?: string }
// Response: { columns: { [status]: { label: string, bookings: Booking[] } } }
router.get('/bookings', requireUser, requireRole(['admin', 'staff']), async (req, res) => {
  try {
    console.log('[KanbanRoutes] GET /api/kanban/bookings - User:', req.user.email);

    const { search, billingStatus } = req.query;
    const filters = {};

    if (search) filters.search = search;
    if (billingStatus) filters.billingStatus = billingStatus;

    const groupedBookings = await KanbanService.getBookingsKanban(filters);

    res.json({ columns: groupedBookings });
  } catch (error) {
    console.error('[KanbanRoutes] Error fetching bookings Kanban:', error);
    res.status(500).json({ error: error.message });
  }
});

// Description: Update order status via Kanban drag-and-drop
// Endpoint: PUT /api/kanban/orders/:id/status
// Request: { status: string }
// Response: { order: Order }
router.put('/orders/:id/status', requireUser, requireRole(['admin', 'staff']), async (req, res) => {
  try {
    console.log(`[KanbanRoutes] PUT /api/kanban/orders/${req.params.id}/status - User:`, req.user.email);

    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    const updatedOrder = await KanbanService.updateOrderStatus(id, status);

    res.json({ order: updatedOrder });
  } catch (error) {
    console.error('[KanbanRoutes] Error updating order status:', error);
    res.status(500).json({ error: error.message });
  }
});

// Description: Update booking status via Kanban drag-and-drop
// Endpoint: PUT /api/kanban/bookings/:id/status
// Request: { status: string }
// Response: { booking: Booking }
router.put('/bookings/:id/status', requireUser, requireRole(['admin', 'staff']), async (req, res) => {
  try {
    console.log(`[KanbanRoutes] PUT /api/kanban/bookings/${req.params.id}/status - User:`, req.user.email);

    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    const updatedBooking = await KanbanService.updateBookingStatus(id, status);

    res.json({ booking: updatedBooking });
  } catch (error) {
    console.error('[KanbanRoutes] Error updating booking status:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
