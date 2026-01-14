# Shopping Cart Repair Order Implementation

## Overview
This implementation adds support for repair orders in the shopping cart system. Previously, the cart only supported product items from the web shop. Now it can handle both product items and repair service orders.

## Changes Made

### Backend Changes

#### 1. Cart Model (`server/models/Cart.js`)
- Added `repairOrderItemSchema` to define repair order structure
- Modified `cartSchema` to include `repairOrders` array field
- Updated `pre-save` hook to calculate totals including repair orders
- Made `productId` field optional in `cartItemSchema` (since repair orders don't have products)

**Key Fields in Repair Order:**
- `deviceType`, `deviceBrand`, `deviceModel` - Device information
- `services` - Array of service IDs
- `addOns` - Array of add-on service objects
- `customerNotes` - Optional notes from customer
- `photos` - Array of photo URLs
- `totalCost` - Total cost of the repair order

#### 2. Cart Service (`server/services/cartService.js`)
- Updated `getCart()` to populate repair orders
- Updated `clearCart()` to clear repair orders
- Added `addRepairOrderToCart(userId, repairOrderData)` - Add repair order to cart
- Added `removeRepairOrderFromCart(userId, repairOrderId)` - Remove repair order from cart

#### 3. Cart Routes (`server/routes/cartRoutes.js`)
- Added `POST /api/cart/add-repair-order` endpoint
- Added `DELETE /api/cart/remove-repair-order/:repairOrderId` endpoint

### Frontend Changes

#### 1. Shop API (`client/src/api/shop.ts`)
- Added `RepairOrderData` interface for repair order data structure
- Added `RepairOrderItem` interface for cart repair orders
- Updated `Cart` interface to include `repairOrders` field
- Added `addRepairOrderToCart()` function
- Added `removeRepairOrderFromCart()` function

#### 2. New Order Page (`client/src/pages/NewOrder.tsx`)
- Imported `addRepairOrderToCart` from shop API
- Updated Step 5 "Add to Cart & Review" button handler:
  - Calls `addRepairOrderToCart()` API instead of navigating with state
  - Properly handles success and error cases
  - Navigates to cart page after successful addition

#### 3. Shopping Cart Page (`client/src/pages/ShoppingCart.tsx`)
- Added imports for repair order handling (`removeRepairOrderFromCart`, `Wrench`, `Smartphone` icons)
- Added `handleRemoveRepairOrder()` function
- Updated empty cart check to include repair orders
- Updated empty cart UI with "Create Repair Order" button
- Added repair order card display in cart items list:
  - Shows device information
  - Displays service and add-on counts
  - Shows total cost
  - Includes remove button

## API Endpoints

### Add Repair Order to Cart
```
POST /api/cart/add-repair-order
Authorization: Bearer <token>

Request Body:
{
  "deviceType": "Smartphone",
  "deviceBrand": "Samsung",
  "deviceModel": "Galaxy S23",
  "services": ["serviceId1", "serviceId2"],
  "addOns": [
    {
      "name": "Screen Protector",
      "description": "Premium glass",
      "price": 25,
      "estimatedTime": "15 minutes"
    }
  ],
  "customerNotes": "Optional notes",
  "photos": ["url1", "url2"],
  "totalCost": 250
}

Response:
{
  "success": true,
  "message": "Repair order added to cart successfully",
  "cart": { ... }
}
```

### Remove Repair Order from Cart
```
DELETE /api/cart/remove-repair-order/:repairOrderId
Authorization: Bearer <token>

Response:
{
  "success": true,
  "message": "Repair order removed from cart",
  "cart": { ... }
}
```

## User Flow

1. User navigates to "Create New Repair Order" (/new-order)
2. User completes all 5 steps:
   - Step 1: Select device
   - Step 2: Select repair services
   - Step 3: Add device lock info and add-ons
   - Step 4: Add photos and notes
   - Step 5: Review and add to cart
3. User clicks "Add to Cart & Review" button
4. Repair order is added to the cart via API
5. User is redirected to Shopping Cart page (/cart)
6. User can see the repair order in their cart
7. User can remove repair order or proceed to checkout

## Testing

See testing instructions at the end of this document.
