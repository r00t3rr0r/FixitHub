const express = require('express');
const ServiceService = require('../services/serviceService.js');
const { requireUser } = require('./middleware/auth.js');

const router = express.Router();

// GET /api/services - Get all services
router.get('/', async (req, res) => {
  try {
    console.log('GET /api/services - Fetching services with query:', req.query);
    
    const filters = {
      category: req.query.category,
      deviceType: req.query.deviceType
    };
    
    const services = await ServiceService.list(filters);
    
    console.log(`GET /api/services - Returning ${services.length} services`);
    res.json({ success: true, services });
  } catch (error) {
    console.error('GET /api/services - Error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// GET /api/services/:id - Get single service
router.get('/:id', async (req, res) => {
  try {
    console.log('GET /api/services/:id - Fetching service with ID:', req.params.id);
    
    const service = await ServiceService.get(req.params.id);
    
    if (!service) {
      console.log('GET /api/services/:id - Service not found');
      return res.status(404).json({ 
        success: false, 
        error: 'Service not found' 
      });
    }
    
    console.log('GET /api/services/:id - Service found:', service.name);
    res.json({ success: true, service });
  } catch (error) {
    console.error('GET /api/services/:id - Error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// POST /api/services - Create new service (admin only)
router.post('/', requireUser, async (req, res) => {
  try {
    console.log('POST /api/services - Creating service by user:', req.user.email);
    
    // Check if user is admin
    if (req.user.role !== 'admin') {
      console.log('POST /api/services - Access denied, user is not admin');
      return res.status(403).json({ 
        success: false, 
        error: 'Access denied. Admin role required.' 
      });
    }
    
    const service = await ServiceService.create(req.body);
    
    console.log('POST /api/services - Service created successfully:', service.name);
    res.status(201).json({ 
      success: true, 
      message: 'Service created successfully', 
      service 
    });
  } catch (error) {
    console.error('POST /api/services - Error:', error);
    res.status(400).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// PUT /api/services/:id - Update service (admin only)
router.put('/:id', requireUser, async (req, res) => {
  try {
    console.log('PUT /api/services/:id - Updating service with ID:', req.params.id);
    
    // Check if user is admin
    if (req.user.role !== 'admin') {
      console.log('PUT /api/services/:id - Access denied, user is not admin');
      return res.status(403).json({ 
        success: false, 
        error: 'Access denied. Admin role required.' 
      });
    }
    
    const service = await ServiceService.update(req.params.id, req.body);
    
    if (!service) {
      console.log('PUT /api/services/:id - Service not found');
      return res.status(404).json({ 
        success: false, 
        error: 'Service not found' 
      });
    }
    
    console.log('PUT /api/services/:id - Service updated successfully:', service.name);
    res.json({ 
      success: true, 
      message: 'Service updated successfully', 
      service 
    });
  } catch (error) {
    console.error('PUT /api/services/:id - Error:', error);
    res.status(400).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// DELETE /api/services/:id - Delete service (admin only)
router.delete('/:id', requireUser, async (req, res) => {
  try {
    console.log('DELETE /api/services/:id - Deleting service with ID:', req.params.id);
    
    // Check if user is admin
    if (req.user.role !== 'admin') {
      console.log('DELETE /api/services/:id - Access denied, user is not admin');
      return res.status(403).json({ 
        success: false, 
        error: 'Access denied. Admin role required.' 
      });
    }
    
    const deleted = await ServiceService.delete(req.params.id);
    
    if (!deleted) {
      console.log('DELETE /api/services/:id - Service not found');
      return res.status(404).json({ 
        success: false, 
        error: 'Service not found' 
      });
    }
    
    console.log('DELETE /api/services/:id - Service deleted successfully');
    res.json({ 
      success: true, 
      message: 'Service deleted successfully' 
    });
  } catch (error) {
    console.error('DELETE /api/services/:id - Error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

module.exports = router;