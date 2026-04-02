const express = require('express');
const OrderService = require('../services/orderService');
const ComplaintService = require('../services/complaintService');
const Complaint = require('../models/Complaint');
const EmailService = require('../services/emailService');
const DHLService = require('../services/dhlService');
const NotificationService = require('../services/notificationService');
const User = require('../models/User');
const { requireUser, requireRole } = require('./middleware/auth');

const router = express.Router();

// Create a new order (customer)
router.post('/', requireUser, async (req, res) => {
  console.log('Create order request received from user:', req.user.email);
  console.log('Order data:', req.body);

  try {
    const orderData = {
      ...req.body,
      customerId: req.user._id
    };

    const order = await OrderService.create(orderData);

    // Send order confirmation email asynchronously (don't block response)
    setImmediate(async () => {
      try {
        const confirmationData = {
          customerName: `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() || req.user.email,
          orderNumber: order.orderNumber,
          deviceBrand: order.deviceBrand || 'Unknown',
          deviceModel: order.deviceModel || 'Unknown',
          serviceName: order.serviceName || 'Repair Service',
          estimatedCompletion: order.estimatedCompletion || 'within 7-10 business days',
          orderId: order._id,
          trackingUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/orders/${order._id}`
        };

        const emailResult = await EmailService.sendOrderConfirmationEmail(
          req.user.email,
          confirmationData
        );

        if (emailResult.success) {
          console.log('Order confirmation email sent to:', req.user.email);
        } else {
          console.error('Failed to send order confirmation email:', emailResult.error);
        }
      } catch (emailError) {
        console.error('Error sending order confirmation email:', emailError.message);
        // Don't block the response - email failure shouldn't affect order creation
      }
    });

    return res.status(201).json({
      success: true,
      orderId: order._id,
      orderNumber: order.orderNumber,
      message: 'Order created successfully'
    });
  } catch (error) {
    console.error('Error creating order:', error);
    return res.status(400).json({
      error: error.message || 'Failed to create order'
    });
  }
});

// Get orders for current user (customer)
router.get('/', requireUser, async (req, res) => {
  console.log('Get orders request received from user:', req.user.email);

  try {
    const filters = {
      status: req.query.status
    };

    const orders = await OrderService.getByCustomer(req.user._id, filters);
    
    console.log('Orders route: Returning orders response:', JSON.stringify({ orders }, null, 2));

    return res.status(200).json({ orders });
  } catch (error) {
    console.error('Error getting orders:', error);
    return res.status(500).json({
      error: error.message || 'Failed to get orders'
    });
  }
});

// Get single order by ID (customer)
router.get('/:id', requireUser, async (req, res) => {
  console.log('Get order by ID request received:', req.params.id);

  try {
    const order = await OrderService.getById(req.params.id);

    // Check if user owns this order - fix the access control check
    const orderCustomerId = order.customerId._id ? order.customerId._id.toString() : order.customerId.toString();
    const currentUserId = req.user._id.toString();

    console.log('Access control check - Order customer ID:', orderCustomerId);
    console.log('Access control check - Current user ID:', currentUserId);
    console.log('Access control check - User role:', req.user.role);

    // Allow access if user owns the order OR if user is admin/staff
    if (orderCustomerId !== currentUserId && !['admin', 'staff'].includes(req.user.role)) {
      console.log('Access denied - User does not own order and is not admin/staff');
      return res.status(403).json({
        error: 'Access denied'
      });
    }

    console.log('Access granted - returning order details');
    return res.status(200).json({ order });
  } catch (error) {
    console.error('Error getting order by ID:', error);
    if (error.message === 'Order not found') {
      return res.status(404).json({ error: error.message });
    }
    return res.status(500).json({
      error: error.message || 'Failed to get order'
    });
  }
});

// Description: Get order progress timeline with milestone data
// Endpoint: GET /api/orders/:id/progress-timeline
// Request: {}
// Response: { stages: Array<{ id: string, label: string, status: string, date?: string }>, currentStage: string }
router.get('/:id/progress-timeline', requireUser, async (req, res) => {
  console.log('Get order progress timeline request received for order:', req.params.id);

  try {
    const order = await OrderService.getById(req.params.id);

    // Check if user owns this order or is admin/staff
    const orderCustomerId = order.customerId._id ? order.customerId._id.toString() : order.customerId.toString();
    const currentUserId = req.user._id.toString();

    if (orderCustomerId !== currentUserId && !['admin', 'staff'].includes(req.user.role)) {
      console.log('Access denied - User does not own order and is not admin/staff');
      return res.status(403).json({
        error: 'Access denied'
      });
    }

    const timeline = await OrderService.getProgressTimeline(req.params.id);
    console.log('Progress timeline retrieved successfully for order:', req.params.id);

    return res.status(200).json(timeline);
  } catch (error) {
    console.error('Error getting order progress timeline:', error);
    if (error.message === 'Order not found') {
      return res.status(404).json({ error: error.message });
    }
    return res.status(500).json({
      error: error.message || 'Failed to get order progress timeline'
    });
  }
});

// Description: Create a complaint for an order (customer)
// Endpoint: POST /api/orders/:orderId/complaint
// Request: { reason: string, description: string }
// Response: { success: boolean, complaint: Complaint }
router.post('/:orderId/complaint', requireUser, async (req, res) => {
  try {
    const { reason, description } = req.body;

    if (!reason || !description) {
      return res.status(400).json({
        success: false,
        error: 'reason and description are required'
      });
    }

    const order = await OrderService.getById(req.params.orderId);
    const orderCustomerId = order.customerId?._id ? order.customerId._id.toString() : order.customerId.toString();
    if (orderCustomerId !== req.user._id.toString()) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    if (order.status !== 'completed') {
      return res.status(400).json({
        success: false,
        error: 'Complaint can only be created for completed orders'
      });
    }

    const existingOpenComplaint = await Complaint.findOne({
      orderId: order._id,
      status: { $in: ['pending_approval', 'approved', 'acknowledged', 'denied', 'new_repair'] }
    });

    if (existingOpenComplaint) {
      return res.status(409).json({
        success: false,
        error: 'An active complaint already exists for this order',
        complaintId: existingOpenComplaint._id
      });
    }

    const complaintNumber = `R${order._id}`;
    const complaintData = {
      bookingId: order.bookingId || null,
      orderId: order._id,
      customerId: req.user._id,
      subject: `Reklamation fuer Auftrag ${order.orderNumber}`,
      description,
      category: 'service',
      priority: 'medium',
      status: 'pending_approval',
      workflowType: 'order-complaint',
      complaintReason: reason,
      complaintLogs: [{
        actorId: req.user._id,
        actorName: req.user.firstName
          ? `${req.user.firstName} ${req.user.lastName || ''}`.trim()
          : (req.user.name || req.user.email),
        actorRole: req.user.role,
        action: 'complaint_created',
        fromStatus: '',
        toStatus: 'pending_approval',
        notes: reason,
        metadata: {
          reason,
          description
        }
      }]
    };

    const complaint = await ComplaintService.create(complaintData);
    complaint.complaintNumber = complaintNumber;
    await complaint.save();

    const admins = await User.find({ role: 'admin', isActive: true }).select('_id email');
    const customerName = req.user.firstName
      ? `${req.user.firstName} ${req.user.lastName || ''}`.trim()
      : (req.user.name || req.user.email);

    await Promise.all(admins.map(async (admin) => {
      try {
        await NotificationService.createNotification({
          userId: admin._id,
          title: 'Neue Reklamation',
          message: `${customerName} hat eine Reklamation fuer Auftrag ${order.orderNumber} gemeldet.`,
          type: 'system',
          orderId: order._id,
          actionUrl: `/admin/complaints?complaintId=${complaint._id}`,
          metadata: {
            complaintId: complaint._id,
            orderNumber: order.orderNumber,
            reason
          }
        });

        if (admin.email) {
          await EmailService.sendTemplateEmail('Statusupdate Auftrag oder Buchung', admin.email, {
            companyName: 'McRepair.de',
            customerName: 'Admin Team',
            orderNumber: order.orderNumber,
            orderStatus: 'Neue Reklamation',
            statusMessage: `${customerName} hat eine Reklamation gemeldet: ${reason}`,
            statusUpdatedAt: new Date().toLocaleDateString('de-DE'),
            trackingUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/admin/complaints`,
            supportEmail: process.env.SUPPORT_EMAIL || 'support@fixithub.com',
            supportPhone: process.env.SUPPORT_PHONE || '+49 (0) 123/456789'
          });
        }
      } catch (notifyError) {
        console.error('Error notifying admin about complaint:', notifyError.message);
      }
    }));

    // Notify customer with complaint-created template
    try {
      if (req.user?.email) {
        await EmailService.sendTriggerEmail('complaint_created', req.user.email, {
          companyName: process.env.COMPANY_NAME || 'McRepair.de',
          customerName,
          complaintNumber: complaint.complaintNumber || complaintNumber,
          complaintCategory: complaint.category || 'service',
          complaintSubject: complaint.subject || `Reklamation fuer Auftrag ${order.orderNumber}`,
          orderNumber: order.orderNumber,
          priority: complaint.priority || 'medium',
          submittedAt: new Date().toLocaleDateString('de-DE'),
          complaintUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/complaints/${complaint._id}`,
          supportEmail: process.env.SUPPORT_EMAIL || 'support@fixithub.com',
          supportPhone: process.env.SUPPORT_PHONE || '+49 (0) 123/456789'
        });
      }
    } catch (customerNotifyError) {
      console.error('Error notifying customer about complaint creation:', customerNotifyError.message);
    }

    return res.status(201).json({
      success: true,
      complaint,
      message: 'Complaint submitted successfully'
    });
  } catch (error) {
    console.error('Error creating complaint for order:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to create complaint'
    });
  }
});

// ============================================
// SHIPPING & TRACKING ROUTES
// ============================================

// Description: Create shipping label for an order
// Endpoint: POST /api/orders/:id/shipping/create-label
// Request: { shipmentData: { weight, length, width, height, serviceType, shipperAddress, shipperCity, etc. } }
// Response: { success: boolean, trackingNumber: string, labelUrl: string, estimatedDelivery: Date }
router.post('/:id/shipping/create-label', requireUser, requireRole(['admin', 'staff']), async (req, res) => {
  console.log('Create shipping label request received for order:', req.params.id);
  console.log('Shipment data:', req.body);

  try {
    const result = await DHLService.createShipment(req.params.id, req.body.shipmentData || req.body);

    console.log('Shipping label created successfully');
    return res.status(200).json(result);
  } catch (error) {
    console.error('Error creating shipping label:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to create shipping label'
    });
  }
});

// Description: Get tracking information for an order
// Endpoint: GET /api/orders/:id/tracking
// Request: {}
// Response: { success: boolean, trackingNumber: string, status: string, events: Array, estimatedDelivery: Date }
router.get('/:id/tracking', requireUser, async (req, res) => {
  console.log('Get tracking info request received for order:', req.params.id);

  try {
    const order = await OrderService.getById(req.params.id);

    // Check access
    const orderCustomerId = order.customerId._id ? order.customerId._id.toString() : order.customerId.toString();
    const currentUserId = req.user._id.toString();

    if (orderCustomerId !== currentUserId && !['admin', 'staff'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    if (!order.trackingNumber) {
      return res.status(404).json({
        success: false,
        error: 'No tracking number found for this order'
      });
    }

    // Get latest tracking info from DHL
    const trackingInfo = await DHLService.getTrackingInfo(order.trackingNumber);

    console.log('Tracking info retrieved successfully');
    return res.status(200).json({
      ...trackingInfo,
      order: {
        orderNumber: order.orderNumber,
        shippingStatus: order.shippingStatus,
        estimatedDelivery: order.estimatedDelivery,
        actualDelivery: order.actualDelivery,
        trackingEvents: order.trackingEvents
      }
    });
  } catch (error) {
    console.error('Error getting tracking info:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to get tracking information'
    });
  }
});

// Description: Update order tracking from DHL API
// Endpoint: PUT /api/orders/:id/tracking/update
// Request: {}
// Response: { success: boolean, order: Order, trackingInfo: Object }
router.put('/:id/tracking/update', requireUser, requireRole(['admin', 'staff']), async (req, res) => {
  console.log('Update order tracking request received for order:', req.params.id);

  try {
    const result = await DHLService.updateOrderTracking(req.params.id);

    console.log('Order tracking updated successfully');
    return res.status(200).json(result);
  } catch (error) {
    console.error('Error updating order tracking:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to update tracking information'
    });
  }
});

// Description: Update order status and send notification email to customer
// Endpoint: PUT /api/orders/:id/status
// Request: { status: string, statusMessage?: string }
// Response: { success: boolean, order: Order }
router.put('/:id/status', requireUser, requireRole(['admin', 'staff']), async (req, res) => {
  console.log('Update order status request received for order:', req.params.id);

  try {
    const { status, statusMessage } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        error: 'Status is required'
      });
    }

    // Update order status via service
    const order = await OrderService.updateStatus(req.params.id, status, statusMessage, req.user._id);

    // Customer notifications and email dispatch are handled centrally in OrderService.updateStatus.

    return res.status(200).json({
      success: true,
      order,
      message: 'Order status updated successfully'
    });
  } catch (error) {
    console.error('Error updating order status:', error);
    return res.status(400).json({
      success: false,
      error: error.message || 'Failed to update order status'
    });
  }
});

// Description: DHL webhook endpoint for automatic status updates
// Endpoint: POST /api/orders/tracking/webhook
// Request: { trackingNumber: string, status: string, events: Array }
// Response: { success: boolean, message: string }
router.post('/tracking/webhook', async (req, res) => {
  console.log('DHL webhook received:', JSON.stringify(req.body));

  try {
    const result = await DHLService.handleWebhook(req.body);

    console.log('Webhook processed successfully');
    return res.status(200).json(result);
  } catch (error) {
    console.error('Error processing webhook:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to process webhook'
    });
  }
});

module.exports = router;