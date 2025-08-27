const express = require('express');
const OrderService = require('../services/orderService');
const { requireUser } = require('./middleware/auth');

const router = express.Router();

// Create a new order (customer)
router.post('/', requireUser, async (req, res) => {
  console.log('Create order request received from user:', req.user.email);
  console.log('Order data:', req.body);

  try {
    const orderData = {
      ...req.body,
      customerId: req.user._id
    };

    const order = await OrderService.create(orderData);

    return res.status(201).json({
      success: true,
      orderId: order._id,
      orderNumber: order.orderNumber,
      message: 'Order created successfully'
    });
  } catch (error) {
    console.error('Error creating order:', error);
    return res.status(400).json({
      error: error.message || 'Failed to create order'
    });
  }
});

// Get orders for current user (customer)
router.get('/', requireUser, async (req, res) => {
  console.log('Get orders request received from user:', req.user.email);

  try {
    const filters = {
      status: req.query.status
    };

    const orders = await OrderService.getByCustomer(req.user._id, filters);
    
    console.log('Orders route: Returning orders response:', JSON.stringify({ orders }, null, 2));

    return res.status(200).json({ orders });
  } catch (error) {
    console.error('Error getting orders:', error);
    return res.status(500).json({
      error: error.message || 'Failed to get orders'
    });
  }
});

// Get single order by ID (customer)
router.get('/:id', requireUser, async (req, res) => {
  console.log('Get order by ID request received:', req.params.id);

  try {
    const order = await OrderService.getById(req.params.id);

    // Check if user owns this order - fix the access control check
    const orderCustomerId = order.customerId._id ? order.customerId._id.toString() : order.customerId.toString();
    const currentUserId = req.user._id.toString();
    
    console.log('Access control check - Order customer ID:', orderCustomerId);
    console.log('Access control check - Current user ID:', currentUserId);
    console.log('Access control check - User role:', req.user.role);
    
    // Allow access if user owns the order OR if user is admin/staff
    if (orderCustomerId !== currentUserId && !['admin', 'staff'].includes(req.user.role)) {
      console.log('Access denied - User does not own order and is not admin/staff');
      return res.status(403).json({
        error: 'Access denied'
      });
    }

    console.log('Access granted - returning order details');
    return res.status(200).json({ order });
  } catch (error) {
    console.error('Error getting order by ID:', error);
    if (error.message === 'Order not found') {
      return res.status(404).json({ error: error.message });
    }
    return res.status(500).json({
      error: error.message || 'Failed to get order'
    });
  }
});

module.exports = router;