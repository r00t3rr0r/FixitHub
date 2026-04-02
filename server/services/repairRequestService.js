const RepairRequest = require('../models/RepairRequest');
const Order = require('../models/Order');
const User = require('../models/User');
const Service = require('../models/Service');
const BookingService = require('./bookingService');
const mongoose = require('mongoose');
const EmailService = require('./emailService');

class RepairRequestService {
  static getRepairRequestStatusTrigger(status) {
    const normalized = String(status || '').toLowerCase();
    if (['in_progress', 'in-progress', 'processing', 'assigned', 'under_review'].includes(normalized)) {
      return 'repair_request_processing';
    }
    if (['diagnosed', 'quote_ready', 'awaiting_approval'].includes(normalized)) {
      return 'repair_request_diagnosed';
    }
    if (['completed', 'resolved', 'closed'].includes(normalized)) {
      return 'repair_request_completed';
    }
    return 'repair_request_processing';
  }

  /**
   * Helper function to parse estimatedTime string to numeric minutes
   * Examples: "2-3 hours" -> 150, "1-2 hours" -> 90, "30-60 minutes" -> 45
   */
  static parseEstimatedTime(timeString) {
    try {
      if (!timeString || typeof timeString !== 'string') {
        console.warn('RepairRequestService: Invalid time string:', timeString);
        return 0;
      }

      // Convert to lowercase for consistent matching
      const lowerTime = timeString.toLowerCase().trim();

      // Extract numbers from the string
      const numbers = lowerTime.match(/\d+/g);
      if (!numbers || numbers.length === 0) {
        console.warn('RepairRequestService: No numbers found in time string:', timeString);
        return 0;
      }

      // Calculate average of range (e.g., "2-3" -> 2.5)
      let averageValue = 0;
      if (numbers.length === 1) {
        averageValue = parseInt(numbers[0]);
      } else {
        // Take average of first two numbers
        averageValue = (parseInt(numbers[0]) + parseInt(numbers[1])) / 2;
      }

      // Check if it's in hours or minutes
      if (lowerTime.includes('hour')) {
        // Convert hours to minutes
        return Math.round(averageValue * 60);
      } else if (lowerTime.includes('minute') || lowerTime.includes('min')) {
        return Math.round(averageValue);
      } else {
        // Default to minutes if no unit specified
        console.warn('RepairRequestService: No time unit found, assuming minutes:', timeString);
        return Math.round(averageValue);
      }
    } catch (error) {
      console.error('RepairRequestService: Error parsing time string:', timeString, error);
      return 0;
    }
  }

  /**
   * Create a new repair request
   */
  static async createRepairRequest(customerId, data) {
    try {
      console.log(`RepairRequestService: Creating repair request for customer: ${customerId}`);

      // Get customer information
      const customer = await User.findById(customerId).select('firstName lastName email phone');
      if (!customer) {
        throw new Error('Customer not found');
      }

      // Set review deadline (3 business days from now)
      const reviewDeadline = new Date();
      reviewDeadline.setDate(reviewDeadline.getDate() + 3);

      const repairRequest = new RepairRequest({
        customerId,
        customerName: `${customer.firstName} ${customer.lastName}`,
        customerEmail: customer.email,
        customerPhone: customer.phone,
        deviceType: data.deviceType,
        deviceBrand: data.deviceBrand,
        deviceModel: data.deviceModel,
        deviceModelId: data.deviceModelId,
        issueDescription: data.issueDescription,
        issueOccurredDate: data.issueOccurredDate,
        repairAttempts: data.repairAttempts || '',
        modelNumber: data.modelNumber || '',
        waterDamage: data.waterDamage || 'no',
        previousRepairDetails: data.previousRepairDetails || '',
        itemCondition: data.itemCondition || 'unsure',
        images: data.images || [],
        reviewDeadline,
      });

      await repairRequest.save();
      console.log(`RepairRequestService: Created repair request: ${repairRequest.requestNumber}`);

      setImmediate(async () => {
        try {
          await EmailService.sendTriggerEmail('repair_request_created', repairRequest.customerEmail, {
            companyName: process.env.COMPANY_NAME || 'McRepair.de',
            customerName: repairRequest.customerName,
            requestNumber: repairRequest.requestNumber,
            deviceBrand: repairRequest.deviceBrand,
            deviceModel: repairRequest.deviceModel,
            issueDescription: repairRequest.issueDescription,
            submittedAt: new Date(repairRequest.createdAt || Date.now()).toLocaleDateString('de-DE'),
            requestUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/repair-requests/${repairRequest._id}`,
            supportEmail: process.env.SUPPORT_EMAIL || 'support@fixithub.com',
            supportPhone: process.env.SUPPORT_PHONE || '+49 (0) 123/456789'
          });
        } catch (notificationError) {
          console.error('RepairRequestService: Error sending repair request created email:', notificationError.message);
        }
      });

      return repairRequest;
    } catch (error) {
      console.error('RepairRequestService: Error creating repair request:', error);
      throw error;
    }
  }

  /**
   * Get all repair requests with filtering and pagination
   */
  static async getRepairRequests(filters = {}, pagination = {}) {
    try {
      const { status, priority, customerId, assignedStaffId, search } = filters;
      const { page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc' } = pagination;

      console.log('RepairRequestService: Getting repair requests with filters:', filters);

      const query = {};

      // Apply filters
      if (status) query.status = status;
      if (priority) query.priority = priority;
      if (customerId) query.customerId = new mongoose.Types.ObjectId(customerId);
      if (assignedStaffId) query.assignedStaffId = new mongoose.Types.ObjectId(assignedStaffId);

      // Search by request number, customer name, or device model
      if (search) {
        query.$or = [
          { requestNumber: { $regex: search, $options: 'i' } },
          { customerName: { $regex: search, $options: 'i' } },
          { deviceModel: { $regex: search, $options: 'i' } },
        ];
      }

      const skip = (page - 1) * limit;
      const sortOptions = {};
      sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

      const [requests, total] = await Promise.all([
        RepairRequest.find(query)
          .populate('customerId', 'firstName lastName email phone')
          .populate('assignedStaffId', 'firstName lastName email')
          .populate('convertedToOrderId', 'orderNumber status')
          .sort(sortOptions)
          .skip(skip)
          .limit(limit)
          .lean(),
        RepairRequest.countDocuments(query),
      ]);

      console.log(`RepairRequestService: Found ${requests.length} repair requests out of ${total} total`);

      return {
        requests,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      console.error('RepairRequestService: Error getting repair requests:', error);
      throw error;
    }
  }

  /**
   * Get a single repair request by ID
   */
  static async getRepairRequestById(requestId) {
    try {
      console.log(`RepairRequestService: Getting repair request: ${requestId}`);

      const request = await RepairRequest.findById(requestId)
        .populate('customerId', 'firstName lastName email phone avatar')
        .populate('assignedStaffId', 'firstName lastName email')
        .populate('convertedToOrderId', 'orderNumber status totalCost')
        .populate('deviceModelId', 'name manufacturer specifications')
        .lean();

      if (!request) {
        throw new Error('Repair request not found');
      }

      return request;
    } catch (error) {
      console.error('RepairRequestService: Error getting repair request:', error);
      throw error;
    }
  }

  /**
   * Update repair request status
   */
  static async updateStatus(requestId, status, staffId, staffName) {
    try {
      console.log(`RepairRequestService: Updating status of request ${requestId} to ${status}`);

      const request = await RepairRequest.findById(requestId);
      if (!request) {
        throw new Error('Repair request not found');
      }

      request.status = status;
      request.updatedAt = Date.now();

      // Add admin note about status change
      request.adminNotes.push({
        staffId,
        staffName,
        note: `Status changed to: ${status}`,
        createdAt: Date.now(),
      });

      await request.save();
      console.log(`RepairRequestService: Status updated successfully`);

      setImmediate(async () => {
        try {
          const trigger = this.getRepairRequestStatusTrigger(status);
          await EmailService.sendTriggerEmail(trigger, request.customerEmail, {
            companyName: process.env.COMPANY_NAME || 'McRepair.de',
            customerName: request.customerName,
            requestNumber: request.requestNumber,
            deviceBrand: request.deviceBrand,
            deviceModel: request.deviceModel,
            technicianName: request.assignedStaffName || staffName || 'Service Team',
            processingStartedAt: new Date(request.updatedAt || Date.now()).toLocaleDateString('de-DE'),
            estimatedResponseDate: new Date(Date.now() + (2 * 24 * 60 * 60 * 1000)).toLocaleDateString('de-DE'),
            diagnosisResult: request.issueDescription,
            recommendedAction: 'Bitte Details im Kundenkonto pruefen',
            offerAmount: request.estimatedCost ? `EUR ${Number(request.estimatedCost).toFixed(2)}` : 'Wird mitgeteilt',
            diagnosisDate: new Date(request.updatedAt || Date.now()).toLocaleDateString('de-DE'),
            resolutionSummary: `Status auf ${status} gesetzt`,
            completedAt: new Date(request.updatedAt || Date.now()).toLocaleDateString('de-DE'),
            approvalUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/repair-requests/${request._id}`,
            requestUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/repair-requests/${request._id}`,
            supportEmail: process.env.SUPPORT_EMAIL || 'support@fixithub.com',
            supportPhone: process.env.SUPPORT_PHONE || '+49 (0) 123/456789'
          });
        } catch (notificationError) {
          console.error('RepairRequestService: Error sending repair request status email:', notificationError.message);
        }
      });

      return request;
    } catch (error) {
      console.error('RepairRequestService: Error updating status:', error);
      throw error;
    }
  }

  /**
   * Assign staff to repair request
   */
  static async assignStaff(requestId, staffId, assignedByStaffId, assignedByStaffName) {
    try {
      console.log(`RepairRequestService: Assigning staff ${staffId} to request ${requestId}`);

      const request = await RepairRequest.findById(requestId);
      if (!request) {
        throw new Error('Repair request not found');
      }

      const staff = await User.findById(staffId).select('firstName lastName');
      if (!staff) {
        throw new Error('Staff member not found');
      }

      request.assignedStaffId = staffId;
      request.assignedStaffName = `${staff.firstName} ${staff.lastName}`;
      request.updatedAt = Date.now();

      // Add admin note about assignment
      request.adminNotes.push({
        staffId: assignedByStaffId,
        staffName: assignedByStaffName,
        note: `Assigned to: ${staff.firstName} ${staff.lastName}`,
        createdAt: Date.now(),
      });

      await request.save();
      console.log(`RepairRequestService: Staff assigned successfully`);

      return request;
    } catch (error) {
      console.error('RepairRequestService: Error assigning staff:', error);
      throw error;
    }
  }

  /**
   * Add a message to the communication thread
   */
  static async addMessage(requestId, senderId, senderName, senderRole, message) {
    try {
      console.log(`RepairRequestService: Adding message to request ${requestId}`);

      const request = await RepairRequest.findById(requestId);
      if (!request) {
        throw new Error('Repair request not found');
      }

      request.messages.push({
        senderId,
        senderName,
        senderRole,
        message,
        sentAt: Date.now(),
        isRead: false,
      });

      request.updatedAt = Date.now();
      await request.save();

      console.log(`RepairRequestService: Message added successfully`);

      if (String(senderRole || '').toLowerCase() !== 'customer') {
        setImmediate(async () => {
          try {
            await EmailService.sendTriggerEmail('repair_request_message', request.customerEmail, {
              companyName: process.env.COMPANY_NAME || 'McRepair.de',
              customerName: request.customerName,
              requestNumber: request.requestNumber,
              deviceBrand: request.deviceBrand,
              deviceModel: request.deviceModel,
              senderName: senderName || 'Service Team',
              messageSentAt: new Date().toLocaleString('de-DE'),
              requestUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/repair-requests/${request._id}`,
              supportEmail: process.env.SUPPORT_EMAIL || 'support@fixithub.com',
              supportPhone: process.env.SUPPORT_PHONE || '+49 (0) 123/456789'
            });
          } catch (notificationError) {
            console.error('RepairRequestService: Error sending repair request message email:', notificationError.message);
          }
        });
      }

      return request;
    } catch (error) {
      console.error('RepairRequestService: Error adding message:', error);
      throw error;
    }
  }

  /**
   * Mark messages as read
   */
  static async markMessagesAsRead(requestId, userId) {
    try {
      console.log(`RepairRequestService: Marking messages as read for request ${requestId}`);

      const request = await RepairRequest.findById(requestId);
      if (!request) {
        throw new Error('Repair request not found');
      }

      // Mark all messages not sent by the current user as read
      request.messages.forEach(msg => {
        if (msg.senderId.toString() !== userId.toString() && !msg.isRead) {
          msg.isRead = true;
        }
      });

      await request.save();

      return request;
    } catch (error) {
      console.error('RepairRequestService: Error marking messages as read:', error);
      throw error;
    }
  }

  /**
   * Add admin note
   */
  static async addAdminNote(requestId, staffId, staffName, note) {
    try {
      console.log(`RepairRequestService: Adding admin note to request ${requestId}`);

      const request = await RepairRequest.findById(requestId);
      if (!request) {
        throw new Error('Repair request not found');
      }

      request.adminNotes.push({
        staffId,
        staffName,
        note,
        createdAt: Date.now(),
      });

      request.updatedAt = Date.now();
      await request.save();

      console.log(`RepairRequestService: Admin note added successfully`);

      return request;
    } catch (error) {
      console.error('RepairRequestService: Error adding admin note:', error);
      throw error;
    }
  }

  /**
   * Update priority
   */
  static async updatePriority(requestId, priority, staffId, staffName) {
    try {
      console.log(`RepairRequestService: Updating priority of request ${requestId} to ${priority}`);

      const request = await RepairRequest.findById(requestId);
      if (!request) {
        throw new Error('Repair request not found');
      }

      request.priority = priority;
      request.updatedAt = Date.now();

      // Add admin note about priority change
      request.adminNotes.push({
        staffId,
        staffName,
        note: `Priority changed to: ${priority}`,
        createdAt: Date.now(),
      });

      await request.save();

      return request;
    } catch (error) {
      console.error('RepairRequestService: Error updating priority:', error);
      throw error;
    }
  }

  /**
   * Update estimated cost
   */
  static async updateEstimatedCost(requestId, estimatedCost, staffId, staffName) {
    try {
      console.log(`RepairRequestService: Updating estimated cost of request ${requestId} to ${estimatedCost}`);

      const request = await RepairRequest.findById(requestId);
      if (!request) {
        throw new Error('Repair request not found');
      }

      request.estimatedCost = estimatedCost;
      request.updatedAt = Date.now();

      // Add admin note about cost estimate
      request.adminNotes.push({
        staffId,
        staffName,
        note: `Estimated cost set to: $${estimatedCost}`,
        createdAt: Date.now(),
      });

      await request.save();

      return request;
    } catch (error) {
      console.error('RepairRequestService: Error updating estimated cost:', error);
      throw error;
    }
  }

  /**
   * Convert repair request to an order
   */
  static async convertToOrder(requestId, orderData, staffId, staffName) {
    try {
      console.log(`RepairRequestService: Converting request ${requestId} to order`);
      console.log('Order data received:', JSON.stringify(orderData));

      const request = await RepairRequest.findById(requestId);
      if (!request) {
        throw new Error('Repair request not found');
      }

      if (request.status === 'converted') {
        throw new Error('Repair request has already been converted to an order');
      }

      // Transform service IDs into proper service objects
      let formattedServices = [];
      if (orderData.services && orderData.services.length > 0) {
        console.log(`RepairRequestService: Fetching ${orderData.services.length} services`);

        // Fetch all services in one query
        const serviceIds = orderData.services;
        const services = await Service.find({ _id: { $in: serviceIds } });

        if (services.length !== serviceIds.length) {
          console.warn(`RepairRequestService: Found ${services.length} services out of ${serviceIds.length} requested`);
        }

        // Transform services into the format expected by Order model
        formattedServices = services.map(service => {
          const estimatedTimeInMinutes = RepairRequestService.parseEstimatedTime(service.estimatedTime);
          console.log(`RepairRequestService: Service "${service.name}" - Original time: "${service.estimatedTime}", Parsed to: ${estimatedTimeInMinutes} minutes`);

          return {
            serviceId: service._id,
            price: service.price || 0,
            estimatedTime: estimatedTimeInMinutes,
            notes: ''
          };
        });

        console.log(`RepairRequestService: Formatted ${formattedServices.length} services for order`);
      }

      // Create the order with formatted services
      const order = new Order({
        customerId: request.customerId,
        deviceType: request.deviceType,
        deviceBrand: request.deviceBrand,
        deviceModel: request.deviceModel,
        services: formattedServices,
        addOns: orderData.addOns || [],
        customerNotes: `Converted from Repair Request: ${request.requestNumber}\n\nIssue: ${request.issueDescription}`,
        photos: request.images,
        totalCost: orderData.totalCost || request.estimatedCost || 0,
        status: 'pending',
        paymentStatus: 'pending',
      });

      await order.save();
      console.log(`RepairRequestService: Created order: ${order.orderNumber}`);

      // Create a booking for the order
      console.log(`RepairRequestService: Creating booking for order ${order.orderNumber}`);
      let booking = null;
      try {
        booking = await BookingService.create({
          customerId: request.customerId,
          orderIds: [order._id],
          status: 'pending',
          billingStatus: 'unpaid',
          paymentStatus: 'pending',
          discount: 0,
        });
        console.log(`RepairRequestService: Created booking: ${booking.bookingNumber}`);

        // Update order with booking reference
        order.bookingId = booking._id;
        await order.save();
        console.log(`RepairRequestService: Updated order with bookingId: ${booking._id}`);
      } catch (bookingError) {
        console.error('RepairRequestService: Error creating booking (non-fatal):', bookingError);
        console.error('RepairRequestService: Order created successfully but booking creation failed');
        // Continue even if booking creation fails - the order is still valid
      }

      // Update repair request
      request.status = 'converted';
      request.convertedToOrderId = order._id;
      request.convertedAt = Date.now();
      request.convertedByStaffId = staffId;
      request.convertedByStaffName = staffName;

      const noteText = booking
        ? `Converted to order: ${order.orderNumber} (Booking: ${booking.bookingNumber})`
        : `Converted to order: ${order.orderNumber}`;

      request.adminNotes.push({
        staffId,
        staffName,
        note: noteText,
        createdAt: Date.now(),
      });

      await request.save();

      console.log(`RepairRequestService: Repair request converted successfully`);

      return { request, order, booking };
    } catch (error) {
      console.error('RepairRequestService: Error converting to order:', error);
      throw error;
    }
  }

  /**
   * Get statistics
   */
  static async getStatistics() {
    try {
      console.log('RepairRequestService: Getting statistics');

      const [
        total,
        pending,
        reviewing,
        approved,
        rejected,
        converted,
        highPriority,
        unassigned,
      ] = await Promise.all([
        RepairRequest.countDocuments(),
        RepairRequest.countDocuments({ status: 'pending' }),
        RepairRequest.countDocuments({ status: 'reviewing' }),
        RepairRequest.countDocuments({ status: 'approved' }),
        RepairRequest.countDocuments({ status: 'rejected' }),
        RepairRequest.countDocuments({ status: 'converted' }),
        RepairRequest.countDocuments({ priority: { $in: ['high', 'urgent'] } }),
        RepairRequest.countDocuments({ assignedStaffId: { $exists: false } }),
      ]);

      return {
        total,
        byStatus: {
          pending,
          reviewing,
          approved,
          rejected,
          converted,
        },
        highPriority,
        unassigned,
      };
    } catch (error) {
      console.error('RepairRequestService: Error getting statistics:', error);
      throw error;
    }
  }

  /**
   * Delete a repair request (soft delete - only for non-converted requests)
   */
  static async deleteRepairRequest(requestId) {
    try {
      console.log(`RepairRequestService: Deleting repair request: ${requestId}`);

      const request = await RepairRequest.findById(requestId);
      if (!request) {
        throw new Error('Repair request not found');
      }

      if (request.status === 'converted') {
        throw new Error('Cannot delete a repair request that has been converted to an order');
      }

      await RepairRequest.findByIdAndDelete(requestId);
      console.log(`RepairRequestService: Repair request deleted successfully`);

      return { success: true };
    } catch (error) {
      console.error('RepairRequestService: Error deleting repair request:', error);
      throw error;
    }
  }
}

module.exports = RepairRequestService;
