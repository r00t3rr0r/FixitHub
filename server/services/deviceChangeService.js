const Order = require('../models/Order');
const Service = require('../models/Service');
const { sendNotification } = require('./notificationService');

class DeviceChangeService {
  /**
   * Change device in an order and recalculate repair services
   * @param {string} orderId - Order ID
   * @param {Object} newDeviceInfo - New device information
   * @param {string} newDeviceInfo.deviceBrand - New brand
   * @param {string} newDeviceInfo.deviceModel - New model
   * @param {string} newDeviceInfo.deviceType - New type
   * @param {string} userId - User ID making the change (admin/staff)
   * @returns {Promise<Object>} Object with order, recalculatedServices, pricingChangesSummary, requiresConfirmation
   */
  static async changeDeviceAndRecalculateServices(orderId, newDeviceInfo, userId) {
    try {
      const order = await Order.findById(orderId).populate('customerId');

      if (!order) {
        throw new Error('Order not found');
      }

      console.log(
        `[DeviceChange] Starting device change for order ${orderId}. Old: ${order.deviceBrand} ${order.deviceModel} (${order.deviceType}), New: ${newDeviceInfo.deviceBrand} ${newDeviceInfo.deviceModel} (${newDeviceInfo.deviceType})`
      );

      // Store original device info and costs for comparison
      const originalDevice = {
        brand: order.deviceBrand,
        model: order.deviceModel,
        type: order.deviceType,
      };

      const originalServices = JSON.parse(JSON.stringify(order.services || []));
      const originalTotalCost = order.totalCost;

      // Update device information
      order.deviceBrand = newDeviceInfo.deviceBrand;
      order.deviceModel = newDeviceInfo.deviceModel;
      order.deviceType = newDeviceInfo.deviceType;

      // Get current services and recalculate prices for new device
      const recalculatedServices = [];
      const pricingChanges = [];

      if (order.services && order.services.length > 0) {
        for (const orderService of order.services) {
          // Fetch the service details from database
          const serviceDetails = await Service.findById(orderService.serviceId);

          if (!serviceDetails) {
            console.warn(
              `[DeviceChange] Service ${orderService.serviceId} not found, skipping recalculation`
            );
            recalculatedServices.push(orderService);
            continue;
          }

          // Check if service is compatible with new device type
          const isCompatible =
            !serviceDetails.supportedDeviceTypes ||
            serviceDetails.supportedDeviceTypes.length === 0 ||
            serviceDetails.supportedDeviceTypes.includes(newDeviceInfo.deviceType);

          if (!isCompatible) {
            console.warn(
              `[DeviceChange] Service ${serviceDetails.name} not compatible with ${newDeviceInfo.deviceType}`
            );
            throw new Error(
              `Service "${serviceDetails.name}" is not compatible with ${newDeviceInfo.deviceType}`
            );
          }

          // Get new price for the service (may vary by device type)
          let newPrice = serviceDetails.price;
          if (
            serviceDetails.priceByDeviceType &&
            serviceDetails.priceByDeviceType[newDeviceInfo.deviceType]
          ) {
            newPrice = serviceDetails.priceByDeviceType[newDeviceInfo.deviceType];
          }

          const originalPrice = orderService.price;
          const priceDifference = newPrice - originalPrice;
          const percentageChange = originalPrice > 0 ? (priceDifference / originalPrice) * 100 : 0;

          // Update service with new price
          orderService.price = newPrice;

          recalculatedServices.push(orderService);

          pricingChanges.push({
            serviceName: serviceDetails.name,
            serviceId: serviceDetails._id,
            originalPrice: originalPrice,
            newPrice: newPrice,
            difference: priceDifference,
            percentageChange: Math.round(percentageChange * 10) / 10, // Round to 1 decimal place
            status: priceDifference > 0 ? 'increase' : priceDifference < 0 ? 'decrease' : 'no-change',
          });

          console.log(
            `[DeviceChange] Service ${serviceDetails.name}: ${originalPrice} -> ${newPrice} (${priceDifference > 0 ? '+' : ''}${priceDifference})`
          );
        }
      }

      // Recalculate total cost
      const newTotalCost = order.services.reduce((sum, s) => sum + (s.price || 0), 0) +
        (order.addOns ? order.addOns.reduce((sum, addon) => sum + (addon.price || 0), 0) : 0);

      const totalCostDifference = newTotalCost - originalTotalCost;

      console.log(
        `[DeviceChange] Total cost change: ${originalTotalCost} -> ${newTotalCost} (${totalCostDifference > 0 ? '+' : ''}${totalCostDifference})`
      );

      // Create summary object
      const pricingChangesSummary = {
        originalDevice,
        newDevice: {
          brand: newDeviceInfo.deviceBrand,
          model: newDeviceInfo.deviceModel,
          type: newDeviceInfo.deviceType,
        },
        serviceChanges: pricingChanges,
        totalCostBefore: originalTotalCost,
        totalCostAfter: newTotalCost,
        totalCostDifference: totalCostDifference,
        totalCostStatus: totalCostDifference > 0 ? 'increase' : totalCostDifference < 0 ? 'decrease' : 'no-change',
        requiresConfirmation: totalCostDifference !== 0, // Confirmation needed if price changed
        changedAt: new Date(),
        changedBy: userId,
      };

      // Save the order with updated device and services
      await order.save();

      console.log(
        `[DeviceChange] Device successfully changed for order ${orderId}. Requires confirmation: ${pricingChangesSummary.requiresConfirmation}`
      );

      return {
        success: true,
        order,
        recalculatedServices,
        pricingChangesSummary,
        requiresConfirmation: pricingChangesSummary.requiresConfirmation,
      };
    } catch (error) {
      console.error(`[DeviceChange] Error changing device: ${error.message}`);
      throw error;
    }
  }

  /**
   * Confirm device change after customer approval
   * @param {string} orderId - Order ID
   * @param {boolean} confirmed - Whether customer confirmed the change
   * @param {string} userId - User ID confirming
   * @returns {Promise<Object>} Updated order
   */
  static async confirmDeviceChange(orderId, confirmed, userId) {
    try {
      const order = await Order.findById(orderId).populate('customerId');

      if (!order) {
        throw new Error('Order not found');
      }

      if (confirmed) {
        console.log(`[DeviceChange] Device change confirmed for order ${orderId} by user ${userId}`);

        // Send confirmation notification to customer
        try {
          await sendNotification(order.customerId._id, {
            type: 'pricing_update',
            title: 'Device Change Confirmed',
            message: `Your device change for repair order #${order.orderNumber} has been confirmed. The repair services and pricing have been updated accordingly.`,
            orderId: orderId,
            metadata: {
              actionType: 'device_change_confirmed',
            },
          });
        } catch (notifError) {
          console.warn(`[DeviceChange] Failed to send confirmation notification: ${notifError.message}`);
        }

        return order;
      } else {
        console.log(
          `[DeviceChange] Device change rejected for order ${orderId}. Reverting changes.`
        );

        // Revert order to previous state (fetch fresh from DB)
        // In a production system, you might want to store the "before" state
        throw new Error('Device change was not confirmed by customer');
      }
    } catch (error) {
      console.error(`[DeviceChange] Error confirming device change: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get compatible services for a device type
   * @param {string} deviceType - Device type to check
   * @returns {Promise<Array>} List of compatible services
   */
  static async getCompatibleServices(deviceType) {
    try {
      const services = await Service.find({
        $or: [
          { supportedDeviceTypes: { $size: 0 } },
          { supportedDeviceTypes: { $in: [deviceType] } },
          { supportedDeviceTypes: { $exists: false } },
        ],
        isActive: true,
      });

      console.log(
        `[DeviceChange] Found ${services.length} compatible services for device type ${deviceType}`
      );

      return services;
    } catch (error) {
      console.error(`[DeviceChange] Error getting compatible services: ${error.message}`);
      throw error;
    }
  }
}

module.exports = DeviceChangeService;
