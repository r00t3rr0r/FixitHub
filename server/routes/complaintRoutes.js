const express = require('express');
const router = express.Router();
const { requireUser, requireAdmin } = require('./middleware/auth');
const ComplaintService = require('../services/complaintService');

// Description: Get all complaints for a booking
// Endpoint: GET /api/complaints/booking/:bookingId
// Request: {}
// Response: { success: boolean, complaints: Complaint[] }
router.get('/booking/:bookingId', requireUser, async (req, res) => {
  try {
    console.log('ComplaintRoutes: Getting complaints for booking:', req.params.bookingId);

    const complaints = await ComplaintService.getByBooking(req.params.bookingId);

    console.log('ComplaintRoutes: Retrieved', complaints.length, 'complaints');

    res.json({
      success: true,
      complaints: complaints
    });
  } catch (error) {
    console.error('ComplaintRoutes: Error getting complaints:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Description: Get all complaints (admin only)
// Endpoint: GET /api/complaints
// Request: { status?: string, category?: string, priority?: string, limit?: number, skip?: number }
// Response: { success: boolean, complaints: Complaint[] }
router.get('/', requireAdmin, async (req, res) => {
  try {
    console.log('ComplaintRoutes: Getting all complaints');

    const { status, category, priority, limit = 50, skip = 0 } = req.query;

    const filters = {};
    if (status) filters.status = status;
    if (category) filters.category = category;
    if (priority) filters.priority = priority;
    filters.limit = parseInt(limit);
    filters.skip = parseInt(skip);

    const complaints = await ComplaintService.getAll(filters);

    console.log('ComplaintRoutes: Retrieved', complaints.length, 'complaints');

    res.json({
      success: true,
      complaints: complaints
    });
  } catch (error) {
    console.error('ComplaintRoutes: Error getting complaints:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Description: Get a specific complaint by ID
// Endpoint: GET /api/complaints/:id
// Request: {}
// Response: { success: boolean, complaint: Complaint }
router.get('/:id', requireUser, async (req, res) => {
  try {
    console.log('ComplaintRoutes: Getting complaint:', req.params.id);

    const complaint = await ComplaintService.getById(req.params.id);

    if (!complaint) {
      console.log('ComplaintRoutes: Complaint not found');
      return res.status(404).json({
        success: false,
        error: 'Complaint not found'
      });
    }

    console.log('ComplaintRoutes: Complaint retrieved successfully');

    res.json({
      success: true,
      complaint: complaint
    });
  } catch (error) {
    console.error('ComplaintRoutes: Error getting complaint:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Description: Create a new complaint
// Endpoint: POST /api/complaints
// Request: { bookingId: string, orderId?: string, customerId: string, subject: string, description: string, category: string, priority?: string }
// Response: { success: boolean, complaint: Complaint }
router.post('/', requireUser, async (req, res) => {
  try {
    console.log('ComplaintRoutes: Creating new complaint');

    const { bookingId, orderId, subject, description, category, priority } = req.body;

    if (!bookingId || !subject || !description || !category) {
      console.log('ComplaintRoutes: Missing required fields');
      return res.status(400).json({
        success: false,
        error: 'bookingId, subject, description, and category are required'
      });
    }

    const complaintData = {
      bookingId,
      orderId,
      customerId: req.user._id,
      subject,
      description,
      category,
      priority: priority || 'medium'
    };

    const complaint = await ComplaintService.create(complaintData);

    console.log('ComplaintRoutes: Complaint created successfully:', complaint._id);

    res.status(201).json({
      success: true,
      complaint: complaint
    });
  } catch (error) {
    console.error('ComplaintRoutes: Error creating complaint:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Description: Update complaint status
// Endpoint: PUT /api/complaints/:id/status
// Request: { status: string }
// Response: { success: boolean, complaint: Complaint }
router.put('/:id/status', requireAdmin, async (req, res) => {
  try {
    console.log('ComplaintRoutes: Updating complaint status:', req.params.id);

    const { status } = req.body;

    if (!status) {
      console.log('ComplaintRoutes: Missing status');
      return res.status(400).json({
        success: false,
        error: 'status is required'
      });
    }

    const validStatuses = ['open', 'in-progress', 'pending-customer', 'resolved', 'closed'];
    if (!validStatuses.includes(status)) {
      console.log('ComplaintRoutes: Invalid status:', status);
      return res.status(400).json({
        success: false,
        error: `status must be one of: ${validStatuses.join(', ')}`
      });
    }

    const userName = req.user.firstName
      ? `${req.user.firstName} ${req.user.lastName || ''}`
      : (req.user.name || req.user.email);

    const complaint = await ComplaintService.updateStatus(
      req.params.id,
      status,
      req.user._id,
      userName,
      req.user.role
    );

    console.log('ComplaintRoutes: Complaint status updated successfully');

    res.json({
      success: true,
      complaint: complaint
    });
  } catch (error) {
    console.error('ComplaintRoutes: Error updating complaint status:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Description: Add comment to complaint
// Endpoint: POST /api/complaints/:id/comments
// Request: { comment: string, isInternal?: boolean }
// Response: { success: boolean, complaint: Complaint }
router.post('/:id/comments', requireUser, async (req, res) => {
  try {
    console.log('ComplaintRoutes: Adding comment to complaint:', req.params.id);

    const { comment, isInternal } = req.body;

    if (!comment) {
      console.log('ComplaintRoutes: Missing comment');
      return res.status(400).json({
        success: false,
        error: 'comment is required'
      });
    }

    const userName = req.user.firstName
      ? `${req.user.firstName} ${req.user.lastName || ''}`
      : (req.user.name || req.user.email);

    const commentData = {
      userId: req.user._id,
      userName: userName,
      userRole: req.user.role,
      comment: comment,
      isInternal: isInternal && (req.user.role === 'admin' || req.user.role === 'staff')
    };

    const updatedComplaint = await ComplaintService.addComment(req.params.id, commentData);

    console.log('ComplaintRoutes: Comment added successfully');

    res.json({
      success: true,
      complaint: updatedComplaint
    });
  } catch (error) {
    console.error('ComplaintRoutes: Error adding comment:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Description: Assign complaint to staff
// Endpoint: PUT /api/complaints/:id/assign
// Request: { staffId: string, staffName: string }
// Response: { success: boolean, complaint: Complaint }
router.put('/:id/assign', requireAdmin, async (req, res) => {
  try {
    console.log('ComplaintRoutes: Assigning complaint:', req.params.id);

    const { staffId, staffName } = req.body;

    if (!staffId || !staffName) {
      console.log('ComplaintRoutes: Missing staffId or staffName');
      return res.status(400).json({
        success: false,
        error: 'staffId and staffName are required'
      });
    }

    const complaint = await ComplaintService.assign(req.params.id, staffId, staffName);

    console.log('ComplaintRoutes: Complaint assigned successfully');

    res.json({
      success: true,
      complaint: complaint
    });
  } catch (error) {
    console.error('ComplaintRoutes: Error assigning complaint:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Description: Resolve complaint
// Endpoint: PUT /api/complaints/:id/resolve
// Request: { resolution: string }
// Response: { success: boolean, complaint: Complaint }
router.put('/:id/resolve', requireAdmin, async (req, res) => {
  try {
    console.log('ComplaintRoutes: Resolving complaint:', req.params.id);

    const { resolution } = req.body;

    if (!resolution) {
      console.log('ComplaintRoutes: Missing resolution');
      return res.status(400).json({
        success: false,
        error: 'resolution is required'
      });
    }

    const complaint = await ComplaintService.resolve(req.params.id, resolution, req.user._id);

    console.log('ComplaintRoutes: Complaint resolved successfully');

    res.json({
      success: true,
      complaint: complaint
    });
  } catch (error) {
    console.error('ComplaintRoutes: Error resolving complaint:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Description: Close complaint
// Endpoint: PUT /api/complaints/:id/close
// Request: {}
// Response: { success: boolean, complaint: Complaint }
router.put('/:id/close', requireAdmin, async (req, res) => {
  try {
    console.log('ComplaintRoutes: Closing complaint:', req.params.id);

    const complaint = await ComplaintService.close(req.params.id);

    console.log('ComplaintRoutes: Complaint closed successfully');

    res.json({
      success: true,
      complaint: complaint
    });
  } catch (error) {
    console.error('ComplaintRoutes: Error closing complaint:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
