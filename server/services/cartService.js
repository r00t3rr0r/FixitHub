const Cart = require('../models/Cart');
const Product = require('../models/Product');
const PromoCode = require('../models/PromoCode');
const PromoCodeRedemption = require('../models/PromoCodeRedemption');
const FinancialService = require('./financialService');
const CalculationHelper = require('./calculationHelper');

const createCatalogError = (message) => {
  const error = new Error(message);
  error.status = 400;
  error.code = 'CART_CATALOG_INVALID';
  return error;
};

const uniqueIdStrings = (values) => {
  const seen = new Set();
  const ids = [];
  for (const value of Array.isArray(values) ? values : []) {
    const id = String(value?._id || value || '').trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
};

class CartService {
  /**
   * EINZIGE Preisgrundlage eines Geraets (Warenkorb, Gast-Warenkorb, PayPal-Betrag, Checkout):
   * Leistungen und Zusatzleistungen werden aus dem KATALOG aufgeloest, nie aus Client-Werten.
   *  - Leistungs-IDs werden dedupliziert (dieselbe Leistung zaehlt einmal - wie der Checkout
   *    mit Service.find({$in}) sie anlegt); unbekannte/ungueltige IDs -> 400.
   *  - Zusatzleistungen: per Katalog-ID (_id / addOnServiceId), sonst per Name, nur aktive
   *    Eintraege; Preis, Beschreibung und Dauer kommen aus AddOnService. Unbekannt -> 400.
   *    Gleicher Katalogeintrag doppelt -> einmal.
   * Rueckgabe: { serviceDocs, serviceIds, addOns, servicesTotal, addOnsTotal, rawTotal }.
   */
  static async resolveRepairOrderCatalog({ services, addOns } = {}) {
    const mongoose = require('mongoose');
    const Service = require('../models/Service');
    const AddOnService = require('../models/AddOnService');

    const serviceIds = uniqueIdStrings(services);
    if (serviceIds.length === 0) {
      // Auch: Bestandswarenkorb, dessen Leistungen geloescht wurden (populate entfernt sie).
      throw createCatalogError('Für das Gerät ist keine verfügbare Reparaturleistung ausgewählt. Bitte stellen Sie das Gerät neu zusammen.');
    }
    if (serviceIds.some((id) => !mongoose.Types.ObjectId.isValid(id))) {
      throw createCatalogError('Eine ausgewählte Reparaturleistung ist ungültig. Bitte stellen Sie das Gerät neu zusammen.');
    }
    const found = await Service.find({ _id: { $in: serviceIds } });
    const byId = new Map(found.map((doc) => [String(doc._id), doc]));
    if (serviceIds.some((id) => !byId.has(id))) {
      throw createCatalogError('Eine ausgewählte Reparaturleistung ist nicht mehr verfügbar. Bitte stellen Sie das Gerät neu zusammen.');
    }
    const serviceDocs = serviceIds.map((id) => byId.get(id));
    const servicesTotal = serviceDocs.reduce((sum, doc) => sum + (Number(doc.price) || 0), 0);

    const resolvedAddOns = [];
    const seenAddOns = new Set();
    for (const requested of Array.isArray(addOns) ? addOns : []) {
      if (!requested) continue;
      const requestedId = String(requested.addOnServiceId || requested._id || '').trim();
      const requestedName = String(requested.name || '').trim();
      let candidates = [];
      if (requestedId && mongoose.Types.ObjectId.isValid(requestedId)) {
        candidates = await AddOnService.find({ _id: requestedId, isActive: true }).lean();
      }
      if (candidates.length === 0 && requestedName) {
        candidates = await AddOnService.find({ name: requestedName, isActive: true }).sort({ createdAt: 1, _id: 1 }).lean();
      }
      if (candidates.length === 0) {
        throw createCatalogError(`Die Zusatzleistung „${requestedName || requestedId || 'unbekannt'}“ ist nicht verfügbar. Bitte stellen Sie das Gerät neu zusammen.`);
      }
      // Gleichnamige Katalogeintraege: der zum angezeigten Preis passende, sonst der erste.
      // Der Preis ist in jedem Fall ein Katalogpreis.
      const requestedPrice = Number(requested.price);
      const catalog = candidates.find((c) => Math.abs(Number(c.price) - requestedPrice) < 0.005) || candidates[0];
      const catalogId = String(catalog._id);
      if (seenAddOns.has(catalogId)) continue;
      seenAddOns.add(catalogId);
      resolvedAddOns.push({
        name: catalog.name,
        description: catalog.description || '',
        price: Number(catalog.price) || 0,
        estimatedTime: catalog.estimatedTime || '',
      });
    }
    const addOnsTotal = resolvedAddOns.reduce((sum, addOn) => sum + addOn.price, 0);

    return {
      serviceDocs,
      serviceIds,
      addOns: resolvedAddOns,
      servicesTotal: Number(servicesTotal.toFixed(2)),
      addOnsTotal: Number(addOnsTotal.toFixed(2)),
      rawTotal: Number((servicesTotal + addOnsTotal).toFixed(2)),
    };
  }

  static async buildPricing({ cart, userId }) {
    const financialProfile = await FinancialService.resolveFinancialProfile({ customerId: userId });
    const subtotal = Number((cart?.subtotal || this.calculateCartSubtotal(cart)).toFixed(2));
    const promoDiscount = Number(Number(cart?.discount || 0).toFixed(2));
    const groupDiscountPercent = Math.max(0, Math.min(100, Number(financialProfile?.defaultDiscountPercent || 0)));
    const groupDiscountAmount = CalculationHelper.percentOf(subtotal - promoDiscount, groupDiscountPercent);
    const totalDiscount = Number((promoDiscount + Math.max(0, groupDiscountAmount)).toFixed(2));
    const total = Number(Math.max(0, subtotal - totalDiscount).toFixed(2));
    const taxRatePercent = Math.max(0, Number(financialProfile?.taxRate || 0));
    const tax = taxRatePercent > 0
      ? Number((total * (taxRatePercent / (100 + taxRatePercent))).toFixed(2))
      : 0;

    return {
      currency: String(financialProfile?.currency || 'EUR').toUpperCase(),
      taxMode: financialProfile?.taxMode || 'default',
      taxRatePercent,
      subtotal,
      promoDiscount,
      groupDiscountPercent,
      groupDiscountAmount: Math.min(Math.max(0, subtotal - promoDiscount), Math.max(0, groupDiscountAmount)),
      totalDiscount,
      tax,
      total,
      normalTotal: subtotal,
    };
  }

  static async serializeCartWithPricing(cart, userId) {
    const pricing = await this.buildPricing({ cart, userId });
    return {
      ...(typeof cart?.toObject === 'function' ? cart.toObject() : cart),
      ...pricing,
      discount: pricing.totalDiscount,
    };
  }

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
      return Math.min(safeSubtotal, CalculationHelper.percentOf(safeSubtotal, safeDiscountValue));
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
      } else {
        // Bestandswarenkorb mit einem vom Client gesetzten (oder veralteten) Geraetebetrag
        // bzw. Zusatzleistungspreis: Zusatzleistungen aus dem Katalog uebernehmen, speichern
        // rechnet den Betrag aus dem Katalog neu (Cart pre-save) - damit haben Warenkorb,
        // Rabattgrundlage und Checkout-Auftraege dieselbe Grundlage.
        let needsSave = false;
        for (const order of cart.repairOrders || []) {
          if (Array.isArray(order.addOns) && order.addOns.length > 0) {
            try {
              const catalog = await this.resolveRepairOrderCatalog({ services: order.services, addOns: order.addOns });
              const stored = order.addOns.map((addOn) => `${addOn.name}|${Number(addOn.price)}`).join(';');
              const fresh = catalog.addOns.map((addOn) => `${addOn.name}|${addOn.price}`).join(';');
              if (stored !== fresh) {
                order.addOns = catalog.addOns;
                needsSave = true;
              }
            } catch (catalogError) {
              // Nicht aufloesbar (Leistung/Zusatzleistung entfernt): Anzeige bleibt, der
              // Checkout weist den Warenkorb mit 400 ab.
            }
          }
          const catalogTotal = Cart.catalogRepairOrderTotal(order);
          if (catalogTotal !== null && Math.abs(catalogTotal - Number(order.totalCost || 0)) > 0.004) needsSave = true;
        }
        if (needsSave) await cart.save();
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
        const newQuantity = cart.items[existingItemIndex].quantity + quantity;
        if (product.stockCount < newQuantity) {
          throw new Error('Insufficient stock');
        }
        cart.items[existingItemIndex].quantity = newQuantity;
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
        itemCondition,
        imei,
        serialNumber
      } = repairOrderData;

      // Validate required fields
      if (!deviceType || !deviceBrand || !deviceModel || !services || services.length === 0 || !totalCost) {
        throw new Error('Missing required repair order fields');
      }

      // Leistungen/Zusatzleistungen und Betrag aus dem Katalog (Client-Preise, doppelte
      // Leistungs-IDs und frei gewaehlte Zusatzleistungspreise werden nicht uebernommen).
      const catalog = await this.resolveRepairOrderCatalog({ services, addOns });

      let cart = await this.getCart(userId);

      // Add repair order to cart
      const newRepairOrder = {
        deviceType,
        deviceBrand,
        deviceModel,
        deviceImage: deviceImage || '',
        services: catalog.serviceIds,
        serviceNames: catalog.serviceDocs.map((service) => service.name).filter(Boolean),
        addOns: catalog.addOns,
        customerNotes: customerNotes || '',
        photos: photos || [],
        totalCost: catalog.rawTotal,
        unlockPattern: unlockPattern || [],
        unlockCode: unlockCode || '',
        noLock: noLock || false,
        // Additional repair information
        errorDescription: errorDescription || '',
        waterDamage: waterDamage || '',
        previousRepairAttempts: previousRepairAttempts || '',
        previousRepairDetails: previousRepairDetails || '',
        itemCondition: itemCondition || '',
        imei: imei || '',
        serialNumber: serialNumber || '',
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