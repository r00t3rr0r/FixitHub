const express = require('express');
const OrderService = require('../services/orderService');
const { requireUser } = require('./middleware/auth');

const router = express.Router();

// Middleware to check if user is admin or staff
const requireAdminOrStaff = (req, res, next) => {
  if (!req.user || !['admin', 'staff'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Access denied. Admin or staff role required.' });
  }
  next();
};

// Get all orders (admin/staff)
router.get('/', requireUser, requireAdminOrStaff, async (req, res) => {
  console.log('Admin get all orders request received from user:', req.user.email);

  try {
    const filters = {
      search: req.query.search,
      status: req.query.status,
      priority: req.query.priority,
      deviceType: req.query.deviceType,
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
      assignedStaff: req.query.assignedStaff,
      page: req.query.page,
      limit: req.query.limit
    };

    const result = await OrderService.getAll(filters);

    return res.status(200).json(result);
  } catch (error) {
    console.error('Error getting admin orders:', error);
    return res.status(500).json({ 
      error: error.message || 'Failed to get orders' 
    });
  }
});

// Get single order by ID (admin/staff)
router.get('/:id', requireUser, requireAdminOrStaff, async (req, res) => {
  console.log('Admin get order by ID request received:', req.params.id);

  try {
    const order = await OrderService.getById(req.params.id);

    return res.status(200).json({ order });
  } catch (error) {
    console.error('Error getting admin order by ID:', error);
    if (error.message === 'Order not found') {
      return res.status(404).json({ error: error.message });
    }
    return res.status(500).json({ 
      error: error.message || 'Failed to get order' 
    });
  }
});

// Update order status (admin/staff)
router.put('/:id/status', requireUser, requireAdminOrStaff, async (req, res) => {
  console.log('Update order status request received:', req.params.id, req.body);

  try {
    const { status, note } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    const validStatuses = ['pending', 'in-progress', 'quality-check', 'completed', 'ready-for-pickup', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const order = await OrderService.updateStatus(req.params.id, status, note, req.user._id);

    return res.status(200).json({
      success: true,
      message: 'Order status updated successfully',
      order
    });
  } catch (error) {
    console.error('Error updating order status:', error);
    if (error.message === 'Order not found') {
      return res.status(404).json({ error: error.message });
    }
    return res.status(500).json({ 
      error: error.message || 'Failed to update order status' 
    });
  }
});

// Assign staff to order (admin/staff)
router.put('/:id/assign', requireUser, requireAdminOrStaff, async (req, res) => {
  console.log('Assign staff to order request received:', req.params.id, req.body);

  try {
    const { staffIds } = req.body;

    if (!staffIds || !Array.isArray(staffIds) || staffIds.length === 0) {
      return res.status(400).json({ error: 'Staff IDs are required' });
    }

    await OrderService.assignStaff(req.params.id, staffIds);

    return res.status(200).json({
      success: true,
      message: 'Staff assigned successfully'
    });
  } catch (error) {
    console.error('Error assigning staff to order:', error);
    if (error.message === 'Order not found') {
      return res.status(404).json({ error: error.message });
    }
    return res.status(500).json({ 
      error: error.message || 'Failed to assign staff' 
    });
  }
});

// Add staff note to order (admin/staff)
router.post('/:id/notes', requireUser, requireAdminOrStaff, async (req, res) => {
  console.log('Add note to order request received:', req.params.id, req.body);

  try {
    const { note, type } = req.body;

    if (!note) {
      return res.status(400).json({ error: 'Note is required' });
    }

    const validTypes = ['general', 'technical', 'customer', 'internal'];
    const noteType = type && validTypes.includes(type) ? type : 'general';

    const newNote = await OrderService.addNote(req.params.id, note, noteType, req.user._id);

    return res.status(201).json({
      success: true,
      message: 'Note added successfully',
      note: newNote
    });
  } catch (error) {
    console.error('Error adding note to order:', error);
    if (error.message === 'Order not found') {
      return res.status(404).json({ error: error.message });
    }
    return res.status(500).json({
      error: error.message || 'Failed to add note'
    });
  }
});

// Assign EPart to order (admin/staff)
router.post('/:id/eparts', requireUser, requireAdminOrStaff, async (req, res) => {
  console.log('Assign EPart to order request received:', req.params.id, req.body);

  try {
    const { partId, versionId, quantity } = req.body;

    if (!partId || !versionId || !quantity) {
      return res.status(400).json({ error: 'Part ID, version ID, and quantity are required' });
    }

    if (quantity <= 0) {
      return res.status(400).json({ error: 'Quantity must be greater than 0' });
    }

    const order = await OrderService.assignEPart(
      req.params.id,
      partId,
      versionId,
      quantity,
      req.user._id
    );

    return res.status(200).json({
      success: true,
      message: 'EPart assigned successfully',
      order
    });
  } catch (error) {
    console.error('Error assigning EPart to order:', error);
    if (error.message === 'Order not found' || error.message === 'Part not found') {
      return res.status(404).json({ error: error.message });
    }
    return res.status(400).json({
      error: error.message || 'Failed to assign EPart'
    });
  }
});

// Remove EPart from order (admin/staff)
router.delete('/:id/eparts/:ePartId', requireUser, requireAdminOrStaff, async (req, res) => {
  console.log('Remove EPart from order request received:', req.params.id, req.params.ePartId);

  try {
    const order = await OrderService.removeEPart(
      req.params.id,
      req.params.ePartId,
      req.user._id
    );

    return res.status(200).json({
      success: true,
      message: 'EPart removed successfully',
      order
    });
  } catch (error) {
    console.error('Error removing EPart from order:', error);
    if (error.message === 'Order not found' || error.message === 'EPart not found in order') {
      return res.status(404).json({ error: error.message });
    }
    return res.status(500).json({
      error: error.message || 'Failed to remove EPart'
    });
  }
});

// Update EPart status (admin/staff)
router.put('/:id/eparts/:ePartId/status', requireUser, requireAdminOrStaff, async (req, res) => {
  console.log('Update EPart status request received:', req.params.id, req.params.ePartId, req.body);

  try {
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    const validStatuses = ['pending', 'allocated', 'used'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const order = await OrderService.updateEPartStatus(
      req.params.id,
      req.params.ePartId,
      status,
      req.user._id
    );

    return res.status(200).json({
      success: true,
      message: 'EPart status updated successfully',
      order
    });
  } catch (error) {
    console.error('Error updating EPart status:', error);
    if (error.message === 'Order not found' || error.message === 'EPart not found in order') {
      return res.status(404).json({ error: error.message });
    }
    return res.status(500).json({
      error: error.message || 'Failed to update EPart status'
    });
  }
});

// Description: Add add-on service to order
// Endpoint: POST /api/admin/orders/:id/addons
// Request: { name: string, description?: string, price: number, estimatedTime?: string, status?: string }
// Response: { success: boolean, message: string, order: Order }
router.post('/:id/addons', requireUser, requireAdminOrStaff, async (req, res) => {
  console.log('Add add-on to order request received:', req.params.id, req.body);

  try {
    const { name, description, price, estimatedTime, status } = req.body;

    if (!name || price === undefined) {
      return res.status(400).json({ error: 'Name and price are required' });
    }

    if (typeof price !== 'number' || price < 0) {
      return res.status(400).json({ error: 'Price must be a positive number' });
    }

    const order = await OrderService.addAddonToOrder(
      req.params.id,
      { name, description, price, estimatedTime, status },
      req.user._id
    );

    return res.status(200).json({
      success: true,
      message: 'Add-on service added successfully',
      order
    });
  } catch (error) {
    console.error('Error adding add-on to order:', error);
    if (error.message === 'Order not found') {
      return res.status(404).json({ error: error.message });
    }
    return res.status(500).json({
      error: error.message || 'Failed to add add-on service'
    });
  }
});

// Description: Update add-on service in order
// Endpoint: PUT /api/admin/orders/:id/addons/:addonId
// Request: { name?: string, description?: string, price?: number, estimatedTime?: string, status?: string, progress?: number }
// Response: { success: boolean, message: string, order: Order }
router.put('/:id/addons/:addonId', requireUser, requireAdminOrStaff, async (req, res) => {
  console.log('Update add-on in order request received:', req.params.id, req.params.addonId, req.body);

  try {
    const { name, description, price, estimatedTime, status, progress } = req.body;

    if (price !== undefined && (typeof price !== 'number' || price < 0)) {
      return res.status(400).json({ error: 'Price must be a positive number' });
    }

    if (status && !['pending', 'in-progress', 'completed'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    if (progress !== undefined && (typeof progress !== 'number' || progress < 0 || progress > 100)) {
      return res.status(400).json({ error: 'Progress must be between 0 and 100' });
    }

    const order = await OrderService.updateOrderAddon(
      req.params.id,
      req.params.addonId,
      { name, description, price, estimatedTime, status, progress },
      req.user._id
    );

    return res.status(200).json({
      success: true,
      message: 'Add-on service updated successfully',
      order
    });
  } catch (error) {
    console.error('Error updating add-on in order:', error);
    if (error.message === 'Order not found' || error.message === 'Add-on not found in order') {
      return res.status(404).json({ error: error.message });
    }
    return res.status(500).json({
      error: error.message || 'Failed to update add-on service'
    });
  }
});

// Description: Remove add-on service from order
// Endpoint: DELETE /api/admin/orders/:id/addons/:addonId
// Request: {}
// Response: { success: boolean, message: string, order: Order }
router.delete('/:id/addons/:addonId', requireUser, requireAdminOrStaff, async (req, res) => {
  console.log('Remove add-on from order request received:', req.params.id, req.params.addonId);

  try {
    const order = await OrderService.removeAddonFromOrder(
      req.params.id,
      req.params.addonId,
      req.user._id
    );

    return res.status(200).json({
      success: true,
      message: 'Add-on service removed successfully',
      order
    });
  } catch (error) {
    console.error('Error removing add-on from order:', error);
    if (error.message === 'Order not found' || error.message === 'Add-on not found in order') {
      return res.status(404).json({ error: error.message });
    }
    return res.status(500).json({
      error: error.message || 'Failed to remove add-on service'
    });
  }
});

// Description: Assign staff to add-on service
// Endpoint: PUT /api/admin/orders/:id/addons/:addonId/assign
// Request: { staffId: string }
// Response: { success: boolean, message: string, order: Order }
router.put('/:id/addons/:addonId/assign', requireUser, requireAdminOrStaff, async (req, res) => {
  console.log('Assign staff to add-on request received:', req.params.id, req.params.addonId, req.body);

  try {
    const { staffId } = req.body;

    if (!staffId) {
      return res.status(400).json({ error: 'Staff ID is required' });
    }

    const order = await OrderService.assignStaffToAddon(
      req.params.id,
      req.params.addonId,
      staffId,
      req.user._id
    );

    return res.status(200).json({
      success: true,
      message: 'Staff assigned to add-on service successfully',
      order
    });
  } catch (error) {
    console.error('Error assigning staff to add-on:', error);
    if (error.message === 'Order not found' || error.message === 'Add-on not found in order') {
      return res.status(404).json({ error: error.message });
    }
    return res.status(500).json({
      error: error.message || 'Failed to assign staff to add-on service'
    });
  }
});

module.exports = router;