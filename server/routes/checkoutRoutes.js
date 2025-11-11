const express = require('express');
const router = express.Router();
const { requireUser } = require('./middleware/auth');
const CartService = require('../services/cartService');
const UserService = require('../services/userService');
const OrderService = require('../services/orderService');
const Service = require('../models/Service');

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

    // Validate required fields
    if (!email || !password || !firstName || !lastName) {
      console.log('CheckoutRoutes: Missing required fields');
      return res.status(400).json({
        success: false,
        error: 'Email, password, first name, and last name are required'
      });
    }

    // Check if user already exists
    const existingUser = await UserService.findByEmail(email);
    if (existingUser) {
      console.log('CheckoutRoutes: User already exists:', email);
      return res.status(400).json({
        success: false,
        error: 'User with this email already exists. Please login instead.'
      });
    }

    // Create user with extended profile
    const userData = {
      email,
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

    console.log('CheckoutRoutes: Creating new user:', email);
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

// Description: Complete checkout - creates orders from cart repair orders and clears cart
// Endpoint: POST /api/checkout/complete
// Request: {}
// Response: { success: boolean, message: string, orders: Order[], orderIds: string[] }
router.post('/complete', requireUser, async (req, res) => {
  try {
    console.log('CheckoutRoutes: Completing checkout for user:', req.user._id);

    // Get user's cart
    const cart = await CartService.getCart(req.user._id);

    // Check if cart has repair orders
    if (!cart || !cart.repairOrders || cart.repairOrders.length === 0) {
      console.log('CheckoutRoutes: No repair orders in cart');
      return res.status(400).json({
        success: false,
        error: 'No repair orders in cart to checkout.'
      });
    }

    console.log('CheckoutRoutes: Found', cart.repairOrders.length, 'repair orders in cart');

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

    // Create an order for each repair order in the cart
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
          estimatedCompletion: null
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

    if (createdOrders.length === 0) {
      console.log('CheckoutRoutes: No orders were created');
      return res.status(500).json({
        success: false,
        error: 'Failed to create orders from cart. Please try again.'
      });
    }

    // Clear the cart repair orders after successful order creation
    try {
      cart.repairOrders = [];
      cart.items = []; // Also clear product items if any
      await cart.save();
      console.log('CheckoutRoutes: Cart cleared successfully');
    } catch (clearError) {
      console.error('CheckoutRoutes: Error clearing cart:', clearError);
      // Don't fail the request if cart clearing fails - orders were created
    }

    console.log('CheckoutRoutes: Checkout completed successfully. Created', createdOrders.length, 'orders');

    res.json({
      success: true,
      message: `Successfully created ${createdOrders.length} order(s)`,
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

module.exports = router;
