const Order = require('../models/Order');
const Service = require('../models/Service');
const { sendNotification } = require('./notificationService');

class OrderServiceManagementService {
  /**
   * Get all services for an order (populated with full details)
   * @param {string} orderId - Order ID
   * @returns {Promise<Array>} Array of services with full details
   */
  static async getOrderServices(orderId) {
    try {
      const order = await Order.findById(orderId).populate({
        path: 'services.serviceId',
        model: Service,
      });

      if (!order) {
        throw new Error('Order not found');
      }

      // Migrate old format (array of strings) to new format (array of objects)
      let services = (order.services || []).filter((s) => {
        // Filter out old string format and keep only new object format
        if (typeof s === 'string') {
          console.log(`[OrderServiceManagement] Migrating old service format (string) to new format`);
          return false;
        }
        return true;
      });

      console.log(`[OrderServiceManagement] Retrieved ${services.length} services for order ${orderId}`);
      return services;
    } catch (error) {
      console.error(`[OrderServiceManagement] Error getting order services: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update an existing service in an order
   * @param {string} orderId - Order ID
   * @param {string} serviceId - Service ID in the order (the _id of the service record in services array)
   * @param {Object} updateData - Service update data (price, estimatedTime, notes)
   * @returns {Promise<Object>} Updated order
   */
  static async updateOrderService(orderId, serviceId, updateData) {
    try {
      const order = await Order.findById(orderId);

      if (!order) {
        throw new Error('Order not found');
      }

      // Find the service index with safe null/undefined checking
      const serviceIndex = order.services.findIndex((s) => {
        if (!s || !s._id) {
          return false;
        }
        return s._id.toString() === serviceId;
      });

      if (serviceIndex === -1) {
        throw new Error('Service not found in order');
      }

      // Update service fields
      if (updateData.price !== undefined && updateData.price >= 0) {
        order.services[serviceIndex].price = updateData.price;
      }

      if (
        updateData.estimatedTime !== undefined &&
        updateData.estimatedTime >= 0
      ) {
        order.services[serviceIndex].estimatedTime = updateData.estimatedTime;
      }

      if (updateData.notes !== undefined) {
        order.services[serviceIndex].notes = updateData.notes;
      }

      // Recalculate totals
      order.totalCost = order.services.reduce(
        (sum, service) => sum + (service.price || 0),
        0
      );

      if (order.addOns) {
        order.totalCost += order.addOns.reduce(
          (sum, addon) => sum + (addon.price || 0),
          0
        );
      }

      await order.save();

      console.log(`[OrderServiceManagement] Service ${serviceId} updated in order ${orderId}. New price: ${updateData.price}`);

      // Send notification to customer
      try {
        await sendNotification(order.customerId, {
          type: 'order_update',
          title: 'Service Updated',
          message: `A repair service has been updated in your repair order #${order.orderNumber}`,
          orderId: orderId,
        });
      } catch (notifError) {
        console.warn(`[OrderServiceManagement] Failed to send notification: ${notifError.message}`);
      }

      return order;
    } catch (error) {
      console.error(`[OrderServiceManagement] Error updating order service: ${error.message}`);
      throw error;
    }
  }

  /**
   * Add a new service to an order
   * @param {string} orderId - Order ID
   * @param {string} serviceId - Service ID to add (from Service model)
   * @param {Object} options - Service options (price, estimatedTime, notes)
   * @returns {Promise<Object>} Updated order
   */
  static async addServiceToOrder(orderId, serviceId, options = {}) {
    try {
      const order = await Order.findById(orderId);

      if (!order) {
        throw new Error('Order not found');
      }

      // Verify service exists
      const service = await Service.findById(serviceId);

      if (!service) {
        throw new Error('Service not found');
      }

      // Ensure services array exists and migrate old format if needed
      if (!order.services) {
        order.services = [];
      } else {
        // Migrate old format (array of strings) to new format (array of objects)
        order.services = order.services.map((s) => {
          // If it's a string (old format), skip it (we'll clear old data)
          if (typeof s === 'string') {
            return null;
          }
          return s;
        }).filter(s => s !== null);
      }

      // Check if service is already in order (safely handle both formats)
      const serviceExists = order.services.some((s) => {
        if (!s || typeof s === 'string') return false;
        if (!s.serviceId) return false;
        const sId = typeof s.serviceId === 'object' ? s.serviceId.toString() : s.serviceId;
        return sId === serviceId;
      });

      if (serviceExists) {
        throw new Error('Service is already added to this order');
      }

      // Ensure price and estimatedTime are numbers
      let price = options.price !== undefined ? options.price : service.price;
      let estimatedTime = options.estimatedTime !== undefined ? options.estimatedTime : service.estimatedTime;

      // Convert to numbers if they're strings
      if (typeof price === 'string') {
        price = parseFloat(price);
      }
      if (typeof estimatedTime === 'string') {
        estimatedTime = parseFloat(estimatedTime);
      }

      // Add service with custom or default values
      const newService = {
        serviceId: serviceId,
        price: price,
        estimatedTime: estimatedTime,
        notes: options.notes || '',
      };

      order.services.push(newService);

      // Recalculate totals
      order.totalCost = order.services.reduce(
        (sum, s) => sum + (s.price || 0),
        0
      );

      if (order.addOns) {
        order.totalCost += order.addOns.reduce(
          (sum, addon) => sum + (addon.price || 0),
          0
        );
      }

      await order.save();

      console.log(
        `[OrderServiceManagement] Service ${serviceId} added to order ${orderId}. Price: ${newService.price}`
      );

      // Send notification to customer
      try {
        await sendNotification(order.customerId, {
          type: 'order_update',
          title: 'Service Added',
          message: `A new repair service has been added to your repair order #${order.orderNumber}`,
          orderId: orderId,
        });
      } catch (notifError) {
        console.warn(`[OrderServiceManagement] Failed to send notification: ${notifError.message}`);
      }

      return order;
    } catch (error) {
      console.error(`[OrderServiceManagement] Error adding service to order: ${error.message}`);
      throw error;
    }
  }

  /**
   * Remove a service from an order
   * @param {string} orderId - Order ID
   * @param {string} serviceId - Service ID in the order (the _id of the service record in services array)
   * @returns {Promise<Object>} Updated order
   */
  static async removeServiceFromOrder(orderId, serviceId) {
    try {
      const order = await Order.findById(orderId);

      if (!order) {
        throw new Error('Order not found');
      }

      // Find service index with safe null/undefined checking
      const serviceIndex = order.services.findIndex((s) => {
        if (!s || !s._id) {
          return false;
        }
        return s._id.toString() === serviceId;
      });

      if (serviceIndex === -1) {
        throw new Error('Service not found in order');
      }

      // Remove service
      const removedService = order.services.splice(serviceIndex, 1);

      // Prevent removing all services
      if (order.services.length === 0) {
        order.services.push(removedService[0]);
        throw new Error('An order must have at least one service');
      }

      // Recalculate totals
      order.totalCost = order.services.reduce(
        (sum, s) => sum + (s.price || 0),
        0
      );

      if (order.addOns) {
        order.totalCost += order.addOns.reduce(
          (sum, addon) => sum + (addon.price || 0),
          0
        );
      }

      await order.save();

      console.log(`[OrderServiceManagement] Service ${serviceId} removed from order ${orderId}`);

      // Send notification to customer
      try {
        await sendNotification(order.customerId, {
          type: 'order_update',
          title: 'Service Removed',
          message: `A repair service has been removed from your repair order #${order.orderNumber}`,
          orderId: orderId,
        });
      } catch (notifError) {
        console.warn(`[OrderServiceManagement] Failed to send notification: ${notifError.message}`);
      }

      return order;
    } catch (error) {
      console.error(`[OrderServiceManagement] Error removing service from order: ${error.message}`);
      throw error;
    }
  }
}

module.exports = OrderServiceManagementService;
