const Complaint = require('../models/Complaint');
const Booking = require('../models/Booking');
const Order = require('../models/Order');
const User = require('../models/User');

class ComplaintService {
  static buildActor(user) {
    if (!user) {
      return {
        actorId: null,
        actorName: 'System',
        actorRole: 'system'
      };
    }

    const actorName = user.firstName
      ? `${user.firstName} ${user.lastName || ''}`.trim()
      : (user.name || user.email || 'Unknown');

    return {
      actorId: user._id,
      actorName,
      actorRole: user.role || 'unknown'
    };
  }

  static appendLog(complaint, user, action, fromStatus, toStatus, notes = '', metadata = {}) {
    const actor = this.buildActor(user);
    complaint.complaintLogs.push({
      actorId: actor.actorId,
      actorName: actor.actorName,
      actorRole: actor.actorRole,
      action,
      fromStatus: fromStatus || '',
      toStatus: toStatus || '',
      notes,
      metadata
    });
  }

  // Create a new complaint
  static async create(complaintData) {
    console.log('ComplaintService: Creating new complaint with data:', complaintData);

    try {
      // Validate booking exists only when provided
      if (complaintData.bookingId) {
        const booking = await Booking.findById(complaintData.bookingId);
        if (!booking) {
          throw new Error('Booking not found');
        }
      }

      // Validate order exists only when provided
      if (complaintData.orderId) {
        const order = await Order.findById(complaintData.orderId);
        if (!order) {
          throw new Error('Order not found');
        }
      }

      // Validate customer exists
      const customer = await User.findById(complaintData.customerId);
      if (!customer) {
        throw new Error('Customer not found');
      }

      const complaint = new Complaint({
        bookingId: complaintData.bookingId,
        orderId: complaintData.orderId,
        customerId: complaintData.customerId,
        subject: complaintData.subject || 'Order Complaint',
        description: complaintData.description,
        category: complaintData.category || 'other',
        priority: complaintData.priority || 'medium',
        status: complaintData.status || 'open',
        workflowType: complaintData.workflowType || 'legacy',
        complaintReason: complaintData.complaintReason || '',
        shippingLabelUrl: complaintData.shippingLabelUrl || '',
        extraCosts: complaintData.extraCosts || 0,
        serviceFee: complaintData.serviceFee || 0,
        partialRefund: complaintData.partialRefund || 0,
        repairOffer: complaintData.repairOffer || undefined,
        comments: [{
          userId: complaintData.customerId,
          userName: `${customer.firstName || customer.name || ''} ${customer.lastName || ''}`.trim(),
          userRole: customer.role || 'customer',
          comment: complaintData.description,
          isInternal: false
        }],
        complaintLogs: complaintData.complaintLogs || []
      });

      const savedComplaint = await complaint.save();
      console.log('ComplaintService: Complaint created successfully with ID:', savedComplaint._id);

      return savedComplaint;
    } catch (error) {
      console.error('ComplaintService: Error creating complaint:', error);
      throw error;
    }
  }

  // Get complaint by ID
  static async getById(complaintId) {
    console.log('ComplaintService: Getting complaint:', complaintId);

    try {
      const complaint = await Complaint.findById(complaintId);

      if (!complaint) {
        console.log('ComplaintService: Complaint not found:', complaintId);
        return null;
      }

      console.log('ComplaintService: Complaint retrieved successfully');
      return complaint;
    } catch (error) {
      console.error('ComplaintService: Error getting complaint:', error);
      throw error;
    }
  }

  // Get all complaints for a booking
  static async getByBooking(bookingId) {
    console.log('ComplaintService: Getting complaints for booking:', bookingId);

    try {
      const complaints = await Complaint.find({ bookingId })
        .sort({ createdAt: -1 });

      console.log('ComplaintService: Found', complaints.length, 'complaints for booking');
      return complaints;
    } catch (error) {
      console.error('ComplaintService: Error getting complaints:', error);
      throw error;
    }
  }

  // Get all complaints (admin view)
  static async getAll(filters = {}) {
    console.log('ComplaintService: Getting all complaints with filters:', filters);

    try {
      const query = {};

      // Apply status filter
      if (filters.status) {
        query.status = filters.status;
      }

      // Apply category filter
      if (filters.category) {
        query.category = filters.category;
      }

      // Apply priority filter
      if (filters.priority) {
        query.priority = filters.priority;
      }

      const complaints = await Complaint.find(query)
        .sort({ createdAt: -1 })
        .limit(filters.limit || 50)
        .skip(filters.skip || 0);

      console.log('ComplaintService: Found', complaints.length, 'total complaints');
      return complaints;
    } catch (error) {
      console.error('ComplaintService: Error getting all complaints:', error);
      throw error;
    }
  }

  // Update complaint status
  static async updateStatus(complaintId, status, userId, userName, userRole) {
    console.log('ComplaintService: Updating complaint status:', complaintId, 'to:', status);

    try {
      const complaint = await Complaint.findById(complaintId);
      if (!complaint) {
        throw new Error('Complaint not found');
      }

      const previousStatus = complaint.status;
      complaint.status = status;

      // Add comment about status change
      complaint.comments.push({
        userId: userId,
        userName: userName,
        userRole: userRole,
        comment: `Status changed to ${status}`,
        isInternal: false
      });

      complaint.complaintLogs.push({
        actorId: userId,
        actorName: userName,
        actorRole: userRole,
        action: 'status_changed',
        fromStatus: previousStatus,
        toStatus: status,
        notes: `Status changed to ${status}`
      });

      const savedComplaint = await complaint.save();
      console.log('ComplaintService: Complaint status updated successfully');

      return savedComplaint;
    } catch (error) {
      console.error('ComplaintService: Error updating complaint status:', error);
      throw error;
    }
  }

  // Add comment to complaint
  static async addComment(complaintId, commentData) {
    console.log('ComplaintService: Adding comment to complaint:', complaintId);

    try {
      const complaint = await Complaint.findById(complaintId);
      if (!complaint) {
        throw new Error('Complaint not found');
      }

      complaint.comments.push({
        userId: commentData.userId,
        userName: commentData.userName,
        userRole: commentData.userRole,
        comment: commentData.comment,
        isInternal: commentData.isInternal || false
      });

      const savedComplaint = await complaint.save();
      console.log('ComplaintService: Comment added successfully');

      return savedComplaint;
    } catch (error) {
      console.error('ComplaintService: Error adding comment:', error);
      throw error;
    }
  }

  // Assign complaint to staff
  static async assign(complaintId, staffId, staffName) {
    console.log('ComplaintService: Assigning complaint:', complaintId, 'to:', staffId);

    try {
      const complaint = await Complaint.findById(complaintId);
      if (!complaint) {
        throw new Error('Complaint not found');
      }

      complaint.assignedTo = staffId;
      complaint.assignedToName = staffName;
      complaint.status = 'in-progress';

      const savedComplaint = await complaint.save();
      console.log('ComplaintService: Complaint assigned successfully');

      return savedComplaint;
    } catch (error) {
      console.error('ComplaintService: Error assigning complaint:', error);
      throw error;
    }
  }

  // Resolve complaint
  static async resolve(complaintId, resolution, userId) {
    console.log('ComplaintService: Resolving complaint:', complaintId);

    try {
      const complaint = await Complaint.findById(complaintId);
      if (!complaint) {
        throw new Error('Complaint not found');
      }

      complaint.status = 'resolved';
      complaint.resolution = resolution;
      complaint.resolvedAt = new Date();
      complaint.resolvedBy = userId;

      const savedComplaint = await complaint.save();
      console.log('ComplaintService: Complaint resolved successfully');

      return savedComplaint;
    } catch (error) {
      console.error('ComplaintService: Error resolving complaint:', error);
      throw error;
    }
  }

  // Close complaint
  static async close(complaintId) {
    console.log('ComplaintService: Closing complaint:', complaintId);

    try {
      const complaint = await Complaint.findById(complaintId);
      if (!complaint) {
        throw new Error('Complaint not found');
      }

      complaint.status = 'closed';

      const savedComplaint = await complaint.save();
      console.log('ComplaintService: Complaint closed successfully');

      return savedComplaint;
    } catch (error) {
      console.error('ComplaintService: Error closing complaint:', error);
      throw error;
    }
  }
}

module.exports = ComplaintService;
