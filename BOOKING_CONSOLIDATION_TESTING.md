# Booking Consolidation - Testing Instructions

## Overview
This document provides step-by-step testing instructions for the order consolidation into booking feature. All testing can be done through the web browser interface without requiring command-line operations.

## Pre-Testing Setup

1. The application should already be running at: https://preview-0d8qg901.ui.pythagora.ai
2. You should have a working internet connection
3. Clear your browser cache/cookies if you have previous test sessions

## Test Scenario 1: Complete Checkout Workflow with Booking Creation

### Step 1.1: Create a Test Account
**Action:**
"Open your web browser and navigate to 'https://preview-0d8qg901.ui.pythagora.ai'. Click on the 'Register' or 'Sign Up' link. Fill in the registration form with:
- Email: booking-test-{timestamp}@example.com (use a unique timestamp)
- Password: TestPassword123!
- First Name: Booking
- Last Name: Tester
- Phone: +1234567890

Click the 'Register' or 'Create Account' button."

**Expected Result:**
"You should be redirected to the dashboard page. A 'Welcome' or success message should appear. The page should show you're logged in as the new user."

### Step 1.2: Add a Repair Order to Cart
**Action:**
"Click on 'Create New Order' or 'New Repair Order' button. In the device selection form:
1. Select or search for a device (e.g., 'iPhone 13', 'Samsung Galaxy')
2. Select a repair service (e.g., 'Screen Replacement', 'Battery Replacement')
3. Add any additional services or add-ons if available
4. Click 'Add to Cart' or 'Continue'

Verify the repair order is added to cart (you should see a cart badge or confirmation)."

**Expected Result:**
"The repair order should appear in your cart. You should see:
- Device details (brand, model, type)
- Selected service(s)
- Estimated price
- A notification that item was added to cart"

### Step 1.3: Add Shop Products to Cart
**Action:**
"Navigate to the 'Web Shop' or 'Shop' section. Browse available products and:
1. Click on a product (e.g., screen protector, phone case)
2. Select quantity (e.g., 2)
3. Click 'Add to Cart'

Repeat this for at least one more product."

**Expected Result:**
"Each product should be added to cart. You should see:
- Product name and image
- Quantity selected
- Price per item and total
- Cart count should increase (usually shown as a badge on cart icon)"

### Step 1.4: View Cart Summary
**Action:**
"Click on the 'Cart' icon or 'Shopping Cart' link. Review the cart contents."

**Expected Result:**
"Your cart page should display:
- Repair order(s) with device details and services
- Shop product(s) with quantities and prices
- Subtotal amount
- Tax calculation (8%)
- Discount field (if applicable)
- Total amount
- 'Checkout' or 'Proceed to Checkout' button"

### Step 1.5: Proceed to Checkout
**Action:**
"Click the 'Checkout' or 'Proceed to Checkout' button."

**Expected Result:**
"You should be taken to the checkout page. The page should display:
- All items from cart (both repair orders and shop products)
- Billing address fields (or use saved address)
- Shipping address fields
- Order summary with total cost
- 'Complete Purchase' or 'Place Order' button"

### Step 1.6: Complete Checkout and Verify Booking
**Action:**
"Fill in any required billing/shipping information if not already filled. Click 'Complete Purchase' or 'Place Order' button. Wait for the request to complete (should take 2-5 seconds)."

**Expected Result:**
"You should see a success message or be redirected to an order confirmation page. The message should indicate:
- ✓ Order(s) created successfully
- Booking number (format: BKG-YYYY-NNNN, e.g., BKG-2024-0001)
- Total cost with breakdown
- Confirmation that all items are in one booking
- Next steps or 'View Orders' button

**IMPORTANT:** Write down the booking number for use in later tests."

### Step 1.7: Navigate to Orders/Bookings
**Action:**
"Click on 'View Orders', 'My Orders', or 'Bookings' link. This may be in the main navigation, dashboard, or customer menu."

**Expected Result:**
"You should see a list of your bookings. The page should display:
- Booking number (BKG-2024-0001 from previous step)
- Booking status (should be 'pending' or 'payment-pending')
- Total cost
- Date created
- 'View Details' or 'Expand' option"

## Test Scenario 2: View Booking Details

### Step 2.1: Open Booking Details
**Action:**
"From your bookings list, click on the booking number or 'View Details' button for the booking created in Test Scenario 1."

**Expected Result:**
"The booking details page should display:
- Booking number and status
- Consolidated items section showing:
  - Repair order(s): device brand/model, services, individual prices
  - Shop product(s): product names, quantities, prices
- Total cost breakdown:
  - Subtotal
  - Tax (8%)
  - Discount (if any)
  - Total
- All individual orders linked to this booking should be visible or accessible"

### Step 2.2: Verify All Orders in Booking
**Action:**
"Look at the 'Orders' or 'Related Orders' section in the booking details. Count the number of orders shown."

**Expected Result:**
"You should see:
- Same number of orders as you created (repair orders + 1 for shop products)
- Each order should have:
  - Order number (ORD-YYYY-NNN format)
  - Status
  - Cost breakdown
  - Link/option to view order details

For example: 2 repair orders + 1 shop product order = 3 total orders in 1 booking"

### Step 2.3: Verify Timeline/Status History
**Action:**
"Scroll down to find the 'Timeline' or 'Status History' section of the booking."

**Expected Result:**
"You should see a timeline showing:
- 'Booking Created' entry with timestamp
- Description like 'Orders consolidated into booking'
- Staff/System name
- More status changes may be visible depending on admin actions"

## Test Scenario 3: Verify Order-Booking Relationship

### Step 3.1: Access Individual Order
**Action:**
"From the booking details, click on one of the linked order numbers (e.g., ORD-2024-001) to view the order details."

**Expected Result:**
"The order details page should display:
- Order number
- Order status
- Device details
- Services/items for this order
- ✓ Should show a 'Booking' or 'Part of Booking' section with:
  - Booking number (BKG-2024-0001)
  - Link back to booking details"

### Step 3.2: Verify Booking Reference
**Action:**
"Look for a 'Booking' section or field in the order details."

**Expected Result:**
"The order should clearly show:
- It is part of booking: [Booking Number]
- Clicking the booking number should take you back to the consolidated booking
- This confirms the order-to-booking relationship"

## Test Scenario 4: Multiple Bookings Test (Optional)

### Step 4.1: Create Another Order
**Action:**
"Repeat Test Scenario 1 (Steps 1.2 through 1.6) to create another booking with different items."

**Expected Result:**
"After checkout, you should have:
- A new booking with a different booking number (BKG-2024-0002)
- Same format and structure as first booking
- Both bookings visible when viewing your bookings list"

### Step 4.2: Compare Bookings
**Action:**
"Go to your bookings list and view both bookings you created."

**Expected Result:**
"You should see:
- Booking 1 (BKG-2024-0001) with orders from first scenario
- Booking 2 (BKG-2024-0002) with orders from second scenario
- Each booking is independent
- Different items/orders in each booking"

## Test Scenario 5: Browser/Responsive Design Test

### Step 5.1: Desktop View
**Action:**
"Open the booking details page on a full-width desktop browser."

**Expected Result:**
"All booking information should be clearly visible:
- Multi-column layout with items on left, summary on right (or similar)
- Booking details readable and well-organized
- Tables/lists properly formatted
- Buttons and links accessible"

### Step 5.2: Tablet View
**Action:**
"Resize your browser window to tablet width (approximately 768px) or use browser's responsive design mode. View the booking details page."

**Expected Result:**
"Layout should adapt to tablet size:
- Single column layout
- Items and summary stacked vertically
- Readable font sizes
- Touch-friendly button sizes
- No horizontal scrolling needed"

### Step 5.3: Mobile View
**Action:**
"Resize your browser window to mobile width (approximately 375px) or use browser's mobile view. View the booking details page."

**Expected Result:**
"Layout should be fully responsive:
- All content accessible without horizontal scroll
- Large enough touch targets
- Collapsible sections if needed
- Readable on small screen
- All information still visible"

## Test Scenario 6: Error Scenarios (If Applicable)

### Step 6.1: Empty Cart Checkout (if possible)
**Action:**
"Clear your cart completely. Try to proceed to checkout."

**Expected Result:**
"You should see an error message:
- 'Cart is empty'
- 'Please add items before checkout'
- Option to continue shopping"

### Step 6.2: Access Another User's Booking (if applicable)
**Action:**
"If you can obtain another user's booking ID, try to access it directly via URL or list."

**Expected Result:**
"You should NOT be able to see another user's booking:
- 404 error or 'Booking not found' message
- Or 'Access Denied' / 'Unauthorized' message
- Redirected to your own bookings"

## Post-Testing Checklist

- [ ] Successfully created account
- [ ] Added repair order to cart
- [ ] Added shop products to cart
- [ ] Completed checkout
- [ ] Booking was automatically created
- [ ] Booking contains all cart items consolidated
- [ ] Booking has correct booking number format
- [ ] Can view booking details
- [ ] Can view individual orders within booking
- [ ] Orders show relationship to booking
- [ ] Timeline shows booking creation
- [ ] Can create multiple bookings
- [ ] Responsive design works on all screen sizes
- [ ] Error handling works correctly

## Success Criteria

✓ **Order Consolidation Working** if:
- Orders from single checkout are grouped into one booking
- All orders reference the same booking ID
- Booking consolidates all items for unified billing

✓ **Booking Accessible** if:
- Can retrieve booking via bookings list
- Can view booking details
- Can see all orders linked to booking

✓ **System Functioning Correctly** if:
- No errors in browser console
- Responsive design adapts to all screen sizes
- All functionality works as expected
- Error scenarios handled gracefully

## Troubleshooting

### Issue: Booking not created after checkout
**Solution:**
1. Check browser console for errors (F12 → Console tab)
2. Refresh the page
3. Try checkout again with different items
4. Check server logs if available

### Issue: Can't see booking in bookings list
**Solution:**
1. Refresh the page
2. Log out and log back in
3. Check if you're viewing the correct user's bookings
4. Try clearing browser cache

### Issue: Booking shows wrong items
**Solution:**
1. Verify the items you added to cart
2. Check if orders were created correctly
3. Refresh the booking details page
4. Try a new checkout to test again

### Issue: Responsive design looks wrong
**Solution:**
1. Clear browser cache
2. Try a different browser
3. Make sure window is properly resized
4. Try incognito/private browsing mode

## Additional Testing Commands (Optional - For Developers)

To test via command line (requires Node.js and curl):

```bash
# Test user registration
curl -X POST http://localhost:3000/api/checkout/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123!",
    "firstName": "Test",
    "lastName": "User"
  }'

# Get user's bookings (requires token)
curl -X GET http://localhost:3000/api/bookings \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"

# Get specific booking (requires token)
curl -X GET http://localhost:3000/api/bookings/BOOKING_ID \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

## Summary

The booking consolidation feature is working correctly if all test scenarios pass and success criteria are met. The feature provides:
- Automatic order consolidation in checkout
- Unified booking reference for all items
- Proper order-to-booking linkage
- Clear booking status and timeline tracking
- Responsive design across all devices

---

**Test Date:** _______________
**Tester Name:** _______________
**Overall Status:** ✓ PASS / ✗ FAIL
**Notes:** _________________________________________________
