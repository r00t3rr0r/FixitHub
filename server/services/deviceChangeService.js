const Order = require('../models/Order');
const Payment = require('../models/Payment');
const Service = require('../models/Service');
const User = require('../models/User');
const FinancialService = require('./financialService');
const OrderService = require('./orderService');
const OrderRevisionService = require('./orderRevisionService');
const ServiceService = require('./serviceService');
const NotificationService = require('./notificationService');

const buildDeviceChangeError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

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
      const changedByUser = userId ? await User.findById(userId).select('name firstName lastName') : null;
      const changedByName =
        changedByUser?.name ||
        [changedByUser?.firstName, changedByUser?.lastName].filter(Boolean).join(' ') ||
        'System';

      // Konfliktsicher (OrderService.runGuardedOrderEdit): Geraet, Positionen und
      // Auftragswert werden auf EINEM Stand gebildet und nur gemeinsam gespeichert;
      // bei einer gleichzeitigen Aenderung wird auf dem frischen Stand wiederholt.
      const { order, context } = await OrderService.runGuardedOrderEdit(orderId, async (order) => {
        // Kondition und Wert VOR jeder Aenderung festhalten (eine Preisregel). Passt der
        // gespeicherte Wert nicht zu den Positionen, nur nach ausdruecklicher Bestaetigung.
        const { conditions: pricingConditions, reconciliation } = OrderService.getPricingConditionsForEdit(order, newDeviceInfo || {});

        console.log(
          `[DeviceChange] Starting device change for order ${orderId}. Old: ${order.deviceBrand} ${order.deviceModel} (${order.deviceType}), New: ${newDeviceInfo.deviceBrand} ${newDeviceInfo.deviceModel} (${newDeviceInfo.deviceType})`
        );

        // Store original device info and costs for comparison
        const originalDevice = {
          brand: order.deviceBrand,
          model: order.deviceModel,
          type: order.deviceType,
        };

        const originalTotalCost = Number(order.totalCost) || 0;

        // Preserve the originally booked device before it is overwritten. Write-once:
        // a second correction must not move the snapshot forward.
        if (!order.reportedDevice?.model) {
          order.reportedDevice = {
            brand: originalDevice.brand,
            model: originalDevice.model,
            deviceType: originalDevice.type,
            capturedAt: new Date(),
          };
        }

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
            throw buildDeviceChangeError('Jeder bestehende Reparaturservice darf nur einmal zugeordnet werden.');
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
                throw buildDeviceChangeError('Der ausgewählte bestehende Reparaturservice gehört nicht zu diesem Auftrag.');
              }

              const existingOrderService = order.services[serviceIndex];
              const existingServiceDetails = existingOrderService.serviceId
                ? await Service.findById(existingOrderService.serviceId)
                : null;
              const newServiceDetails = await Service.findById(replacement.newServiceId).catch(() => null);

              if (!newServiceDetails) {
                throw buildDeviceChangeError('Der ausgewählte neue Reparaturservice wurde nicht gefunden.', 404);
              }

              // Dieselbe Regel wie die Serviceliste im Dialog (ServiceService.findServicesForDevice):
              // aktiv, passender Geraetetyp, Hersteller und Modell (inkl. Altdaten-Modelltext).
              const match = await ServiceService.checkServiceForDevice(newServiceDetails, {
                deviceType: newDeviceInfo.deviceType,
                deviceBrand: newDeviceInfo.deviceBrand,
                deviceModel: newDeviceInfo.deviceModel,
              });

              if (!match.ok) {
                throw buildDeviceChangeError(
                  ServiceService.describeDeviceMismatch(newServiceDetails, match, `${newDeviceInfo.deviceBrand} ${newDeviceInfo.deviceModel}`)
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

              const previousServiceName = existingOrderService.name
                || existingServiceDetails?.name
                || 'Vorheriger Service';

              // Dieselbe Auftragszeile (_id bleibt), neuer Katalogservice mit Namens-Snapshot.
              existingOrderService.serviceId = newServiceDetails._id;
              existingOrderService.isManual = false;
              existingOrderService.name = newServiceDetails.name || '';
              existingOrderService.description = '';
              existingOrderService.price = newPrice;
              existingOrderService.estimatedTime = OrderService.parseEstimatedMinutes(newServiceDetails.estimatedTime);

              const serviceSwap = {
                previousServiceName,
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

            // Nicht ersetzte Katalogpositionen muessen ebenfalls zum neuen Geraet passen -
            // sonst bliebe ein Service fuer ein anderes Modell im Auftrag.
            const replacedIds = new Set(selectedServiceReplacements.map((entry) => entry.oldOrderServiceId));
            for (const orderService of order.services) {
              if (replacedIds.has(String(orderService._id)) || orderService.isManual || !orderService.serviceId) continue;
              const keptService = await Service.findById(orderService.serviceId);
              if (!keptService) continue;
              const keptMatch = await ServiceService.checkServiceForDevice(keptService, {
                deviceType: newDeviceInfo.deviceType,
                deviceBrand: newDeviceInfo.deviceBrand,
                deviceModel: newDeviceInfo.deviceModel,
              });
              if (!keptMatch.ok) {
                throw buildDeviceChangeError(
                  `Der Service „${keptService.name}“ passt nicht zu ${newDeviceInfo.deviceBrand} ${newDeviceInfo.deviceModel}. Bitte ordnen Sie einen passenden Reparaturservice zu.`
                );
              }
            }
          } else {
            for (const orderService of order.services) {
              const serviceDetails = orderService.serviceId && !orderService.isManual
                ? await Service.findById(orderService.serviceId)
                : null;

              if (!serviceDetails) {
                console.warn(
                  `[DeviceChange] Service ${orderService.serviceId} not found, skipping recalculation`
                );
                recalculatedServices.push(orderService);
                continue;
              }

              // Ohne Zuordnung darf eine Katalogposition nur bleiben, wenn sie auch zum
              // NEUEN Geraet passt - sonst muss sie ersetzt werden.
              const match = await ServiceService.checkServiceForDevice(serviceDetails, {
                deviceType: newDeviceInfo.deviceType,
                deviceBrand: newDeviceInfo.deviceBrand,
                deviceModel: newDeviceInfo.deviceModel,
              });

              if (!match.ok) {
                throw buildDeviceChangeError(
                  `Der Service „${serviceDetails.name}“ passt nicht zu ${newDeviceInfo.deviceBrand} ${newDeviceInfo.deviceModel}. Bitte ordnen Sie einen passenden Reparaturservice zu.`
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

        // Auftragswert mit DER Preisregel neu rechnen: Positionen zu Listen-Brutto,
        // Kunden-/Haendlerrabatt (Snapshot) genau einmal, Aktionsrabatt fest, Produkte
        // und Zusatzleistungen bleiben enthalten.
        OrderService.applyOrderPricing(order, pricingConditions);
        const newTotalCost = Number(order.totalCost) || 0;

        const totalCostDifference = newTotalCost - originalTotalCost;

        console.log(
          `[DeviceChange] Total cost change: ${originalTotalCost} -> ${newTotalCost} (${totalCostDifference > 0 ? '+' : ''}${totalCostDifference})`
        );

        // Create summary object
        const pricingChangesSummary = {
          originalDevice,
          // The device the customer ORIGINALLY booked - differs from originalDevice as soon
          // as this is the second correction of the same order.
          bookedDevice: {
            brand: order.reportedDevice?.brand || originalDevice.brand,
            model: order.reportedDevice?.model || originalDevice.model,
            type: order.reportedDevice?.deviceType || originalDevice.type,
          },
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

        // EIN atomarer Schreibvorgang: Geraet, Positionen, Auftragswert und Verlaufseintrag.
        const timelineEntry = {
          status: 'Device Changed',
          description: `Modellwechsel: ${originalDevice.brand} ${originalDevice.model} -> ${newDeviceInfo.deviceBrand} ${newDeviceInfo.deviceModel}. Auftragskosten: ${originalTotalCost.toFixed(2)} EUR -> ${newTotalCost.toFixed(2)} EUR.`,
          completedAt: new Date(),
          staffId: String(userId || 'system'),
          staffName: changedByName,
        };
        order.timeline.push(timelineEntry);

        return {
          originalDevice,
          originalTotalCost,
          newTotalCost,
          recalculatedServices,
          pricingChangesSummary,
          selectedServiceSwaps,
          timelineEntry,
          reconciliation,
        };
      });
      const {
        originalDevice,
        originalTotalCost,
        newTotalCost,
        recalculatedServices,
        pricingChangesSummary,
        selectedServiceSwaps,
        timelineEntry,
        reconciliation,
      } = context;

      const warnings = [];
      const revision = await OrderRevisionService.recordRevision(order, {
        triggerReason: 'device_change',
        previousGrossAmount: originalTotalCost,
        changedBy: userId || undefined,
        changedByName,
        notes: [
          `Gerätewechsel ${originalDevice.brand} ${originalDevice.model} → ${newDeviceInfo.deviceBrand} ${newDeviceInfo.deviceModel}`,
          ...selectedServiceSwaps.map((swap) => `„${swap.previousServiceName}“ → „${swap.newServiceName}“ (${swap.newServicePrice.toFixed(2)} EUR)`),
          `Auftragswert ${originalTotalCost.toFixed(2)} EUR → ${newTotalCost.toFixed(2)} EUR`,
          OrderService.describeConfirmedRepricing(reconciliation),
          newDeviceInfo.reason ? `Grund: ${newDeviceInfo.reason}` : '',
        ].filter(Boolean).join(' | '),
      });
      if (!revision) {
        warnings.push('Der Gerätewechsel wurde gespeichert, konnte aber nicht in der Auftragshistorie protokolliert werden.');
      }

      try {
        const syncResult = await FinancialService.syncOrderAndBookingValue(order._id, 'order');
        if (syncResult && syncResult.ok === false) {
          throw new Error(syncResult.error || syncResult.message || 'unbekannter Fehler');
        }
      } catch (syncErr) {
        console.error(`[DeviceChange] Financial sync failed: ${syncErr.message}`);
        warnings.push('Der Gerätewechsel wurde gespeichert, der Abgleich mit Buchung/Rechnung ist jedoch fehlgeschlagen. Bitte den Finanzabgleich für diesen Auftrag erneut ausführen.');
      }

      let paymentAdjustment = null;
      try {
        paymentAdjustment = await DeviceChangeService.getPaymentAdjustment(order);
      } catch (paymentError) {
        console.warn(`[DeviceChange] Warning calculating payment adjustment: ${paymentError.message}`);
      }

      pricingChangesSummary.paymentAdjustment = paymentAdjustment;
      pricingChangesSummary.warnings = warnings;
      const paymentHistory = paymentAdjustment
        ? paymentAdjustment.refundAmount > 0
          ? ` Erstattung fällig: ${paymentAdjustment.refundAmount.toFixed(2)} EUR.`
          : paymentAdjustment.additionalPaymentAmount > 0
            ? ` Noch offen: ${paymentAdjustment.additionalPaymentAmount.toFixed(2)} EUR.`
            : ' Zahlung ist ausgeglichen.'
        : '';
      if (paymentHistory) {
        // Nur ein Zusatzhinweis im Verlauf - ein Fehler hier macht den bereits
        // gespeicherten Gerätewechsel nicht rückgängig und wird nicht als Fehler gemeldet.
        try {
          const entry = order.timeline[order.timeline.length - 1];
          entry.description = `${timelineEntry.description}${paymentHistory}`;
          await order.save();
        } catch (timelineError) {
          console.warn(`[DeviceChange] Warning updating timeline payment note: ${timelineError.message}`);
        }
      }

      console.log(
        `[DeviceChange] Device successfully changed for order ${orderId}. Requires confirmation: ${pricingChangesSummary.requiresConfirmation}`
      );

      return {
        success: true,
        order,
        recalculatedServices,
        pricingChangesSummary,
        requiresConfirmation: pricingChangesSummary.requiresConfirmation,
        warnings: pricingChangesSummary.warnings || [],
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
        throw buildDeviceChangeError('Auftrag wurde nicht gefunden.', 404);
      }

      if (confirmed) {
        console.log(`[DeviceChange] Device change confirmed for order ${orderId} by user ${userId}`);

        // Send confirmation notification to customer
        try {
          const customerId = order.customerId?._id || order.customerId;
          if (customerId) {
            await NotificationService.createNotification({
              userId: customerId,
              type: 'order_update',
              title: 'Gerätewechsel bestätigt',
              message: `Der Gerätewechsel für Ihren Reparaturauftrag #${order.orderNumber} wurde bestätigt. Reparaturservices und Preise wurden entsprechend angepasst.`,
              orderId: order._id,
              actionUrl: `/orders/${order._id}`,
              metadata: {
                actionType: 'device_change_confirmed',
              },
            }, { sendInApp: true });
          }
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
        throw buildDeviceChangeError('Der Gerätewechsel wurde nicht bestätigt. Der gespeicherte Stand bleibt bis zu einer erneuten Änderung bestehen.');
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
      // Dieselbe Regel wie die serverseitige Pruefung beim Tausch/Hinzufuegen
      // (ServiceService.checkServiceForDevice): nur aktive Services, alle
      // Geraetetyp-Schreibweisen, Hersteller und Modell inkl. Altdaten-Modelltext,
      // modellunabhaengige Hersteller-Services eingeschlossen. Vollstaendig, ohne
      // Seitenbegrenzung.
      const services = await ServiceService.findServicesForDevice({
        deviceType,
        deviceBrand: options.deviceBrand,
        deviceModel: options.deviceModel,
      });

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
