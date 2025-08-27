const express = require('express');
const AddOnServiceService = require('../services/addOnServiceService.js');
const { requireUser } = require('./middleware/auth.js');

const router = express.Router();

// GET /api/addons - Get all add-on services
router.get('/', async (req, res) => {
  try {
    console.log('GET /api/addons - Fetching add-on services with query:', req.query);

    const filters = {
      category: req.query.category,
      deviceType: req.query.deviceType
    };

    const addOnServices = await AddOnServiceService.list(filters);

    console.log(`GET /api/addons - Returning ${addOnServices.length} add-on services`);
    res.json({ success: true, addOns: addOnServices });
  } catch (error) {
    console.error('GET /api/addons - Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/addons/:id - Get single add-on service
router.get('/:id', async (req, res) => {
  try {
    console.log('GET /api/addons/:id - Fetching add-on service with ID:', req.params.id);

    const addOnService = await AddOnServiceService.get(req.params.id);

    if (!addOnService) {
      console.log('GET /api/addons/:id - Add-on service not found');
      return res.status(404).json({
        success: false,
        error: 'Add-on service not found'
      });
    }

    console.log('GET /api/addons/:id - Add-on service found:', addOnService.name);
    res.json({ success: true, addOn: addOnService });
  } catch (error) {
    console.error('GET /api/addons/:id - Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// POST /api/addons - Create new add-on service (admin only)
router.post('/', requireUser, async (req, res) => {
  try {
    console.log('POST /api/addons - Creating add-on service by user:', req.user.email);

    // Check if user is admin
    if (req.user.role !== 'admin') {
      console.log('POST /api/addons - Access denied, user is not admin');
      return res.status(403).json({
        success: false,
        error: 'Access denied. Admin role required.'
      });
    }

    const addOnService = await AddOnServiceService.create(req.body);

    console.log('POST /api/addons - Add-on service created successfully:', addOnService.name);
    res.status(201).json({
      success: true,
      message: 'Add-on service created successfully',
      addOn: addOnService
    });
  } catch (error) {
    console.error('POST /api/addons - Error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// PUT /api/addons/:id - Update add-on service (admin only)
router.put('/:id', requireUser, async (req, res) => {
  try {
    console.log('PUT /api/addons/:id - Updating add-on service with ID:', req.params.id);

    // Check if user is admin
    if (req.user.role !== 'admin') {
      console.log('PUT /api/addons/:id - Access denied, user is not admin');
      return res.status(403).json({
        success: false,
        error: 'Access denied. Admin role required.'
      });
    }

    const addOnService = await AddOnServiceService.update(req.params.id, req.body);

    if (!addOnService) {
      console.log('PUT /api/addons/:id - Add-on service not found');
      return res.status(404).json({
        success: false,
        error: 'Add-on service not found'
      });
    }

    console.log('PUT /api/addons/:id - Add-on service updated successfully:', addOnService.name);
    res.json({
      success: true,
      message: 'Add-on service updated successfully',
      addOn: addOnService
    });
  } catch (error) {
    console.error('PUT /api/addons/:id - Error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// DELETE /api/addons/:id - Delete add-on service (admin only)
router.delete('/:id', requireUser, async (req, res) => {
  try {
    console.log('DELETE /api/addons/:id - Deleting add-on service with ID:', req.params.id);

    // Check if user is admin
    if (req.user.role !== 'admin') {
      console.log('DELETE /api/addons/:id - Access denied, user is not admin');
      return res.status(403).json({
        success: false,
        error: 'Access denied. Admin role required.'
      });
    }

    const deleted = await AddOnServiceService.delete(req.params.id);

    if (!deleted) {
      console.log('DELETE /api/addons/:id - Add-on service not found');
      return res.status(404).json({
        success: false,
        error: 'Add-on service not found'
      });
    }

    console.log('DELETE /api/addons/:id - Add-on service deleted successfully');
    res.json({
      success: true,
      message: 'Add-on service deleted successfully'
    });
  } catch (error) {
    console.error('DELETE /api/addons/:id - Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;