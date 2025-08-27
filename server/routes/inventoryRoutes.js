const express = require('express');
const InventoryService = require('../services/inventoryService');
const { requireUser } = require('./middleware/auth');

const router = express.Router();

// Middleware to check if user is admin or staff
const requireAdminOrStaff = (req, res, next) => {
  if (!req.user || !['admin', 'staff'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Access denied. Admin or staff role required.' });
  }
  next();
};

// Get all inventory items
router.get('/', requireUser, requireAdminOrStaff, async (req, res) => {
  console.log('Inventory: Get all items request received from user:', req.user.email);

  try {
    const filters = {
      search: req.query.search,
      category: req.query.category,
      brand: req.query.brand,
      lowStock: req.query.lowStock,
      page: req.query.page,
      limit: req.query.limit
    };

    const result = await InventoryService.getAll(filters);

    return res.status(200).json(result);
  } catch (error) {
    console.error('Error getting inventory items:', error);
    return res.status(500).json({
      error: error.message || 'Failed to get inventory items'
    });
  }
});

// Create new inventory item
router.post('/', requireUser, requireAdminOrStaff, async (req, res) => {
  console.log('Inventory: Create item request received from user:', req.user.email);

  try {
    const itemData = req.body;

    // Validate required fields
    if (!itemData.itemName || !itemData.category || !itemData.manufacturer || !itemData.brand) {
      return res.status(400).json({
        error: 'Item name, category, manufacturer, and brand are required'
      });
    }

    if (!itemData.versions || itemData.versions.length === 0) {
      return res.status(400).json({
        error: 'At least one version is required'
      });
    }

    const newItem = await InventoryService.create(itemData);

    return res.status(201).json({
      success: true,
      message: 'Inventory item created successfully',
      item: newItem
    });
  } catch (error) {
    console.error('Error creating inventory item:', error);
    return res.status(400).json({
      error: error.message || 'Failed to create inventory item'
    });
  }
});

// Get inventory item by ID
router.get('/:id', requireUser, requireAdminOrStaff, async (req, res) => {
  console.log('Inventory: Get item by ID request received:', req.params.id);

  try {
    const item = await InventoryService.getById(req.params.id);

    return res.status(200).json({ item });
  } catch (error) {
    console.error('Error getting inventory item by ID:', error);
    if (error.message === 'Inventory item not found') {
      return res.status(404).json({ error: error.message });
    }
    return res.status(500).json({
      error: error.message || 'Failed to get inventory item'
    });
  }
});

// Update inventory item quantity
router.put('/:id/quantity', requireUser, requireAdminOrStaff, async (req, res) => {
  console.log('Inventory: Update quantity request received:', req.params.id, req.body);

  try {
    const { versionId, quantity, operation, reason } = req.body;

    if (!versionId || quantity === undefined || !operation) {
      return res.status(400).json({
        error: 'Version ID, quantity, and operation are required'
      });
    }

    if (!['add', 'subtract', 'set'].includes(operation)) {
      return res.status(400).json({
        error: 'Operation must be add, subtract, or set'
      });
    }

    if (quantity < 0) {
      return res.status(400).json({
        error: 'Quantity cannot be negative'
      });
    }

    const updatedItem = await InventoryService.updateQuantity(
      req.params.id,
      versionId,
      parseInt(quantity),
      operation,
      reason
    );

    return res.status(200).json({
      success: true,
      message: 'Quantity updated successfully',
      item: updatedItem
    });
  } catch (error) {
    console.error('Error updating inventory quantity:', error);
    if (error.message === 'Inventory item not found' || error.message === 'Version not found') {
      return res.status(404).json({ error: error.message });
    }
    return res.status(400).json({
      error: error.message || 'Failed to update quantity'
    });
  }
});

// Update inventory item
router.put('/:id', requireUser, requireAdminOrStaff, async (req, res) => {
  console.log('Inventory: Update item request received:', req.params.id);

  try {
    const updateData = req.body;
    const updatedItem = await InventoryService.update(req.params.id, updateData);

    return res.status(200).json({
      success: true,
      message: 'Inventory item updated successfully',
      item: updatedItem
    });
  } catch (error) {
    console.error('Error updating inventory item:', error);
    if (error.message === 'Inventory item not found') {
      return res.status(404).json({ error: error.message });
    }
    return res.status(400).json({
      error: error.message || 'Failed to update inventory item'
    });
  }
});

// Delete inventory item
router.delete('/:id', requireUser, requireAdminOrStaff, async (req, res) => {
  console.log('Inventory: Delete item request received:', req.params.id);

  try {
    await InventoryService.delete(req.params.id);

    return res.status(200).json({
      success: true,
      message: 'Inventory item deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting inventory item:', error);
    if (error.message === 'Inventory item not found') {
      return res.status(404).json({ error: error.message });
    }
    return res.status(500).json({
      error: error.message || 'Failed to delete inventory item'
    });
  }
});

// Get low stock items
router.get('/alerts/low-stock', requireUser, requireAdminOrStaff, async (req, res) => {
  console.log('Inventory: Get low stock items request received from user:', req.user.email);

  try {
    const lowStockItems = await InventoryService.getLowStockItems();

    return res.status(200).json({
      items: lowStockItems,
      count: lowStockItems.length
    });
  } catch (error) {
    console.error('Error getting low stock items:', error);
    return res.status(500).json({
      error: error.message || 'Failed to get low stock items'
    });
  }
});

module.exports = router;