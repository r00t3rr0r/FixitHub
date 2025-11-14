# Order Consolidation into Booking System - Implementation Plan

## Task Overview
Orders placed via the shopping cart need to be consolidated into a single grouped booking. This booking should contain all repair jobs and all items added to the cart, with all line items billed together within one booking. Additionally, the Order Management system should allow listed orders to be grouped into bookings and ensure accurate assignment of orders to their corresponding booking.

## Current State Analysis

### Cart System
- Cart model supports both shop products (`items`) and repair orders (`repairOrders`)
- Automatically calculates subtotal, tax, discount, and total
- Can mix multiple repair orders and shop products

### Order System
- Each checkout creates SEPARATE orders for:
  - Each repair order → separate Order document
  - Shop products → one combined Order document
- Orders are created individually, not consolidated

### Checkout Flow (Current)
1. User adds repair orders and/or shop products to cart
2. On checkout, creates SEPARATE Order documents:
   - One order per repair order
   - One order for all shop products combined
3. This results in multiple unpaid/separate orders

## Solution Requirements

### 1. Create Booking Model (`/server/models/Booking.js`)
A new Booking model that groups multiple orders together:

**Fields needed:**
- `bookingNumber` (string, unique, auto-generated)
- `customerId` (ref: User, required)
- `orderIds` (array of ObjectId refs to Order)
- `totalOrders` (number - count of orders in booking)
- `repairOrderIds` (array of repair order IDs)
- `shopProductOrderId` (single order ID for shop products)
- `status` (enum: pending, payment-pending, processing, completed, cancelled)
- `billingStatus` (enum: unpaid, partially-paid, paid)
- `paymentStatus` (enum: pending, paid, refunded)
- `totalCost` (number - sum of all order costs)
- `tax` (number)
- `discount` (number)
- `subtotal` (number)
- `appliedPromoCode` (string)
- `items` (array with order details - repair jobs and shop items)
- `timeline` (array of status events)
- `createdAt` (date)
- `updatedAt` (date)

### 2. Modify Checkout Flow to Create Bookings
**File:** `/server/routes/checkoutRoutes.js`
**Changes:**
- After creating individual orders, group them into a single Booking
- Return booking info instead of individual order info
- Link all orders to the booking

**New logic:**
1. Get cart items
2. Create individual orders (existing logic) → collect order IDs
3. **NEW**: Create Booking document with all order IDs
4. Link each order to booking via bookingId field
5. Return booking instead of orders array

### 3. Update Order Model to Link to Booking
**File:** `/server/models/Order.js`
**Changes:**
- Add `bookingId` field (ref: Booking, optional)
- Existing orders won't have this, new orders from cart will

### 4. Create BookingService
**File:** `/server/services/bookingService.js`
**Methods needed:**
- `create(bookingData)` - Create booking from orders
- `getById(bookingId)` - Get booking with populated orders
- `getByCustomer(customerId)` - Get all bookings for customer
- `updateStatus(bookingId, status)` - Update booking status
- `groupOrders(orderIds)` - Group existing orders into booking
- `getItems()` - Get consolidated items from booking

### 5. Create Booking Routes
**File:** `/server/routes/bookingRoutes.js`
**Endpoints:**
- `GET /api/bookings` - Get user's bookings
- `GET /api/bookings/:id` - Get booking details
- `POST /api/bookings/group` - Group orders into booking (for existing orders)
- `PUT /api/bookings/:id/status` - Update booking status

### 6. Modify checkout complete endpoint
**File:** `/server/routes/checkoutRoutes.js`
**Endpoint:** `POST /api/checkout/complete`
**Current response:** `{ orders: Order[], orderIds: string[] }`
**New response:** `{ booking: Booking, bookingId: string }`

### 7. Create Frontend API Client
**File:** `/client/src/api/bookings.ts`
**Functions:**
- `getBookings()` - Get user's bookings
- `getBooking(id)` - Get booking details with orders
- `groupOrders(orderIds)` - Consolidate existing orders

### 8. Update Frontend Checkout Component
**File:** `/client/src/components/checkout/CheckoutDialog.tsx`
- Update to show booking confirmation instead of individual orders

### 9. Update Frontend Order Management
**File:** `/client/src/pages/admin/OrderManagement.tsx`
- Add UI to view orders by booking
- Add ability to group existing orders into a booking
- Show booking status alongside orders

## Data Structure Examples

### Order Structure (Updated)
```json
{
  "_id": "507f1f77bcf86cd799439011",
  "orderNumber": "ORD-2024-001",
  "bookingId": "507f1f77bcf86cd799439012",
  "customerId": "507f1f77bcf86cd799439010",
  "deviceBrand": "Apple",
  "deviceModel": "iPhone 13",
  "services": [...],
  "totalCost": 150,
  "status": "pending"
}
```

### Booking Structure (New)
```json
{
  "_id": "507f1f77bcf86cd799439012",
  "bookingNumber": "BKG-2024-001",
  "customerId": "507f1f77bcf86cd799439010",
  "orderIds": [
    "507f1f77bcf86cd799439011",
    "507f1f77bcf86cd799439013"
  ],
  "repairOrderIds": ["507f1f77bcf86cd799439011"],
  "shopProductOrderId": "507f1f77bcf86cd799439013",
  "status": "pending",
  "billingStatus": "unpaid",
  "items": [
    {
      "type": "repair",
      "orderId": "507f1f77bcf86cd799439011",
      "device": "iPhone 13 - Screen Replacement",
      "cost": 150
    },
    {
      "type": "product",
      "orderId": "507f1f77bcf86cd799439013",
      "products": [
        { "name": "Screen Protector", "quantity": 2, "price": 20 }
      ],
      "cost": 20
    }
  ],
  "totalCost": 170,
  "tax": 13.60,
  "discount": 0,
  "subtotal": 160,
  "timeline": [
    {
      "status": "Booking Created",
      "description": "Orders consolidated into booking",
      "completedAt": "2024-01-15T10:00:00Z"
    }
  ],
  "createdAt": "2024-01-15T10:00:00Z",
  "updatedAt": "2024-01-15T10:00:00Z"
}
```

## Implementation Steps

1. **Create Booking Model** - Define schema and validation
2. **Create BookingService** - Business logic for booking operations
3. **Create Booking Routes** - API endpoints for booking management
4. **Update Checkout Logic** - Modify checkout to create bookings
5. **Update Order Model** - Add bookingId reference
6. **Create Frontend API Client** - Booking API functions
7. **Update Frontend Components** - Show bookings instead of individual orders
8. **Create Test Script** - Validate booking creation and grouping
9. **Documentation** - Update API docs

## Benefits

1. **Unified Billing** - All items billed together in one booking
2. **Better Order Tracking** - Customer sees one booking instead of multiple orders
3. **Easier Management** - Admin can group and view orders by booking
4. **Flexible Grouping** - Can group existing orders retroactively
5. **Clear Status** - Booking-level status across all related items

## Files to Create
1. `/server/models/Booking.js`
2. `/server/services/bookingService.js`
3. `/server/routes/bookingRoutes.js`
4. `/client/src/api/bookings.ts`
5. Test scripts for validation

## Files to Modify
1. `/server/models/Order.js` - Add bookingId field
2. `/server/routes/checkoutRoutes.js` - Create booking in checkout/complete
3. `/server/services/orderService.js` - Optional updates for booking reference
4. `/client/src/components/checkout/CheckoutDialog.tsx` - Show booking response
5. `/client/src/pages/admin/OrderManagement.tsx` - Add booking grouping UI
6. `/server/routes/index.js` - Register booking routes if needed
