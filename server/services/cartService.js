const Cart = require('../models/Cart');
const Product = require('../models/Product');
const PromoCode = require('../models/PromoCode');
const PromoCodeRedemption = require('../models/PromoCodeRedemption');

class CartService {
  static calculateCartSubtotal(cart) {
    let subtotal = 0;

    const items = Array.isArray(cart?.items) ? cart.items : [];
    const repairOrders = Array.isArray(cart?.repairOrders) ? cart.repairOrders : [];

    for (const item of items) {
      const unitPrice = Number(item?.productId?.price || item?.productId?.priceAtOrder || 0);
      const quantity = Number(item?.quantity || 0);
      subtotal += unitPrice * quantity;
    }

    for (const repairOrder of repairOrders) {
      subtotal += Number(repairOrder?.totalCost || 0);
    }

    return Number(subtotal.toFixed(2));
  }

  static calculateDiscountAmount({ discountType, discountValue, subtotal }) {
    const safeSubtotal = Math.max(0, Number(subtotal || 0));
    const safeDiscountValue = Math.max(0, Number(discountValue || 0));

    if (safeSubtotal <= 0) return 0;

    if (discountType === 'percentage') {
      return Number(Math.min(safeSubtotal, safeSubtotal * (safeDiscountValue / 100)).toFixed(2));
    }

    if (discountType === 'fixed_amount') {
      return Number(Math.min(safeSubtotal, safeDiscountValue).toFixed(2));
    }

    return 0;
  }

  static async resolvePromoCodeForCheckout({ promoCode, subtotal, customerId = null }) {
    const normalizedCode = String(promoCode || '').trim().toUpperCase();
    if (!normalizedCode) {
      return null;
    }

    const promo = await PromoCode.findOne({ code: normalizedCode });
    if (!promo) {
      throw new Error('Invalid promo code');
    }

    if (!['active'].includes(String(promo.status || '').toLowerCase())) {
      throw new Error('Promo code is not active');
    }

    const now = new Date();
    if (promo.startDate && now < promo.startDate) {
      throw new Error('Promo code is not active yet');
    }
    if (promo.endDate && now > promo.endDate) {
      throw new Error('Promo code is expired');
    }

    const minimumOrderValue = Number(promo.rules?.minimumOrderValue || 0);
    if (subtotal < minimumOrderValue) {
      throw new Error(`Minimum order value for this promo code is ${minimumOrderValue}`);
    }

    const usageLimitTotal = Number(promo.rules?.usageLimitTotal || 0);
    if (usageLimitTotal > 0 && Number(promo.usageCount || 0) >= usageLimitTotal) {
      throw new Error('Promo code usage limit reached');
    }

    const usageLimitPerCustomer = Number(promo.rules?.usageLimitPerCustomer || 0);
    if (usageLimitPerCustomer > 0 && customerId) {
      const customerUsages = await PromoCodeRedemption.countDocuments({
        promoCodeId: promo._id,
        customerId,
      });

      if (customerUsages >= usageLimitPerCustomer) {
        throw new Error('Promo code usage limit per customer reached');
      }
    }

    const discountAmount = this.calculateDiscountAmount({
      discountType: promo.discountType,
      discountValue: promo.value,
      subtotal,
    });

    if (discountAmount <= 0) {
      throw new Error('Promo code does not produce a valid discount');
    }

    return {
      promo,
      discountAmount,
      discountType: promo.discountType,
      discountValue: Number(promo.value || 0),
    };
  }

  // Get user's cart
  static async getCart(userId) {
    console.log('CartService: Getting cart for user:', userId);

    try {
      let cart = await Cart.findOne({ userId })
        .populate('items.productId')
        .populate('repairOrders.services');

      if (!cart) {
        // Create empty cart if none exists
        cart = new Cart({
          userId,
          items: [],
          repairOrders: [],
          subtotal: 0,
          tax: 0,
          total: 0
        });
        await cart.save();
        console.log('CartService: Created new empty cart');
      }

      console.log('CartService: Found cart with', cart.items.length, 'product items and', cart.repairOrders?.length || 0, 'repair orders');
      return cart;
    } catch (error) {
      console.error('CartService: Error getting cart:', error);
      throw error;
    }
  }

  // Add item to cart
  static async addToCart(userId, productId, quantity) {
    console.log('CartService: Adding item to cart:', { userId, productId, quantity });

    try {
      // Verify product exists
      const product = await Product.findById(productId);
      if (!product) {
        throw new Error('Product not found');
      }

      if (!product.inStock || product.stockCount < quantity) {
        throw new Error('Insufficient stock');
      }

      let cart = await this.getCart(userId);

      // Check if item already exists in cart
      const existingItemIndex = cart.items.findIndex(
        item => item.productId._id.toString() === productId
      );

      if (existingItemIndex >= 0) {
        // Update quantity
        cart.items[existingItemIndex].quantity += quantity;
      } else {
        // Add new item
        cart.items.push({
          productId: productId,
          quantity,
          addedAt: new Date()
        });
      }

      // Validate promo code after cart update
      await this.validatePromoCodeForCart(cart);

      await cart.save();
      await cart.populate('items.productId');

      console.log('CartService: Item added to cart successfully');
      return cart;
    } catch (error) {
      console.error('CartService: Error adding item to cart:', error);
      throw error;
    }
  }

  // Update cart item quantity
  static async updateCartItem(userId, productId, quantity) {
    console.log('CartService: Updating cart item:', { userId, productId, quantity });

    try {
      const cart = await Cart.findOne({ userId }).populate('items.productId');
      if (!cart) {
        throw new Error('Cart not found');
      }

      const itemIndex = cart.items.findIndex(item => item.productId._id.toString() === productId);
      if (itemIndex === -1) {
        throw new Error('Item not found in cart');
      }

      if (quantity <= 0) {
        // Remove item if quantity is 0 or negative
        cart.items.splice(itemIndex, 1);
      } else {
        cart.items[itemIndex].quantity = quantity;
      }

      // Validate promo code after cart update
      await this.validatePromoCodeForCart(cart);

      await cart.save();

      console.log('CartService: Cart item updated successfully');
      return cart;
    } catch (error) {
      console.error('CartService: Error updating cart item:', error);
      throw error;
    }
  }

  // Remove item from cart
  static async removeFromCart(userId, itemId) {
    console.log('CartService: Removing item from cart:', { userId, itemId });

    try {
      const cart = await Cart.findOne({ userId }).populate('items.productId');
      if (!cart) {
        throw new Error('Cart not found');
      }

      cart.items = cart.items.filter(item => item._id.toString() !== itemId);
      
      // Validate promo code after cart update
      await this.validatePromoCodeForCart(cart);

      await cart.save();

      console.log('CartService: Item removed from cart successfully');
      return cart;
    } catch (error) {
      console.error('CartService: Error removing item from cart:', error);
      throw error;
    }
  }

  // Apply promo code
  static async applyPromoCode(userId, promoCode) {
    console.log('CartService: Applying promo code:', { userId, promoCode });

    try {
      const cart = await Cart.findOne({ userId }).populate('items.productId');
      if (!cart) {
        throw new Error('Cart not found');
      }

      const subtotal = this.calculateCartSubtotal(cart);
      const resolvedPromo = await this.resolvePromoCodeForCheckout({
        promoCode,
        subtotal,
        customerId: userId,
      });

      if (!resolvedPromo) {
        throw new Error('Invalid promo code');
      }

      cart.promoCode = resolvedPromo.promo.code;
      cart.promoCodeId = resolvedPromo.promo._id;
      cart.discountType = resolvedPromo.discountType;
      cart.discountValue = resolvedPromo.discountValue;
      cart.discount = resolvedPromo.discountAmount;

      await cart.save();

      console.log('CartService: Promo code applied successfully');
      return {
        success: true,
        message: 'Promo code applied successfully',
        discount: resolvedPromo.discountAmount,
        cart
      };
    } catch (error) {
      console.error('CartService: Error applying promo code:', error);
      throw error;
    }
  }

  // Clear cart
  static async clearCart(userId) {
    console.log('CartService: Clearing cart for user:', userId);

    try {
      const cart = await Cart.findOne({ userId });
      if (!cart) {
        throw new Error('Cart not found');
      }

      cart.items = [];
      cart.repairOrders = [];
      cart.promoCode = '';
      cart.promoCodeId = null;
      cart.discountType = '';
      cart.discountValue = 0;
      cart.discount = 0;

      await cart.save();

      console.log('CartService: Cart cleared successfully');
      return cart;
    } catch (error) {
      console.error('CartService: Error clearing cart:', error);
      throw error;
    }
  }

  // Add repair order to cart
  static async addRepairOrderToCart(userId, repairOrderData) {
    console.log('CartService: Adding repair order to cart:', { userId, repairOrderData });

    try {
      const {
        deviceType,
        deviceBrand,
        deviceModel,
        deviceImage,
        services,
        serviceNames,
        addOns,
        customerNotes,
        photos,
        totalCost,
        unlockPattern,
        unlockCode,
        noLock,
        // Additional repair information
        errorDescription,
        waterDamage,
        previousRepairAttempts,
        previousRepairDetails,
        itemCondition
      } = repairOrderData;

      // Validate required fields
      if (!deviceType || !deviceBrand || !deviceModel || !services || services.length === 0 || !totalCost) {
        throw new Error('Missing required repair order fields');
      }

      let cart = await this.getCart(userId);

      // Add repair order to cart
      const newRepairOrder = {
        deviceType,
        deviceBrand,
        deviceModel,
        deviceImage: deviceImage || '',
        services,
        serviceNames: serviceNames || [],
        addOns: addOns || [],
        customerNotes: customerNotes || '',
        photos: photos || [],
        totalCost,
        unlockPattern: unlockPattern || [],
        unlockCode: unlockCode || '',
        noLock: noLock || false,
        // Additional repair information
        errorDescription: errorDescription || '',
        waterDamage: waterDamage || '',
        previousRepairAttempts: previousRepairAttempts || '',
        previousRepairDetails: previousRepairDetails || '',
        itemCondition: itemCondition || '',
        addedAt: new Date()
      };

      if (!cart.repairOrders) {
        cart.repairOrders = [];
      }

      cart.repairOrders.push(newRepairOrder);

      // Validate promo code after cart update
      await this.validatePromoCodeForCart(cart);

      await cart.save();
      await cart.populate('repairOrders.services');
      await cart.populate('items.productId');

      console.log('CartService: Repair order added to cart successfully with unlock data and additional repair info:', {
        unlockPattern,
        unlockCode,
        noLock,
        errorDescription,
        waterDamage,
        previousRepairAttempts,
        itemCondition
      });
      return cart;
    } catch (error) {
      console.error('CartService: Error adding repair order to cart:', error);
      throw error;
    }
  }

  // Remove repair order from cart
  static async removeRepairOrderFromCart(userId, repairOrderId) {
    console.log('CartService: Removing repair order from cart:', { userId, repairOrderId });

    try {
      const cart = await Cart.findOne({ userId })
        .populate('items.productId')
        .populate('repairOrders.services');

      if (!cart) {
        throw new Error('Cart not found');
      }

      cart.repairOrders = cart.repairOrders.filter(order => order._id.toString() !== repairOrderId);
      
      // Validate promo code after cart update
      await this.validatePromoCodeForCart(cart);

      await cart.save();

      console.log('CartService: Repair order removed from cart successfully');
      return cart;
    } catch (error) {
      console.error('CartService: Error removing repair order from cart:', error);
      throw error;
    }
  }

  // Validate and reapply promo code (called after cart updates)
  static async validatePromoCodeForCart(cart) {
    if (!cart.promoCode || !cart.promoCodeId) {
      return; // No promo code to validate
    }

    try {
      const promo = await PromoCode.findById(cart.promoCodeId);
      if (!promo) {
        console.log('CartService: Promo code not found, removing');
        cart.promoCode = '';
        cart.promoCodeId = null;
        cart.discountType = '';
        cart.discountValue = 0;
        cart.discount = 0;
        return;
      }

      // Check if promo is still active
      const now = new Date();
      const isActive = String(promo.status || '').toLowerCase() === 'active';
      const notExpired = !promo.endDate || now <= promo.endDate;
      const notStarted = !promo.startDate || now >= promo.startDate;

      if (!isActive || !notExpired || !notStarted) {
        console.log('CartService: Promo code expired or inactive, removing');
        cart.promoCode = '';
        cart.promoCodeId = null;
        cart.discountType = '';
        cart.discountValue = 0;
        cart.discount = 0;
        return;
      }

      // Check minimum order value
      const subtotal = this.calculateCartSubtotal(cart);
      const minimumOrderValue = Number(promo.rules?.minimumOrderValue || 0);
      if (subtotal < minimumOrderValue) {
        console.log('CartService: Cart subtotal below minimum, removing discount');
        cart.promoCode = '';
        cart.promoCodeId = null;
        cart.discountType = '';
        cart.discountValue = 0;
        cart.discount = 0;
        return;
      }

      // Recalculate discount
      const newDiscountAmount = this.calculateDiscountAmount({
        discountType: promo.discountType,
        discountValue: promo.value,
        subtotal,
      });

      if (newDiscountAmount > 0) {
        cart.discount = newDiscountAmount;
        console.log('CartService: Promo code still valid, discount updated:', newDiscountAmount);
      } else {
        console.log('CartService: Promo code produces no discount, removing');
        cart.promoCode = '';
        cart.promoCodeId = null;
        cart.discountType = '';
        cart.discountValue = 0;
        cart.discount = 0;
      }
    } catch (error) {
      console.error('CartService: Error validating promo code:', error);
      cart.promoCode = '';
      cart.promoCodeId = null;
      cart.discountType = '';
      cart.discountValue = 0;
      cart.discount = 0;
    }
  }

  static async consumePromoCodeRedemption({ promoCode, customerId = null, orderId = null, orderAmount = 0, discountAmount = 0, metadata = {} }) {
    const normalizedCode = String(promoCode || '').trim().toUpperCase();
    if (!normalizedCode) return null;

    const promo = await PromoCode.findOne({ code: normalizedCode });
    if (!promo) {
      throw new Error('Promo code not found for redemption');
    }

    const redemption = await PromoCodeRedemption.create({
      promoCodeId: promo._id,
      code: promo.code,
      customerId: customerId || null,
      orderId: orderId || null,
      orderAmount: Number(orderAmount || 0),
      discountAmount: Number(discountAmount || 0),
      metadata,
    });

    promo.usageCount = Number(promo.usageCount || 0) + 1;
    promo.discountVolume = Number(promo.discountVolume || 0) + Number(discountAmount || 0);
    promo.revenueAttributed = Number(promo.revenueAttributed || 0) + Math.max(0, Number(orderAmount || 0) - Number(discountAmount || 0));
    await promo.save();

    return { promo, redemption };
  }
}

module.exports = CartService;