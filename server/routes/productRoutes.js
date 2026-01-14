const express = require('express');
const router = express.Router();
const { requireUser, requireRole } = require('./middleware/auth');
const ProductService = require('../services/productService');

// Description: Get all products with pagination and sorting
// Endpoint: GET /api/products
// Request: { page?: number, limit?: number, sortBy?: string, sortOrder?: 'asc'|'desc', category?: string, brand?: string, search?: string }
// Response: { success: boolean, products: Product[], totalPages: number, currentPage: number, totalProducts: number, limit: number }
router.get('/', async (req, res) => {
  try {
    console.log('ProductRoutes: Getting products with filters and sorting:', req.query);
    const result = await ProductService.getProducts(req.query);

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('ProductRoutes: Error getting products:', error.message, error.stack);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get single product (public)
router.get('/:id', async (req, res) => {
  try {
    console.log('ProductRoutes: Getting product by ID:', req.params.id);
    const product = await ProductService.getProductById(req.params.id);
    
    res.json({
      success: true,
      product
    });
  } catch (error) {
    console.error('ProductRoutes: Error getting product:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Create product (admin only)
router.post('/', requireUser, requireRole(['admin']), async (req, res) => {
  try {
    console.log('ProductRoutes: Creating product:', req.body);
    const product = await ProductService.createProduct(req.body);
    
    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      product
    });
  } catch (error) {
    console.error('ProductRoutes: Error creating product:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Update product (admin only)
router.put('/:id', requireUser, requireRole(['admin']), async (req, res) => {
  try {
    console.log('ProductRoutes: Updating product:', req.params.id);
    const product = await ProductService.updateProduct(req.params.id, req.body);
    
    res.json({
      success: true,
      message: 'Product updated successfully',
      product
    });
  } catch (error) {
    console.error('ProductRoutes: Error updating product:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Delete product (admin only)
router.delete('/:id', requireUser, requireRole(['admin']), async (req, res) => {
  try {
    console.log('ProductRoutes: Deleting product:', req.params.id);
    const result = await ProductService.deleteProduct(req.params.id);
    
    res.json(result);
  } catch (error) {
    console.error('ProductRoutes: Error deleting product:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get product categories
router.get('/categories/list', async (req, res) => {
  try {
    console.log('ProductRoutes: Getting product categories');
    const categories = await ProductService.getCategories();
    
    res.json({
      success: true,
      categories
    });
  } catch (error) {
    console.error('ProductRoutes: Error getting categories:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get product brands
router.get('/brands/list', async (req, res) => {
  try {
    console.log('ProductRoutes: Getting product brands');
    const brands = await ProductService.getBrands();
    
    res.json({
      success: true,
      brands
    });
  } catch (error) {
    console.error('ProductRoutes: Error getting brands:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;