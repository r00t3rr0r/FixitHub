const Cart = require('../models/Cart');
const Product = require('../models/Product');

class CartService {
  // Get user's cart
  static async getCart(userId) {
    console.log('CartService: Getting cart for user:', userId);

    try {
      let cart = await Cart.findOne({ userId }).populate('items.productId');

      if (!cart) {
        // Create empty cart if none exists
        cart = new Cart({
          userId,
          items: [],
          subtotal: 0,
          tax: 0,
          total: 0
        });
        await cart.save();
        console.log('CartService: Created new empty cart');
      }

      console.log('CartService: Found cart with', cart.items.length, 'items');
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

      // Mock promo code validation - in real app this would check a promo codes table
      const validPromoCodes = {
        'SAVE10': { discount: 0.10, type: 'percentage' },
        'SAVE20': { discount: 0.20, type: 'percentage' },
        'WELCOME': { discount: 15, type: 'fixed' }
      };

      const promo = validPromoCodes[promoCode.toUpperCase()];
      if (!promo) {
        throw new Error('Invalid promo code');
      }

      cart.promoCode = promoCode.toUpperCase();
      cart.discountType = promo.type;
      cart.discountValue = promo.discount;

      await cart.save();

      console.log('CartService: Promo code applied successfully');
      return {
        success: true,
        message: 'Promo code applied successfully',
        discount: promo.discount,
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
      cart.promoCode = undefined;
      cart.discountType = undefined;
      cart.discountValue = undefined;

      await cart.save();

      console.log('CartService: Cart cleared successfully');
      return cart;
    } catch (error) {
      console.error('CartService: Error clearing cart:', error);
      throw error;
    }
  }
}

module.exports = CartService;