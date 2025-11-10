const express = require('express');
const router = express.Router();
const { requireUser, requireRole } = require('./middleware/auth');
const OrderServiceManagementService = require('../services/orderServiceManagementService');

// Description: Get all services for an order (populated with full service details)
// Endpoint: GET /api/order-services/:orderId
// Request: {}
// Response: { services: Array<{ _id, serviceId, price, estimatedTime, notes }> }
router.get('/:orderId', requireUser, async (req, res) => {
  try {
    const { orderId } = req.params;

    console.log(`[OrderServiceRoutes] GET /:orderId - Fetching services for order: ${orderId}`);

    const services =
      await OrderServiceManagementService.getOrderServices(orderId);

    res.status(200).json({ services });
  } catch (error) {
    console.error(`[OrderServiceRoutes] Error fetching order services: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// Description: Update an existing repair service in an order
// Endpoint: PUT /api/order-services/:orderId/:serviceId
// Request: { price?: number, estimatedTime?: number, notes?: string }
// Response: { order: Order }
router.put(
  '/:orderId/:serviceId',
  requireUser,
  requireRole(['admin', 'staff']),
  async (req, res) => {
    try {
      const { orderId, serviceId } = req.params;
      const { price, estimatedTime, notes } = req.body;

      console.log(`[OrderServiceRoutes] PUT /:orderId/:serviceId - Updating service ${serviceId} in order ${orderId}`);

      // Validate inputs - convert to numbers if needed and validate
      let validatedPrice = price;
      let validatedTime = estimatedTime;

      if (price !== undefined) {
        validatedPrice = typeof price === 'string' ? parseFloat(price) : price;
        if (isNaN(validatedPrice) || validatedPrice < 0) {
          return res.status(400).json({ error: 'Price must be a positive number' });
        }
      }

      if (estimatedTime !== undefined) {
        validatedTime = typeof estimatedTime === 'string' ? parseFloat(estimatedTime) : estimatedTime;
        if (isNaN(validatedTime) || validatedTime < 0) {
          return res.status(400).json({ error: 'Estimated time must be a positive number' });
        }
      }

      const order = await OrderServiceManagementService.updateOrderService(
        orderId,
        serviceId,
        { price: validatedPrice, estimatedTime: validatedTime, notes }
      );

      console.log(
        `[OrderServiceRoutes] Service ${serviceId} updated by user ${req.user._id} in order ${orderId}`
      );

      res.status(200).json({ order });
    } catch (error) {
      console.error(`[OrderServiceRoutes] Error updating service: ${error.message}`);
      res.status(500).json({ error: error.message });
    }
  }
);

// Description: Add a new repair service to an order
// Endpoint: POST /api/order-services/:orderId
// Request: { serviceId: string, price?: number, estimatedTime?: number, notes?: string }
// Response: { order: Order }
router.post('/:orderId', requireUser, requireRole(['admin', 'staff']), async (req, res) => {
  try {
    const { orderId } = req.params;
    const { serviceId, price, estimatedTime, notes } = req.body;

    console.log(`[OrderServiceRoutes] POST /:orderId - Adding service ${serviceId} to order ${orderId}`);

    // Validate required fields
    if (!serviceId) {
      return res.status(400).json({ error: 'Service ID is required' });
    }

    // Validate optional fields - convert to numbers if needed
    let validatedPrice = price;
    let validatedTime = estimatedTime;

    if (price !== undefined) {
      validatedPrice = typeof price === 'string' ? parseFloat(price) : price;
      if (isNaN(validatedPrice) || validatedPrice < 0) {
        return res.status(400).json({ error: 'Price must be a positive number' });
      }
    }

    if (estimatedTime !== undefined) {
      validatedTime = typeof estimatedTime === 'string' ? parseFloat(estimatedTime) : estimatedTime;
      if (isNaN(validatedTime) || validatedTime < 0) {
        return res.status(400).json({ error: 'Estimated time must be a positive number' });
      }
    }

    const order = await OrderServiceManagementService.addServiceToOrder(
      orderId,
      serviceId,
      { price: validatedPrice, estimatedTime: validatedTime, notes }
    );

    console.log(
      `[OrderServiceRoutes] Service ${serviceId} added by user ${req.user._id} to order ${orderId}`
    );

    res.status(201).json({ order });
  } catch (error) {
    console.error(`[OrderServiceRoutes] Error adding service: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// Description: Remove a repair service from an order
// Endpoint: DELETE /api/order-services/:orderId/:serviceId
// Request: {}
// Response: { order: Order }
router.delete(
  '/:orderId/:serviceId',
  requireUser,
  requireRole(['admin', 'staff']),
  async (req, res) => {
    try {
      const { orderId, serviceId } = req.params;

      console.log(`[OrderServiceRoutes] DELETE /:orderId/:serviceId - Removing service ${serviceId} from order ${orderId}`);

      const order =
        await OrderServiceManagementService.removeServiceFromOrder(
          orderId,
          serviceId
        );

      console.log(
        `[OrderServiceRoutes] Service ${serviceId} removed by user ${req.user._id} from order ${orderId}`
      );

      res.status(200).json({ order });
    } catch (error) {
      console.error(`[OrderServiceRoutes] Error removing service: ${error.message}`);
      res.status(500).json({ error: error.message });
    }
  }
);

module.exports = router;
