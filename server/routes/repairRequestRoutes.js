const express = require('express');
const router = express.Router();
const RepairRequestService = require('../services/repairRequestService');
const { requireUser, requireAdmin, requireStaff } = require('./middleware/auth');

// Description: Create a new repair request
// Endpoint: POST /api/repair-requests
// Request: { deviceType, deviceBrand, deviceModel, deviceModelId, issueDescription, issueOccurredDate, repairAttempts, additionalInfo, images }
// Response: { success: true, request: RepairRequest }
router.post('/', requireUser, async (req, res) => {
  try {
    console.log('POST /api/repair-requests - Create repair request');
    console.log('Request body:', req.body);

    const customerId = req.user._id;
    const request = await RepairRequestService.createRepairRequest(customerId, req.body);

    res.status(201).json({
      success: true,
      request,
      message: 'Repair request submitted successfully',
    });
  } catch (error) {
    console.error('Error creating repair request:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create repair request',
    });
  }
});

// Description: Get all repair requests with filtering and pagination
// Endpoint: GET /api/repair-requests
// Request: { status?, priority?, customerId?, assignedStaffId?, search?, page?, limit?, sortBy?, sortOrder? }
// Response: { success: true, requests: RepairRequest[], pagination: Pagination }
router.get('/', requireStaff, async (req, res) => {
  try {
    console.log('GET /api/repair-requests - Get all repair requests');
    console.log('Query params:', req.query);

    const filters = {
      status: req.query.status,
      priority: req.query.priority,
      customerId: req.query.customerId,
      assignedStaffId: req.query.assignedStaffId,
      search: req.query.search,
    };

    const pagination = {
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 20,
      sortBy: req.query.sortBy || 'createdAt',
      sortOrder: req.query.sortOrder || 'desc',
    };

    const result = await RepairRequestService.getRepairRequests(filters, pagination);

    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('Error getting repair requests:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get repair requests',
    });
  }
});

// Description: Get customer's own repair requests
// Endpoint: GET /api/repair-requests/my-requests
// Request: {}
// Response: { success: true, requests: RepairRequest[] }
router.get('/my-requests', requireUser, async (req, res) => {
  try {
    console.log('GET /api/repair-requests/my-requests - Get customer repair requests');

    const customerId = req.user._id;
    const result = await RepairRequestService.getRepairRequests(
      { customerId },
      { page: 1, limit: 100, sortBy: 'createdAt', sortOrder: 'desc' }
    );

    res.status(200).json({
      success: true,
      requests: result.requests,
    });
  } catch (error) {
    console.error('Error getting customer repair requests:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get repair requests',
    });
  }
});

// Description: Get repair request statistics
// Endpoint: GET /api/repair-requests/statistics
// Request: {}
// Response: { success: true, statistics: Statistics }
router.get('/statistics', requireStaff, async (req, res) => {
  try {
    console.log('GET /api/repair-requests/statistics - Get statistics');

    const statistics = await RepairRequestService.getStatistics();

    res.status(200).json({
      success: true,
      statistics,
    });
  } catch (error) {
    console.error('Error getting statistics:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get statistics',
    });
  }
});

// Description: Get a single repair request by ID
// Endpoint: GET /api/repair-requests/:id
// Request: {}
// Response: { success: true, request: RepairRequest }
router.get('/:id', requireUser, async (req, res) => {
  try {
    console.log(`GET /api/repair-requests/${req.params.id} - Get repair request`);

    const request = await RepairRequestService.getRepairRequestById(req.params.id);

    // Check access permissions
    const isCustomer = req.user._id.toString() === request.customerId._id.toString();
    const isStaff = ['staff', 'admin'].includes(req.user.role);
    const isAssignedStaff = request.assignedStaffId && req.user._id.toString() === request.assignedStaffId._id.toString();

    if (!isCustomer && !isStaff && !isAssignedStaff) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    res.status(200).json({
      success: true,
      request,
    });
  } catch (error) {
    console.error('Error getting repair request:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get repair request',
    });
  }
});

// Description: Update repair request status
// Endpoint: PUT /api/repair-requests/:id/status
// Request: { status: string }
// Response: { success: true, request: RepairRequest }
router.put('/:id/status', requireStaff, async (req, res) => {
  try {
    console.log(`PUT /api/repair-requests/${req.params.id}/status - Update status`);
    console.log('Request body:', req.body);

    const { status } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Status is required',
      });
    }

    const staffId = req.user._id;
    const staffName = `${req.user.firstName} ${req.user.lastName}`;

    const request = await RepairRequestService.updateStatus(
      req.params.id,
      status,
      staffId,
      staffName
    );

    res.status(200).json({
      success: true,
      request,
      message: 'Status updated successfully',
    });
  } catch (error) {
    console.error('Error updating status:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update status',
    });
  }
});

// Description: Assign staff to repair request
// Endpoint: PUT /api/repair-requests/:id/assign
// Request: { staffId: string }
// Response: { success: true, request: RepairRequest }
router.put('/:id/assign', requireAdmin, async (req, res) => {
  try {
    console.log(`PUT /api/repair-requests/${req.params.id}/assign - Assign staff`);
    console.log('Request body:', req.body);

    const { staffId } = req.body;

    if (!staffId) {
      return res.status(400).json({
        success: false,
        message: 'Staff ID is required',
      });
    }

    const assignedByStaffId = req.user._id;
    const assignedByStaffName = `${req.user.firstName} ${req.user.lastName}`;

    const request = await RepairRequestService.assignStaff(
      req.params.id,
      staffId,
      assignedByStaffId,
      assignedByStaffName
    );

    res.status(200).json({
      success: true,
      request,
      message: 'Staff assigned successfully',
    });
  } catch (error) {
    console.error('Error assigning staff:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to assign staff',
    });
  }
});

// Description: Add a message to the communication thread
// Endpoint: POST /api/repair-requests/:id/messages
// Request: { message: string }
// Response: { success: true, request: RepairRequest }
router.post('/:id/messages', requireUser, async (req, res) => {
  try {
    console.log(`POST /api/repair-requests/${req.params.id}/messages - Add message`);
    console.log('Request body:', req.body);

    const { message } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        message: 'Message is required',
      });
    }

    const senderId = req.user._id;
    const senderName = `${req.user.firstName} ${req.user.lastName}`;
    const senderRole = req.user.role;

    const request = await RepairRequestService.addMessage(
      req.params.id,
      senderId,
      senderName,
      senderRole,
      message
    );

    res.status(201).json({
      success: true,
      request,
      message: 'Message added successfully',
    });
  } catch (error) {
    console.error('Error adding message:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to add message',
    });
  }
});

// Description: Mark messages as read
// Endpoint: PUT /api/repair-requests/:id/messages/read
// Request: {}
// Response: { success: true, request: RepairRequest }
router.put('/:id/messages/read', requireUser, async (req, res) => {
  try {
    console.log(`PUT /api/repair-requests/${req.params.id}/messages/read - Mark messages as read`);

    const userId = req.user._id;
    const request = await RepairRequestService.markMessagesAsRead(req.params.id, userId);

    res.status(200).json({
      success: true,
      request,
    });
  } catch (error) {
    console.error('Error marking messages as read:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to mark messages as read',
    });
  }
});

// Description: Add admin note
// Endpoint: POST /api/repair-requests/:id/admin-notes
// Request: { note: string }
// Response: { success: true, request: RepairRequest }
router.post('/:id/admin-notes', requireStaff, async (req, res) => {
  try {
    console.log(`POST /api/repair-requests/${req.params.id}/admin-notes - Add admin note`);
    console.log('Request body:', req.body);

    const { note } = req.body;

    if (!note) {
      return res.status(400).json({
        success: false,
        message: 'Note is required',
      });
    }

    const staffId = req.user._id;
    const staffName = `${req.user.firstName} ${req.user.lastName}`;

    const request = await RepairRequestService.addAdminNote(
      req.params.id,
      staffId,
      staffName,
      note
    );

    res.status(201).json({
      success: true,
      request,
      message: 'Admin note added successfully',
    });
  } catch (error) {
    console.error('Error adding admin note:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to add admin note',
    });
  }
});

// Description: Update priority
// Endpoint: PUT /api/repair-requests/:id/priority
// Request: { priority: string }
// Response: { success: true, request: RepairRequest }
router.put('/:id/priority', requireStaff, async (req, res) => {
  try {
    console.log(`PUT /api/repair-requests/${req.params.id}/priority - Update priority`);
    console.log('Request body:', req.body);

    const { priority } = req.body;

    if (!priority) {
      return res.status(400).json({
        success: false,
        message: 'Priority is required',
      });
    }

    const staffId = req.user._id;
    const staffName = `${req.user.firstName} ${req.user.lastName}`;

    const request = await RepairRequestService.updatePriority(
      req.params.id,
      priority,
      staffId,
      staffName
    );

    res.status(200).json({
      success: true,
      request,
      message: 'Priority updated successfully',
    });
  } catch (error) {
    console.error('Error updating priority:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update priority',
    });
  }
});

// Description: Update estimated cost
// Endpoint: PUT /api/repair-requests/:id/estimated-cost
// Request: { estimatedCost: number }
// Response: { success: true, request: RepairRequest }
router.put('/:id/estimated-cost', requireStaff, async (req, res) => {
  try {
    console.log(`PUT /api/repair-requests/${req.params.id}/estimated-cost - Update estimated cost`);
    console.log('Request body:', req.body);

    const { estimatedCost } = req.body;

    if (estimatedCost === undefined || estimatedCost === null) {
      return res.status(400).json({
        success: false,
        message: 'Estimated cost is required',
      });
    }

    const staffId = req.user._id;
    const staffName = `${req.user.firstName} ${req.user.lastName}`;

    const request = await RepairRequestService.updateEstimatedCost(
      req.params.id,
      estimatedCost,
      staffId,
      staffName
    );

    res.status(200).json({
      success: true,
      request,
      message: 'Estimated cost updated successfully',
    });
  } catch (error) {
    console.error('Error updating estimated cost:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update estimated cost',
    });
  }
});

// Description: Convert repair request to order
// Endpoint: POST /api/repair-requests/:id/convert
// Request: { services: string[], addOns: AddOn[], totalCost: number }
// Response: { success: true, request: RepairRequest, order: Order }
router.post('/:id/convert', requireStaff, async (req, res) => {
  try {
    console.log(`POST /api/repair-requests/${req.params.id}/convert - Convert to order`);
    console.log('Request body:', req.body);

    const staffId = req.user._id;
    const staffName = `${req.user.firstName} ${req.user.lastName}`;

    const { request, order } = await RepairRequestService.convertToOrder(
      req.params.id,
      req.body,
      staffId,
      staffName
    );

    res.status(201).json({
      success: true,
      request,
      order,
      message: 'Repair request converted to order successfully',
    });
  } catch (error) {
    console.error('Error converting to order:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to convert to order',
    });
  }
});

// Description: Delete repair request
// Endpoint: DELETE /api/repair-requests/:id
// Request: {}
// Response: { success: true }
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    console.log(`DELETE /api/repair-requests/${req.params.id} - Delete repair request`);

    await RepairRequestService.deleteRepairRequest(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Repair request deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting repair request:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to delete repair request',
    });
  }
});

module.exports = router;
