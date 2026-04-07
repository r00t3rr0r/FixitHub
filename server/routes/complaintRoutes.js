const express = require('express');
const router = express.Router();
const { requireUser, requireAdmin, requireRole } = require('./middleware/auth');
const ComplaintService = require('../services/complaintService');
const BookingService = require('../services/bookingService');
const OrderService = require('../services/orderService');
const Complaint = require('../models/Complaint');
const Order = require('../models/Order');
const User = require('../models/User');
const NotificationService = require('../services/notificationService');
const EmailService = require('../services/emailService');
const InspectionCommunicationService = require('../services/inspectionCommunicationService');

const ADMIN_NOTIFICATION_TYPE = 'system';

function actorName(user) {
  return user?.firstName
    ? `${user.firstName} ${user.lastName || ''}`.trim()
    : (user?.name || user?.email || 'System');
}

function ensureTransition(currentStatus, allowedStatuses, actionLabel) {
  if (!allowedStatuses.includes(currentStatus)) {
    throw new Error(`${actionLabel} not allowed while complaint status is ${currentStatus}`);
  }
}

function getComplaintCustomerId(complaint) {
  if (!complaint?.customerId) return '';
  return complaint.customerId?._id
    ? complaint.customerId._id.toString()
    : complaint.customerId.toString();
}

function getComplaintEmailTrigger(complaint, metadata = {}) {
  const event = String(metadata.event || '').toLowerCase();
  const status = String(complaint?.status || '').toLowerCase();

  if (event === 'complaint_created') return 'complaint_created';
  if (event === 'comment_added' || event === 'message_added') return 'complaint_message';
  if (event === 'offer_rejected' || event === 'complaint_rejected') return 'complaint_rejected';
  if (event === 'complaint_resolved') return 'complaint_resolved';

  if (['resolved', 'closed', 'new_repair'].includes(status)) return 'complaint_resolved';
  if (['rejected', 'denied'].includes(status)) return 'complaint_rejected';
  if (['in-progress', 'pending_approval', 'approved', 'acknowledged'].includes(status)) return 'complaint_processing';

  return 'complaint_processing';
}

async function notifyAdminsAboutComplaint(complaint, customer, order) {
  const admins = await User.find({ role: 'admin', isActive: true }).select('_id email');
  if (!admins.length) {
    return;
  }

  const notificationText = `Neue Reklamation ${complaint.complaintNumber} zu Auftrag ${order.orderNumber} von ${customer.email}`;

  await Promise.all(admins.map(async (admin) => {
    try {
      await NotificationService.createNotification({
        userId: admin._id,
        title: 'Neue Reklamation eingegangen',
        message: notificationText,
        type: ADMIN_NOTIFICATION_TYPE,
        orderId: order._id,
        actionUrl: `/admin/complaints?complaintId=${complaint._id}`,
        metadata: {
          complaintId: complaint._id,
          orderId: order._id,
          event: 'complaint_created'
        }
      });

      if (admin.email) {
        await EmailService.sendTemplateEmail('Statusupdate Auftrag oder Buchung', admin.email, {
          companyName: 'McRepair.de',
          customerName: 'Admin Team',
          orderNumber: order.orderNumber,
          orderStatus: 'Reklamation eingegangen',
          statusMessage: notificationText,
          statusUpdatedAt: new Date().toLocaleDateString('de-DE'),
          trackingUrl: await EmailService.buildSystemUrl('/admin/complaints'),
          supportEmail: process.env.SUPPORT_EMAIL || 'support@fixithub.com',
          supportPhone: process.env.SUPPORT_PHONE || '+49 (0) 123/456789'
        });
      }
    } catch (notificationError) {
      console.error('ComplaintRoutes: Failed to notify admin:', notificationError.message);
    }
  }));
}

async function notifyCustomer(complaint, customerId, title, message, metadata = {}) {
  try {
    const event = String(metadata.event || '').toLowerCase();
    const isMessageEvent = ['comment_added', 'message_added', 'feedback_request', 'quick_action'].includes(event);

    await NotificationService.createNotification({
      userId: customerId,
      title,
      message,
      type: isMessageEvent ? 'message' : 'order_update',
      orderId: complaint.orderId,
      actionUrl: '/my-complaints',
      metadata: {
        complaintId: complaint._id,
        complaintNumber: complaint.complaintNumber || null,
        ...metadata
      }
    });

    const customer = await User.findById(customerId).select('email firstName lastName');
    if (customer?.email) {
      const customerName = `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || customer.email;
      const trigger = getComplaintEmailTrigger(complaint, metadata);

      await EmailService.sendTriggerEmail(trigger, customer.email, {
        companyName: process.env.COMPANY_NAME || 'McRepair.de',
        customerName,
        complaintNumber: complaint.complaintNumber || String(complaint._id),
        complaintStatus: complaint.status,
        complaintCategory: complaint.category || 'other',
        complaintSubject: complaint.subject || 'Reklamation',
        orderNumber: complaint.orderId?.orderNumber || 'N/A',
        priority: complaint.priority || 'medium',
        submittedAt: new Date(complaint.createdAt || Date.now()).toLocaleDateString('de-DE'),
        handlerName: complaint.assignedToName || complaint.technicianName || 'Service Team',
        processingStartedAt: new Date().toLocaleDateString('de-DE'),
        estimatedResolutionDate: new Date(Date.now() + (3 * 24 * 60 * 60 * 1000)).toLocaleDateString('de-DE'),
        senderName: metadata.senderName || complaint.assignedToName || 'Service Team',
        messageSentAt: new Date().toLocaleString('de-DE'),
        resolutionSummary: message,
        compensationInfo: complaint.partialRefund ? `Teil-Erstattung: EUR ${Number(complaint.partialRefund).toFixed(2)}` : 'Keine zusaetzliche Kompensation',
        resolvedAt: ['resolved', 'closed', 'new_repair'].includes(String(complaint.status || '').toLowerCase())
          ? new Date().toLocaleDateString('de-DE')
          : '',
        decision: title,
        decisionReason: message,
        decidedAt: new Date().toLocaleDateString('de-DE'),
        complaintUrl: await EmailService.buildSystemUrl(`/complaints/${complaint._id}`),
        supportEmail: process.env.SUPPORT_EMAIL || 'support@fixithub.com',
        supportPhone: process.env.SUPPORT_PHONE || '+49 (0) 123/456789'
      });
    }
  } catch (error) {
    console.error('ComplaintRoutes: Error notifying customer:', error.message);
  }
}

function complaintToAdminRow(complaint) {
  const partsCosts = (complaint.additionalParts || []).reduce((sum, part) => sum + (part.cost || 0), 0);
  const sourceOrderId = complaint.orderId?._id || complaint.orderId;
  const complaintOrderId = complaint.newOrderId?._id || complaint.newOrderId;
  return {
    _id: complaint._id,
    complaintNumber: complaint.complaintNumber,
    orderId: sourceOrderId,
    orderNumber: complaint.orderId?.orderNumber || 'N/A',
    complaintOrderId,
    complaintOrderNumber: complaint.newOrderId?.orderNumber || '',
    customer: complaint.customerId
      ? `${complaint.customerId.firstName || ''} ${complaint.customerId.lastName || ''}`.trim() || complaint.customerId.email
      : 'N/A',
    processor: complaint.technicianName || complaint.assignedToName || '',
    status: complaint.status,
    createdAt: complaint.createdAt,
    extraCosts: Number((complaint.extraCosts || 0) + partsCosts + (complaint.serviceFee || 0)),
    partialRefund: complaint.partialRefund || 0
  };
}

function buildComplaintOrderPayload(sourceOrder, complaint) {
  const source = sourceOrder.toObject();
  delete source._id;
  delete source.orderNumber;
  delete source.createdAt;
  delete source.updatedAt;

  source.status = 'pending';
  source.progress = 0;
  source.actualCompletion = undefined;
  source.estimatedCompletion = undefined;
  source.assignedStaff = [];
  source.staffNotes = [];
  source.timeline = [];
  source.workflows = [];
  source.hasComplaint = true;
  source.parentOrderId = sourceOrder._id;
  source.sourceComplaintId = complaint._id;
  source.isComplaintFollowup = true;
  source.customerNotes = `${source.customerNotes || ''}\nReklamationsauftrag aus ${complaint.complaintNumber}`.trim();

  return source;
}

// Description: Get all complaints for a booking
// Endpoint: GET /api/complaints/booking/:bookingId
router.get('/booking/:bookingId', requireUser, async (req, res) => {
  try {
    const complaints = await ComplaintService.getByBooking(req.params.bookingId);
    return res.json({ success: true, complaints });
  } catch (error) {
    console.error('ComplaintRoutes: Error getting complaints by booking:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Description: Get all complaints (admin only)
// Endpoint: GET /api/complaints
router.get('/', requireAdmin, async (req, res) => {
  try {
    const { status, category, priority, limit = 50, skip = 0, from, to, technicianId } = req.query;

    const query = {};
    if (status) query.status = status;
    if (category) query.category = category;
    if (priority) query.priority = priority;
    if (technicianId) query.technicianId = technicianId;

    if (from || to) {
      query.createdAt = {};
      if (from) query.createdAt.$gte = new Date(from);
      if (to) query.createdAt.$lte = new Date(to);
    }

    const complaints = await Complaint.find(query)
      .populate('orderId', 'orderNumber')
      .populate('newOrderId', 'orderNumber status')
      .populate('customerId', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit, 10))
      .skip(parseInt(skip, 10));

    return res.json({
      success: true,
      complaints,
      rows: complaints.map(complaintToAdminRow)
    });
  } catch (error) {
    console.error('ComplaintRoutes: Error getting all complaints:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Description: Accept new repair offer (customer)
// Endpoint: POST /api/complaints/:id/accept-offer
router.post('/:id/accept-offer', requireUser, async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) {
      return res.status(404).json({ success: false, error: 'Complaint not found' });
    }

    const complaintCustomerId = getComplaintCustomerId(complaint);
    if (req.user.role === 'customer' && complaintCustomerId !== req.user._id.toString()) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    ensureTransition(complaint.status, ['denied'], 'Accept offer');

    let duplicatedOrder = null;
    if (complaint.newOrderId) {
      duplicatedOrder = await Order.findById(complaint.newOrderId).setOptions({ skipAutoPopulate: true });
    }

    if (!duplicatedOrder) {
      const sourceOrder = await Order.findById(complaint.orderId).setOptions({ skipAutoPopulate: true });
      if (!sourceOrder) {
        return res.status(404).json({ success: false, error: 'Source order not found for complaint' });
      }

      const source = buildComplaintOrderPayload(sourceOrder, complaint);
      duplicatedOrder = await Order.create(source);
    }

    const previousStatus = complaint.status;
    complaint.status = 'new_repair';
    complaint.newOrderId = duplicatedOrder._id;
    complaint.repairOffer.status = 'accepted';
    complaint.repairOffer.acceptedAt = new Date();
    complaint.complaintLogs.push({
      actorId: req.user._id,
      actorName: actorName(req.user),
      actorRole: req.user.role,
      action: 'offer_accepted',
      fromStatus: previousStatus,
      toStatus: 'new_repair',
      notes: 'Customer accepted technician repair offer',
      metadata: {
        newOrderId: duplicatedOrder._id
      }
    });

    await complaint.save();

    // Update repair offer message status in the communication thread
    try {
      const targetOrderId = (complaint.newOrderId || complaint.orderId).toString();
      await InspectionCommunicationService.updateRepairOfferStatus(
        targetOrderId, complaint._id, 'accepted'
      );
    } catch (commError) {
      console.error('ComplaintRoutes: Error updating repair offer message status (accept):', commError);
    }

    await notifyCustomer(
      complaint,
      complaint.customerId,
      'Neues Reparaturangebot angenommen',
      `Ein neuer Reparaturauftrag wurde erstellt: ${duplicatedOrder.orderNumber}`,
      { event: 'offer_accepted', newOrderId: duplicatedOrder._id }
    );

    return res.json({
      success: true,
      complaint,
      newOrder: {
        _id: duplicatedOrder._id,
        orderNumber: duplicatedOrder.orderNumber,
        status: duplicatedOrder.status
      }
    });
  } catch (error) {
    console.error('ComplaintRoutes: Error accepting offer:', error);
    return res.status(400).json({ success: false, error: error.message });
  }
});

// Description: Reject new repair offer (customer)
// Endpoint: POST /api/complaints/:id/reject-offer
router.post('/:id/reject-offer', requireUser, async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) {
      return res.status(404).json({ success: false, error: 'Complaint not found' });
    }

    const complaintCustomerId = getComplaintCustomerId(complaint);
    if (req.user.role === 'customer' && complaintCustomerId !== req.user._id.toString()) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    ensureTransition(complaint.status, ['denied'], 'Reject offer');

    const serviceFee = Number(req.body?.serviceFee || 39);
    const previousStatus = complaint.status;

    complaint.status = 'closed';
    complaint.serviceFee = serviceFee;
    complaint.extraCosts = Number(complaint.extraCosts || 0) + serviceFee;
    complaint.repairOffer.status = 'rejected';
    complaint.repairOffer.rejectedAt = new Date();
    complaint.complaintLogs.push({
      actorId: req.user._id,
      actorName: actorName(req.user),
      actorRole: req.user.role,
      action: 'offer_rejected',
      fromStatus: previousStatus,
      toStatus: 'closed',
      notes: `Customer rejected offer. Service fee applied: ${serviceFee}`,
      metadata: {
        serviceFee
      }
    });

    await complaint.save();

    // Update repair offer message status in the communication thread
    try {
      const targetOrderId = (complaint.newOrderId || complaint.orderId).toString();
      await InspectionCommunicationService.updateRepairOfferStatus(
        targetOrderId, complaint._id, 'rejected'
      );
    } catch (commError) {
      console.error('ComplaintRoutes: Error updating repair offer message status (reject):', commError);
    }

    await notifyCustomer(
      complaint,
      complaint.customerId,
      'Reparaturangebot abgelehnt',
      `Die Reklamation wurde geschlossen. Servicepauschale: ${serviceFee.toFixed(2)} EUR`,
      { event: 'offer_rejected', serviceFee }
    );

    return res.json({ success: true, complaint });
  } catch (error) {
    console.error('ComplaintRoutes: Error rejecting offer:', error);
    return res.status(400).json({ success: false, error: error.message });
  }
});

// Description: Convert accepted repair offer into a new booking with a newly generated order
// Endpoint: POST /api/complaints/:id/convert-offer-to-booking
router.post('/:id/convert-offer-to-booking', requireUser, async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) {
      return res.status(404).json({ success: false, error: 'Complaint not found' });
    }

    const complaintCustomerId = getComplaintCustomerId(complaint);
    if (req.user.role === 'customer' && complaintCustomerId !== req.user._id.toString()) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    if (!complaint.repairOffer || complaint.repairOffer.status !== 'accepted') {
      return res.status(400).json({ success: false, error: 'Repair offer must be accepted before conversion' });
    }

    if (!complaint.newOrderId) {
      return res.status(400).json({ success: false, error: 'No follow-up order available for conversion' });
    }

    const complaintOrder = await Order.findById(complaint.newOrderId).setOptions({ skipAutoPopulate: true });
    if (!complaintOrder) {
      return res.status(404).json({ success: false, error: 'Follow-up order not found' });
    }

    // Always generate a brand-new order for the new booking, independent from existing booking links.
    const newOrderPayload = complaintOrder.toObject();
    delete newOrderPayload._id;
    delete newOrderPayload.orderNumber;
    delete newOrderPayload.createdAt;
    delete newOrderPayload.updatedAt;
    delete newOrderPayload.bookingId;

    newOrderPayload.status = 'pending';
    newOrderPayload.progress = 0;
    newOrderPayload.completedAt = undefined;
    newOrderPayload.assignedStaff = [];
    newOrderPayload.staffNotes = [];
    newOrderPayload.timeline = [];
    newOrderPayload.workflows = [];
    newOrderPayload.hasComplaint = false;
    newOrderPayload.complaintReason = undefined;
    newOrderPayload.parentOrderId = complaintOrder._id;
    newOrderPayload.sourceComplaintId = complaint._id;
    newOrderPayload.isComplaintFollowup = false;
    newOrderPayload.customerNotes = `${newOrderPayload.customerNotes || ''}\nNeuer Auftrag aus angenommenem Reparaturangebot (${complaint.complaintNumber})`.trim();

    const newOrder = await Order.create(newOrderPayload);
    const booking = await BookingService.groupOrders([newOrder._id], complaintCustomerId);

    await OrderService.updateStatus(
      complaintOrder._id,
      'completed',
      'Reklamationsauftrag wurde nach Angebotsumwandlung abgeschlossen',
      req.user._id
    );

    complaint.complaintLogs.push({
      actorId: req.user._id,
      actorName: actorName(req.user),
      actorRole: req.user.role,
      action: 'offer_converted_to_booking',
      fromStatus: complaint.status,
      toStatus: complaint.status,
      notes: `Accepted repair offer converted to booking ${booking.bookingNumber}`,
      metadata: {
        bookingId: booking._id,
        bookingNumber: booking.bookingNumber,
        orderId: newOrder._id,
        orderNumber: newOrder.orderNumber,
        closedComplaintOrderId: complaintOrder._id,
      },
    });

    await complaint.save();

    return res.json({
      success: true,
      converted: true,
      bookingId: booking._id,
      bookingNumber: booking.bookingNumber,
      orderId: newOrder._id,
      orderNumber: newOrder.orderNumber,
    });
  } catch (error) {
    console.error('ComplaintRoutes: Error converting accepted offer to booking:', error);
    return res.status(400).json({ success: false, error: error.message });
  }
});

// Description: Admin approves complaint
// Endpoint: PATCH /api/complaints/:id/approve
router.patch('/:id/approve', requireAdmin, async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) {
      return res.status(404).json({ success: false, error: 'Complaint not found' });
    }

    ensureTransition(complaint.status, ['pending_approval'], 'Approve complaint');

    const order = await Order.findById(complaint.orderId).setOptions({ skipAutoPopulate: true });
    if (!order) {
      return res.status(404).json({ success: false, error: 'Source order not found for complaint' });
    }

    order.hasComplaint = true;
    order.complaintReason = complaint.complaintReason || complaint.description || complaint.subject;
    await order.save();

    let complaintOrder = null;
    if (complaint.newOrderId) {
      complaintOrder = await Order.findById(complaint.newOrderId).setOptions({ skipAutoPopulate: true });
    }

    if (!complaintOrder) {
      const complaintOrderPayload = buildComplaintOrderPayload(order, complaint);
      complaintOrder = await Order.create(complaintOrderPayload);
      complaint.newOrderId = complaintOrder._id;
    }

    const previousStatus = complaint.status;
    complaint.status = 'approved';
    complaint.adminApprovedAt = new Date();
    complaint.adminApprovedBy = req.user._id;
    complaint.shippingLabelUrl = complaint.shippingLabelUrl || `${process.env.FRONTEND_URL || 'http://localhost:5173'}/labels/${complaint.complaintNumber || `R${complaint.orderId}`}.pdf`;
    complaint.complaintLogs.push({
      actorId: req.user._id,
      actorName: actorName(req.user),
      actorRole: req.user.role,
      action: 'admin_approved',
      fromStatus: previousStatus,
      toStatus: 'approved',
      notes: 'Complaint approved and shipping label generated',
      metadata: {
        shippingLabelUrl: complaint.shippingLabelUrl,
        complaintOrderId: complaintOrder?._id,
        complaintOrderNumber: complaintOrder?.orderNumber
      }
    });

    await complaint.save();

    await notifyCustomer(
      complaint,
      complaint.customerId,
      'Reklamation genehmigt',
      `Deine Reklamation wurde genehmigt. Versandlabel: ${complaint.shippingLabelUrl}${complaintOrder ? `. Reklamationsauftrag: ${complaintOrder.orderNumber}` : ''}`,
      {
        event: 'admin_approved',
        shippingLabelUrl: complaint.shippingLabelUrl,
        complaintOrderId: complaintOrder?._id,
        complaintOrderNumber: complaintOrder?.orderNumber
      }
    );

    return res.json({
      success: true,
      complaint,
      complaintOrder: complaintOrder
        ? {
            _id: complaintOrder._id,
            orderNumber: complaintOrder.orderNumber,
            status: complaintOrder.status
          }
        : null
    });
  } catch (error) {
    console.error('ComplaintRoutes: Error approving complaint:', error);
    return res.status(400).json({ success: false, error: error.message });
  }
});

// Description: Admin rejects complaint
// Endpoint: PATCH /api/complaints/:id/reject
router.patch('/:id/reject', requireAdmin, async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id)
      .populate('orderId', 'orderNumber')
      .populate('newOrderId', 'orderNumber status')
      .populate('customerId', 'firstName lastName email');
    if (!complaint) {
      return res.status(404).json({ success: false, error: 'Complaint not found' });
    }

    const rejectionReason = req.body?.rejection_reason;
    if (!rejectionReason) {
      return res.status(400).json({ success: false, error: 'rejection_reason is required' });
    }

    ensureTransition(complaint.status, ['pending_approval'], 'Reject complaint');

    const previousStatus = complaint.status;
    complaint.status = 'rejected';
    complaint.rejectionReason = rejectionReason;
    complaint.complaintLogs.push({
      actorId: req.user._id,
      actorName: actorName(req.user),
      actorRole: req.user.role,
      action: 'admin_rejected',
      fromStatus: previousStatus,
      toStatus: 'rejected',
      notes: rejectionReason,
      metadata: {
        rejectionReason
      }
    });

    await complaint.save();

    await notifyCustomer(
      complaint,
      complaint.customerId,
      'Reklamation abgelehnt',
      `Deine Reklamation wurde abgelehnt. Grund: ${rejectionReason}`,
      { event: 'admin_rejected', rejectionReason }
    );

    return res.json({ success: true, complaint });
  } catch (error) {
    console.error('ComplaintRoutes: Error rejecting complaint:', error);
    return res.status(400).json({ success: false, error: error.message });
  }
});

// Description: Technician acknowledges complaint
// Endpoint: PATCH /api/complaints/:id/acknowledge
router.patch('/:id/acknowledge', requireUser, requireRole(['staff', 'admin']), async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) {
      return res.status(404).json({ success: false, error: 'Complaint not found' });
    }

    const technicianReason = req.body?.technician_reason;
    if (!technicianReason) {
      return res.status(400).json({ success: false, error: 'technician_reason is required' });
    }

    ensureTransition(complaint.status, ['approved'], 'Acknowledge complaint');

    const additionalParts = Array.isArray(req.body?.additional_parts) ? req.body.additional_parts : [];
    const partsCost = additionalParts.reduce((sum, item) => sum + Number(item.cost || 0), 0);
    const partialRefund = Number(req.body?.partial_refund || 0);
    const repairNotes = req.body?.repair_notes || '';
    const previousStatus = complaint.status;

    complaint.status = 'acknowledged';
    complaint.technicianId = req.user._id;
    complaint.technicianName = actorName(req.user);
    complaint.technicianReason = technicianReason;
    complaint.additionalParts = additionalParts;
    complaint.partialRefund = partialRefund;
    complaint.repairNotes = repairNotes;
    complaint.extraCosts = Number(complaint.extraCosts || 0) + partsCost;
    complaint.complaintLogs.push({
      actorId: req.user._id,
      actorName: actorName(req.user),
      actorRole: req.user.role,
      action: 'technician_acknowledged',
      fromStatus: previousStatus,
      toStatus: 'acknowledged',
      notes: technicianReason,
      metadata: {
        additionalParts,
        partsCost,
        partialRefund,
        repairNotes
      }
    });

    await complaint.save();

    await notifyCustomer(
      complaint,
      complaint.customerId,
      'Reklamation anerkannt',
      'Der Techniker hat die Reklamation anerkannt. Wir starten die Ausbesserung.',
      { event: 'technician_acknowledged' }
    );

    return res.json({ success: true, complaint });
  } catch (error) {
    console.error('ComplaintRoutes: Error acknowledging complaint:', error);
    return res.status(400).json({ success: false, error: error.message });
  }
});

// Description: Technician denies complaint and creates repair offer
// Endpoint: PATCH /api/complaints/:id/deny
router.patch('/:id/deny', requireUser, requireRole(['staff', 'admin']), async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) {
      return res.status(404).json({ success: false, error: 'Complaint not found' });
    }

    const technicianReason = req.body?.technician_reason;
    if (!technicianReason) {
      return res.status(400).json({ success: false, error: 'technician_reason is required' });
    }

    if (req.user.role === 'staff') {
      ensureTransition(complaint.status, ['approved'], 'Escalate denied complaint');
    } else {
      // Admin confirmation is only allowed after technician escalation.
      ensureTransition(complaint.status, ['pending_approval'], 'Confirm denied complaint');
    }

    const hasOfferAmountField = req.body?.offer_amount !== undefined && req.body?.offer_amount !== null;
    const offerAmount = Number(req.body?.offer_amount || 0);
    const offerDescription = (req.body?.offer_description || '').trim();
    const existingOfferAmount = Number(complaint.repairOffer?.amount || 0);
    const existingOfferDescription = (complaint.repairOffer?.description || '').trim();
    const resolvedOfferAmount = hasOfferAmountField ? offerAmount : existingOfferAmount;
    const resolvedOfferDescription = offerDescription || existingOfferDescription;

    if (req.user.role === 'staff' && (!hasOfferAmountField || !resolvedOfferDescription)) {
      return res.status(400).json({
        success: false,
        error: 'offer_amount and offer_description are required to escalate denied complaint',
      });
    }

    if (req.user.role === 'admin' && !resolvedOfferDescription) {
      return res.status(400).json({
        success: false,
        error: 'Repair offer configuration is required before admin confirmation',
      });
    }
    const previousStatus = complaint.status;

    complaint.status = req.user.role === 'staff' ? 'pending_approval' : 'denied';
    complaint.technicianId = req.user._id;
    complaint.technicianName = actorName(req.user);
    complaint.technicianReason = technicianReason;
    complaint.repairOffer = {
      amount: resolvedOfferAmount,
      description: resolvedOfferDescription || 'Neues Reparaturangebot nach Reklamationspruefung',
      createdAt: new Date(),
      acceptedAt: null,
      rejectedAt: null,
      status: 'pending'
    };
    complaint.complaintLogs.push({
      actorId: req.user._id,
      actorName: actorName(req.user),
      actorRole: req.user.role,
      action: req.user.role === 'staff' ? 'technician_denied_escalated' : 'admin_denied_confirmed',
      fromStatus: previousStatus,
      toStatus: complaint.status,
      notes: technicianReason,
      metadata: {
        offerAmount: resolvedOfferAmount,
        offerDescription: resolvedOfferDescription
      }
    });

    await complaint.save();

    if (req.user.role === 'staff') {
      try {
        const admins = await User.find({ role: 'admin', isActive: true }).select('_id');
        await Promise.all(admins.map((admin) => NotificationService.createNotification({
          userId: admin._id,
          title: 'Reklamation zur Ablehnungspruefung eskaliert',
          message: `Reklamation ${complaint.complaintNumber} wurde mit Reparaturangebot zur Admin-Freigabe eingereicht.`,
          type: ADMIN_NOTIFICATION_TYPE,
          orderId: complaint.newOrderId || complaint.orderId,
          actionUrl: `/orders/${complaint.newOrderId || complaint.orderId}`,
          metadata: {
            complaintId: complaint._id,
            event: 'technician_denied_escalated',
            offerAmount: resolvedOfferAmount,
            offerDescription: resolvedOfferDescription,
          },
        })));
      } catch (adminNotifyError) {
        console.error('ComplaintRoutes: Error notifying admins about escalation:', adminNotifyError);
      }

      return res.json({
        success: true,
        escalated: true,
        complaint,
      });
    }

    // Send repair offer as a message into the follow-up order's communication thread (the Reklamationsauftrag the customer views)
    try {
      const targetOrderId = (complaint.newOrderId || complaint.orderId).toString();
      await InspectionCommunicationService.sendRepairOfferMessage(
        targetOrderId,
        req.user._id,
        actorName(req.user),
        { complaintId: complaint._id, offerAmount: resolvedOfferAmount, offerDescription: resolvedOfferDescription }
      );
    } catch (commError) {
      console.error('ComplaintRoutes: Error sending repair offer message:', commError);
    }

    await notifyCustomer(
      complaint,
      complaint.customerId,
      'Neues Reparaturangebot verfügbar',
      `Die Reklamation wurde abgelehnt. Neues Angebot: ${resolvedOfferAmount.toFixed(2)} EUR. Bitte annehmen oder ablehnen.`,
      { event: 'technician_denied', offerAmount: resolvedOfferAmount, offerDescription: resolvedOfferDescription }
    );

    return res.json({ success: true, complaint });
  } catch (error) {
    console.error('ComplaintRoutes: Error denying complaint:', error);
    return res.status(400).json({ success: false, error: error.message });
  }
});

// Description: Get all complaints for the authenticated customer
// Endpoint: GET /api/complaints/my
router.get('/my', requireUser, async (req, res) => {
  try {
    const complaints = await Complaint.find({ customerId: req.user._id })
      .populate('orderId', 'orderNumber')
      .sort({ createdAt: -1 });
    return res.json({ success: true, complaints });
  } catch (error) {
    console.error('ComplaintRoutes: Error getting customer complaints:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Description: Get a specific complaint by ID
// Endpoint: GET /api/complaints/:id
router.get('/:id', requireUser, async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id);

    if (!complaint) {
      return res.status(404).json({ success: false, error: 'Complaint not found' });
    }

    const complaintCustomerId = getComplaintCustomerId(complaint);
    if (req.user.role === 'customer' && complaintCustomerId !== req.user._id.toString()) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    return res.json({ success: true, complaint });
  } catch (error) {
    console.error('ComplaintRoutes: Error getting complaint:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Description: Create a new legacy complaint
// Endpoint: POST /api/complaints
router.post('/', requireUser, async (req, res) => {
  try {
    const { bookingId, orderId, subject, description, category, priority } = req.body;

    if (!subject || !description || !category) {
      return res.status(400).json({
        success: false,
        error: 'subject, description, and category are required'
      });
    }

    const complaintData = {
      bookingId,
      orderId,
      customerId: req.user._id,
      subject,
      description,
      category,
      priority: priority || 'medium',
      workflowType: 'legacy'
    };

    const complaint = await ComplaintService.create(complaintData);

    try {
      const customer = await User.findById(req.user._id).select('email firstName lastName');
      if (customer?.email) {
        await EmailService.sendTriggerEmail('complaint_created', customer.email, {
          companyName: process.env.COMPANY_NAME || 'McRepair.de',
          customerName: `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || customer.email,
          complaintNumber: complaint.complaintNumber || String(complaint._id),
          complaintCategory: complaint.category,
          complaintSubject: complaint.subject,
          orderNumber: complaint.orderId?.orderNumber || 'N/A',
          priority: complaint.priority || 'medium',
          submittedAt: new Date(complaint.createdAt || Date.now()).toLocaleDateString('de-DE'),
          complaintUrl: await EmailService.buildSystemUrl(`/complaints/${complaint._id}`),
          supportEmail: process.env.SUPPORT_EMAIL || 'support@fixithub.com',
          supportPhone: process.env.SUPPORT_PHONE || '+49 (0) 123/456789'
        });
      }
    } catch (notificationError) {
      console.error('ComplaintRoutes: Error sending complaint-created email:', notificationError.message);
    }

    return res.status(201).json({ success: true, complaint });
  } catch (error) {
    console.error('ComplaintRoutes: Error creating complaint:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Description: Update complaint status (legacy)
// Endpoint: PUT /api/complaints/:id/status
router.put('/:id/status', requireAdmin, async (req, res) => {
  try {
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ success: false, error: 'status is required' });
    }

    const validStatuses = ['open', 'in-progress', 'pending-customer', 'resolved', 'closed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: `status must be one of: ${validStatuses.join(', ')}`
      });
    }

    const complaint = await ComplaintService.updateStatus(
      req.params.id,
      status,
      req.user._id,
      actorName(req.user),
      req.user.role
    );

    return res.json({ success: true, complaint });
  } catch (error) {
    console.error('ComplaintRoutes: Error updating complaint status:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Description: Add comment to complaint
// Endpoint: POST /api/complaints/:id/comments
router.post('/:id/comments', requireUser, async (req, res) => {
  try {
    const { comment, isInternal } = req.body;

    if (!comment) {
      return res.status(400).json({ success: false, error: 'comment is required' });
    }

    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) {
      return res.status(404).json({ success: false, error: 'Complaint not found' });
    }

    const complaintCustomerId = getComplaintCustomerId(complaint);
    if (req.user.role === 'customer' && complaintCustomerId !== req.user._id.toString()) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const commentData = {
      userId: req.user._id,
      userName: actorName(req.user),
      userRole: req.user.role,
      comment,
      isInternal: isInternal && (req.user.role === 'admin' || req.user.role === 'staff')
    };

    const updatedComplaint = await ComplaintService.addComment(req.params.id, commentData);

    const shouldNotifyCustomer =
      !commentData.isInternal &&
      req.user.role !== 'customer' &&
      complaintCustomerId;

    if (shouldNotifyCustomer) {
      await notifyCustomer(
        updatedComplaint,
        complaintCustomerId,
        'Neue Nachricht zu Ihrer Reklamation',
        `${commentData.userName}: ${String(comment).trim()}`,
        {
          event: 'comment_added',
          senderName: commentData.userName,
          commentId: updatedComplaint.comments?.[updatedComplaint.comments.length - 1]?._id,
        }
      );
    }

    return res.json({ success: true, complaint: updatedComplaint });
  } catch (error) {
    console.error('ComplaintRoutes: Error adding comment:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Description: Assign complaint to staff
// Endpoint: PUT /api/complaints/:id/assign
router.put('/:id/assign', requireAdmin, async (req, res) => {
  try {
    const { staffId, staffName } = req.body;

    if (!staffId || !staffName) {
      return res.status(400).json({ success: false, error: 'staffId and staffName are required' });
    }

    const complaint = await ComplaintService.assign(req.params.id, staffId, staffName);
    return res.json({ success: true, complaint });
  } catch (error) {
    console.error('ComplaintRoutes: Error assigning complaint:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Description: Resolve complaint
// Endpoint: PUT /api/complaints/:id/resolve
router.put('/:id/resolve', requireAdmin, async (req, res) => {
  try {
    const { resolution } = req.body;

    if (!resolution) {
      return res.status(400).json({ success: false, error: 'resolution is required' });
    }

    const complaint = await ComplaintService.resolve(req.params.id, resolution, req.user._id);
    return res.json({ success: true, complaint });
  } catch (error) {
    console.error('ComplaintRoutes: Error resolving complaint:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Description: Close complaint
// Endpoint: PUT /api/complaints/:id/close
router.put('/:id/close', requireAdmin, async (req, res) => {
  try {
    const complaint = await ComplaintService.close(req.params.id);
    return res.json({ success: true, complaint });
  } catch (error) {
    console.error('ComplaintRoutes: Error closing complaint:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
