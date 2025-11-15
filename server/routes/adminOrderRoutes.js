const express = require('express');
const OrderService = require('../services/orderService');
const DeviceChangeService = require('../services/deviceChangeService');
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

// ===== Workflow Execution Routes =====

// Description: Get suggested workflows for an order based on device type and services
// Endpoint: GET /api/admin/orders/:id/workflows/suggested
// Request: {}
// Response: { success: boolean, workflows: WorkflowTemplate[] }
router.get('/:id/workflows/suggested', requireUser, requireAdminOrStaff, async (req, res) => {
  console.log('Get suggested workflows for order request received:', req.params.id);

  try {
    const workflows = await OrderService.getSuggestedWorkflows(req.params.id);

    return res.status(200).json({
      success: true,
      workflows
    });
  } catch (error) {
    console.error('Error getting suggested workflows:', error);
    if (error.message === 'Order not found') {
      return res.status(404).json({ error: error.message });
    }
    return res.status(500).json({
      error: error.message || 'Failed to get suggested workflows'
    });
  }
});

// Description: Get workflows assigned to an order
// Endpoint: GET /api/admin/orders/:id/workflows
// Request: {}
// Response: { success: boolean, workflows: OrderWorkflow[] }
router.get('/:id/workflows', requireUser, requireAdminOrStaff, async (req, res) => {
  console.log('Get order workflows request received:', req.params.id);

  try {
    const workflows = await OrderService.getOrderWorkflows(req.params.id);

    return res.status(200).json({
      success: true,
      workflows
    });
  } catch (error) {
    console.error('Error getting order workflows:', error);
    if (error.message === 'Order not found') {
      return res.status(404).json({ error: error.message });
    }
    return res.status(500).json({
      error: error.message || 'Failed to get order workflows'
    });
  }
});

// Description: Assign workflow template to an order
// Endpoint: POST /api/admin/orders/:id/workflows
// Request: { workflowTemplateId: string }
// Response: { success: boolean, message: string, order: Order }
router.post('/:id/workflows', requireUser, requireAdminOrStaff, async (req, res) => {
  console.log('Assign workflow to order request received:', req.params.id, req.body);

  try {
    const { workflowTemplateId } = req.body;

    if (!workflowTemplateId) {
      return res.status(400).json({ error: 'Workflow template ID is required' });
    }

    const order = await OrderService.assignWorkflowToOrder(
      req.params.id,
      workflowTemplateId,
      req.user._id
    );

    return res.status(200).json({
      success: true,
      message: 'Workflow assigned to order successfully',
      order
    });
  } catch (error) {
    console.error('Error assigning workflow to order:', error);
    if (error.message === 'Order not found' || error.message === 'Workflow template not found') {
      return res.status(404).json({ error: error.message });
    }
    return res.status(400).json({
      error: error.message || 'Failed to assign workflow to order'
    });
  }
});

// Description: Start workflow execution
// Endpoint: POST /api/admin/orders/:id/workflows/:workflowId/start
// Request: {}
// Response: { success: boolean, message: string, order: Order }
router.post('/:id/workflows/:workflowId/start', requireUser, requireAdminOrStaff, async (req, res) => {
  console.log('Start workflow request received:', req.params.id, req.params.workflowId);

  try {
    const order = await OrderService.startWorkflow(
      req.params.id,
      req.params.workflowId,
      req.user._id
    );

    return res.status(200).json({
      success: true,
      message: 'Workflow started successfully',
      order
    });
  } catch (error) {
    console.error('Error starting workflow:', error);
    if (error.message === 'Order not found' || error.message === 'Workflow not found in order') {
      return res.status(404).json({ error: error.message });
    }
    return res.status(400).json({
      error: error.message || 'Failed to start workflow'
    });
  }
});

// Description: Complete workflow step
// Endpoint: POST /api/admin/orders/:id/workflows/:workflowId/steps/:stepId/complete
// Request: { formData?: object, checklistData?: object, notes?: string, photos?: string[] }
// Response: { success: boolean, message: string, order: Order }
router.post('/:id/workflows/:workflowId/steps/:stepId/complete', requireUser, requireAdminOrStaff, async (req, res) => {
  console.log('Complete workflow step request received:', req.params.id, req.params.workflowId, req.params.stepId, req.body);

  try {
    const { formData, checklistData, notes, photos } = req.body;

    const order = await OrderService.completeWorkflowStep(
      req.params.id,
      req.params.workflowId,
      req.params.stepId,
      { formData, checklistData, notes, photos },
      req.user._id
    );

    return res.status(200).json({
      success: true,
      message: 'Workflow step completed successfully',
      order
    });
  } catch (error) {
    console.error('Error completing workflow step:', error);
    if (error.message === 'Order not found' ||
        error.message === 'Workflow not found in order' ||
        error.message === 'Step not found in workflow') {
      return res.status(404).json({ error: error.message });
    }
    return res.status(400).json({
      error: error.message || 'Failed to complete workflow step'
    });
  }
});

// Description: Skip workflow step
// Endpoint: POST /api/admin/orders/:id/workflows/:workflowId/steps/:stepId/skip
// Request: { reason?: string }
// Response: { success: boolean, message: string, order: Order }
router.post('/:id/workflows/:workflowId/steps/:stepId/skip', requireUser, requireAdminOrStaff, async (req, res) => {
  console.log('Skip workflow step request received:', req.params.id, req.params.workflowId, req.params.stepId, req.body);

  try {
    const { reason } = req.body;

    const order = await OrderService.skipWorkflowStep(
      req.params.id,
      req.params.workflowId,
      req.params.stepId,
      reason,
      req.user._id
    );

    return res.status(200).json({
      success: true,
      message: 'Workflow step skipped successfully',
      order
    });
  } catch (error) {
    console.error('Error skipping workflow step:', error);
    if (error.message === 'Order not found' ||
        error.message === 'Workflow not found in order' ||
        error.message === 'Step not found in workflow') {
      return res.status(404).json({ error: error.message });
    }
    return res.status(400).json({
      error: error.message || 'Failed to skip workflow step'
    });
  }
});

// Description: Update workflow status (pause/resume)
// Endpoint: PUT /api/admin/orders/:id/workflows/:workflowId/status
// Request: { status: 'in-progress' | 'on-hold' }
// Response: { success: boolean, message: string, order: Order }
router.put('/:id/workflows/:workflowId/status', requireUser, requireAdminOrStaff, async (req, res) => {
  console.log('Update workflow status request received:', req.params.id, req.params.workflowId, req.body);

  try {
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    const order = await OrderService.updateWorkflowStatus(
      req.params.id,
      req.params.workflowId,
      status,
      req.user._id
    );

    return res.status(200).json({
      success: true,
      message: 'Workflow status updated successfully',
      order
    });
  } catch (error) {
    console.error('Error updating workflow status:', error);
    if (error.message === 'Order not found' || error.message === 'Workflow not found in order') {
      return res.status(404).json({ error: error.message });
    }
    return res.status(400).json({
      error: error.message || 'Failed to update workflow status'
    });
  }
});

// Description: Navigate back to previous step
// Endpoint: POST /api/admin/orders/:id/workflows/:workflowId/steps/:stepId/goto
// Request: {}
// Response: { success: boolean, message: string, order: Order }
router.post('/:id/workflows/:workflowId/steps/:stepId/goto', requireUser, requireAdminOrStaff, async (req, res) => {
  console.log('Go back to workflow step request received:', req.params.id, req.params.workflowId, req.params.stepId);

  try {
    const order = await OrderService.goBackToStep(
      req.params.id,
      req.params.workflowId,
      req.params.stepId,
      req.user._id
    );

    return res.status(200).json({
      success: true,
      message: 'Successfully navigated to step',
      order
    });
  } catch (error) {
    console.error('Error navigating to step:', error);
    if (error.message === 'Order not found' ||
        error.message === 'Workflow not found in order' ||
        error.message === 'Step not found in workflow') {
      return res.status(404).json({ error: error.message });
    }
    return res.status(400).json({
      error: error.message || 'Failed to navigate to step'
    });
  }
});

// Description: Update device information for an order
// Endpoint: PUT /api/admin/orders/:id/device
// Request: { deviceBrand: string, deviceModel: string, deviceType?: string }
// Response: { success: boolean, message: string, order: Order }
router.put('/:id/device', requireUser, requireAdminOrStaff, async (req, res) => {
  console.log('Update device information request received:', req.params.id, req.body);

  try {
    const { deviceBrand, deviceModel, deviceType } = req.body;

    // Validate required fields
    if (!deviceBrand || !deviceBrand.trim()) {
      return res.status(400).json({ error: 'Device brand is required' });
    }

    if (!deviceModel || !deviceModel.trim()) {
      return res.status(400).json({ error: 'Device model is required' });
    }

    const order = await OrderService.updateDevice(
      req.params.id,
      {
        deviceBrand: deviceBrand.trim(),
        deviceModel: deviceModel.trim(),
        deviceType: deviceType ? deviceType.trim() : undefined
      },
      req.user._id,
      req.user.name
    );

    console.log('Device information updated successfully for order:', req.params.id);

    return res.status(200).json({
      success: true,
      message: 'Device information updated successfully',
      order
    });
  } catch (error) {
    console.error('Error updating device information:', error);
    if (error.message === 'Order not found') {
      return res.status(404).json({ error: error.message });
    }
    return res.status(500).json({ error: error.message || 'Failed to update device information' });
  }
});

// Description: Confirm/verify the device unlock code or pattern
// Endpoint: POST /api/admin-orders/:id/confirm-unlock
// Request: { confirmationStatus: 'verified' | 'incorrect' | 'unable-to-verify', notes?: string }
// Response: { order: Order }
router.post('/:id/confirm-unlock', requireUser, requireAdminOrStaff, async (req, res) => {
  console.log('Unlock confirmation request received for order:', req.params.id, 'from user:', req.user.email);

  try {
    const { confirmationStatus, notes = '' } = req.body;

    // Validate required fields
    if (!confirmationStatus) {
      return res.status(400).json({ error: 'Confirmation status is required' });
    }

    const order = await OrderService.confirmUnlock(
      req.params.id,
      req.user._id,
      req.user.name,
      confirmationStatus,
      notes
    );

    console.log('Unlock confirmation successful for order:', req.params.id);

    return res.status(200).json({ order });
  } catch (error) {
    console.error('Error confirming unlock:', error);
    if (error.message === 'Order not found') {
      return res.status(404).json({ error: error.message });
    }
    if (error.message.includes('No unlock information') || error.message.includes('Invalid confirmation status')) {
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({ error: error.message || 'Failed to confirm unlock' });
  }
});

// ===== Shop Products Routes =====

// Description: Add shop product to order
// Endpoint: POST /api/admin/orders/:id/shop-products
// Request: { productId: string, quantity: number }
// Response: { success: boolean, message: string, order: Order }
router.post('/:id/shop-products', requireUser, requireAdminOrStaff, async (req, res) => {
  console.log('Add shop product to order request received:', req.params.id, req.body);

  try {
    const { productId, quantity } = req.body;

    if (!productId || !quantity) {
      return res.status(400).json({ error: 'Product ID and quantity are required' });
    }

    if (quantity <= 0) {
      return res.status(400).json({ error: 'Quantity must be greater than 0' });
    }

    const order = await OrderService.addShopProduct(
      req.params.id,
      productId,
      quantity,
      req.user._id
    );

    return res.status(200).json({
      success: true,
      message: 'Shop product added successfully',
      order
    });
  } catch (error) {
    console.error('Error adding shop product to order:', error);
    if (error.message === 'Order not found' || error.message === 'Product not found') {
      return res.status(404).json({ error: error.message });
    }
    return res.status(400).json({
      error: error.message || 'Failed to add shop product'
    });
  }
});

// Description: Update shop product quantity in order
// Endpoint: PUT /api/admin/orders/:id/shop-products/:productItemId
// Request: { quantity: number }
// Response: { success: boolean, message: string, order: Order }
router.put('/:id/shop-products/:productItemId', requireUser, requireAdminOrStaff, async (req, res) => {
  console.log('Update shop product quantity in order request received:', req.params.id, req.params.productItemId, req.body);

  try {
    const { quantity } = req.body;

    if (!quantity) {
      return res.status(400).json({ error: 'Quantity is required' });
    }

    if (quantity <= 0) {
      return res.status(400).json({ error: 'Quantity must be greater than 0' });
    }

    const order = await OrderService.updateShopProductQuantity(
      req.params.id,
      req.params.productItemId,
      quantity,
      req.user._id
    );

    return res.status(200).json({
      success: true,
      message: 'Shop product quantity updated successfully',
      order
    });
  } catch (error) {
    console.error('Error updating shop product quantity:', error);
    if (error.message === 'Order not found' || error.message === 'Product not found in order' || error.message === 'Product not found in database') {
      return res.status(404).json({ error: error.message });
    }
    return res.status(400).json({
      error: error.message || 'Failed to update shop product quantity'
    });
  }
});

// Description: Remove shop product from order
// Endpoint: DELETE /api/admin/orders/:id/shop-products/:productItemId
// Request: {}
// Response: { success: boolean, message: string, order: Order }
router.delete('/:id/shop-products/:productItemId', requireUser, requireAdminOrStaff, async (req, res) => {
  console.log('Remove shop product from order request received:', req.params.id, req.params.productItemId);

  try {
    const order = await OrderService.removeShopProduct(
      req.params.id,
      req.params.productItemId,
      req.user._id
    );

    return res.status(200).json({
      success: true,
      message: 'Shop product removed successfully',
      order
    });
  } catch (error) {
    console.error('Error removing shop product from order:', error);
    if (error.message === 'Order not found' || error.message === 'Product not found in order') {
      return res.status(404).json({ error: error.message });
    }
    return res.status(500).json({
      error: error.message || 'Failed to remove shop product'
    });
  }
});

// Description: Delete workflow from order
// Endpoint: DELETE /api/admin/orders/:id/workflows/:workflowId
// Request: {}
// Response: { success: boolean, message: string, order: Order }
router.delete('/:id/workflows/:workflowId', requireUser, requireAdminOrStaff, async (req, res) => {
  console.log('Delete workflow from order request received:', req.params.id, req.params.workflowId);

  try {
    const order = await OrderService.removeWorkflowFromOrder(
      req.params.id,
      req.params.workflowId,
      req.user._id
    );

    return res.status(200).json({
      success: true,
      message: 'Workflow removed from order successfully',
      order
    });
  } catch (error) {
    console.error('Error deleting workflow from order:', error);
    if (error.message === 'Order not found' || error.message === 'Workflow not found in order') {
      return res.status(404).json({ error: error.message });
    }
    return res.status(500).json({
      error: error.message || 'Failed to delete workflow from order'
    });
  }
});

// Description: Change device and recalculate repair services
// Endpoint: POST /api/admin/orders/:id/change-device
// Request: { deviceBrand: string, deviceModel: string, deviceType: string }
// Response: { success: boolean, order: Order, pricingChangesSummary: Object, requiresConfirmation: boolean }
router.post('/:id/change-device', requireUser, requireAdminOrStaff, async (req, res) => {
  console.log('[DeviceChange] Change device request received:', req.params.id, req.body);

  try {
    const { deviceBrand, deviceModel, deviceType } = req.body;

    if (!deviceBrand || !deviceModel || !deviceType) {
      return res.status(400).json({ error: 'Device brand, model, and type are required' });
    }

    const result = await DeviceChangeService.changeDeviceAndRecalculateServices(
      req.params.id,
      {
        deviceBrand,
        deviceModel,
        deviceType,
      },
      req.user._id
    );

    return res.status(200).json({
      success: true,
      message: 'Device changed and services recalculated successfully',
      order: result.order,
      pricingChangesSummary: result.pricingChangesSummary,
      requiresConfirmation: result.requiresConfirmation,
    });
  } catch (error) {
    console.error('[DeviceChange] Error changing device:', error);
    if (error.message === 'Order not found') {
      return res.status(404).json({ error: error.message });
    }
    return res.status(400).json({
      error: error.message || 'Failed to change device',
    });
  }
});

// Description: Confirm device change after pricing approval
// Endpoint: POST /api/admin/orders/:id/confirm-device-change
// Request: { confirmed: boolean }
// Response: { success: boolean, message: string, order: Order }
router.post('/:id/confirm-device-change', requireUser, requireAdminOrStaff, async (req, res) => {
  console.log('[DeviceChange] Confirm device change request received:', req.params.id, req.body);

  try {
    const { confirmed } = req.body;

    if (typeof confirmed !== 'boolean') {
      return res.status(400).json({ error: 'Confirmation status is required' });
    }

    const order = await DeviceChangeService.confirmDeviceChange(
      req.params.id,
      confirmed,
      req.user._id
    );

    return res.status(200).json({
      success: true,
      message: confirmed ? 'Device change confirmed' : 'Device change cancelled',
      order,
    });
  } catch (error) {
    console.error('[DeviceChange] Error confirming device change:', error);
    if (error.message === 'Order not found') {
      return res.status(404).json({ error: error.message });
    }
    return res.status(400).json({
      error: error.message || 'Failed to confirm device change',
    });
  }
});

// Description: Get compatible services for a device type
// Endpoint: GET /api/admin/orders/device-type/:deviceType/compatible-services
// Request: {}
// Response: { services: Array<Service> }
router.get('/device-type/:deviceType/compatible-services', requireUser, requireAdminOrStaff, async (req, res) => {
  console.log('[DeviceChange] Get compatible services for device type:', req.params.deviceType);

  try {
    const { deviceType } = req.params;

    if (!deviceType) {
      return res.status(400).json({ error: 'Device type is required' });
    }

    const services = await DeviceChangeService.getCompatibleServices(deviceType);

    return res.status(200).json({
      success: true,
      services,
    });
  } catch (error) {
    console.error('[DeviceChange] Error getting compatible services:', error);
    return res.status(500).json({
      error: error.message || 'Failed to get compatible services',
    });
  }
});

module.exports = router;