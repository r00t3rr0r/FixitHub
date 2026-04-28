const express = require('express');
const router = express.Router();
const { requireUser, optionalAuth } = require('./middleware/auth');
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
    const { productId, quantity } = req.body;

    if (!productId || quantity === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Product ID and quantity are required'
      });
    }

    const cart = await CartService.updateCartItem(req.user._id, productId, quantity);

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

// Apply promo code (works for both authenticated and guest users)
// For authenticated users, applies to their saved cart
// For guest users, just validates and returns discount info
router.post('/promo', optionalAuth, async (req, res) => {
  try {
    console.log('CartRoutes: Applying promo code:', req.body);
    const { promoCode } = req.body;
    
    if (!promoCode) {
      return res.status(400).json({
        success: false,
        error: 'Promo code is required'
      });
    }
    
    // Check if user is authenticated
    if (req.user) {
      // Authenticated user: apply to their cart
      console.log('CartRoutes: Applying promo code for authenticated user:', req.user._id);
      const result = await CartService.applyPromoCode(req.user._id, promoCode);
      res.json(result);
    } else {
      // Guest user: just validate the promo code
      console.log('CartRoutes: Validating promo code for guest user');
      const Cart = require('../models/Cart');
      const PromoCode = require('../models/PromoCode');
      
      const normalizedCode = String(promoCode || '').trim().toUpperCase();
      const promo = await PromoCode.findOne({ code: normalizedCode });
      
      if (!promo) {
        return res.status(400).json({
          success: false,
          error: 'Invalid promo code'
        });
      }
      
      if (!['active'].includes(String(promo.status || '').toLowerCase())) {
        return res.status(400).json({
          success: false,
          error: 'Promo code is not active'
        });
      }
      
      const now = new Date();
      if (promo.startDate && now < promo.startDate) {
        return res.status(400).json({
          success: false,
          error: 'Promo code is not active yet'
        });
      }
      if (promo.endDate && now > promo.endDate) {
        return res.status(400).json({
          success: false,
          error: 'Promo code is expired'
        });
      }
      
      // For guest users, return the promo code info (but don't save it)
      res.json({
        success: true,
        message: 'Promo code validated successfully',
        promoCode: promo.code,
        discountType: promo.discountType,
        discountValue: Number(promo.value || 0),
        note: 'Guest user: discount will be applied at checkout'
      });
    }
  } catch (error) {
    console.error('CartRoutes: Error applying promo code:', error);
    res.status(400).json({
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

// Description: Add repair order to cart
// Endpoint: POST /api/cart/add-repair-order
// Request: { deviceType: string, deviceBrand: string, deviceModel: string, services: string[], addOns: object[], customerNotes: string, photos: string[], totalCost: number, unlockPattern?: string[], unlockCode?: string, noLock?: boolean, errorDescription?: string, waterDamage?: string, previousRepairAttempts?: string, previousRepairDetails?: string, itemCondition?: string }
// Response: { success: boolean, message: string, cart: Cart }
router.post('/add-repair-order', requireUser, async (req, res) => {
  try {
    console.log('CartRoutes: Adding repair order to cart:', req.body);
    const repairOrderData = req.body;

    if (!repairOrderData.deviceType || !repairOrderData.deviceBrand || !repairOrderData.deviceModel ||
        !repairOrderData.services || !repairOrderData.totalCost) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: deviceType, deviceBrand, deviceModel, services, and totalCost are required'
      });
    }

    const cart = await CartService.addRepairOrderToCart(req.user._id, repairOrderData);

    res.json({
      success: true,
      message: 'Repair order added to cart successfully',
      cart
    });
  } catch (error) {
    console.error('CartRoutes: Error adding repair order to cart:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Description: Remove repair order from cart
// Endpoint: DELETE /api/cart/remove-repair-order/:repairOrderId
// Request: { repairOrderId: string }
// Response: { success: boolean, message: string, cart: Cart }
router.delete('/remove-repair-order/:repairOrderId', requireUser, async (req, res) => {
  try {
    console.log('CartRoutes: Removing repair order from cart:', req.params.repairOrderId);
    const { repairOrderId } = req.params;

    const cart = await CartService.removeRepairOrderFromCart(req.user._id, repairOrderId);

    res.json({
      success: true,
      message: 'Repair order removed from cart',
      cart
    });
  } catch (error) {
    console.error('CartRoutes: Error removing repair order from cart:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;