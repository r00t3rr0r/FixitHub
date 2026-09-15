const Order = require('../models/Order');
const Payment = require('../models/Payment');
const Service = require('../models/Service');
const User = require('../models/User');
const FinancialService = require('./financialService');
const { sendNotification } = require('./notificationService');

class DeviceChangeService {
  static async getPaymentAdjustment(order) {
    if (order.bookingId) {
      const BookingPaymentService = require('./bookingPaymentService');
      const overview = await BookingPaymentService.getOverview(order.bookingId);
      const orderValue = Number(overview.summary.orderValue || 0);
      const paidAmount = Number(overview.summary.receivedTotal || 0);

      return {
        scope: 'booking',
        orderValue,
        paidAmount,
        refundAmount: Number(Math.max(0, paidAmount - orderValue).toFixed(2)),
        additionalPaymentAmount: Number(Math.max(0, orderValue - paidAmount).toFixed(2)),
      };
    }

    const payments = await Payment.find({
      orderId: order._id,
      status: { $in: ['completed', 'refunded'] },
    }).lean();
    const paidAmount = Number(
      Math.max(
        0,
        payments.reduce(
          (sum, payment) => sum + (Number(payment.amount) || 0) - (Number(payment.refundAmount) || 0),
          0
        )
      ).toFixed(2)
    );
    const orderValue = Number(order.totalCost || 0);

    return {
      scope: 'order',
      orderValue,
      paidAmount,
      refundAmount: Number(Math.max(0, paidAmount - orderValue).toFixed(2)),
      additionalPaymentAmount: Number(Math.max(0, orderValue - paidAmount).toFixed(2)),
    };
  }

  static normalizeDeviceTypeCandidates(deviceType) {
    const candidates = [String(deviceType || '').trim()].filter(Boolean);
    const normalized = candidates[0]?.toLowerCase();

    if (normalized === 'wearable' && !candidates.includes('smartwatch')) {
      candidates.push('smartwatch');
    }
    if (normalized === 'smartwatch' && !candidates.includes('wearable')) {
      candidates.push('wearable');
    }

    return candidates;
  }

  static isServiceCompatibleWithDeviceType(serviceDetails, deviceType) {
    const compatibleTypes = DeviceChangeService.normalizeDeviceTypeCandidates(deviceType).map((entry) =>
      String(entry || '').trim().toLowerCase()
    );

    const declaredTypes = [
      ...(Array.isArray(serviceDetails.supportedDeviceTypes) ? serviceDetails.supportedDeviceTypes : []),
      ...(Array.isArray(serviceDetails.deviceTypes) ? serviceDetails.deviceTypes : []),
      serviceDetails.deviceType,
    ]
      .filter(Boolean)
      .map((entry) => String(entry).trim().toLowerCase());

    if (declaredTypes.length === 0) {
      return true;
    }

    return declaredTypes.some((entry) => compatibleTypes.includes(entry));
  }

  static getServicePriceForDevice(serviceDetails, deviceType, fallbackPrice = 0) {
    if (
      serviceDetails.priceByDeviceType &&
      serviceDetails.priceByDeviceType[deviceType] !== undefined
    ) {
      return Number(serviceDetails.priceByDeviceType[deviceType]) || 0;
    }

    if (serviceDetails.price !== undefined && serviceDetails.price !== null) {
      return Number(serviceDetails.price) || 0;
    }

    return Number(fallbackPrice) || 0;
  }

  static doesServiceMatchDeviceSelection(serviceDetails, deviceBrand, deviceModel) {
    const expectedBrand = String(deviceBrand || '').trim().toLowerCase();
    const expectedModel = String(deviceModel || '').trim().toLowerCase();

    if (!expectedBrand && !expectedModel) {
      return true;
    }

    const candidateBrands = [serviceDetails.manufacturerPrecise, serviceDetails.manufacturer]
      .filter(Boolean)
      .map((entry) => String(entry).trim().toLowerCase());
    const candidateModels = [serviceDetails.modelPrecise, serviceDetails.model]
      .filter(Boolean)
      .map((entry) => String(entry).trim().toLowerCase());

    const matchesBrand = expectedBrand ? candidateBrands.includes(expectedBrand) : true;
    const matchesModel = expectedModel ? candidateModels.includes(expectedModel) : true;

    return matchesBrand && matchesModel;
  }

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

      const changedByUser = userId ? await User.findById(userId).select('name firstName lastName') : null;
      const changedByName =
        changedByUser?.name ||
        [changedByUser?.firstName, changedByUser?.lastName].filter(Boolean).join(' ') ||
        'System';

      const originalTotalCost = Number(order.totalCost) || 0;

      // Update device information
      order.deviceBrand = newDeviceInfo.deviceBrand;
      order.deviceModel = newDeviceInfo.deviceModel;
      order.deviceType = newDeviceInfo.deviceType;

      const selectedServiceReplacements = [];

      if (Array.isArray(newDeviceInfo.serviceReplacements)) {
        for (const replacement of newDeviceInfo.serviceReplacements) {
          if (replacement?.oldOrderServiceId && replacement?.newServiceId) {
            selectedServiceReplacements.push({
              oldOrderServiceId: String(replacement.oldOrderServiceId),
              newServiceId: String(replacement.newServiceId),
            });
          }
        }
      }

      if (
        selectedServiceReplacements.length === 0 &&
        newDeviceInfo.serviceReplacement &&
        newDeviceInfo.serviceReplacement.oldOrderServiceId &&
        newDeviceInfo.serviceReplacement.newServiceId
      ) {
        selectedServiceReplacements.push({
          oldOrderServiceId: String(newDeviceInfo.serviceReplacement.oldOrderServiceId),
          newServiceId: String(newDeviceInfo.serviceReplacement.newServiceId),
        });
      }

      const seenOrderServiceIds = new Set();
      for (const replacement of selectedServiceReplacements) {
        if (seenOrderServiceIds.has(replacement.oldOrderServiceId)) {
          throw new Error('Duplicate existing repair service selections are not allowed');
        }
        seenOrderServiceIds.add(replacement.oldOrderServiceId);
      }

      // Get current services and recalculate prices for new device
      const recalculatedServices = [];
      const pricingChanges = [];
      let selectedServiceSwap = null;
      const selectedServiceSwaps = [];

      if (order.services && order.services.length > 0) {
        if (selectedServiceReplacements.length > 0) {
          for (const replacement of selectedServiceReplacements) {
            const serviceIndex = order.services.findIndex(
              (service) => String(service._id) === replacement.oldOrderServiceId
            );

            if (serviceIndex === -1) {
              throw new Error('Selected existing repair service is not part of this order');
            }

            const existingOrderService = order.services[serviceIndex];
            const existingServiceDetails = await Service.findById(existingOrderService.serviceId);
            const newServiceDetails = await Service.findById(replacement.newServiceId);

            if (!newServiceDetails) {
              throw new Error('Selected replacement repair service was not found');
            }

            const isCompatible = DeviceChangeService.isServiceCompatibleWithDeviceType(
              newServiceDetails,
              newDeviceInfo.deviceType
            );

            if (!isCompatible) {
              throw new Error(
                `Service "${newServiceDetails.name}" is not compatible with ${newDeviceInfo.deviceType}`
              );
            }

            const modelCompatible = DeviceChangeService.doesServiceMatchDeviceSelection(
              newServiceDetails,
              newDeviceInfo.deviceBrand,
              newDeviceInfo.deviceModel
            );

            if (!modelCompatible) {
              throw new Error(
                `Service "${newServiceDetails.name}" is not available for ${newDeviceInfo.deviceBrand} ${newDeviceInfo.deviceModel}`
              );
            }

            const originalPrice = Number(existingOrderService.price) || 0;
            const newPrice = DeviceChangeService.getServicePriceForDevice(
              newServiceDetails,
              newDeviceInfo.deviceType,
              originalPrice
            );
            const priceDifference = newPrice - originalPrice;
            const percentageChange = originalPrice > 0 ? (priceDifference / originalPrice) * 100 : 0;

            existingOrderService.serviceId = newServiceDetails._id;
            existingOrderService.price = newPrice;

            const numericEstimatedTime = Number(newServiceDetails.estimatedTime);
            if (!Number.isNaN(numericEstimatedTime) && numericEstimatedTime >= 0) {
              existingOrderService.estimatedTime = numericEstimatedTime;
            }

            const serviceSwap = {
              previousServiceName: existingServiceDetails?.name || 'Vorheriger Service',
              previousServicePrice: originalPrice,
              newServiceName: newServiceDetails.name,
              newServicePrice: newPrice,
              difference: priceDifference,
              status: priceDifference > 0 ? 'increase' : priceDifference < 0 ? 'decrease' : 'no-change',
            };

            selectedServiceSwaps.push(serviceSwap);

            pricingChanges.push({
              serviceName: `${serviceSwap.previousServiceName} -> ${serviceSwap.newServiceName}`,
              serviceId: newServiceDetails._id,
              originalPrice,
              newPrice,
              difference: priceDifference,
              percentageChange: Math.round(percentageChange * 10) / 10,
              status: serviceSwap.status,
            });

            recalculatedServices.push(existingOrderService);

            console.log(
              `[DeviceChange] Replaced service ${serviceSwap.previousServiceName} with ${serviceSwap.newServiceName}: ${originalPrice} -> ${newPrice}`
            );
          }

          selectedServiceSwap = selectedServiceSwaps[0] || null;
        } else {
          for (const orderService of order.services) {
            const serviceDetails = await Service.findById(orderService.serviceId);

            if (!serviceDetails) {
              console.warn(
                `[DeviceChange] Service ${orderService.serviceId} not found, skipping recalculation`
              );
              recalculatedServices.push(orderService);
              continue;
            }

            const isCompatible = DeviceChangeService.isServiceCompatibleWithDeviceType(
              serviceDetails,
              newDeviceInfo.deviceType
            );

            if (!isCompatible) {
              console.warn(
                `[DeviceChange] Service ${serviceDetails.name} not compatible with ${newDeviceInfo.deviceType}`
              );
              throw new Error(
                `Service "${serviceDetails.name}" is not compatible with ${newDeviceInfo.deviceType}`
              );
            }

            const newPrice = DeviceChangeService.getServicePriceForDevice(
              serviceDetails,
              newDeviceInfo.deviceType,
              orderService.price
            );
            const originalPrice = Number(orderService.price) || 0;
            const priceDifference = newPrice - originalPrice;
            const percentageChange = originalPrice > 0 ? (priceDifference / originalPrice) * 100 : 0;

            orderService.price = newPrice;

            recalculatedServices.push(orderService);

            pricingChanges.push({
              serviceName: serviceDetails.name,
              serviceId: serviceDetails._id,
              originalPrice: originalPrice,
              newPrice: newPrice,
              difference: priceDifference,
              percentageChange: Math.round(percentageChange * 10) / 10,
              status: priceDifference > 0 ? 'increase' : priceDifference < 0 ? 'decrease' : 'no-change',
            });

            console.log(
              `[DeviceChange] Service ${serviceDetails.name}: ${originalPrice} -> ${newPrice} (${priceDifference > 0 ? '+' : ''}${priceDifference})`
            );
          }
        }
      }

      // Recalculate the entire order value while preserving products and checkout discounts.
      const servicesTotal = (order.services || []).reduce(
        (sum, service) => sum + (Number(service.price) || 0),
        0
      );
      const addOnsTotal = (order.addOns || []).reduce(
        (sum, addon) => sum + (Number(addon.price) || 0),
        0
      );
      const shopProductsTotal = (order.shopProducts || []).reduce(
        (sum, product) =>
          sum + (Number(product.priceAtOrder) || 0) * (Number(product.quantity) || 0),
        0
      );
      const discount = Number(order.discount) || 0;
      const newTotalCost = Number(
        Math.max(0, servicesTotal + addOnsTotal + shopProductsTotal - discount).toFixed(2)
      );
      order.totalCost = newTotalCost;

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
        selectedServiceSwap,
        selectedServiceSwaps,
        requiresConfirmation: totalCostDifference !== 0, // Confirmation needed if price changed
        changedAt: new Date(),
        changedBy: userId,
      };

      // Save the order with updated device and services
      await order.save();
      try {
        await FinancialService.syncOrderAndBookingValue(order._id, 'order');
      } catch (syncErr) {
        console.warn(`[DeviceChange] Warning syncing financial value: ${syncErr.message}`);
      }

      let paymentAdjustment = null;
      try {
        paymentAdjustment = await DeviceChangeService.getPaymentAdjustment(order);
      } catch (paymentError) {
        console.warn(`[DeviceChange] Warning calculating payment adjustment: ${paymentError.message}`);
      }

      pricingChangesSummary.paymentAdjustment = paymentAdjustment;
      const paymentHistory = paymentAdjustment
        ? paymentAdjustment.refundAmount > 0
          ? ` Erstattung faellig: ${paymentAdjustment.refundAmount.toFixed(2)} EUR.`
          : paymentAdjustment.additionalPaymentAmount > 0
            ? ` Noch offen: ${paymentAdjustment.additionalPaymentAmount.toFixed(2)} EUR.`
            : ' Zahlung ist ausgeglichen.'
        : '';
      order.timeline.push({
        status: 'Device Changed',
        description: `Modellwechsel: ${originalDevice.brand} ${originalDevice.model} -> ${newDeviceInfo.deviceBrand} ${newDeviceInfo.deviceModel}. Auftragskosten: ${originalTotalCost.toFixed(2)} EUR -> ${newTotalCost.toFixed(2)} EUR.${paymentHistory}`,
        completedAt: new Date(),
        staffId: String(userId || 'system'),
        staffName: changedByName,
      });
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
   * Get compatible services for a device selection.
   * @param {string} deviceType - Device type to check
   * @param {{ deviceBrand?: string, deviceModel?: string }} options - Optional brand/model filters
   * @returns {Promise<Array>} List of compatible services
   */
  static async getCompatibleServices(deviceType, options = {}) {
    try {
      const normalizedType = String(deviceType || '').trim().toLowerCase();
      const compatibleTypes = [String(deviceType || '').trim()].filter(Boolean);

      if (normalizedType === 'wearable' && !compatibleTypes.includes('smartwatch')) {
        compatibleTypes.push('smartwatch');
      }
      if (normalizedType === 'smartwatch' && !compatibleTypes.includes('wearable')) {
        compatibleTypes.push('wearable');
      }

      const andConditions = [
        {
          $or: [
            { supportedDeviceTypes: { $size: 0 } },
            { supportedDeviceTypes: { $in: compatibleTypes } },
            { supportedDeviceTypes: { $exists: false } },
            { deviceTypes: { $in: compatibleTypes } },
            { deviceType: { $in: compatibleTypes } },
          ],
        },
      ];

      const deviceBrand = String(options.deviceBrand || '').trim();
      if (deviceBrand) {
        const escapedBrand = deviceBrand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const brandRegex = new RegExp(`^${escapedBrand}$`, 'i');
        andConditions.push({
          $or: [{ manufacturerPrecise: brandRegex }, { manufacturer: brandRegex }],
        });
      }

      const deviceModel = String(options.deviceModel || '').trim();
      if (deviceModel) {
        const escapedModel = deviceModel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const modelRegex = new RegExp(`^${escapedModel}$`, 'i');
        andConditions.push({
          $or: [{ modelPrecise: modelRegex }, { model: modelRegex }],
        });
      }

      const query = {
        isActive: true,
        $and: andConditions,
      };

      const services = await Service.find(query);

      console.log(
        `[DeviceChange] Found ${services.length} compatible services for device ${options.deviceBrand || '-'} ${options.deviceModel || '-'} (${deviceType})`
      );

      return services;
    } catch (error) {
      console.error(`[DeviceChange] Error getting compatible services: ${error.message}`);
      throw error;
    }
  }
}

module.exports = DeviceChangeService;
