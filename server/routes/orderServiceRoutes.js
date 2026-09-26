const express = require('express');
const router = express.Router();
const { requireUser, requireRole } = require('./middleware/auth');
const OrderServiceManagementService = require('../services/orderServiceManagementService');

// Fehler an die Oberflaeche: Status aus dem Service (400/404/409), deutsche Meldung.
// Unerwartete Fehler werden nicht roh (englisch) durchgereicht.
const respondWithError = (res, error, fallbackMessage) => {
  const statusCode = Number(error?.statusCode)
    || (error?.name === 'ValidationError' || error?.name === 'CastError' ? 400 : 500);
  const message = error?.statusCode
    ? error.message
    : (statusCode === 400 ? 'Die Eingaben sind ungültig. Bitte prüfen Sie Preis, Zeit und Auswahl.' : fallbackMessage);
  return res.status(statusCode).json({
    error: message,
    code: error?.code || undefined,
    // z. B. 409 ORDER_VALUE_NOT_RECONCILED: { storedTotal, positionsGross, discount, expectedTotal, difference }
    details: error?.statusCode ? (error.details || undefined) : undefined,
  });
};

// Ausdrueckliche Bestaetigung, einen Auftrag neu zu berechnen, dessen gespeicherter Wert
// nicht zu den Positionen passt (sonst 409 ORDER_VALUE_NOT_RECONCILED, siehe
// OrderService.getPricingConditionsForEdit). Nur ein echtes true bzw. 'true' zaehlt.
const isConfirmFlag = (value) => value === true || value === 'true';

// Description: Get all services for an order (populated with full service details)
//              plus the order's money breakdown. services[].price is the GROSS
//              LIST price of the position; `pricing` reconciles those list prices
//              with the discounted order total (Zwischensumme / Rabatt in % und EUR /
//              Netto / MwSt. / Brutto), so the order detail screen can add up.
// Endpoint: GET /api/order-services/:orderId
// Request: {}
// Response: { services: Array<{ _id, serviceId, isManual, name, description, price, estimatedTime, notes }>,
//             pricing: { positionsGross, discount, groupDiscountPercent, groupDiscountAmount, promoDiscountAmount,
//                        grossTotal, netTotal, taxAmount, taxRate, positionsReconcile, conditionsSource, conditionsAppliedAt } }
router.get('/:orderId', requireUser, async (req, res) => {
  try {
    const { orderId } = req.params;

    console.log(`[OrderServiceRoutes] GET /:orderId - Fetching services for order: ${orderId}`);

    const { services, pricing, order } =
      await OrderServiceManagementService.getOrderServicesWithPricing(orderId);

    // Same ownership rule as GET /api/orders/:id - a customer may only read the
    // positions of their own order.
    const orderCustomerId = order.customerId?._id
      ? order.customerId._id.toString()
      : (order.customerId ? order.customerId.toString() : '');
    if (orderCustomerId !== req.user._id.toString() && !['admin', 'staff'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Zugriff verweigert.' });
    }

    res.status(200).json({ services, pricing });
  } catch (error) {
    console.error(`[OrderServiceRoutes] Error fetching order services: ${error.message}`);
    return respondWithError(res, error, 'Die Reparaturpositionen konnten nicht geladen werden.');
  }
});

// Description: All ACTIVE catalogue services that match the order's CURRENT device
//              (brand, model incl. legacy model text, device type) - filtered on the
//              backend and complete (no pagination).
// Endpoint: GET /api/order-services/:orderId/available-services
// Request: {}
// Response: { device: { brand, model, type }, services: Service[] }
router.get('/:orderId/available-services', requireUser, requireRole(['admin', 'staff']), async (req, res) => {
  try {
    const result = await OrderServiceManagementService.getAvailableServicesForOrder(req.params.orderId);
    res.status(200).json(result);
  } catch (error) {
    console.error(`[OrderServiceRoutes] Error fetching available services: ${error.message}`);
    return respondWithError(res, error, 'Die passenden Reparaturservices konnten nicht geladen werden.');
  }
});

// Description: Update an existing repair position in an order
// Endpoint: PUT /api/order-services/:orderId/:serviceId
// Request: { price?: number (LIST gross / Standardpreis), estimatedTime?: number, notes?: string,
//            name?: string, description?: string (manual lines only), reason?: string,
//            confirmRepricing?: boolean }
// Response: { order: Order, pricing: Object, warnings: string[] }
// Errors:   { error (German), code?, details? } - 409 ORDER_VALUE_NOT_RECONCILED carries
//           details { storedTotal, positionsGross, discount, expectedTotal, difference }; resend
//           with confirmRepricing: true after the user explicitly confirmed the repricing.
router.put(
  '/:orderId/:serviceId',
  requireUser,
  requireRole(['admin', 'staff']),
  async (req, res) => {
    try {
      const { orderId, serviceId } = req.params;
      const { price, estimatedTime, notes, name, description, reason, confirmRepricing } = req.body || {};

      console.log(`[OrderServiceRoutes] PUT /:orderId/:serviceId - Updating service ${serviceId} in order ${orderId}`);

      const result = await OrderServiceManagementService.updateOrderService(orderId, serviceId, {
        price,
        estimatedTime,
        notes,
        name,
        description,
        reason,
        confirmRepricing: isConfirmFlag(confirmRepricing),
        actorId: req.user._id,
      });

      console.log(
        `[OrderServiceRoutes] Service ${serviceId} updated by user ${req.user._id} in order ${orderId}`
      );

      res.status(200).json({ order: result.order, pricing: result.pricing, warnings: result.warnings });
    } catch (error) {
      console.error(`[OrderServiceRoutes] Error updating service: ${error.message}`);
      return respondWithError(res, error, 'Die Reparaturposition konnte nicht aktualisiert werden.');
    }
  }
);

// Description: Add a repair position to an order - a catalogue service or a MANUAL line
// Endpoint: POST /api/order-services/:orderId
// Request: catalogue: { serviceId: string, price?: number, estimatedTime?: number, notes?: string, reason?: string }
//          manual:    { isManual: true, name: string, description?: string, price: number (LIST gross),
//                       estimatedTime?: number, notes?: string, reason?: string }
//          both accept confirmRepricing?: boolean (see PUT).
//          price is always the STANDARD/LIST gross price; customer/dealer conditions are
//          applied automatically on the order level.
// Response: { order: Order, pricing: Object, warnings: string[] }
// Errors:   { error (German), code?, details? } (see PUT)
router.post('/:orderId', requireUser, requireRole(['admin', 'staff']), async (req, res) => {
  try {
    const { orderId } = req.params;
    const { serviceId, price, estimatedTime, notes, isManual, name, description, reason, confirmRepricing } = req.body || {};
    const manual = isManual === true || isManual === 'true';

    console.log(`[OrderServiceRoutes] POST /:orderId - Adding ${manual ? 'manual line' : `service ${serviceId}`} to order ${orderId}`);

    if (!manual && !serviceId) {
      return res.status(400).json({ error: 'Bitte wählen Sie einen Reparaturservice aus.' });
    }

    const result = await OrderServiceManagementService.addServiceToOrder(
      orderId,
      manual ? null : serviceId,
      {
        isManual: manual,
        name,
        description,
        price,
        estimatedTime,
        notes,
        reason,
        confirmRepricing: isConfirmFlag(confirmRepricing),
        actorId: req.user._id,
      }
    );

    console.log(
      `[OrderServiceRoutes] Position added by user ${req.user._id} to order ${orderId}`
    );

    res.status(201).json({ order: result.order, pricing: result.pricing, warnings: result.warnings });
  } catch (error) {
    console.error(`[OrderServiceRoutes] Error adding service: ${error.message}`);
    return respondWithError(res, error, 'Die Reparaturposition konnte nicht hinzugefügt werden.');
  }
});

// Description: Remove a repair position from an order
// Endpoint: DELETE /api/order-services/:orderId/:serviceId
// Request: { reason?: string, confirmRepricing?: boolean } (body, or ?reason= / ?confirmRepricing=true)
// Response: { order: Order, pricing: Object, warnings: string[] }
// Errors:   { error (German), code?, details? } (see PUT)
router.delete(
  '/:orderId/:serviceId',
  requireUser,
  requireRole(['admin', 'staff']),
  async (req, res) => {
    try {
      const { orderId, serviceId } = req.params;
      const reason = (req.body && req.body.reason) || req.query.reason || '';
      const confirmRepricing = isConfirmFlag(req.body && req.body.confirmRepricing)
        || isConfirmFlag(req.query.confirmRepricing);

      console.log(`[OrderServiceRoutes] DELETE /:orderId/:serviceId - Removing service ${serviceId} from order ${orderId}`);

      const result = await OrderServiceManagementService.removeServiceFromOrder(orderId, serviceId, {
        reason: String(reason || ''),
        confirmRepricing,
        actorId: req.user._id,
      });

      console.log(
        `[OrderServiceRoutes] Service ${serviceId} removed by user ${req.user._id} from order ${orderId}`
      );

      res.status(200).json({ order: result.order, pricing: result.pricing, warnings: result.warnings });
    } catch (error) {
      console.error(`[OrderServiceRoutes] Error removing service: ${error.message}`);
      return respondWithError(res, error, 'Die Reparaturposition konnte nicht entfernt werden.');
    }
  }
);

module.exports = router;
