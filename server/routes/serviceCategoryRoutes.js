const express = require('express');
const router = express.Router();
const ServiceCategoryService = require('../services/serviceCategoryService');
const { auth, requireAdmin, requireStaff } = require('./middleware/auth');

// Description: Get all service categories with optional filtering
// Endpoint: GET /api/service-categories
// Request: { type?: 'repair' | 'addon', isActive?: boolean, search?: string }
// Response: { success: boolean, categories: Array<ServiceCategory> }
router.get('/', async (req, res) => {
  try {
    console.log('GET /api/service-categories - Query:', req.query);

    const categories = await ServiceCategoryService.getCategories(req.query);

    res.status(200).json({
      success: true,
      categories
    });
  } catch (error) {
    console.error('GET /api/service-categories - Error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Description: Get category statistics (service count per category)
// Endpoint: GET /api/service-categories/statistics
// Request: {}
// Response: { success: boolean, statistics: Array<{ _id, name, type, serviceCount }> }
router.get('/statistics', auth, requireStaff, async (req, res) => {
  try {
    console.log('GET /api/service-categories/statistics');

    const statistics = await ServiceCategoryService.getCategoryStatistics();

    res.status(200).json({
      success: true,
      statistics
    });
  } catch (error) {
    console.error('GET /api/service-categories/statistics - Error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Description: Get a single category by ID
// Endpoint: GET /api/service-categories/:id
// Request: {}
// Response: { success: boolean, category: ServiceCategory }
router.get('/:id', async (req, res) => {
  try {
    console.log('GET /api/service-categories/:id - ID:', req.params.id);

    const category = await ServiceCategoryService.getCategoryById(req.params.id);

    res.status(200).json({
      success: true,
      category
    });
  } catch (error) {
    console.error('GET /api/service-categories/:id - Error:', error);
    res.status(error.message.includes('not found') ? 404 : 500).json({
      success: false,
      message: error.message
    });
  }
});

// Description: Create a new service category
// Endpoint: POST /api/service-categories
// Request: { name: string, description?: string, type: 'repair' | 'addon', icon?: string, color?: string, order?: number }
// Response: { success: boolean, category: ServiceCategory }
router.post('/', auth, requireAdmin, async (req, res) => {
  try {
    console.log('POST /api/service-categories - Data:', req.body);

    const category = await ServiceCategoryService.createCategory(req.body);

    res.status(201).json({
      success: true,
      category,
      message: 'Category created successfully'
    });
  } catch (error) {
    console.error('POST /api/service-categories - Error:', error);
    res.status(error.message.includes('already exists') ? 409 : 500).json({
      success: false,
      message: error.message
    });
  }
});

// Description: Update a service category
// Endpoint: PUT /api/service-categories/:id
// Request: { name?: string, description?: string, icon?: string, color?: string, order?: number }
// Response: { success: boolean, category: ServiceCategory }
router.put('/:id', auth, requireAdmin, async (req, res) => {
  try {
    console.log('PUT /api/service-categories/:id - ID:', req.params.id, 'Data:', req.body);

    const category = await ServiceCategoryService.updateCategory(req.params.id, req.body);

    res.status(200).json({
      success: true,
      category,
      message: 'Category updated successfully'
    });
  } catch (error) {
    console.error('PUT /api/service-categories/:id - Error:', error);
    res.status(error.message.includes('not found') ? 404 : error.message.includes('already exists') ? 409 : 500).json({
      success: false,
      message: error.message
    });
  }
});

// Description: Delete a service category
// Endpoint: DELETE /api/service-categories/:id
// Request: {}
// Response: { success: boolean, message: string }
router.delete('/:id', auth, requireAdmin, async (req, res) => {
  try {
    console.log('DELETE /api/service-categories/:id - ID:', req.params.id);

    const result = await ServiceCategoryService.deleteCategory(req.params.id);

    res.status(200).json(result);
  } catch (error) {
    console.error('DELETE /api/service-categories/:id - Error:', error);
    res.status(error.message.includes('not found') ? 404 : error.message.includes('currently used') ? 409 : 500).json({
      success: false,
      message: error.message
    });
  }
});

// Description: Deactivate a service category
// Endpoint: PUT /api/service-categories/:id/deactivate
// Request: {}
// Response: { success: boolean, category: ServiceCategory }
router.put('/:id/deactivate', auth, requireAdmin, async (req, res) => {
  try {
    console.log('PUT /api/service-categories/:id/deactivate - ID:', req.params.id);

    const category = await ServiceCategoryService.deactivateCategory(req.params.id);

    res.status(200).json({
      success: true,
      category,
      message: 'Category deactivated successfully'
    });
  } catch (error) {
    console.error('PUT /api/service-categories/:id/deactivate - Error:', error);
    res.status(error.message.includes('not found') ? 404 : 500).json({
      success: false,
      message: error.message
    });
  }
});

// Description: Activate a service category
// Endpoint: PUT /api/service-categories/:id/activate
// Request: {}
// Response: { success: boolean, category: ServiceCategory }
router.put('/:id/activate', auth, requireAdmin, async (req, res) => {
  try {
    console.log('PUT /api/service-categories/:id/activate - ID:', req.params.id);

    const category = await ServiceCategoryService.activateCategory(req.params.id);

    res.status(200).json({
      success: true,
      category,
      message: 'Category activated successfully'
    });
  } catch (error) {
    console.error('PUT /api/service-categories/:id/activate - Error:', error);
    res.status(error.message.includes('not found') ? 404 : 500).json({
      success: false,
      message: error.message
    });
  }
});

// Description: Reorder service categories
// Endpoint: PUT /api/service-categories/reorder
// Request: { categoryOrders: Array<{ categoryId: string, order: number }> }
// Response: { success: boolean, categories: Array<ServiceCategory> }
router.put('/reorder', auth, requireAdmin, async (req, res) => {
  try {
    console.log('PUT /api/service-categories/reorder - Data:', req.body);

    const categories = await ServiceCategoryService.reorderCategories(req.body.categoryOrders);

    res.status(200).json({
      success: true,
      categories,
      message: 'Categories reordered successfully'
    });
  } catch (error) {
    console.error('PUT /api/service-categories/reorder - Error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;
