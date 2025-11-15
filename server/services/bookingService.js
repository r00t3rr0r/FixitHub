const Booking = require('../models/Booking');
const Order = require('../models/Order');
const Product = require('../models/Product');
const Service = require('../models/Service');

class BookingService {
  // Create a new booking from orders (consolidated from cart checkout)
  static async create(bookingData) {
    console.log('BookingService: Creating new booking with data:', bookingData);

    try {
      // Validate that at least one order exists
      if (!bookingData.orderIds || bookingData.orderIds.length === 0) {
        throw new Error('At least one order is required to create a booking');
      }

      // Calculate totals from orders
      let totalCost = 0;
      let subtotal = 0;
      let tax = 0;
      let discount = bookingData.discount || 0;
      const items = [];
      const repairOrderIds = [];
      let shopProductOrderId = null;

      // Fetch all orders and calculate totals
      for (const orderId of bookingData.orderIds) {
        const order = await Order.findById(orderId);
        if (!order) {
          console.warn('BookingService: Order not found:', orderId);
          continue;
        }

        console.log('BookingService: Processing order:', order._id, 'Type:', order.deviceType);

        // Determine order type and add to appropriate list
        if (order.deviceType === 'Shop Products') {
          shopProductOrderId = order._id;
        } else {
          repairOrderIds.push(order._id);
        }

        // Calculate costs
        totalCost += order.totalCost;
        subtotal += order.totalCost;

        // Build booking item from order
        let itemData = {
          type: order.deviceType === 'Shop Products' ? 'product' : 'repair',
          orderId: order._id,
          orderNumber: order.orderNumber || order._id.toString().slice(-8).toUpperCase(),
          status: order.status || 'pending',
          progress: order.progress || 0,
          cost: order.totalCost,
        };

        if (order.deviceType === 'Shop Products') {
          // Shop product order
          itemData.products = order.shopProducts.map(product => ({
            name: product.productId?.name || 'Unknown Product',
            quantity: product.quantity,
            price: product.priceAtOrder,
            totalPrice: product.priceAtOrder * product.quantity,
          }));
        } else {
          // Repair order
          itemData.device = `${order.deviceBrand} ${order.deviceModel}`;
          itemData.services = order.services.map(service => ({
            name: service.serviceId?.name || 'Unknown Service',
            price: service.price,
            estimatedTime: service.estimatedTime,
          }));
        }

        items.push(itemData);
      }

      // Calculate tax (8% by default)
      tax = subtotal * 0.08;

      // Calculate final total
      const finalTotal = subtotal + tax - discount;

      // Create booking data
      const booking = new Booking({
        customerId: bookingData.customerId,
        orderIds: bookingData.orderIds,
        repairOrderIds: repairOrderIds,
        shopProductOrderId: shopProductOrderId,
        items: items,
        status: bookingData.status || 'pending',
        billingStatus: bookingData.billingStatus || 'unpaid',
        paymentStatus: bookingData.paymentStatus || 'pending',
        subtotal: subtotal,
        tax: tax,
        discount: discount,
        totalCost: finalTotal,
        appliedPromoCode: bookingData.appliedPromoCode || '',
      });

      const savedBooking = await booking.save();
      console.log('BookingService: Booking created successfully with ID:', savedBooking._id, 'Number:', savedBooking.bookingNumber);

      // Link booking to all orders
      console.log('BookingService: Linking booking to orders');
      for (const orderId of bookingData.orderIds) {
        await Order.findByIdAndUpdate(
          orderId,
          { bookingId: savedBooking._id },
          { new: true }
        );
      }

      console.log('BookingService: Booking creation completed. Total orders:', savedBooking.orderIds.length);

      return savedBooking;
    } catch (error) {
      console.error('BookingService: Error creating booking:', error);
      throw error;
    }
  }

  // Get booking by ID
  static async getById(bookingId) {
    console.log('BookingService: Getting booking:', bookingId);

    try {
      const booking = await Booking.findById(bookingId)
        .populate('customerId', 'firstName lastName email phone avatar')
        .populate('orderIds')
        .populate('repairOrderIds')
        .populate('shopProductOrderId');

      if (!booking) {
        console.log('BookingService: Booking not found:', bookingId);
        return null;
      }

      console.log('BookingService: Booking retrieved successfully');
      return booking;
    } catch (error) {
      console.error('BookingService: Error getting booking:', error);
      throw error;
    }
  }

  // Get all bookings (admin view)
  static async getAllBookings(filters = {}) {
    console.log('BookingService: Getting all bookings');

    try {
      const query = {};

      // Apply status filter if provided
      if (filters.status) {
        query.status = filters.status;
      }

      // Apply billing status filter if provided
      if (filters.billingStatus) {
        query.billingStatus = filters.billingStatus;
      }

      const bookings = await Booking.find(query)
        .populate('customerId', 'firstName lastName email phone avatar name')
        .sort({ createdAt: -1 })
        .limit(filters.limit || 50)
        .skip(filters.skip || 0);

      console.log('BookingService: Found', bookings.length, 'total bookings');
      return bookings;
    } catch (error) {
      console.error('BookingService: Error getting all bookings:', error);
      throw error;
    }
  }

  // Get all bookings for a customer
  static async getByCustomer(customerId, filters = {}) {
    console.log('BookingService: Getting bookings for customer:', customerId);

    try {
      const query = { customerId };

      // Apply status filter if provided
      if (filters.status) {
        query.status = filters.status;
      }

      // Apply billing status filter if provided
      if (filters.billingStatus) {
        query.billingStatus = filters.billingStatus;
      }

      const bookings = await Booking.find(query)
        .sort({ createdAt: -1 })
        .limit(filters.limit || 50)
        .skip(filters.skip || 0);

      console.log('BookingService: Found', bookings.length, 'bookings for customer');
      return bookings;
    } catch (error) {
      console.error('BookingService: Error getting bookings:', error);
      throw error;
    }
  }

  // Group existing orders into a new booking
  static async groupOrders(orderIds, customerId) {
    console.log('BookingService: Grouping orders:', orderIds, 'for customer:', customerId);

    try {
      // Validate all orders exist and belong to the customer
      const orders = await Order.find({ _id: { $in: orderIds }, customerId: customerId });

      if (orders.length !== orderIds.length) {
        throw new Error('One or more orders not found or do not belong to this customer');
      }

      // Check if orders are already in a booking
      const bookedOrders = orders.filter(o => o.bookingId);
      if (bookedOrders.length > 0) {
        console.warn('BookingService: Some orders already have bookings');
        // Could optionally remove them from existing bookings first
      }

      // Create booking data
      const bookingData = {
        customerId: customerId,
        orderIds: orderIds,
        discount: 0,
      };

      return await this.create(bookingData);
    } catch (error) {
      console.error('BookingService: Error grouping orders:', error);
      throw error;
    }
  }

  // Update booking status
  static async updateStatus(bookingId, newStatus, description = '') {
    console.log('BookingService: Updating booking status:', bookingId, 'to:', newStatus);

    try {
      const booking = await Booking.findById(bookingId);
      if (!booking) {
        throw new Error('Booking not found');
      }

      booking.status = newStatus;

      // Add timeline entry
      booking.timeline.push({
        status: newStatus,
        description: description || `Status updated to ${newStatus}`,
        completedAt: new Date(),
        staffId: 'system',
        staffName: 'System',
      });

      const savedBooking = await booking.save();
      console.log('BookingService: Booking status updated successfully');

      return savedBooking;
    } catch (error) {
      console.error('BookingService: Error updating booking status:', error);
      throw error;
    }
  }

  // Update billing status
  static async updateBillingStatus(bookingId, billingStatus, paymentStatus = null) {
    console.log('BookingService: Updating billing status:', bookingId, 'to:', billingStatus);

    try {
      const booking = await Booking.findById(bookingId);
      if (!booking) {
        throw new Error('Booking not found');
      }

      booking.billingStatus = billingStatus;
      if (paymentStatus) {
        booking.paymentStatus = paymentStatus;
      }

      const savedBooking = await booking.save();
      console.log('BookingService: Billing status updated successfully');

      return savedBooking;
    } catch (error) {
      console.error('BookingService: Error updating billing status:', error);
      throw error;
    }
  }

  // Get booking summary (for display)
  static async getSummary(bookingId) {
    console.log('BookingService: Getting booking summary:', bookingId);

    try {
      const booking = await this.getById(bookingId);
      if (!booking) {
        return null;
      }

      return {
        bookingNumber: booking.bookingNumber,
        customerId: booking.customerId,
        totalOrders: booking.orderIds.length,
        repairOrderCount: booking.repairOrderIds.length,
        hasShopProducts: booking.shopProductOrderId ? true : false,
        items: booking.items,
        status: booking.status,
        billingStatus: booking.billingStatus,
        totalCost: booking.totalCost,
        subtotal: booking.subtotal,
        tax: booking.tax,
        discount: booking.discount,
        createdAt: booking.createdAt,
      };
    } catch (error) {
      console.error('BookingService: Error getting booking summary:', error);
      throw error;
    }
  }

  // Cancel booking and related orders
  static async cancel(bookingId) {
    console.log('BookingService: Cancelling booking:', bookingId);

    try {
      const booking = await Booking.findById(bookingId);
      if (!booking) {
        throw new Error('Booking not found');
      }

      // Update booking status
      booking.status = 'cancelled';
      booking.timeline.push({
        status: 'Booking Cancelled',
        description: 'Booking and all related orders cancelled',
        completedAt: new Date(),
        staffId: 'system',
        staffName: 'System',
      });

      const savedBooking = await booking.save();

      // Cancel all related orders
      console.log('BookingService: Cancelling related orders');
      for (const orderId of booking.orderIds) {
        await Order.findByIdAndUpdate(
          orderId,
          { status: 'cancelled' },
          { new: true }
        );
      }

      console.log('BookingService: Booking cancelled successfully');
      return savedBooking;
    } catch (error) {
      console.error('BookingService: Error cancelling booking:', error);
      throw error;
    }
  }
}

module.exports = BookingService;
