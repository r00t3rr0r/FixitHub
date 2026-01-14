# Booking Consolidation Implementation - Complete Documentation

## Overview

This document describes the implementation of the Order Consolidation into Booking feature for FixitHub. The feature groups all orders placed via the shopping cart into a single consolidated booking, allowing all repair jobs and items to be billed together.

## Implementation Summary

### What Was Built

1. **Booking Model** - New MongoDB model for managing consolidated bookings
2. **Booking Service** - Business logic layer for booking operations
3. **Booking Routes** - RESTful API endpoints for booking management
4. **Checkout Integration** - Modified checkout process to create bookings
5. **Frontend API Client** - TypeScript client for booking API calls
6. **Order Model Update** - Added bookingId reference to orders

### Architecture Overview

```
Shopping Cart (multiple items)
         ↓
    Checkout Process
         ↓
  Create Orders (separate document per repair order + 1 for shop products)
         ↓
  Create Booking (consolidates all orders)
         ↓
    Linked Orders (each order has bookingId)
         ↓
  Unified Billing (booking contains all costs)
```

## Files Created

### 1. Backend Models
- **`/server/models/Booking.js`** - Booking schema with auto-generated booking numbers, timeline tracking, and consolidated items

### 2. Backend Services
- **`/server/services/bookingService.js`** - Core business logic for:
  - Creating bookings from orders
  - Retrieving bookings
  - Grouping existing orders
  - Updating booking status
  - Managing billing status
  - Cancelling bookings

### 3. Backend Routes
- **`/server/routes/bookingRoutes.js`** - RESTful endpoints:
  - `GET /api/bookings` - Get user's bookings
  - `GET /api/bookings/:id` - Get specific booking
  - `GET /api/bookings/:id/summary` - Get booking summary
  - `POST /api/bookings/group` - Group existing orders (admin)
  - `PUT /api/bookings/:id/status` - Update booking status (admin)
  - `PUT /api/bookings/:id/billing-status` - Update billing status (admin)
  - `DELETE /api/bookings/:id` - Cancel booking (admin)

### 4. Frontend API Client
- **`/client/src/api/bookings.ts`** - TypeScript API wrapper functions:
  - `getBookings()` - Fetch user's bookings
  - `getBooking(id)` - Fetch single booking
  - `getBookingSummary(id)` - Get booking summary
  - `groupOrdersIntoBooking()` - Group orders (admin)
  - `updateBookingStatus()` - Update status (admin)
  - `updateBookingBillingStatus()` - Update billing (admin)
  - `cancelBooking()` - Cancel booking (admin)

### 5. Test Script
- **`/test-booking-consolidation.js`** - Comprehensive test suite for booking workflow

## Files Modified

### 1. Server Files
- **`/server/models/Order.js`** - Added `bookingId` field to link orders to bookings
- **`/server/routes/checkoutRoutes.js`** - Modified to create bookings after order creation
- **`/server/server.js`** - Registered booking routes

## Key Features

### 1. Automatic Consolidation
When a customer checks out:
- Individual orders are created (one per repair order + one for shop products)
- A booking is automatically created that links all orders together
- Orders are linked to the booking via bookingId field

### 2. Unified Billing
Booking consolidates:
- All repair jobs and associated services
- All shop products
- Pricing information (subtotal, tax, discount, total)
- Payment status across all items

### 3. Flexible Grouping
Admin can manually group existing orders into a booking via:
- `POST /api/bookings/group` endpoint
- Accepts multiple order IDs and customer ID

### 4. Status Management
Booking status lifecycle:
- **pending** - Initial state after checkout
- **payment-pending** - Awaiting payment
- **processing** - Orders are being worked on
- **completed** - All orders completed
- **cancelled** - Booking cancelled

Billing status tracking:
- **unpaid** - No payment received
- **partially-paid** - Some payment received
- **paid** - Full payment received

### 5. Timeline Tracking
Each booking maintains a timeline of:
- Status changes
- When changes occurred
- Which staff member made changes
- Descriptive messages for each change

### 6. Consolidated Items Display
Items array in booking consolidates:
- Type (repair or product)
- Device/product details
- Services (for repairs)
- Pricing for each item
- Order reference

## Data Flow

### Checkout to Booking

```
1. Customer adds items to cart
   - Repair orders: { services, device, addOns, totalCost }
   - Shop products: { product, quantity, price }

2. Checkout Initialize
   GET /api/checkout/initialize
   - Validates cart
   - Returns cart + user info

3. Checkout Complete
   POST /api/checkout/complete
   - Creates individual Order documents
   - Calculates totals
   - Creates Booking document with orderIds
   - Links orders to booking
   - Clears cart
   - Returns booking + orderIds

4. Booking Created
   - bookingNumber: auto-generated (BKG-2024-0001)
   - status: "pending"
   - billingStatus: "unpaid"
   - items: consolidated from all orders
   - totalCost: sum of all orders
   - timeline: initial entry "Booking Created"
```

### Booking Retrieval

```
Customer queries their bookings:
GET /api/bookings
- Returns all bookings for user
- Sorted by creation date (newest first)
- Supports filtering by status/billingStatus

Customer views specific booking:
GET /api/bookings/:id
- Returns fully populated booking
- Includes all linked orders
- Includes customer details
- Includes all line items
```

### Admin Operations

```
Admin groups existing orders:
POST /api/bookings/group
- Accepts orderIds[] and customerId
- Creates new booking
- Links all orders to booking
- Returns booking details

Admin updates booking status:
PUT /api/bookings/:id/status
- Updates status field
- Adds timeline entry
- Returns updated booking

Admin updates billing status:
PUT /api/bookings/:id/billing-status
- Updates billingStatus and paymentStatus
- Returns updated booking

Admin cancels booking:
DELETE /api/bookings/:id
- Sets status to "cancelled"
- Cancels all related orders
- Adds timeline entry
- Returns updated booking
```

## Database Schema

### Booking Model

```javascript
{
  _id: ObjectId,
  bookingNumber: String,           // Auto-generated: BKG-2024-0001
  customerId: ObjectId (ref: User),
  orderIds: [ObjectId (ref: Order)],
  repairOrderIds: [ObjectId (ref: Order)],
  shopProductOrderId: ObjectId (ref: Order),
  items: [{
    type: String,                   // "repair" or "product"
    orderId: ObjectId (ref: Order),
    device: String,                 // For repairs
    services: [{                    // For repairs
      name: String,
      price: Number,
      estimatedTime: Number
    }],
    products: [{                    // For products
      name: String,
      quantity: Number,
      price: Number,
      totalPrice: Number
    }],
    cost: Number,
    addedAt: Date
  }],
  status: Enum,                     // pending|payment-pending|processing|completed|cancelled
  billingStatus: Enum,              // unpaid|partially-paid|paid
  paymentStatus: Enum,              // pending|paid|refunded|partial
  subtotal: Number,
  tax: Number,
  discount: Number,
  totalCost: Number,
  appliedPromoCode: String,
  totalOrders: Number,
  timeline: [{
    status: String,
    description: String,
    completedAt: Date,
    staffId: String,
    staffName: String
  }],
  createdAt: Date,
  updatedAt: Date
}
```

### Order Model (Updated)

```javascript
{
  // ... existing fields ...
  bookingId: ObjectId (ref: Booking),  // NEW FIELD - links to booking
}
```

## API Endpoints

### Public Endpoints

#### Get User's Bookings
```
GET /api/bookings
Headers: Authorization: Bearer <token>
Query: status?, billingStatus?, limit?, skip?
Response: { success, bookings[], count }
```

#### Get Specific Booking
```
GET /api/bookings/:id
Headers: Authorization: Bearer <token>
Response: { success, booking }
```

#### Get Booking Summary
```
GET /api/bookings/:id/summary
Headers: Authorization: Bearer <token>
Response: { success, summary }
```

### Admin Endpoints

#### Group Orders into Booking
```
POST /api/bookings/group
Headers: Authorization: Bearer <admin-token>
Body: { orderIds[], customerId }
Response: { success, booking, bookingId }
```

#### Update Booking Status
```
PUT /api/bookings/:id/status
Headers: Authorization: Bearer <admin-token>
Body: { status, description? }
Response: { success, booking }
```

#### Update Booking Billing Status
```
PUT /api/bookings/:id/billing-status
Headers: Authorization: Bearer <admin-token>
Body: { billingStatus, paymentStatus? }
Response: { success, booking }
```

#### Cancel Booking
```
DELETE /api/bookings/:id
Headers: Authorization: Bearer <admin-token>
Response: { success, booking }
```

## Checkout Flow Example

### Before (Multiple Orders)
```
Cart:
  - Repair Order 1: iPhone screen replacement ($150)
  - Repair Order 2: Battery replacement ($80)
  - Shop Product: Screen protector x2 ($20)

Checkout Create:
  ✓ Order 1: ORD-2024-001 (iPhone screen - $150)
  ✓ Order 2: ORD-2024-002 (Battery - $80)
  ✓ Order 3: ORD-2024-003 (Shop products - $20)

Customer sees:
  - 3 separate orders
  - 3 separate bills
  - Unclear consolidated total
```

### After (Consolidated Booking)
```
Cart:
  - Repair Order 1: iPhone screen replacement ($150)
  - Repair Order 2: Battery replacement ($80)
  - Shop Product: Screen protector x2 ($20)

Checkout Create:
  ✓ Order 1: ORD-2024-001 (iPhone screen - $150) → bookingId
  ✓ Order 2: ORD-2024-002 (Battery - $80) → bookingId
  ✓ Order 3: ORD-2024-003 (Shop products - $20) → bookingId
  ✓ Booking: BKG-2024-0001 (All items consolidated)

Customer sees:
  - 1 booking (BKG-2024-0001)
  - All items listed in booking
  - Single total cost ($250 + $20 tax = $270)
  - Unified billing reference
```

## Error Handling

### Checkout Errors
- Cart empty: Returns 400 error before checkout
- Booking creation failure: Graceful degradation (orders created, booking skipped)
- Cart clearing failure: Non-critical (doesn't fail checkout)

### Booking Retrieval Errors
- Booking not found: 404 error
- Unauthorized access: 403 error (non-owner accessing)
- Invalid status/billingStatus: 400 error (admin endpoints)

### Booking Operations
- Group orders: Validates all orders exist and belong to customer
- Already booked orders: Warning logged but continues
- Order not found: Individual order skipped with warning

## Security

1. **Authentication**
   - All endpoints require valid JWT token
   - User can only see their own bookings

2. **Authorization**
   - Grouping/updating/deleting requires admin role
   - Non-admin users get 403 error

3. **Data Validation**
   - All inputs validated before processing
   - Status values restricted to enum
   - ObjectId validation for references

## Performance Considerations

1. **Indexing**
   - Bookings indexed by customerId, status, createdAt, bookingNumber
   - Enables fast queries for:
     - User's bookings
     - Status filtering
     - Sorting by date

2. **Population**
   - Auto-population can be skipped with `skipAutoPopulate` option
   - Reduces N+1 queries for large datasets

3. **Timeline Tracking**
   - Timeline entries added on each status change
   - Supports audit logging without separate collection

## Testing

### Manual Testing Scenarios
1. Create cart with multiple repair orders
2. Add shop products to cart
3. Checkout and verify booking created
4. Retrieve booking and verify all orders linked
5. Test admin grouping of existing orders
6. Test status updates
7. Test billing status updates

### Automated Testing
Run: `node test-booking-consolidation.js`

Tests:
- Customer registration
- Cart operations
- Checkout initialization
- Checkout completion
- Booking retrieval
- Booking summary
- Status updates
- Error scenarios

## Deployment Notes

1. **Database Migration**
   - No migration needed for existing orders (bookingId is optional)
   - Existing orders won't have bookingId
   - New orders will include bookingId

2. **Breaking Changes**
   - None. Existing order API unchanged.
   - Checkout endpoint now returns booking in response (backwards compatible)

3. **Environment Variables**
   - No new environment variables required

4. **Dependencies**
   - Uses existing mongoose, express, other packages
   - No new npm dependencies needed

## Future Enhancements

1. **Booking Analytics**
   - Average orders per booking
   - Booking completion time
   - Revenue per booking

2. **Booking Workflows**
   - Automated status transitions
   - Booking-level workflows (not just orders)

3. **Payment Integration**
   - Charge entire booking at once
   - Split payments across orders

4. **Notifications**
   - Booking status change notifications
   - Consolidated invoices

## Troubleshooting

### Booking Not Created After Checkout
- Check server logs for BookingService errors
- Verify Order documents created successfully
- Booking creation is non-critical - orders still created even if booking fails

### Orders Not Linked to Booking
- Check bookingId field in Order documents
- Verify checkout completed successfully
- Check BookingService.create logs

### Access Denied to Booking
- Verify user owns the booking (customerId matches)
- Admin users should be able to access any booking
- Check authorization middleware

### Grouping Orders Fails
- Verify all order IDs exist
- Verify orders belong to specified customer
- Verify user has admin role

## Support & Maintenance

For issues or questions about the booking consolidation feature:
1. Check server logs for detailed error messages
2. Verify database indexes are created
3. Run test script to validate API functionality
4. Check authentication tokens are valid
