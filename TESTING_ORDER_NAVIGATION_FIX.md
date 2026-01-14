# Testing Guide: Order Navigation Fix in Booking Management

## Overview
This testing guide provides comprehensive procedures to verify that the order navigation fix is working correctly in the Booking Management interface.

## Prerequisites
- Admin user credentials (pre-configured in the system)
- Access to the running application at https://preview-0d8qg901.ui.pythagora.ai
- Bookings with associated orders already in the system

## Test Scenarios

### Test 1: Navigate from Expandable Booking Row to Order Details
**Purpose:** Verify that clicking on associated orders in the expandable nested table navigates to the correct order details page

**Steps:**
1. Open browser and navigate to https://preview-0d8qg901.ui.pythagora.ai/admin/bookings
2. Log in with admin credentials if needed
3. Find a booking with associated orders (check the "Orders" column shows a number > 0)
4. Click the downward-pointing chevron (▼) button in the first column to expand the booking row
5. A nested table should appear showing "Associated Orders & Repairs"
6. Look for a repair or product item row in the nested table
7. **Hover over a row** - the row should highlight with a light background and the cursor should change to a pointer hand icon
8. **Click on the row** - the page should navigate to the order details page
9. **Verify:** The URL should change to `/orders/{orderId}` and the Order Details page should load showing the specific order information

**Expected Result:** ✅ User is redirected to the correct order details page with full order information visible

---

### Test 2: Navigate from Booking Details Dialog - Repair Jobs Tab
**Purpose:** Verify that clicking on repair job cards in the Booking Details Dialog navigates to the correct order details page

**Steps:**
1. Navigate to https://preview-0d8qg901.ui.pythagora.ai/admin/bookings
2. Find any booking with items
3. Click the **eye icon** (Details button) on the right side of the booking row
4. The Booking Details Dialog should open
5. Click on the **"Repair Jobs" tab** at the top of the dialog
6. A list of repair job cards should appear (if the booking has repair jobs)
7. **Hover over a repair job card** - the card should highlight with a light background and show:
   - Device/product name
   - Services with prices (for repairs) or product details (for products)
   - An external link icon (🔗) next to the Order ID
   - "Click to view order details" hint text in blue
8. **Click on the repair job card** - the page should navigate to the order details page
9. **Verify:** The URL should change to `/orders/{orderId}` and the Order Details page should load

**Expected Result:** ✅ User is redirected to the correct order details page from the dialog

---

### Test 3: Verify Hover Visual Feedback on Nested Table Rows
**Purpose:** Verify that expandable booking rows provide proper visual feedback

**Steps:**
1. Navigate to https://preview-0d8qg901.ui.pythagora.ai/admin/bookings
2. Expand a booking by clicking the chevron (▼)
3. Look at the nested table rows showing "Associated Orders & Repairs"
4. **Move your mouse over different rows** - each row should:
   - Change to a light gray/muted background color
   - Cursor should change to a pointer hand icon
   - Color should smoothly transition
5. **Move mouse away** - the row should return to normal appearance with smooth animation

**Expected Result:** ✅ All hover effects work smoothly with proper color transitions

---

### Test 4: Verify Order Details Page Contains Full Information
**Purpose:** Verify that the navigated order details page displays complete order information

**Steps:**
1. Complete Test 1 or Test 2 to navigate to an order details page
2. Verify the Order Details page shows:
   - Customer information (name, email, phone)
   - Device/product information
   - Services or products ordered
   - Order status and progress
   - Timeline of events
   - Any workflows assigned
   - Add-on services (if applicable)
3. Check that all data is correctly displayed

**Expected Result:** ✅ Order Details page displays all information correctly

---

### Test 5: Test with Multiple Associated Orders
**Purpose:** Verify navigation works with bookings containing multiple orders

**Steps:**
1. Navigate to https://preview-0d8qg901.ui.pythagora.ai/admin/bookings
2. Find a booking with multiple associated orders (high number in "Orders" column)
3. Expand the booking by clicking the chevron
4. The nested table should show multiple rows
5. Click on **first order row** - should navigate to that specific order
6. Use browser **back button** to return to bookings
7. Expand the same booking again
8. Click on **second order row** - should navigate to that different order
9. Verify each order shows different details

**Expected Result:** ✅ Each order row correctly navigates to its respective order details page

---

### Test 6: Test with Different Browser Tab
**Purpose:** Verify that navigation works and that the booking dialog closes properly

**Steps:**
1. Navigate to https://preview-0d8qg901.ui.pythagora.ai/admin/bookings
2. Open the Booking Details Dialog by clicking the eye icon
3. Click on a repair job card to navigate to order details
4. The dialog should close and navigate to the order details page
5. Open the order details page in a new tab instead (optional):
   - Right-click on a row in the expandable table
   - Select "Open in New Tab"
   - The new tab should show the order details page

**Expected Result:** ✅ Navigation works correctly, dialog closes properly

---

### Test 7: Test Error Handling - Missing Order ID
**Purpose:** Verify graceful handling of missing order IDs

**Steps:**
1. Open browser DevTools (F12 → Console tab)
2. Navigate to https://preview-0d8qg901.ui.pythagora.ai/admin/bookings
3. Expand a booking
4. Try clicking on any rows that might have incomplete data
5. Check the browser console for any error messages
6. No navigation should occur if order ID is missing

**Expected Result:** ✅ Application handles missing IDs gracefully with a console warning and no errors

---

### Test 8: Test on Different Screen Sizes
**Purpose:** Verify navigation works on responsive layouts

**Steps:**
1. Open browser DevTools (F12)
2. Navigate to https://preview-0d8qg901.ui.pythagora.ai/admin/bookings
3. Set viewport to **desktop** (1920x1080):
   - Expand a booking
   - Verify rows are clickable
   - Click to navigate
4. Set viewport to **tablet** (768x1024):
   - Expand a booking
   - Verify table is still accessible (may require horizontal scroll)
   - Click to navigate
5. Set viewport to **mobile** (375x812):
   - Expand a booking
   - Verify nested table is readable
   - Click to navigate

**Expected Result:** ✅ Navigation works on all screen sizes, table remains accessible

---

### Test 9: Test Dark Mode Compatibility
**Purpose:** Verify navigation UI works correctly in dark mode

**Steps:**
1. Navigate to https://preview-0d8qg901.ui.pythagora.ai/admin/bookings
2. Toggle to dark mode (moon icon in header)
3. Expand a booking
4. Verify nested table rows:
   - Are readable in dark mode
   - Have proper hover effects (visible color change)
   - Text has sufficient contrast
5. Click on a row to navigate
6. Verify hover effects on Booking Details Dialog repair jobs

**Expected Result:** ✅ All navigation UI elements are properly styled and visible in dark mode

---

### Test 10: Console Verification - No Errors
**Purpose:** Verify no JavaScript errors occur during navigation

**Steps:**
1. Open browser DevTools (F12 → Console tab)
2. Clear the console (right-click → Clear Console)
3. Navigate to https://preview-0d8qg901.ui.pythagora.ai/admin/bookings
4. Expand a booking
5. Hover over nested table rows and observe console
6. Click to navigate to an order
7. Verify console shows:
   - No red error messages
   - No TypeScript errors
   - No undefined reference warnings
   - Only info/log messages if any

**Expected Result:** ✅ Console is clean with no errors

---

## Acceptance Criteria

All tests must pass with the following criteria:
- ✅ Clicking associated orders row navigates to correct order details page
- ✅ Clicking repair job card navigates to correct order details page
- ✅ Hover effects provide visual feedback on all clickable rows
- ✅ Navigation works on all screen sizes
- ✅ Navigation works in both light and dark modes
- ✅ No console errors occur during navigation
- ✅ Order details page loads completely
- ✅ Multiple orders navigate correctly to their respective pages
- ✅ UI remains responsive and functional

## Troubleshooting

### Issue: Clicking row doesn't navigate
**Solution:**
1. Verify browser JavaScript is enabled
2. Check browser console for errors (F12 → Console)
3. Verify order ID is present in the booking item
4. Try refreshing the page and retry

### Issue: Hover effects not visible
**Solution:**
1. Verify you're using a recent browser version
2. Check that Tailwind CSS is properly loaded
3. Try toggling between light and dark mode
4. Clear browser cache (Ctrl+Shift+Delete)

### Issue: Order details page shows blank
**Solution:**
1. Verify the order ID is valid
2. Check that the order exists in the database
3. Check browser console for any API errors
4. Try manually navigating to `/orders/{orderId}` in the URL bar

## Sign-Off Checklist

- [ ] All 10 test scenarios completed successfully
- [ ] No console errors detected
- [ ] Navigation works from both booking list and booking dialog
- [ ] Hover effects work correctly
- [ ] Responsive design verified on desktop, tablet, and mobile
- [ ] Dark mode verified
- [ ] Order details page loads correctly
- [ ] Ready for production deployment

---

**Testing Date:** November 2024
**Tester Name:** [Your Name]
**Test Environment:** https://preview-0d8qg901.ui.pythagora.ai
**Status:** Ready for Sign-Off ✅
