const express = require('express');
const router = express.Router();
const { requireUser } = require('./middleware/auth');
const CartService = require('../services/cartService');
const UserService = require('../services/userService');
const OrderService = require('../services/orderService');
const BookingService = require('../services/bookingService');
const EmailService = require('../services/emailService');
const Service = require('../models/Service');
const normalizeEmailAddress = (email) => String(email || '').trim().toLowerCase();

// Description: Initialize checkout - validates user authentication and returns cart with user info
// Endpoint: POST /api/checkout/initialize
// Request: {}
// Response: { success: boolean, cart: Cart, userInfo: { firstName, lastName, email, phone, company, country, vatId, billingAddress, shippingAddress } }
router.post('/initialize', requireUser, async (req, res) => {
  try {
    console.log('CheckoutRoutes: Initializing checkout for user:', req.user._id);

    // Get user's cart
    const cart = await CartService.getCart(req.user._id);

    // Check if cart has items
    if (!cart || (cart.items.length === 0 && (!cart.repairOrders || cart.repairOrders.length === 0))) {
      console.log('CheckoutRoutes: Cart is empty');
      return res.status(400).json({
        success: false,
        error: 'Cart is empty. Please add items before checkout.'
      });
    }

    // Get user information
    const user = await UserService.get(req.user._id);

    if (!user) {
      console.log('CheckoutRoutes: User not found');
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Prepare user info for checkout
    const userInfo = {
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      email: user.email,
      phone: user.phone || '',
      company: user.company || '',
      country: user.country || '',
      vatId: user.vatId || '',
      billingAddress: {
        street: user.invoiceAddress?.street || '',
        city: user.invoiceAddress?.city || '',
        state: user.invoiceAddress?.state || '',
        zipCode: user.invoiceAddress?.zipCode || '',
        country: user.invoiceAddress?.country || ''
      },
      shippingAddress: {
        street: user.paymentAddress?.sameAsInvoice ? user.invoiceAddress?.street : user.paymentAddress?.street || '',
        city: user.paymentAddress?.sameAsInvoice ? user.invoiceAddress?.city : user.paymentAddress?.city || '',
        state: user.paymentAddress?.sameAsInvoice ? user.invoiceAddress?.state : user.paymentAddress?.state || '',
        zipCode: user.paymentAddress?.sameAsInvoice ? user.invoiceAddress?.zipCode : user.paymentAddress?.zipCode || '',
        country: user.paymentAddress?.sameAsInvoice ? user.invoiceAddress?.country : user.paymentAddress?.country || ''
      }
    };

    console.log('CheckoutRoutes: Checkout initialized successfully');
    res.json({
      success: true,
      cart,
      userInfo
    });
  } catch (error) {
    console.error('CheckoutRoutes: Error initializing checkout:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Description: Register guest user with extended profile during checkout
// Endpoint: POST /api/checkout/register
// Request: { email, password, firstName, lastName, phone, company, country, vatId, billingAddress: { street, city, state, zipCode, country }, shippingAddress: { street, city, state, zipCode, country } }
// Response: { success: boolean, message: string, user: User, accessToken: string, refreshToken: string }
router.post('/register', async (req, res) => {
  try {
    console.log('CheckoutRoutes: Guest registration during checkout');

    const {
      email,
      password,
      firstName,
      lastName,
      phone,
      company,
      country,
      vatId,
      billingAddress,
      shippingAddress
    } = req.body;

    const normalizedEmail = normalizeEmailAddress(email);

    // Validate required fields
    if (!normalizedEmail || !password || !firstName || !lastName) {
      console.log('CheckoutRoutes: Missing required fields');
      return res.status(400).json({
        success: false,
        error: 'Email, password, first name, and last name are required'
      });
    }

    // Check if user already exists
    const existingUser = await UserService.getByEmail(normalizedEmail);
    if (existingUser) {
      console.log('CheckoutRoutes: User already exists:', normalizedEmail);
      return res.status(400).json({
        success: false,
        error: 'User with this email already exists. Please login instead.'
      });
    }

    // Create user with extended profile
    const userData = {
      email: normalizedEmail,
      password,
      firstName,
      lastName,
      phone: phone || '',
      role: 'customer',
      company: company || '',
      country: country || '',
      vatId: vatId || '',
      invoiceAddress: {
        street: billingAddress?.street || '',
        city: billingAddress?.city || '',
        state: billingAddress?.state || '',
        zipCode: billingAddress?.zipCode || '',
        country: billingAddress?.country || ''
      },
      paymentAddress: {
        street: shippingAddress?.street || '',
        city: shippingAddress?.city || '',
        state: shippingAddress?.state || '',
        zipCode: shippingAddress?.zipCode || '',
        country: shippingAddress?.country || '',
        sameAsInvoice: false
      }
    };

    console.log('CheckoutRoutes: Creating new user:', normalizedEmail);
    const user = await UserService.create(userData);

    // Generate tokens for auto-login
    const { generateAccessToken, generateRefreshToken } = require('../utils/auth');
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // Update user with refresh token
    user.refreshToken = refreshToken;
    await user.save();

    console.log('CheckoutRoutes: User created and logged in successfully:', email);

    res.json({
      success: true,
      message: 'Account created successfully',
      user: user.toObject(),
      accessToken,
      refreshToken
    });
  } catch (error) {
    console.error('CheckoutRoutes: Error during guest registration:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Description: Complete checkout - creates orders from cart repair orders and shop products, clears cart
// Endpoint: POST /api/checkout/complete
// Request: { paymentMethod?: string, paymentData?: object }
// Response: { success: boolean, message: string, orders: Order[], orderIds: string[] }
router.post('/complete', requireUser, async (req, res) => {
  try {
    console.log('CheckoutRoutes: Completing checkout for user:', req.user._id);

    const { paymentMethod, paymentData } = req.body;

    // Get user information to validate invoice address
    const user = await UserService.get(req.user._id);

    if (!user) {
      console.log('CheckoutRoutes: User not found');
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Validate invoice address - required for return label generation
    const invoiceAddress = user.invoiceAddress || {};
    console.log('CheckoutRoutes: Validating invoice address:', JSON.stringify(invoiceAddress, null, 2));

    if (!invoiceAddress.street || !invoiceAddress.city || !invoiceAddress.zipCode) {
      console.log('CheckoutRoutes: Incomplete invoice address');
      return res.status(400).json({
        success: false,
        error: 'Please complete your invoice address in your profile before checkout. Street, city, and postal code are required for return label generation.',
        missingFields: {
          street: !invoiceAddress.street,
          city: !invoiceAddress.city,
          zipCode: !invoiceAddress.zipCode
        }
      });
    }

    // Get user's cart
    const cart = await CartService.getCart(req.user._id);

    // Check if cart has any items (repair orders or shop products)
    const hasRepairOrders = cart && cart.repairOrders && cart.repairOrders.length > 0;
    const hasShopProducts = cart && cart.items && cart.items.length > 0;

    if (!cart || (!hasRepairOrders && !hasShopProducts)) {
      console.log('CheckoutRoutes: Cart is empty');
      return res.status(400).json({
        success: false,
        error: 'Cart is empty. Please add items before checkout.'
      });
    }

    console.log('CheckoutRoutes: Found', cart.repairOrders?.length || 0, 'repair orders and', cart.items?.length || 0, 'shop products in cart');

    // Helper function to parse estimated time string to minutes
    const parseEstimatedTime = (timeString) => {
      if (typeof timeString === 'number') {
        return timeString;
      }
      if (!timeString || typeof timeString !== 'string') {
        return 0;
      }

      // Extract the first number from the string (e.g., "2-3 hours" -> 2, "1 hour" -> 1)
      const match = timeString.match(/(\d+)/);
      if (!match) {
        return 0;
      }

      const value = parseInt(match[1], 10);

      // Convert to minutes if it contains "hour"
      if (timeString.toLowerCase().includes('hour')) {
        return value * 60;
      }

      // If it contains "minute" or no unit, assume minutes
      return value;
    };

    const createdOrders = [];
    const orderIds = [];

    // Create orders from repair orders in the cart
    if (hasRepairOrders) {
      for (const repairOrder of cart.repairOrders) {
        try {
          console.log('CheckoutRoutes: Creating order from repair order:', repairOrder);

          // Fetch service details to get price and estimated time
          const serviceDetails = await Service.find({ _id: { $in: repairOrder.services } });

          // Calculate total cost from services
          let totalCost = 0;
          const services = serviceDetails.map(service => {
            totalCost += service.price;
            return {
              serviceId: service._id,
              price: service.price,
              estimatedTime: parseEstimatedTime(service.estimatedTime),
              notes: ''
            };
          });

          // Add addOns to total cost if present
          if (repairOrder.addOns && repairOrder.addOns.length > 0) {
            repairOrder.addOns.forEach(addOn => {
              totalCost += addOn.price || 0;
            });
          }

          // Prepare order data matching the Order model schema
          const orderData = {
            customerId: req.user._id,
            deviceBrand: repairOrder.deviceBrand,
            deviceModel: repairOrder.deviceModel,
            deviceType: repairOrder.deviceType || 'Smartphone',
            services: services,
            addOns: repairOrder.addOns || [],
            customerNotes: repairOrder.customerNotes || '',
            photos: repairOrder.photos || [],
            totalCost: totalCost,
            status: 'pending',
            priority: 'normal',
            progress: 0,
            paymentStatus: 'pending',
            estimatedCompletion: null,
            // Device unlock information from cart
            unlockPattern: repairOrder.unlockPattern || [],
            unlockCode: repairOrder.unlockCode || '',
            noLock: repairOrder.noLock || false,
            // Additional repair information from cart
            errorDescription: repairOrder.errorDescription || '',
            waterDamage: repairOrder.waterDamage || '',
            previousRepairAttempts: repairOrder.previousRepairAttempts || '',
            previousRepairDetails: repairOrder.previousRepairDetails || '',
            itemCondition: repairOrder.itemCondition || ''
          };

          console.log('CheckoutRoutes: Order data prepared:', orderData);

          // Create the order
          const order = await OrderService.create(orderData);
          console.log('CheckoutRoutes: Order created successfully:', order._id);

          createdOrders.push(order);
          orderIds.push(order._id.toString());
        } catch (orderError) {
          console.error('CheckoutRoutes: Error creating order from repair order:', orderError);
          // Continue with other orders even if one fails
        }
      }
    }

    // Create an order from shop products if present
    if (hasShopProducts && cart.items.length > 0) {
      try {
        console.log('CheckoutRoutes: Creating order from shop products');

        // Populate product details
        const Product = require('../models/Product');
        const populatedItems = [];
        let totalCost = 0;

        for (const item of cart.items) {
          const product = await Product.findById(item.productId);
          if (product) {
            const itemTotal = product.price * item.quantity;
            totalCost += itemTotal;
            populatedItems.push({
              productId: product._id,
              quantity: item.quantity,
              priceAtOrder: product.price,
              addedBy: req.user._id
            });
          }
        }

        // Create a shop product order with placeholder device info
        const shopOrderData = {
          customerId: req.user._id,
          deviceBrand: 'N/A',  // Placeholder for shop-only orders
          deviceModel: 'Shop Products Order',
          deviceType: 'Shop Products',
          services: [],  // Empty services array
          addOns: [],
          shopProducts: populatedItems,
          customerNotes: 'Order containing shop products only',
          photos: [],
          totalCost: totalCost,
          status: 'pending',
          priority: 'normal',
          progress: 0,
          paymentStatus: 'pending',
          estimatedCompletion: null
        };

        console.log('CheckoutRoutes: Shop order data prepared:', shopOrderData);

        // Create the shop product order
        const shopOrder = await OrderService.create(shopOrderData);
        console.log('CheckoutRoutes: Shop product order created successfully:', shopOrder._id);

        createdOrders.push(shopOrder);
        orderIds.push(shopOrder._id.toString());
      } catch (shopOrderError) {
        console.error('CheckoutRoutes: Error creating shop product order:', shopOrderError);
        // Log but don't fail the entire checkout
      }
    }

    if (createdOrders.length === 0) {
      console.log('CheckoutRoutes: No orders were created');
      return res.status(500).json({
        success: false,
        error: 'Failed to create orders from cart. Please try again.'
      });
    }

    // Create booking to consolidate all orders
    console.log('CheckoutRoutes: Creating booking to consolidate', createdOrders.length, 'orders');
    let booking = null;
    try {
      const mongoose = require('mongoose');
      booking = await BookingService.create({
        customerId: req.user._id,
        orderIds: orderIds.map(id => new mongoose.Types.ObjectId(id)),
        discount: cart.discount || 0,
        appliedPromoCode: cart.promoCode || '',
        status: 'pending',
        billingStatus: 'unpaid',
        paymentStatus: 'pending',
        paymentMethod: paymentMethod || '',
      });
      console.log('CheckoutRoutes: Booking created successfully:', booking._id);
    } catch (bookingError) {
      console.error('CheckoutRoutes: Error creating booking:', bookingError);
      // Don't fail checkout if booking creation fails - orders were created
      // This is a graceful degradation scenario
    }

    // Clear the cart after successful order creation
    try {
      cart.repairOrders = [];
      cart.items = [];
      await cart.save();
      console.log('CheckoutRoutes: Cart cleared successfully');
    } catch (clearError) {
      console.error('CheckoutRoutes: Error clearing cart:', clearError);
      // Don't fail the request if cart clearing fails - orders were created
    }

    // Create descriptive success message
    const repairOrderCount = hasRepairOrders ? (cart.repairOrders?.length || 0) : 0;
    const shopProductCount = hasShopProducts ? 1 : 0; // Shop products create 1 combined order
    const totalOrders = createdOrders.length;

    let successMessage = `Successfully created booking with ${totalOrders} order(s)`;
    if (repairOrderCount > 0 && shopProductCount > 0) {
      successMessage = `Successfully created booking with ${repairOrderCount} repair order(s) and 1 shop product order`;
    } else if (repairOrderCount > 0) {
      successMessage = `Successfully created booking with ${repairOrderCount} repair order(s)`;
    } else if (shopProductCount > 0) {
      successMessage = `Successfully created booking with shop product order`;
    }

    console.log('CheckoutRoutes: Checkout completed successfully. Created booking:', booking?._id);

    res.json({
      success: true,
      message: successMessage,
      booking: booking || { orderIds: orderIds },
      bookingId: booking?._id?.toString() || null,
      orders: createdOrders,
      orderIds: orderIds
    });
  } catch (error) {
    console.error('CheckoutRoutes: Error completing checkout:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Description: Complete guest checkout - creates orders from guest cart data without authentication
// Endpoint: POST /api/checkout/guest-complete
// Request: { guestInfo: { email, firstName, lastName, billingAddress, shippingAddress }, cartData: { items, repairOrders }, paymentMethod?: string, paymentData?: object }
// Response: { success: boolean, message: string, orders: Order[], orderIds: string[] }
router.post('/guest-complete', async (req, res) => {
  try {
    console.log('CheckoutRoutes: Processing guest checkout');

    const { guestInfo, cartData, paymentMethod, paymentData } = req.body;

    // Validate guest information
    if (!guestInfo || !guestInfo.email || !guestInfo.firstName || !guestInfo.lastName) {
      console.log('CheckoutRoutes: Missing required guest information');
      return res.status(400).json({
        success: false,
        error: 'Guest information (email, firstName, lastName) is required'
      });
    }

    // Validate billing address
    const billingAddress = guestInfo.billingAddress || {};
    if (!billingAddress.street || !billingAddress.city || !billingAddress.zipCode) {
      console.log('CheckoutRoutes: Incomplete billing address');
      return res.status(400).json({
        success: false,
        error: 'Complete billing address (street, city, postal code) is required',
        missingFields: {
          street: !billingAddress.street,
          city: !billingAddress.city,
          zipCode: !billingAddress.zipCode
        }
      });
    }

    // Validate cart data
    if (!cartData || (!cartData.repairOrders || cartData.repairOrders.length === 0) && (!cartData.items || cartData.items.length === 0)) {
      console.log('CheckoutRoutes: Cart is empty');
      return res.status(400).json({
        success: false,
        error: 'Cart is empty. Please add items before checkout.'
      });
    }

    const hasRepairOrders = cartData.repairOrders && cartData.repairOrders.length > 0;
    const hasShopProducts = cartData.items && cartData.items.length > 0;

    console.log('CheckoutRoutes: Found', cartData.repairOrders?.length || 0, 'repair orders and', cartData.items?.length || 0, 'shop products in guest cart');

    // Create a temporary guest user ID for orders (using email as identifier)
    const guestUserId = `guest_${Buffer.from(guestInfo.email).toString('base64')}_${Date.now()}`;

    // Store guest information in a way that can be retrieved
    const guestUserData = {
      email: guestInfo.email,
      firstName: guestInfo.firstName,
      lastName: guestInfo.lastName,
      phone: guestInfo.phone || '',
      isGuest: true,
      billingAddress: billingAddress,
      shippingAddress: guestInfo.shippingAddress || billingAddress
    };

    // Helper function to parse estimated time string to minutes
    const parseEstimatedTime = (timeString) => {
      if (typeof timeString === 'number') {
        return timeString;
      }
      if (!timeString || typeof timeString !== 'string') {
        return 0;
      }

      const match = timeString.match(/(\d+)/);
      if (!match) {
        return 0;
      }

      const value = parseInt(match[1], 10);

      if (timeString.toLowerCase().includes('hour')) {
        return value * 60;
      }

      return value;
    };

    const createdOrders = [];
    const orderIds = [];

    // Create orders from repair orders in the guest cart
    if (hasRepairOrders) {
      for (const repairOrder of cartData.repairOrders) {
        try {
          console.log('CheckoutRoutes: Creating order from guest repair order:', repairOrder);

          // Fetch service details to get price and estimated time
          const serviceDetails = await Service.find({ _id: { $in: repairOrder.services.map(s => s._id || s) } });

          // Calculate total cost from services
          let totalCost = 0;
          const services = serviceDetails.map(service => {
            totalCost += service.price;
            return {
              serviceId: service._id,
              price: service.price,
              estimatedTime: parseEstimatedTime(service.estimatedTime),
              notes: ''
            };
          });

          // Add addOns to total cost if present
          if (repairOrder.addOns && repairOrder.addOns.length > 0) {
            repairOrder.addOns.forEach(addOn => {
              totalCost += addOn.price || 0;
            });
          }

          // Prepare order data with guest information
          const orderData = {
            customerId: null, // No user ID for guest orders
            guestInfo: guestUserData, // Store guest information with the order
            deviceBrand: repairOrder.deviceBrand,
            deviceModel: repairOrder.deviceModel,
            deviceType: repairOrder.deviceType || 'Smartphone',
            services: services,
            addOns: repairOrder.addOns || [],
            customerNotes: repairOrder.customerNotes || '',
            photos: repairOrder.photos || [],
            totalCost: totalCost,
            status: 'pending',
            priority: 'normal',
            progress: 0,
            paymentStatus: 'pending',
            estimatedCompletion: null,
            unlockPattern: repairOrder.unlockPattern || [],
            unlockCode: repairOrder.unlockCode || '',
            noLock: repairOrder.noLock || false,
            errorDescription: repairOrder.errorDescription || '',
            waterDamage: repairOrder.waterDamage || '',
            previousRepairAttempts: repairOrder.previousRepairAttempts || '',
            previousRepairDetails: repairOrder.previousRepairDetails || '',
            itemCondition: repairOrder.itemCondition || ''
          };

          console.log('CheckoutRoutes: Guest order data prepared:', orderData);

          // Create the order
          const order = await OrderService.create(orderData);
          console.log('CheckoutRoutes: Guest order created successfully:', order._id);

          createdOrders.push(order);
          orderIds.push(order._id.toString());
        } catch (orderError) {
          console.error('CheckoutRoutes: Error creating guest order from repair order:', orderError);
          // Continue with other orders even if one fails
        }
      }
    }

    // Create an order from shop products if present
    if (hasShopProducts && cartData.items.length > 0) {
      try {
        console.log('CheckoutRoutes: Creating order from guest shop products');

        const Product = require('../models/Product');
        const populatedItems = [];
        let totalCost = 0;

        for (const item of cartData.items) {
          const productId = item.product?._id || item.productId;
          const product = await Product.findById(productId);
          if (product) {
            const itemTotal = product.price * item.quantity;
            totalCost += itemTotal;
            populatedItems.push({
              productId: product._id,
              quantity: item.quantity,
              priceAtOrder: product.price
            });
          }
        }

        // Create a shop product order for guest
        const shopOrderData = {
          customerId: null,
          guestInfo: guestUserData,
          deviceBrand: 'N/A',
          deviceModel: 'Shop Products Order',
          deviceType: 'Shop Products',
          services: [],
          addOns: [],
          shopProducts: populatedItems,
          customerNotes: 'Order containing shop products only',
          photos: [],
          totalCost: totalCost,
          status: 'pending',
          priority: 'normal',
          progress: 0,
          paymentStatus: 'pending',
          estimatedCompletion: null
        };

        console.log('CheckoutRoutes: Guest shop order data prepared:', shopOrderData);

        const shopOrder = await OrderService.create(shopOrderData);
        console.log('CheckoutRoutes: Guest shop product order created successfully:', shopOrder._id);

        createdOrders.push(shopOrder);
        orderIds.push(shopOrder._id.toString());
      } catch (shopOrderError) {
        console.error('CheckoutRoutes: Error creating guest shop product order:', shopOrderError);
      }
    }

    if (createdOrders.length === 0) {
      console.log('CheckoutRoutes: No guest orders were created');
      return res.status(500).json({
        success: false,
        error: 'Failed to create orders from cart. Please try again.'
      });
    }

    // Create booking to consolidate all guest orders
    console.log('CheckoutRoutes: Creating booking for guest orders:', createdOrders.length);
    let booking = null;
    try {
      const mongoose = require('mongoose');
      booking = await BookingService.create({
        customerId: null,
        guestInfo: guestUserData,
        orderIds: orderIds.map(id => new mongoose.Types.ObjectId(id)),
        discount: 0,
        appliedPromoCode: '',
        status: 'pending',
        billingStatus: 'unpaid',
        paymentStatus: 'pending',
        paymentMethod: paymentMethod || '',
      });
      console.log('CheckoutRoutes: Guest booking created successfully:', booking._id);
    } catch (bookingError) {
      console.error('CheckoutRoutes: Error creating guest booking:', bookingError);
    }

    // Create success message
    const totalOrders = createdOrders.length;
    let successMessage = `Successfully created ${totalOrders} order(s) for guest checkout`;

    console.log('CheckoutRoutes: Guest checkout completed successfully');

    // Send guest booking confirmation email with booking tracking link
    try {
      const totalAmount = createdOrders.reduce((sum, order) => sum + order.totalCost, 0);

      const bookingToken = booking?.guestTrackingToken || null;
      const bookingTrackingPath = bookingToken
        ? `/track-order/booking?token=${encodeURIComponent(bookingToken)}&email=${encodeURIComponent(guestInfo.email)}`
        : '/track-order/booking';

      const itemSummaryParts = await Promise.all(createdOrders.map(async (order, index) => {
        if (order.deviceType === 'Shop Products') {
          return `<strong>Position ${index + 1}: Produktbestellung</strong><br />Auftrag: ${order.orderNumber} (${order.status || 'pending'})`;
        }

        const deviceBrand = String(order.deviceBrand || '').trim();
        const deviceModel = String(order.deviceModel || '').trim();
        const modelImageUrl = await EmailService.resolveDeviceModelImageUrl({ deviceBrand, deviceModel });
        const deviceVisual = EmailService.buildDeviceModelVisualHtml({ deviceBrand, deviceModel, imageUrl: modelImageUrl });

        return `
          <div style="border:1px solid #d8dce6;border-radius:14px;padding:12px 14px;background:#ffffff;">
            <div style="font-size:14px;font-weight:700;color:#1a2a5e;margin-bottom:10px;">Position ${index + 1}: Reparatur</div>
            <div style="display:flex;align-items:flex-start;gap:12px;">
              <div style="flex:0 0 auto;">${deviceVisual}</div>
              <div style="flex:1 1 auto;font-size:13px;line-height:1.6;color:#2d3748;">
                <div><strong>Auftrag:</strong> ${order.orderNumber} (${order.status || 'pending'})</div>
              </div>
            </div>
          </div>
        `.trim();
      }));

      const itemSummary = `${createdOrders.length} Position(en)<br /><br />${itemSummaryParts.join('<br /><br />')}`;

      console.log('CheckoutRoutes: Sending guest booking tracking email');
      const firstRepairOrder = createdOrders.find((order) => order.deviceType !== 'Shop Products');
      let emailResult = await EmailService.sendTriggerEmail('guest_booking_created', guestInfo.email, {
        companyName: process.env.COMPANY_NAME || 'McRepair.de',
        customerName: `${guestInfo.firstName} ${guestInfo.lastName}`,
        bookingNumber: booking?.bookingNumber || 'N/A',
        bookingDate: new Date(booking?.createdAt || Date.now()).toLocaleDateString('de-DE'),
        itemSummary,
        totalAmount: `€${Number(totalAmount || 0).toFixed(2)}`,
        bookingStatus: booking?.status || 'pending',
        deviceBrand: firstRepairOrder?.deviceBrand || '',
        deviceModel: firstRepairOrder?.deviceModel || '',
        bookingUrl: bookingTrackingPath,
        shippingLabelUrl: booking?.shippingLabelUrl || bookingTrackingPath,
        supportEmail: process.env.SUPPORT_EMAIL || 'support@fixithub.com',
        supportPhone: process.env.SUPPORT_PHONE || '+49 (0) 123/456789'
      });

      if (emailResult.success) {
        console.log('CheckoutRoutes: Guest booking tracking email sent successfully');
      } else {
        console.warn('CheckoutRoutes: Failed to send guest booking tracking email:', emailResult.error);
      }
    } catch (emailError) {
      console.error('CheckoutRoutes: Error sending guest booking tracking email:', emailError);
      // Don't fail the checkout if email fails
    }

    res.json({
      success: true,
      message: successMessage,
      booking: booking || { orderIds: orderIds },
      bookingId: booking?._id?.toString() || null,
      bookingTrackingToken: booking?.guestTrackingToken || null,
      orders: createdOrders,
      orderIds: orderIds,
      guestEmail: guestInfo.email,
      trackingToken: createdOrders[0]?.guestTrackingToken || null
    });
  } catch (error) {
    console.error('CheckoutRoutes: Error completing guest checkout:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
