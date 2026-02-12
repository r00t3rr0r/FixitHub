const RepairRequest = require('../models/RepairRequest');
const Order = require('../models/Order');
const User = require('../models/User');
const mongoose = require('mongoose');

class RepairRequestService {
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
        repairAttempts: data.repairAttempts,
        additionalInfo: data.additionalInfo || '',
        images: data.images || [],
        reviewDeadline,
      });

      await repairRequest.save();
      console.log(`RepairRequestService: Created repair request: ${repairRequest.requestNumber}`);

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

      const request = await RepairRequest.findById(requestId);
      if (!request) {
        throw new Error('Repair request not found');
      }

      if (request.status === 'converted') {
        throw new Error('Repair request has already been converted to an order');
      }

      // Create the order with provided data
      const order = new Order({
        customerId: request.customerId,
        deviceType: request.deviceType,
        deviceBrand: request.deviceBrand,
        deviceModel: request.deviceModel,
        services: orderData.services || [],
        addOns: orderData.addOns || [],
        customerNotes: `Converted from Repair Request: ${request.requestNumber}\n\nIssue: ${request.issueDescription}`,
        photos: request.images,
        totalCost: orderData.totalCost || request.estimatedCost || 0,
        status: 'pending',
        paymentStatus: 'pending',
      });

      await order.save();
      console.log(`RepairRequestService: Created order: ${order.orderNumber}`);

      // Update repair request
      request.status = 'converted';
      request.convertedToOrderId = order._id;
      request.convertedAt = Date.now();
      request.convertedByStaffId = staffId;
      request.convertedByStaffName = staffName;

      request.adminNotes.push({
        staffId,
        staffName,
        note: `Converted to order: ${order.orderNumber}`,
        createdAt: Date.now(),
      });

      await request.save();

      console.log(`RepairRequestService: Repair request converted successfully`);

      return { request, order };
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
