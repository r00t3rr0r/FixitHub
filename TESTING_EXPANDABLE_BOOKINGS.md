# Testing Guide: Expandable Booking Rows & Associated Orders

## Quick Start

### Prerequisites
- Application is running at https://preview-0d8qg901.ui.pythagora.ai
- Logged in as admin user
- Bookings Management page is accessible
- Browser DevTools console open (F12) to check for errors

### Test Environment
- URL: https://preview-0d8qg901.ui.pythagora.ai/admin/bookings
- Role: Admin
- Bookings with associated orders should be visible

---

## Test Cases

### TEST 1: Expand Booking Row with Orders
**Objective:** Verify that clicking the chevron button expands the booking row and shows associated orders in a nested table

**Steps:**
1. Navigate to https://preview-0d8qg901.ui.pythagora.ai/admin/bookings
2. Locate a booking that has items (Orders column shows number > 0)
3. Look at the leftmost column - you'll see a downward-pointing chevron (▼)
4. Click on the chevron button
5. Observe the row expansion

**Expected Result:**
- Chevron changes direction to point upward (▲)
- Row expands smoothly to show a "Loading orders..." message briefly
- Nested table appears below the main row with columns: Type, Device/Product, Services/Details, Cost
- Booking row background color remains the same, expanded section has subtle background color
- No console errors appear

**Failure Indicators:**
- Chevron doesn't change direction
- Row doesn't expand
- Console shows errors
- Nested table doesn't appear

---

### TEST 2: View Nested Orders/Repairs/Products
**Objective:** Verify that expanded row correctly displays all associated orders with accurate information

**Steps:**
1. Expand a booking row (from TEST 1)
2. Examine the nested table content
3. Look for repair jobs (Type = "Repair" in badge)
4. Look for product items (Type = "Product" in badge)
5. Verify device names match the booking
6. Check that services are listed for repairs
7. Check that product quantities are shown

**Expected Result:**
- Nested table displays all items from the booking
- For Repair type items:
  - Device/Product column shows device name (e.g., "iPhone 14", "Samsung Galaxy")
  - Services/Details shows list of services with bullet points
  - Services show estimated time if available
  - Cost shows individual item cost
- For Product type items:
  - Device/Product shows product names separated by commas
  - Services/Details shows "Product Item" with quantities (e.g., "Screen Protector × 2")
  - Cost shows product total
- Badge colors are distinct (blue for Repair, gray for Product)
- All costs are properly formatted in USD

**Failure Indicators:**
- Items missing from nested table
- Wrong device information displayed
- Costs don't match booking total
- Services not displayed for repairs
- Missing product quantities

---

### TEST 3: Collapse Booking Row
**Objective:** Verify that clicking the chevron again collapses the expanded row

**Steps:**
1. Start with an expanded booking row (from TEST 2)
2. Look at the chevron - it should be pointing upward (▲)
3. Click the chevron button again
4. Observe the row collapse

**Expected Result:**
- Chevron changes back to pointing downward (▼)
- Nested table disappears smoothly
- Expanded section collapses
- Main booking row remains visible with all original information intact
- No console errors

**Failure Indicators:**
- Chevron doesn't change
- Row doesn't collapse
- Data disappears from main row
- Console shows errors

---

### TEST 4: Multiple Booking Expansions
**Objective:** Verify that multiple bookings can be expanded simultaneously and show correct data

**Steps:**
1. Navigate to https://preview-0d8qg901.ui.pythagora.ai/admin/bookings
2. Find 2-3 bookings with different numbers of items
3. Click the chevron for the first booking - verify it expands
4. WITHOUT collapsing, click the chevron for the second booking - verify it expands
5. Verify each expanded section shows the correct data for that booking
6. Collapse them in reverse order
7. Verify data doesn't mix between bookings

**Expected Result:**
- Both bookings expand independently
- Each shows its own unique orders/repairs/products
- Expanding one doesn't collapse the other
- Data is correct for each booking
- No duplication or data mixing
- All costs match the individual booking totals

**Failure Indicators:**
- Expanding one collapses another
- Same data shown for different bookings
- Costs don't match
- Wrong items displayed

---

### TEST 5: Repair Job Navigation (Details Dialog)
**Objective:** Verify that repair jobs in the Details Dialog are clickable and navigate to orders

**Steps:**
1. Find a booking with repair items
2. Click the eye icon (Details button) to open the booking details dialog
3. In the dialog, click the "Repair Jobs" tab
4. Locate a repair job card (should show device name and services)
5. Hover over the repair job card
6. Click on the repair job card

**Expected Result:**
- Card highlights with subtle background color on hover
- Cursor changes to pointer (hand icon)
- "Click to view order details" message appears in blue text
- External link icon is visible next to order ID
- Clicking navigates to Orders Management page
- No errors in console

**Failure Indicators:**
- No hover effect
- Card doesn't respond to clicks
- Navigation doesn't happen
- "Click to view" message doesn't appear
- Console shows errors

---

### TEST 6: Repair Job Order ID Display
**Objective:** Verify that repair jobs show associated order information

**Steps:**
1. Open booking details (click eye icon)
2. Click "Repair Jobs" tab
3. Look at any repair job card
4. Check for:
   - Order ID badge showing last 8 characters
   - External link icon
   - Order reference in the card header

**Expected Result:**
- Each repair job shows its associated Order ID
- Order ID is clickable (different text color - blue)
- External link icon indicates it's a navigation link
- Order ID format matches booking's order IDs
- "Click to view order details" text appears below

**Failure Indicators:**
- No Order ID visible
- Order ID is not clickable
- Missing external link icon
- Wrong order IDs shown

---

### TEST 7: Dark Mode Compatibility
**Objective:** Verify that expanded rows and all new features work correctly in dark mode

**Steps:**
1. Toggle to dark mode (moon icon in header)
2. Navigate to bookings
3. Expand multiple booking rows
4. Open a booking details dialog
5. Check repair jobs tab
6. Verify all colors and contrast

**Expected Result:**
- Expanded row backgrounds are visible in dark mode
- Nested table text is readable
- Repair job cards show proper contrast
- All colors adapt to dark theme
- No text is invisible or unreadable
- Links maintain their color distinction

**Failure Indicators:**
- Text is hard to read
- Backgrounds blend with content
- Colors don't adapt properly
- Any invisible elements

---

### TEST 8: Responsive Design - Tablet View
**Objective:** Verify functionality on tablet-sized screens (768px)

**Steps:**
1. Open DevTools (F12)
2. Set viewport to tablet size (iPad: 768x1024)
3. Navigate to bookings
4. Expand a booking row
5. Verify nested table is visible
6. Check if horizontal scrolling is needed
7. Try scrolling left/right to see all columns

**Expected Result:**
- Booking row expands properly on tablet
- Nested table is visible and readable
- All columns are accessible (may need horizontal scroll)
- Text is readable (no overflow issues)
- Expand/collapse works smoothly
- No layout breaks or overlapping

**Failure Indicators:**
- Nested table cut off
- Columns overlap
- Unreadable text
- Buttons are hard to click

---

### TEST 9: Responsive Design - Mobile View
**Objective:** Verify functionality on mobile-sized screens (375px)

**Steps:**
1. Set DevTools viewport to mobile (375x667)
2. Navigate to bookings
3. Expand a booking row
4. Verify nested table displays
5. Scroll horizontally to view all columns
6. Check that expand/collapse buttons are accessible

**Expected Result:**
- Table adapts to mobile width
- Nested table is accessible via horizontal scroll
- All information is readable at mobile size
- Expand/collapse buttons are touchable (large enough)
- No UI breaks or overlaps
- Scrolling is smooth

**Failure Indicators:**
- Table columns overlap
- Text is too small
- Buttons are not accessible
- Layout is broken

---

### TEST 10: Console Error Check
**Objective:** Verify no console errors or warnings during all operations

**Steps:**
1. Open DevTools Console (F12 → Console tab)
2. Clear console (click circle with line icon)
3. Perform all previous tests while watching console
4. Expand multiple bookings
5. Open details dialogs
6. Click repair jobs
7. Toggle themes
8. Check responsive views
9. Check console for any errors or warnings

**Expected Result:**
- Console remains clear (no red errors)
- No TypeScript errors
- No React warnings
- No undefined variable errors
- No network errors
- Only standard info messages may appear

**Failure Indicators:**
- Red error messages
- TypeError or ReferenceError
- "Cannot read property..." messages
- Network errors (404, 500)
- Any console.error() calls

---

### TEST 11: Search & Filter Compatibility
**Objective:** Verify that existing search and filter features still work with new expand functionality

**Steps:**
1. Use the search box to find a specific booking
2. Verify the result shows with expand button
3. Try filtering by Booking Status
4. Expand a booking from filtered results
5. Try filtering by Billing Status
6. Expand another booking
7. Clear filters and search

**Expected Result:**
- Search works normally
- Filtered results show expand button
- Expand/collapse works on filtered results
- Nested tables show correct data for filtered bookings
- Clearing filters shows all bookings again
- All original filtering features unaffected

**Failure Indicators:**
- Search breaks with new feature
- Expand button missing on filtered results
- Wrong data in nested tables
- Filters don't work

---

### TEST 12: Action Buttons Still Work
**Objective:** Verify that other action buttons (Details, Cancel) still function correctly

**Steps:**
1. Navigate to bookings
2. Expand a booking row
3. Find the Details button (eye icon) in that row
4. Click Details - verify dialog opens
5. Close dialog
6. Find Cancel button in the same row
7. Don't click (avoid actual cancellation) - just verify it's visible and enabled
8. Try with a cancelled booking - Cancel button should be disabled

**Expected Result:**
- Details button still opens the booking details dialog
- Dialog shows all information correctly
- Cancel button is visible and enabled (for active bookings)
- Cancel button is disabled for already-cancelled bookings
- No conflicts between expand feature and action buttons
- All original functionality preserved

**Failure Indicators:**
- Buttons missing
- Buttons don't work
- Buttons disabled when they shouldn't be
- Dialog doesn't open

---

## Summary Checklist

- [ ] TEST 1: Expand/collapse works
- [ ] TEST 2: Nested table shows correct data
- [ ] TEST 3: Collapse functionality works
- [ ] TEST 4: Multiple bookings can expand independently
- [ ] TEST 5: Repair jobs are clickable in Details Dialog
- [ ] TEST 6: Order ID is shown for each repair job
- [ ] TEST 7: Dark mode looks correct
- [ ] TEST 8: Tablet view works
- [ ] TEST 9: Mobile view works
- [ ] TEST 10: No console errors
- [ ] TEST 11: Search & filters still work
- [ ] TEST 12: Other action buttons work

## Sign-Off
All tests passed: _____ (Date: _____)
Tester Name: _________________
Notes: ________________________

---

## Troubleshooting

### Expand button not appearing
- Refresh page (Ctrl+R)
- Check browser console for errors
- Clear browser cache (Ctrl+Shift+Delete)

### Nested table not showing
- Wait a moment for "Loading orders..." to complete
- Check console for API errors
- Verify booking has associated items

### Navigation not working
- Ensure you're clicking on the repair job card itself
- Check that Orders Management page exists
- Clear browser history/cache

### Styling issues
- Refresh page
- Clear cache and hard refresh (Ctrl+Shift+R)
- Try different browser
- Check dark mode settings

### Console errors
- Take screenshot of error message
- Note the exact error text
- Check if error repeats consistently
- Report with browser type and version
