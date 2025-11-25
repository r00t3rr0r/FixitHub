const express = require('express');
const ServiceService = require('../services/serviceService.js');
const { requireUser } = require('./middleware/auth.js');

const router = express.Router();

// Description: Get all services with pagination and sorting
// Endpoint: GET /api/services
// Request: { category?: string, deviceType?: string, page?: number, limit?: number, sortBy?: string, sortOrder?: 'asc' | 'desc' }
// Response: { success: boolean, services: Service[], pagination: { total: number, page: number, limit: number, totalPages: number, hasNextPage: boolean, hasPrevPage: boolean } }
router.get('/', async (req, res) => {
  try {
    console.log('GET /api/services - Fetching services with query:', req.query);

    const filters = {
      category: req.query.category,
      deviceType: req.query.deviceType
    };

    const pagination = {
      page: req.query.page,
      limit: req.query.limit
    };

    const sorting = {
      sortBy: req.query.sortBy,
      sortOrder: req.query.sortOrder
    };

    const result = await ServiceService.list(filters, pagination, sorting);

    console.log(`GET /api/services - Returning ${result.services.length} services (page ${result.pagination.page}/${result.pagination.totalPages})`);
    res.json({
      success: true,
      services: result.services,
      pagination: result.pagination
    });
  } catch (error) {
    console.error('GET /api/services - Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Description: Get single service by ID
// Endpoint: GET /api/services/:id
// Request: {}
// Response: { success: boolean, service: Service }
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

// Description: Create new service (admin only)
// Endpoint: POST /api/services
// Request: { name: string, description: string, price: number, estimatedTime: string, category: string, deviceTypes: string[], manufacturer?: string, model?: string, internalRepairInfo?: string, externalRepairInfo?: string, linkedKnowledgeBaseArticles?: Array<{title: string, url: string}>, popularity?: number }
// Response: { success: boolean, message: string, service: Service }
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

// Description: Update service (admin only)
// Endpoint: PUT /api/services/:id
// Request: { name?: string, description?: string, price?: number, estimatedTime?: string, category?: string, deviceTypes?: string[], manufacturer?: string, model?: string, internalRepairInfo?: string, externalRepairInfo?: string, linkedKnowledgeBaseArticles?: Array<{title: string, url: string}>, popularity?: number }
// Response: { success: boolean, message: string, service: Service }
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

// Description: Delete service (admin only)
// Endpoint: DELETE /api/services/:id
// Request: {}
// Response: { success: boolean, message: string }
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
