const express = require('express');
const DeviceService = require('../services/deviceService');
const { requireUser, requireRole } = require('./middleware/auth');

const router = express.Router();

// Get all brands
router.get('/brands', async (req, res) => {
  try {
    console.log('DeviceRoutes: GET /brands - Request received');

    const brands = await DeviceService.getBrands();
    console.log('DeviceRoutes: Brands from service:', brands);
    console.log('DeviceRoutes: Brands from service type:', typeof brands);
    console.log('DeviceRoutes: Brands from service length:', brands?.length);
    console.log('DeviceRoutes: Brands from service is array:', Array.isArray(brands));

    const response = {
      success: true,
      brands
    };
    console.log('DeviceRoutes: Response object created:', response);
    console.log('DeviceRoutes: Response brands property:', response.brands);
    console.log('DeviceRoutes: Response brands length:', response.brands?.length);
    console.log('DeviceRoutes: Sending response with status 200');

    res.json(response);
  } catch (error) {
    console.error('DeviceRoutes: Error getting brands:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get brand by ID
router.get('/brands/:id', async (req, res) => {
  try {
    console.log('DeviceRoutes: GET /brands/:id -', req.params.id);
    
    const brand = await DeviceService.getBrandById(req.params.id);
    
    res.json({
      success: true,
      brand
    });
  } catch (error) {
    console.error('DeviceRoutes: Error getting brand by ID:', error);
    if (error.message === 'Brand not found') {
      return res.status(404).json({
        success: false,
        error: error.message
      });
    }
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get models by brand
router.get('/brands/:id/models', async (req, res) => {
  try {
    console.log('DeviceRoutes: GET /brands/:id/models -', req.params.id);
    
    const models = await DeviceService.getModelsByBrand(req.params.id);
    
    res.json({
      success: true,
      models
    });
  } catch (error) {
    console.error('DeviceRoutes: Error getting models by brand:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get model by ID
router.get('/models/:id', async (req, res) => {
  try {
    console.log('DeviceRoutes: GET /models/:id -', req.params.id);
    
    const model = await DeviceService.getModelById(req.params.id);
    
    res.json({
      success: true,
      model
    });
  } catch (error) {
    console.error('DeviceRoutes: Error getting model by ID:', error);
    if (error.message === 'Model not found') {
      return res.status(404).json({
        success: false,
        error: error.message
      });
    }
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get device types
router.get('/types', async (req, res) => {
  try {
    console.log('DeviceRoutes: GET /types');
    
    const deviceTypes = await DeviceService.getDeviceTypes();
    
    res.json({
      success: true,
      deviceTypes
    });
  } catch (error) {
    console.error('DeviceRoutes: Error getting device types:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get manufacturers by device type
router.get('/manufacturers', async (req, res) => {
  try {
    console.log('DeviceRoutes: GET /manufacturers - deviceType:', req.query.deviceType);
    
    const { deviceType } = req.query;
    
    if (!deviceType) {
      return res.status(400).json({
        success: false,
        error: 'Device type is required'
      });
    }
    
    const manufacturers = await DeviceService.getManufacturersByDeviceType(deviceType);
    
    res.json({
      success: true,
      manufacturers
    });
  } catch (error) {
    console.error('DeviceRoutes: Error getting manufacturers:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get models by device type and manufacturer
router.get('/models', async (req, res) => {
  try {
    console.log('DeviceRoutes: GET /models - query:', req.query);

    const { deviceType, manufacturer } = req.query;

    if (!deviceType || !manufacturer) {
      return res.status(400).json({
        success: false,
        error: 'Device type and manufacturer are required'
      });
    }

    const models = await DeviceService.getModelsByTypeAndManufacturer(deviceType, manufacturer);

    res.json({
      success: true,
      models
    });
  } catch (error) {
    console.error('DeviceRoutes: Error getting models:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Description: Search devices by query string (autocomplete)
// Endpoint: GET /api/devices/search?q=iphone
// Request: { q: string }
// Response: { success: boolean, devices: Array<{ _id, name, deviceType, manufacturer, manufacturerId, displayName }> }
router.get('/search', async (req, res) => {
  try {
    const { q } = req.query;

    if (!q) {
      return res.status(400).json({
        success: false,
        error: 'Search query is required'
      });
    }

    console.log('DeviceRoutes: GET /search - query:', q);

    const devices = await DeviceService.searchDevices(q);

    res.json({
      success: true,
      devices
    });
  } catch (error) {
    console.error('DeviceRoutes: Error searching devices:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Create brand (admin only)
router.post('/brands', requireUser, requireRole(['admin']), async (req, res) => {
  try {
    console.log('DeviceRoutes: POST /brands - Request received');
    console.log('DeviceRoutes: Request body:', req.body);

    const brand = await DeviceService.createBrand(req.body);
    console.log('DeviceRoutes: Brand created by service:', brand);
    console.log('DeviceRoutes: Brand created type:', typeof brand);

    const response = {
      success: true,
      message: 'Brand created successfully',
      brand
    };
    console.log('DeviceRoutes: Create response object:', response);

    res.status(201).json(response);
  } catch (error) {
    console.error('DeviceRoutes: Error creating brand:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Create model (admin only)
router.post('/models', requireUser, requireRole(['admin']), async (req, res) => {
  try {
    console.log('DeviceRoutes: POST /models');

    const model = await DeviceService.createModel(req.body);

    res.status(201).json({
      success: true,
      message: 'Model created successfully',
      model
    });
  } catch (error) {
    console.error('DeviceRoutes: Error creating model:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Description: Update device model by ID
// Endpoint: PUT /api/devices/models/:id
// Request: { name?: string, brandId?: string, deviceType?: string, image?: string, specifications?: Record<string, string> }
// Response: { success: boolean, message: string, model: Model }
router.put('/models/:id', requireUser, requireRole(['admin']), async (req, res) => {
  try {
    console.log('DeviceRoutes: PUT /models/:id -', req.params.id);
    console.log('DeviceRoutes: Update data:', req.body);

    const model = await DeviceService.updateModel(req.params.id, req.body);

    res.json({
      success: true,
      message: 'Model updated successfully',
      model
    });
  } catch (error) {
    console.error('DeviceRoutes: Error updating model:', error);
    if (error.message === 'Model not found') {
      return res.status(404).json({
        success: false,
        error: error.message
      });
    }
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Description: Update device brand by ID
// Endpoint: PUT /api/devices/brands/:id
// Request: { name?: string, logo?: string }
// Response: { success: boolean, message: string, brand: Brand }
router.put('/brands/:id', requireUser, requireRole(['admin']), async (req, res) => {
  try {
    console.log('DeviceRoutes: PUT /brands/:id -', req.params.id);
    console.log('DeviceRoutes: Update data:', req.body);

    const brand = await DeviceService.updateBrand(req.params.id, req.body);

    res.json({
      success: true,
      message: 'Brand updated successfully',
      brand
    });
  } catch (error) {
    console.error('DeviceRoutes: Error updating brand:', error);
    if (error.message === 'Brand not found') {
      return res.status(404).json({
        success: false,
        error: error.message
      });
    }
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;