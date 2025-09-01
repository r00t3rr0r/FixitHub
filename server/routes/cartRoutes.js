const express = require('express');
const router = express.Router();
const { requireUser } = require('./middleware/auth');
const CartService = require('../services/cartService');

// Get user's cart
router.get('/', requireUser, async (req, res) => {
  try {
    console.log('CartRoutes: Getting cart for user:', req.user._id);
    const cart = await CartService.getCart(req.user._id);
    
    res.json({
      success: true,
      cart
    });
  } catch (error) {
    console.error('CartRoutes: Error getting cart:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Add item to cart
router.post('/add', requireUser, async (req, res) => {
  try {
    console.log('CartRoutes: Adding item to cart:', req.body);
    const { productId, quantity = 1 } = req.body;
    
    if (!productId) {
      return res.status(400).json({
        success: false,
        error: 'Product ID is required'
      });
    }
    
    const cart = await CartService.addToCart(req.user._id, productId, quantity);
    
    res.json({
      success: true,
      message: 'Item added to cart successfully',
      cart
    });
  } catch (error) {
    console.error('CartRoutes: Error adding item to cart:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Update cart item quantity
router.put('/update', requireUser, async (req, res) => {
  try {
    console.log('CartRoutes: Updating cart item:', req.body);
    const { itemId, quantity } = req.body;
    
    if (!itemId || quantity === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Item ID and quantity are required'
      });
    }
    
    const cart = await CartService.updateCartItem(req.user._id, itemId, quantity);
    
    res.json({
      success: true,
      message: 'Cart updated successfully',
      cart
    });
  } catch (error) {
    console.error('CartRoutes: Error updating cart item:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Remove item from cart
router.delete('/remove/:itemId', requireUser, async (req, res) => {
  try {
    console.log('CartRoutes: Removing item from cart:', req.params.itemId);
    const { itemId } = req.params;
    
    const cart = await CartService.removeFromCart(req.user._id, itemId);
    
    res.json({
      success: true,
      message: 'Item removed from cart',
      cart
    });
  } catch (error) {
    console.error('CartRoutes: Error removing item from cart:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Apply promo code
router.post('/promo', requireUser, async (req, res) => {
  try {
    console.log('CartRoutes: Applying promo code:', req.body);
    const { promoCode } = req.body;
    
    if (!promoCode) {
      return res.status(400).json({
        success: false,
        error: 'Promo code is required'
      });
    }
    
    const result = await CartService.applyPromoCode(req.user._id, promoCode);
    
    res.json(result);
  } catch (error) {
    console.error('CartRoutes: Error applying promo code:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Clear cart
router.delete('/clear', requireUser, async (req, res) => {
  try {
    console.log('CartRoutes: Clearing cart for user:', req.user._id);
    const cart = await CartService.clearCart(req.user._id);
    
    res.json({
      success: true,
      message: 'Cart cleared successfully',
      cart
    });
  } catch (error) {
    console.error('CartRoutes: Error clearing cart:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;