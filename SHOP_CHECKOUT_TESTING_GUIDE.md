# Shop Products Checkout - Testing Guide

## Quick Testing Instructions

This guide provides step-by-step instructions to test the new shop products checkout functionality.

---

## Prerequisites

✅ Application is running at: https://preview-0zq884ns.ui.pythagora.ai
✅ Test user account: `customer@example.com` / `customer123`
✅ Browser with dev tools open (F12) to view console logs

---

## Test 1: Shop Products Only Checkout

**Objective:** Verify customers can checkout with shop products only (no repair orders)

### Steps:

1. **Login to the application**
   - Open https://preview-0zq884ns.ui.pythagora.ai
   - Click "Login" (top right)
   - Enter email: `customer@example.com`
   - Enter password: `customer123`
   - Click "Sign In"
   - **Expected:** Redirected to Dashboard, username visible in header

2. **Navigate to Web Shop**
   - Click "Shop" in the navigation menu (or sidebar)
   - **Expected:** Product grid displays with multiple products

3. **Add products to cart**
   - Scroll through products
   - Click "Add to Cart" on "Premium Screen Protector" (or any product)
   - **Expected:** Success toast "Item added to cart"
   - **Expected:** Cart badge updates to show "1" item
   - Click "Add to Cart" on another product (e.g., "USB-C Cable")
   - **Expected:** Cart badge updates to "2"

4. **View shopping cart**
   - Click the cart icon (top right) or navigate to Shopping Cart
   - **Expected:** See list of added products
   - **Expected:** Each product shows quantity, price, and total
   - **Expected:** Order summary displays subtotal, tax, and grand total
   - **Expected:** "Proceed to Checkout" button is visible and enabled

5. **Proceed to checkout**
   - Click "Proceed to Checkout" button
   - **Expected:** Toast notification: "Successfully created shop product order"
   - **Expected:** Automatic redirect to Orders page
   - **Expected:** Cart icon shows "0" items

6. **Verify order created**
   - On Orders page, see the new order at the top
   - **Expected:** Order shows device type "Shop Products Order"
   - **Expected:** Status is "Pending"
   - **Expected:** Total cost matches cart total

7. **View order details**
   - Click on the new order to open details
   - **Expected:** Order details page opens
   - **Expected:** "Device Information" section shows:
     - Device Brand: N/A
     - Device Model: Shop Products Order
     - Device Type: Shop Products
   - **Expected:** "Shop Products" section shows all purchased products
   - **Expected:** Each product shows quantity and price

8. **Verify cart is empty**
   - Navigate back to Shopping Cart
   - **Expected:** "Your cart is empty" message
   - **Expected:** "Continue Shopping" button visible

### Success Criteria:

✅ Products can be added to cart
✅ Checkout completes without errors
✅ Success toast displays correct message
✅ Order is created with "Shop Products" type
✅ Cart is cleared after checkout
✅ Order appears in Orders list
✅ Order details show all products correctly

---

## Test 2: Mixed Cart (Repair Order + Shop Products)

**Objective:** Verify checkout works with both repair orders and shop products

### Steps:

1. **Create a repair order**
   - Navigate to "New Order" (in sidebar or navigation)
   - **Step 1:** Select device
     - Device Type: Smartphone
     - Manufacturer: Apple
     - Model: iPhone 13 Pro
     - Click "Continue"
   - **Step 2:** Select services
     - Check "Screen Replacement" (or any service)
     - Click "Continue"
   - **Step 3:** Configure options
     - Add device notes (optional)
     - Click "Continue"
   - **Step 4:** Review order
     - Verify order summary
     - Click "Continue"
   - **Step 5:** Add to cart
     - Click "Add to Cart"
   - **Expected:** Toast "Repair order added to cart"
   - **Expected:** Cart badge shows "1"

2. **Add shop products**
   - Navigate to "Shop"
   - Add 1-2 products to cart
   - **Expected:** Cart badge increments (e.g., shows "2" or "3")

3. **View cart with mixed items**
   - Open Shopping Cart
   - **Expected:** See section "Repair Orders" with device info
   - **Expected:** See section "Products" with shop items
   - **Expected:** Order summary shows combined total

4. **Checkout mixed cart**
   - Click "Proceed to Checkout"
   - **Expected:** Toast: "Successfully created 1 repair order(s) and 1 shop product order"
   - **Expected:** Redirect to Orders page

5. **Verify both orders created**
   - On Orders page, see TWO new orders:
     - Order 1: Device repair (shows actual device info)
     - Order 2: Shop Products Order (shows "Shop Products")
   - **Expected:** Both orders have "Pending" status
   - **Expected:** Total costs are separate and correct

6. **Check repair order details**
   - Click the repair order
   - **Expected:** Shows device: iPhone 13 Pro
   - **Expected:** Shows selected services
   - **Expected:** "Shop Products" section is empty

7. **Check shop order details**
   - Go back and click the shop product order
   - **Expected:** Shows device: "Shop Products Order"
   - **Expected:** "Repair Services" section is empty
   - **Expected:** "Shop Products" section shows all products

### Success Criteria:

✅ Can add repair order to cart
✅ Can add shop products to same cart
✅ Cart displays both types correctly
✅ Checkout creates separate orders
✅ Success message mentions both order types
✅ Repair order has real device info
✅ Shop order has placeholder device info
✅ All products and services appear in correct orders

---

## Test 3: Empty Cart Validation

**Objective:** Verify proper error handling for empty cart

### Steps:

1. **Ensure cart is empty**
   - Navigate to Shopping Cart
   - If items present, remove them all
   - **Expected:** "Your cart is empty" message

2. **Attempt checkout with empty cart**
   - Scroll to bottom (if "Proceed to Checkout" button visible)
   - Click "Proceed to Checkout"
   - **Expected:** Error toast: "Cart is empty. Please add items before checkout."
   - **Expected:** User stays on Shopping Cart page
   - **Expected:** No orders created

### Success Criteria:

✅ Empty cart shows appropriate message
✅ Checkout button behavior handles empty cart
✅ Error message is clear and helpful
✅ No orders created from empty cart

---

## Test 4: Edge Case - Multiple Quantities

**Objective:** Verify correct handling of multiple product quantities

### Steps:

1. **Add product with specific quantity**
   - Navigate to Shop
   - Find "Premium Screen Protector"
   - Add to cart
   - Open Shopping Cart
   - Increase quantity to 3 using quantity selector
   - **Expected:** Price updates (e.g., $29.99 × 3 = $89.97)

2. **Add another product**
   - Go back to Shop
   - Add "USB-C Cable" with quantity 2
   - **Expected:** Cart shows both products with quantities

3. **Checkout and verify**
   - Proceed to checkout
   - Open created order details
   - **Expected:** Order shows:
     - Premium Screen Protector: Quantity 3
     - USB-C Cable: Quantity 2
   - **Expected:** Total cost = (29.99×3) + (price×2)

### Success Criteria:

✅ Quantity changes reflect in cart
✅ Quantity changes affect total price
✅ Order stores correct quantities
✅ Total cost calculation is accurate

---

## Test 5: Admin View of Shop Orders

**Objective:** Verify admin can manage shop product orders

### Steps:

1. **Logout and login as admin**
   - Click profile menu → Logout
   - Login with: `admin@example.com` / `admin123`

2. **Navigate to Order Management**
   - Click "Admin" in sidebar
   - Click "Order Management"
   - **Expected:** See list of all orders

3. **Filter by device type**
   - Look for orders with device type "Shop Products"
   - **Expected:** Shop orders visible in list

4. **Open shop product order**
   - Click on a shop order
   - **Expected:** Order Details page opens
   - **Expected:** Shows "Shop Products Order"
   - **Expected:** Shop Products section shows items

5. **Update order status**
   - Change status from "Pending" to "Completed"
   - **Expected:** Status updates successfully
   - **Expected:** Timeline shows status change

### Success Criteria:

✅ Admin can see shop orders
✅ Can filter/search shop orders
✅ Order details display correctly
✅ Can update order status
✅ Shop orders integrate with existing admin features

---

## Test 6: Browser Console Verification

**Objective:** Verify proper logging and no errors

### Steps:

1. **Open browser console** (F12 → Console tab)

2. **Clear console logs**

3. **Perform shop product checkout**
   - Add products to cart
   - Proceed to checkout

4. **Check console logs**
   - **Expected:** No red error messages
   - **Expected:** Logs show:
     ```
     log: Proceed to checkout clicked. Is authenticated: true
     log: User authenticated, initializing checkout...
     log: Checkout initialized successfully: {...}
     log: Completing checkout and creating orders...
     ```

5. **Check Network tab**
   - Filter by XHR
   - **Expected:** See successful API calls:
     - POST /api/checkout/initialize → 200 OK
     - POST /api/checkout/complete → 200 OK
   - **Expected:** Response includes created order(s)

### Success Criteria:

✅ No JavaScript errors in console
✅ API calls return 200 status
✅ Response data is properly formatted
✅ Frontend logs show expected flow

---

## Test 7: Responsive Design

**Objective:** Verify checkout works on different screen sizes

### Steps:

1. **Test on desktop** (default)
   - Complete checkout as per Test 1
   - **Expected:** All elements visible and functional

2. **Test on tablet view**
   - Press F12 → Click device toolbar icon
   - Select "iPad" or set width to 768px
   - Navigate through cart and checkout
   - **Expected:** Layout adjusts, all features work

3. **Test on mobile view**
   - Set device to "iPhone 12" or width 375px
   - Complete checkout process
   - **Expected:** Mobile-optimized layout
   - **Expected:** Touch-friendly buttons
   - **Expected:** Cart and checkout work properly

### Success Criteria:

✅ Desktop layout is clean and functional
✅ Tablet view adapts appropriately
✅ Mobile view is usable
✅ Checkout works on all screen sizes

---

## Troubleshooting

### Issue: "Checkout failed" error

**Check:**
- Browser console for error details
- Network tab for failed API calls
- Server logs for backend errors

**Common causes:**
- Product deleted from database
- Authentication token expired
- Network connectivity issues

**Solution:**
- Refresh page and retry
- Clear cart and re-add products
- Logout and login again

### Issue: Order not appearing in list

**Check:**
- Verify you're on the correct Orders page
- Check if redirected to Orders page after checkout
- Refresh the Orders page

**Solution:**
- Navigate manually to Orders page
- Check browser console for errors
- Verify success toast appeared

### Issue: Wrong total cost

**Check:**
- Product prices in database
- Quantity selectors in cart
- Order summary calculations

**Solution:**
- Recalculate manually
- Check product details in shop
- Report if calculation is incorrect

---

## Reporting Issues

If you encounter any issues during testing:

1. **Capture evidence:**
   - Screenshot of error message
   - Browser console logs (copy full text)
   - Network tab showing failed requests
   - Server logs (if accessible)

2. **Document steps:**
   - What you were trying to do
   - Steps taken before error
   - Expected vs actual behavior

3. **Include environment:**
   - Browser and version
   - Screen size / device type
   - User account used for testing

---

## Success Summary

After completing all tests, you should have verified:

✅ Shop products can be purchased without repair orders
✅ Mixed carts (repair + products) work correctly
✅ Empty cart validation prevents invalid checkout
✅ Quantities and prices calculate correctly
✅ Orders appear properly in customer and admin views
✅ No console errors or failed API calls
✅ Responsive design works on all screen sizes
✅ Success messages are clear and accurate

---

## Next Steps

Once testing is complete:

1. ✅ Mark all test scenarios as passed
2. ✅ Document any issues found
3. ✅ Report success to stakeholders
4. ✅ Update user documentation
5. ✅ Train customer support team
6. ✅ Monitor production logs after deployment

---

**Testing completed by:** _________________
**Date:** _________________
**Result:** ☐ All tests passed ☐ Issues found (see notes)
**Notes:** ________________________________________________
