const Booking = require('../models/Booking');
const Order = require('../models/Order');
const Product = require('../models/Product');
const Service = require('../models/Service');
const Invoice = require('../models/Invoice');
const User = require('../models/User');

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

  // Get all orders associated with a booking with their current repair progress status
  static async getBookingOrders(bookingId) {
    console.log('BookingService: Getting all orders for booking:', bookingId);

    try {
      const booking = await Booking.findById(bookingId);
      if (!booking) {
        throw new Error('Booking not found');
      }

      // Fetch all orders with full details
      const orders = await Order.find({ _id: { $in: booking.orderIds } })
        .populate('services.serviceId', 'name')
        .populate('shopProducts.productId', 'name')
        .select('_id orderNumber status progress deviceBrand deviceModel totalCost shopProducts services paymentStatus');

      console.log('BookingService: Retrieved', orders.length, 'orders for booking');

      // Map orders to booking item format with current status
      const ordersData = orders.map((order) => {
        let itemData = {
          orderId: order._id.toString(),
          orderNumber: order.orderNumber || order._id.toString().slice(-8).toUpperCase(),
          type: order.deviceType === 'Shop Products' ? 'product' : 'repair',
          device: order.deviceType === 'Shop Products' ? undefined : `${order.deviceBrand} ${order.deviceModel}`,
          status: order.status, // Repair progress status (pending, in-progress, quality-check, completed, ready-for-pickup, cancelled)
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
          itemData.services = order.services.map(service => ({
            name: service.serviceId?.name || 'Unknown Service',
            price: service.price,
            estimatedTime: service.estimatedTime,
          }));
        }

        return itemData;
      });

      return ordersData;
    } catch (error) {
      console.error('BookingService: Error getting booking orders:', error);
      throw error;
    }
  }

  // Preview invoice for a booking (before creation)
  static async previewInvoice(bookingId) {
    console.log('BookingService: Previewing invoice for booking:', bookingId);

    try {
      const booking = await Booking.findById(bookingId)
        .populate('customerId', 'firstName lastName email phone name')
        .populate('orderIds');

      if (!booking) {
        throw new Error('Booking not found');
      }

      // Build invoice items from booking
      const items = [];

      for (const item of booking.items) {
        if (item.type === 'repair' && item.services) {
          // Add repair services
          for (const service of item.services) {
            items.push({
              description: `${service.name} - ${item.device || 'Device Repair'}`,
              quantity: 1,
              unitPrice: service.price,
              total: service.price,
              type: 'service'
            });
          }
        } else if (item.type === 'product' && item.products) {
          // Add products
          for (const product of item.products) {
            items.push({
              description: product.name,
              quantity: product.quantity,
              unitPrice: product.price,
              total: product.totalPrice,
              type: 'product'
            });
          }
        }
      }

      // Calculate invoice totals
      const subtotal = items.reduce((sum, item) => sum + item.total, 0);
      const tax = booking.tax || (subtotal * 0.08);
      const discount = booking.discount || 0;
      const total = subtotal + tax - discount;

      const customer = booking.customerId;
      const customerName = customer.firstName
        ? `${customer.firstName} ${customer.lastName || ''}`
        : (customer.name || customer.email);

      // Create preview data
      const invoicePreview = {
        bookingId: booking._id,
        bookingNumber: booking.bookingNumber,
        customerId: customer._id,
        customerName: customerName,
        customerEmail: customer.email,
        items: items,
        subtotal: subtotal,
        tax: tax,
        discount: discount,
        total: total,
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        paymentTerms: 'Net 30',
        notes: `Invoice for booking ${booking.bookingNumber || booking._id}`
      };

      console.log('BookingService: Invoice preview created with', items.length, 'items');
      return invoicePreview;
    } catch (error) {
      console.error('BookingService: Error previewing invoice:', error);
      throw error;
    }
  }

  // Create invoice from booking
  static async createInvoice(bookingId, invoiceData = {}) {
    console.log('BookingService: Creating invoice for booking:', bookingId);

    try {
      const booking = await Booking.findById(bookingId)
        .populate('customerId', 'firstName lastName email phone name')
        .populate('orderIds');

      if (!booking) {
        throw new Error('Booking not found');
      }

      // Build invoice items from booking
      const items = [];

      for (const item of booking.items) {
        if (item.type === 'repair' && item.services) {
          // Add repair services
          for (const service of item.services) {
            items.push({
              description: `${service.name} - ${item.device || 'Device Repair'}`,
              quantity: 1,
              unitPrice: service.price,
              total: service.price,
              type: 'service'
            });
          }
        } else if (item.type === 'product' && item.products) {
          // Add products
          for (const product of item.products) {
            items.push({
              description: product.name,
              quantity: product.quantity,
              unitPrice: product.price,
              total: product.totalPrice,
              type: 'product'
            });
          }
        }
      }

      // Calculate invoice totals
      const subtotal = items.reduce((sum, item) => sum + item.total, 0);
      const tax = invoiceData.tax || booking.tax || (subtotal * 0.08);
      const discount = invoiceData.discount || booking.discount || 0;
      const total = subtotal + tax - discount;

      const customer = booking.customerId;
      const customerName = customer.firstName
        ? `${customer.firstName} ${customer.lastName || ''}`
        : (customer.name || customer.email);

      // Create invoice
      const invoice = new Invoice({
        orderId: booking.orderIds && booking.orderIds.length > 0 ? booking.orderIds[0]._id : null,
        customerId: customer._id,
        customerName: customerName,
        customerEmail: customer.email,
        items: items,
        subtotal: subtotal,
        tax: tax,
        discount: discount,
        total: total,
        status: invoiceData.status || 'draft',
        dueDate: invoiceData.dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        paymentTerms: invoiceData.paymentTerms || 'Net 30',
        notes: invoiceData.notes || `Invoice for booking ${booking.bookingNumber || booking._id}`,
        template: invoiceData.template || 'standard'
      });

      const savedInvoice = await invoice.save();
      console.log('BookingService: Invoice created successfully with ID:', savedInvoice._id, 'Number:', savedInvoice.invoiceNumber);

      // Update invoice status to 'sent' if requested
      if (invoiceData.sendImmediately) {
        savedInvoice.status = 'sent';
        savedInvoice.sentAt = new Date();
        await savedInvoice.save();
        console.log('BookingService: Invoice marked as sent');
      }

      return savedInvoice;
    } catch (error) {
      console.error('BookingService: Error creating invoice:', error);
      throw error;
    }
  }

  // Get invoices for a booking
  static async getBookingInvoices(bookingId) {
    console.log('BookingService: Getting invoices for booking:', bookingId);

    try {
      const booking = await Booking.findById(bookingId);
      if (!booking) {
        throw new Error('Booking not found');
      }

      // Find invoices by order IDs associated with the booking
      const invoices = await Invoice.find({
        orderId: { $in: booking.orderIds }
      }).sort({ createdAt: -1 });

      console.log('BookingService: Found', invoices.length, 'invoices for booking');
      return invoices;
    } catch (error) {
      console.error('BookingService: Error getting booking invoices:', error);
      throw error;
    }
  }

  // Description: Calculate and update booking progress and status based on associated orders
  // This method calculates overall progress from all orders and automatically updates booking status
  static async updateBookingProgressAndStatus(bookingId) {
    console.log('BookingService: Updating booking progress and status for:', bookingId);

    try {
      const booking = await Booking.findById(bookingId);
      if (!booking) {
        throw new Error('Booking not found');
      }

      // Get all orders for this booking
      const allOrders = await Order.find({ bookingId: booking._id });
      console.log('BookingService: Found', allOrders.length, 'orders for booking');

      if (allOrders.length === 0) {
        console.log('BookingService: No orders found, keeping booking at 0% progress');
        booking.overallProgress = 0;
        await booking.save();
        return booking;
      }

      // Calculate overall progress from all orders
      let totalProgress = 0;
      let hasInProgressOrders = false;
      let allCompleted = true;

      allOrders.forEach(order => {
        totalProgress += (order.progress || 0);
        if (order.status === 'in-progress' || order.status === 'quality-check') {
          hasInProgressOrders = true;
        }
        if (order.status !== 'completed' && order.status !== 'cancelled') {
          allCompleted = false;
        }
      });

      const averageProgress = Math.round(totalProgress / allOrders.length);
      console.log('BookingService: Calculated average progress:', averageProgress, '%');

      // Update booking status based on order progress
      let newBookingStatus = booking.status;
      let statusChanged = false;

      // If any order is in progress and booking is still pending, change to processing
      if (hasInProgressOrders && booking.status === 'pending') {
        newBookingStatus = 'processing';
        statusChanged = true;
        console.log('BookingService: Changing booking status from pending to processing');
      }

      // If all orders are completed, mark booking as completed
      if (allCompleted && booking.status !== 'completed' && booking.status !== 'cancelled') {
        newBookingStatus = 'completed';
        statusChanged = true;
        console.log('BookingService: All orders completed, changing booking status to completed');
      }

      // Update booking with new status and progress
      if (statusChanged) {
        booking.status = newBookingStatus;
        booking.timeline.push({
          status: `Status Changed to ${newBookingStatus}`,
          description: `Booking status automatically updated based on order progress`,
          completedAt: new Date(),
          staffId: 'system',
          staffName: 'System'
        });
      }

      booking.overallProgress = averageProgress;
      const savedBooking = await booking.save();

      console.log('BookingService: Booking updated - Status:', savedBooking.status, 'Progress:', savedBooking.overallProgress, '%');
      return savedBooking;

    } catch (error) {
      console.error('BookingService: Error updating booking progress and status:', error);
      throw error;
    }
  }
}

module.exports = BookingService;
