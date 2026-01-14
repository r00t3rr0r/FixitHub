# Code Changes Reference - Associated Orders Status Fix

## Complete Code Snippets for All Changes

This document contains the exact code that was added/modified for the fix.

---

## 1. Backend Service Method (bookingService.js)

**Location**: `server/services/bookingService.js` - Added before final closing brace

**Added Code**:

```javascript
  // Get all orders associated with a booking with their current repair progress status
  static async getBookingOrders(bookingId) {
    console.log('BookingService: Getting all orders for booking:', bookingId);

    try {
      const booking = await Booking.findById(bookingId);
      if (!booking) {
        throw new Error('Booking not found');
      }

      // Fetch all orders with full details
      const orders = await Order.find({ _id: { $in: booking.orderIds } })
        .populate('services.serviceId', 'name')
        .populate('shopProducts.productId', 'name')
        .select('_id orderNumber status progress deviceBrand deviceModel totalCost shopProducts services paymentStatus');

      console.log('BookingService: Retrieved', orders.length, 'orders for booking');

      // Map orders to booking item format with current status
      const ordersData = orders.map((order) => {
        let itemData = {
          orderId: order._id.toString(),
          orderNumber: order.orderNumber || order._id.toString().slice(-8).toUpperCase(),
          type: order.deviceType === 'Shop Products' ? 'product' : 'repair',
          device: order.deviceType === 'Shop Products' ? undefined : `${order.deviceBrand} ${order.deviceModel}`,
          status: order.status, // Repair progress status
          progress: order.progress || 0,
          cost: order.totalCost,
        };

        if (order.deviceType === 'Shop Products') {
          itemData.products = order.shopProducts.map(product => ({
            name: product.productId?.name || 'Unknown Product',
            quantity: product.quantity,
            price: product.priceAtOrder,
            totalPrice: product.priceAtOrder * product.quantity,
          }));
        } else {
          itemData.services = order.services.map(service => ({
            name: service.serviceId?.name || 'Unknown Service',
            price: service.price,
            estimatedTime: service.estimatedTime,
          }));
        }

        return itemData;
      });

      return ordersData;
    } catch (error) {
      console.error('BookingService: Error getting booking orders:', error);
      throw error;
    }
  }
```

---

## 2. Backend Route Handler (bookingRoutes.js)

**Location**: `server/routes/bookingRoutes.js` - Added before the DELETE route

**Added Code**:

```javascript
// Description: Get all orders associated with a booking with their current repair progress status
// Endpoint: GET /api/bookings/:id/orders
// Request: {}
// Response: { success: boolean, orders: Array<{orderId, orderNumber, type, device, services, products, status, progress, cost}> }
router.get('/:id/orders', requireUser, async (req, res) => {
  try {
    console.log('BookingRoutes: Getting orders for booking:', req.params.id);

    const orders = await BookingService.getBookingOrders(req.params.id);

    if (!orders || orders.length === 0) {
      console.log('BookingRoutes: No orders found for booking');
      return res.status(404).json({
        success: false,
        error: 'No orders found for this booking',
      });
    }

    console.log('BookingRoutes: Retrieved', orders.length, 'orders for booking');

    res.json({
      success: true,
      orders: orders,
      count: orders.length,
    });
  } catch (error) {
    console.error('BookingRoutes: Error getting booking orders:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});
```

---

## 3. Frontend API Client (bookings.ts)

**Location**: `client/src/api/bookings.ts` - Added at end of file

**Added Code**:

```typescript
// Description: Get all orders associated with a booking with their current repair progress status
// Endpoint: GET /api/bookings/:id/orders
// Request: {}
// Response: { success: boolean, orders: Array<{orderId, orderNumber, type, device, services, products, status, progress, cost}>, count: number }
export const getBookingOrders = async (bookingId: string) => {
  try {
    const response = await api.get(`/api/bookings/${bookingId}/orders`);
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};
```

---

## 4. Frontend Component Changes (BookingsManagement.tsx)

### Change 1: Updated Import Statement (Line 10)

```typescript
import { getAdminBookings, getBooking, updateBookingStatus, updateBookingBillingStatus, cancelBooking, getBookingOrders } from "@/api/bookings"
```

### Change 2: Updated `toggleExpandBooking` Function (Lines 280-324)

Function now calls `getBookingOrders()` API instead of using cached data:
- Fetches fresh order data with current repair progress status
- Shows loading state
- Includes console logging

### Change 3: Added `getOrderStatusColor()` Helper Function (Lines 343-361)

Maps repair progress statuses to appropriate UI colors.

### Change 4: Updated Status Column JSX (Line 763)

Changed from `getStatusColor()` to `getOrderStatusColor()` for proper color display.

---

## Files Modified Summary

| File | Changes | Lines |
|------|---------|-------|
| server/services/bookingService.js | Added getBookingOrders() | +56 |
| server/routes/bookingRoutes.js | Added GET /orders route | +33 |
| client/src/api/bookings.ts | Added getBookingOrders() | +12 |
| client/src/pages/admin/BookingsManagement.tsx | Updated component | +30 |

**Total**: 4 files, ~131 lines added

---
