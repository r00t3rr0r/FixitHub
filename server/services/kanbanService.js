const Order = require('../models/Order');
const Booking = require('../models/Booking');

class KanbanService {
  /**
   * Get orders grouped by status for Kanban board
   * @param {Object} filters - Optional filters (search, priority, etc.)
   * @returns {Object} Orders grouped by status
   */
  static async getOrdersKanban(filters = {}) {
    console.log('[KanbanService] Fetching orders for Kanban view with filters:', filters);

    try {
      const query = { isActive: true };

      // Apply search filter
      if (filters.search) {
        query.$or = [
          { orderNumber: { $regex: filters.search, $options: 'i' } },
          { 'customer.firstName': { $regex: filters.search, $options: 'i' } },
          { 'customer.lastName': { $regex: filters.search, $options: 'i' } },
          { 'customer.email': { $regex: filters.search, $options: 'i' } }
        ];
      }

      // Apply priority filter
      if (filters.priority) {
        query.priority = filters.priority;
      }

      // Fetch all orders matching filters
      const orders = await Order.find(query)
        .populate('customer', 'firstName lastName email')
        .populate('assignedTo', 'firstName lastName')
        .sort({ createdAt: -1 })
        .lean();

      console.log(`[KanbanService] Found ${orders.length} orders`);

      // Define status columns
      const statusColumns = [
        { id: 'pending', label: 'Pending', orders: [] },
        { id: 'in_progress', label: 'In Progress', orders: [] },
        { id: 'awaiting_parts', label: 'Awaiting Parts', orders: [] },
        { id: 'ready_for_pickup', label: 'Ready for Pickup', orders: [] },
        { id: 'completed', label: 'Completed', orders: [] }
      ];

      // Group orders by status
      const groupedOrders = statusColumns.reduce((acc, column) => {
        acc[column.id] = {
          label: column.label,
          orders: orders.filter(order => order.status === column.id)
        };
        return acc;
      }, {});

      console.log('[KanbanService] Orders grouped by status:',
        Object.keys(groupedOrders).map(key => `${key}: ${groupedOrders[key].orders.length}`).join(', '));

      return groupedOrders;
    } catch (error) {
      console.error('[KanbanService] Error fetching orders for Kanban:', error);
      throw error;
    }
  }

  /**
   * Get bookings grouped by status for Kanban board
   * @param {Object} filters - Optional filters (search, billingStatus, etc.)
   * @returns {Object} Bookings grouped by status
   */
  static async getBookingsKanban(filters = {}) {
    console.log('[KanbanService] Fetching bookings for Kanban view with filters:', filters);

    try {
      const query = {};

      // Apply search filter
      if (filters.search) {
        query.$or = [
          { bookingNumber: { $regex: filters.search, $options: 'i' } },
          { 'customer.firstName': { $regex: filters.search, $options: 'i' } },
          { 'customer.lastName': { $regex: filters.search, $options: 'i' } },
          { 'customer.email': { $regex: filters.search, $options: 'i' } }
        ];
      }

      // Apply billing status filter
      if (filters.billingStatus) {
        query.billingStatus = filters.billingStatus;
      }

      // Fetch all bookings matching filters
      const bookings = await Booking.find(query)
        .populate('customer', 'firstName lastName email')
        .populate('orders')
        .sort({ createdAt: -1 })
        .lean();

      console.log(`[KanbanService] Found ${bookings.length} bookings`);

      // Define status columns
      const statusColumns = [
        { id: 'pending', label: 'Pending', bookings: [] },
        { id: 'confirmed', label: 'Confirmed', bookings: [] },
        { id: 'in_progress', label: 'In Progress', bookings: [] },
        { id: 'ready', label: 'Ready', bookings: [] },
        { id: 'completed', label: 'Completed', bookings: [] },
        { id: 'cancelled', label: 'Cancelled', bookings: [] }
      ];

      // Group bookings by status
      const groupedBookings = statusColumns.reduce((acc, column) => {
        acc[column.id] = {
          label: column.label,
          bookings: bookings.filter(booking => booking.status === column.id)
        };
        return acc;
      }, {});

      console.log('[KanbanService] Bookings grouped by status:',
        Object.keys(groupedBookings).map(key => `${key}: ${groupedBookings[key].bookings.length}`).join(', '));

      return groupedBookings;
    } catch (error) {
      console.error('[KanbanService] Error fetching bookings for Kanban:', error);
      throw error;
    }
  }

  /**
   * Update order status
   * @param {String} orderId - Order ID
   * @param {String} newStatus - New status
   * @returns {Object} Updated order
   */
  static async updateOrderStatus(orderId, newStatus) {
    console.log(`[KanbanService] Updating order ${orderId} status to ${newStatus}`);

    try {
      const validStatuses = ['pending', 'in_progress', 'awaiting_parts', 'ready_for_pickup', 'completed', 'cancelled'];

      if (!validStatuses.includes(newStatus)) {
        throw new Error(`Invalid status: ${newStatus}`);
      }

      const order = await Order.findById(orderId);

      if (!order) {
        throw new Error('Order not found');
      }

      const oldStatus = order.status;
      order.status = newStatus;

      // Add timeline entry
      order.timeline.push({
        status: newStatus,
        timestamp: new Date(),
        note: `Status changed from ${oldStatus} to ${newStatus} via Kanban board`
      });

      await order.save();

      console.log(`[KanbanService] Order ${orderId} status updated successfully`);

      return order;
    } catch (error) {
      console.error('[KanbanService] Error updating order status:', error);
      throw error;
    }
  }

  /**
   * Update booking status
   * @param {String} bookingId - Booking ID
   * @param {String} newStatus - New status
   * @returns {Object} Updated booking
   */
  static async updateBookingStatus(bookingId, newStatus) {
    console.log(`[KanbanService] Updating booking ${bookingId} status to ${newStatus}`);

    try {
      const validStatuses = ['pending', 'confirmed', 'in_progress', 'ready', 'completed', 'cancelled'];

      if (!validStatuses.includes(newStatus)) {
        throw new Error(`Invalid status: ${newStatus}`);
      }

      const booking = await Booking.findById(bookingId);

      if (!booking) {
        throw new Error('Booking not found');
      }

      const oldStatus = booking.status;
      booking.status = newStatus;

      // Add timeline entry
      booking.timeline.push({
        event: 'status_changed',
        timestamp: new Date(),
        description: `Status changed from ${oldStatus} to ${newStatus} via Kanban board`
      });

      await booking.save();

      console.log(`[KanbanService] Booking ${bookingId} status updated successfully`);

      return booking;
    } catch (error) {
      console.error('[KanbanService] Error updating booking status:', error);
      throw error;
    }
  }
}

module.exports = KanbanService;
