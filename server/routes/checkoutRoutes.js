const express = require('express');
const router = express.Router();
const { requireUser } = require('./middleware/auth');
const CartService = require('../services/cartService');
const UserService = require('../services/userService');

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

module.exports = router;
