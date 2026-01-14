# Testing Guide: Associated Orders & Repairs Status Fix

## Overview
This guide explains how to test that the Associated Orders & Repairs nested table now displays the **correct repair progress status** instead of showing "pending" for every order.

---

## Quick Summary of the Fix

**What was broken:** Nested table showed "pending" for all associated orders
**Root cause:** Using cached booking data instead of fetching current order status
**What's fixed:** Now fetches fresh order data showing current repair progress status

---

## Manual Testing Steps

### Setup
1. **Open the application**: Navigate to https://preview-05wl642g.ui.pythagora.ai
2. **Login as Admin**: Use admin credentials to access the admin dashboard
3. **Navigate to Bookings**: Go to Admin Dashboard → Bookings Management

### Test 1: View Expanded Booking with Multiple Orders
**Objective**: Verify that expanding a booking shows orders with correct repair progress statuses

**Steps**:
1. In the Bookings Management page, look for a booking with multiple associated orders
   - If no bookings exist, create test data first by running seed script
   - Bookings should have 2+ orders in them to test properly

2. **Click the expand button** (chevron icon) on the left side of a booking row
   - The row should expand to show "Associated Orders & Repairs"
   - You should see a nested table with columns: Order Number, Type, Device/Product, Services/Details, Progress, **Status**, Cost

3. **Observe the Status column** in the nested table:
   - ✅ **Expected**: Show various statuses like "pending", "in-progress", "completed", "quality-check", "ready-for-pickup", etc.
   - ❌ **Wrong**: All rows showing "pending" (this was the bug)

4. **Verify status colors** match repair progress stages:
   - Yellow = pending
   - Blue = in-progress
   - Purple = quality-check
   - Amber = ready-for-pickup
   - Green = completed
   - Red = cancelled

### Test 2: Multiple Bookings with Different Order Statuses
**Objective**: Verify that different bookings show different order statuses

**Steps**:
1. Expand 2-3 different bookings
2. Note the different statuses shown in each booking's associated orders:
   - First booking might show: "pending", "in-progress"
   - Second booking might show: "completed"
   - Third booking might show: "quality-check", "ready-for-pickup"
3. ✅ **Expected**: Each booking shows the actual current status of its orders
4. ❌ **Wrong**: All showing "pending"

### Test 3: Real-time Status Updates
**Objective**: Verify that the status reflects current order status (not cached at booking creation time)

**Steps**:
1. Open Bookings Management page in two browser windows/tabs (split view)
2. In one window, expand a booking to see the associated orders
3. In another window (or in the OrderDetails for one of those orders), update the order status manually
4. Switch back to the Bookings Management window and click collapse/expand on the same booking
5. ✅ **Expected**: The status in the expanded view should show the updated status
6. ❌ **Wrong**: The status remains unchanged (old cached value)

### Test 4: Responsive Design
**Objective**: Verify the nested table displays correctly on different screen sizes

**Steps**:
1. Expand a booking on a desktop view (full width)
   - ✅ All columns visible: Order Number, Type, Device/Product, Services/Details, Progress, Status, Cost

2. Resize browser to tablet width (~768px)
   - ✅ Columns adjust appropriately, Status column still visible

3. Resize browser to mobile width (~375px)
   - ✅ Table becomes scrollable if needed, Status column visible when scrolled

### Test 5: Error Handling
**Objective**: Verify graceful handling when API fails

**Steps**:
1. Open browser Developer Tools (F12 or Cmd+Option+I)
2. Go to Network tab
3. Expand a booking
4. Look for API call to `/api/bookings/{id}/orders`
   - ✅ Should be a GET request
   - ✅ Should return status 200 with orders data

5. If API fails (network error, etc.):
   - ✅ Should show error message: "Failed to load associated orders"
   - ✅ Should not crash the page

### Test 6: Console Logs (For Developers)
**Objective**: Verify that debug logging is working

**Steps**:
1. Open browser Developer Tools (F12)
2. Go to Console tab
3. Expand a booking
4. In the Console, you should see logs like:
   ```
   Fetching orders for booking: 507f1f77bcf1216b4d0000000
   Retrieved 2 orders with repair progress status
   ```
5. ✅ Logs confirm the API was called and data was retrieved

---

## Expected Results Summary

| Test | Expected Result | Status |
|------|-----------------|--------|
| Test 1: View expanded booking | Shows various repair statuses (not all "pending") | ✅ |
| Test 2: Multiple bookings | Different bookings show different statuses | ✅ |
| Test 3: Real-time updates | Status reflects current order status | ✅ |
| Test 4: Responsive design | Works on desktop, tablet, mobile | ✅ |
| Test 5: Error handling | Graceful error messages when API fails | ✅ |
| Test 6: Console logs | Debug logs show in browser console | ✅ |

---

## Creating Test Data (If Needed)

If there are no bookings or orders to test with, run the seed script:

```bash
# From project root
npm run seed
```

This creates test bookings with multiple orders in various statuses.

---

## API Testing (Developers)

### Test the API Endpoint Directly

Use curl to test the new endpoint:

```bash
# Login first
curl -X POST https://preview-05wl642g.ui.pythagora.ai/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@fixithub.com","password":"password123"}'

# Copy the accessToken from response, then:
curl -X GET https://preview-05wl642g.ui.pythagora.ai/api/bookings/{BOOKING_ID}/orders \
  -H "Authorization: Bearer {ACCESS_TOKEN}"
```

**Expected Response**:
```json
{
  "success": true,
  "orders": [
    {
      "orderId": "507f1f77bcf1216b4d0000001",
      "orderNumber": "ORD-2024-001",
      "type": "repair",
      "device": "Apple iPhone 13",
      "services": [
        {
          "name": "Screen Replacement",
          "price": 150,
          "estimatedTime": 120
        }
      ],
      "status": "in-progress",
      "progress": 50,
      "cost": 150
    }
  ],
  "count": 1
}
```

Note the `status` field contains repair progress status like "in-progress", not payment status like "pending".

---

## Troubleshooting

### Issue: Expanded booking shows "Loading orders..."

**Cause**: API request is taking time
**Solution**: Wait a few seconds, the data should load

### Issue: Error message "Failed to load associated orders"

**Cause**: API endpoint returned an error
**Solution**:
1. Check browser console for error details
2. Verify you're logged in as admin
3. Verify the booking ID exists
4. Check that the server is running

### Issue: Status column showing "pending" for all orders

**Cause**: Might be using old cached code
**Solution**:
1. Hard refresh the browser (Ctrl+Shift+R or Cmd+Shift+R)
2. Clear browser cache
3. Check that all files have been deployed

### Issue: Console shows "getBookingOrders is not defined"

**Cause**: API client function not imported
**Solution**:
1. Verify `getBookingOrders` is imported in BookingsManagement.tsx
2. Check that bookings.ts was updated with the new function
3. Hard refresh the browser

---

## Sign-Off Checklist

Once all tests pass, check these boxes:

- [ ] Test 1: Expanded booking shows correct repair statuses
- [ ] Test 2: Multiple bookings show different statuses
- [ ] Test 3: Real-time status updates work
- [ ] Test 4: Responsive design works on all screen sizes
- [ ] Test 5: Error handling works gracefully
- [ ] Test 6: Console logs appear when expanding
- [ ] API endpoint returns correct data structure
- [ ] No console errors when using the feature
- [ ] Feature works in both light and dark mode
- [ ] No performance issues when expanding bookings

---

## Notes for QA Teams

- **Data Sensitivity**: Test with real booking data if available
- **Performance**: Check that expanding bookings completes within 2 seconds
- **Concurrency**: Test expanding/collapsing multiple bookings rapidly
- **Cross-browser**: Test on Chrome, Firefox, Safari, Edge
- **Accessibility**: Verify screen readers can read the status correctly

---
