# Testing Guide: Homepage Device Selection Integration

## Overview
This guide provides step-by-step testing instructions for the new Homepage Device Selection feature that integrates the repair order process directly into the homepage Hero Section.

## Prerequisites
- Application is running at https://preview-17mhx8z9.ui.pythagora.ai
- Test user account (or ability to use as guest)
- Modern web browser (Chrome, Firefox, Safari, Edge)

---

## Test Scenario 1: Quick Search Method (Default)

### Test 1.1: Basic Search Functionality
**Steps:**
1. Open https://preview-17mhx8z9.ui.pythagora.ai in your browser
2. Observe the Hero Section with device selection card
3. Notice "Quick Search" tab is selected by default
4. Type "iph" in the search input field
5. Wait for search results to appear

**Expected Results:**
- Search input field is visible with search icon on the left
- After typing 2+ characters, a dropdown appears below the input
- Search results show devices matching "iph" (e.g., "iPhone 13", "iPhone 12")
- Each result shows device name, full display name, and device type icon
- Loading indicator appears briefly while searching

### Test 1.2: Select Device from Search
**Steps:**
1. Continue from Test 1.1
2. Click on "iPhone 13" from the search results
3. Observe the search dropdown closes
4. Observe the selected device card appears below

**Expected Results:**
- Search dropdown closes immediately
- Selected device card displays with:
  - Device icon (smartphone icon)
  - Device name: "iPhone 13"
  - Device type and manufacturer (e.g., "Smartphone • Apple")
  - Clear (X) button on the right
- Search input shows the selected device name
- Card has colored border and background

### Test 1.3: Clear Selection
**Steps:**
1. Continue from Test 1.2
2. Click the X button on the selected device card
3. Observe the changes

**Expected Results:**
- Selected device card disappears
- Search input is cleared
- All selection states are reset
- "Start Repair Order" button may become disabled

### Test 1.4: Start Repair Order
**Steps:**
1. Search and select "iPhone 13" again
2. Click the yellow "Start Repair Order" button
3. Wait for page navigation

**Expected Results:**
- Page navigates to /new-order
- Success toast appears: "Device Selected! iPhone 13 has been pre-selected for your repair order."
- Step 1 of the new order form shows the selected device
- Device information is pre-filled (device type, brand, model)
- User can proceed directly to Step 2 (Service Selection)

---

## Test Scenario 2: Browse by Category Method

### Test 2.1: Switch to Dropdown Method
**Steps:**
1. Return to homepage (https://preview-17mhx8z9.ui.pythagora.ai)
2. Click on "Browse by Category" tab
3. Observe the interface changes

**Expected Results:**
- "Browse by Category" tab is now highlighted/active
- Three dropdown selects appear:
  1. "Select Device Type"
  2. "Select Brand" (disabled initially)
  3. "Select Model" (disabled initially)
- All dropdowns are empty initially

### Test 2.2: Cascading Dropdown Selection
**Steps:**
1. Click on "Select Device Type" dropdown
2. Select "Smartphone" from the list
3. Wait for manufacturers to load
4. Click on "Select Brand" dropdown
5. Select "Apple" from the list
6. Wait for models to load
7. Click on "Select Model" dropdown
8. Select "iPhone 13" from the list

**Expected Results:**
- After selecting device type:
  - Loading indicator appears briefly
  - Brand dropdown becomes enabled
  - Brand dropdown shows manufacturers with model counts (e.g., "Apple (25 models)")
- After selecting brand:
  - Loading indicator appears briefly
  - Model dropdown becomes enabled
  - Model dropdown shows all available models
- After selecting model:
  - Selected device card appears with full device information
  - All three dropdowns retain their selections

### Test 2.3: Change Selection Mid-Flow
**Steps:**
1. Continue from Test 2.2
2. Change the device type from "Smartphone" to "Tablet"
3. Observe the changes

**Expected Results:**
- Brand dropdown resets to "Choose brand"
- Model dropdown resets to "Choose model"
- Selected device card disappears
- New manufacturers load for "Tablet" device type
- Model dropdown becomes disabled again

### Test 2.4: Complete Order with Dropdown Method
**Steps:**
1. Select: Device Type = "Smartphone", Brand = "Samsung", Model = "Galaxy S21"
2. Click "Start Repair Order"
3. Verify navigation and pre-fill

**Expected Results:**
- Navigates to /new-order
- Toast notification appears
- Samsung Galaxy S21 is pre-selected in Step 1
- User can proceed to service selection

---

## Test Scenario 3: Advanced Filter Method

### Test 3.1: Switch to Filter Method
**Steps:**
1. Return to homepage
2. Click on "Advanced Filter" tab
3. Observe the interface

**Expected Results:**
- "Advanced Filter" tab is now active
- Device type filter chips appear in a row
- Each chip shows:
  - Device type icon
  - Device type name
  - Count in parentheses (e.g., "Smartphone (150)")
- All chips have outline style (not filled)

### Test 3.2: Filter by Device Type
**Steps:**
1. Click on "Smartphone" filter chip
2. Wait for manufacturers to load
3. Observe the changes

**Expected Results:**
- "Smartphone" chip changes to filled/primary color
- Loading indicator appears briefly
- New section appears: "Filter by Brand"
- Brand filter chips appear below device type chips
- Each brand chip shows name and model count

### Test 3.3: Filter by Brand
**Steps:**
1. Continue from Test 3.2
2. Click on "Apple" brand chip
3. Wait for models to load

**Expected Results:**
- "Apple" chip changes to filled/primary color
- Loading indicator appears briefly
- New section appears: "Select Model"
- Grid of model buttons appears
- Grid has 2-3 columns on desktop, 2 columns on mobile
- Models are displayed as clickable buttons

### Test 3.4: Select Model from Grid
**Steps:**
1. Continue from Test 3.3
2. Scroll through the model grid
3. Click on "iPhone 13" button

**Expected Results:**
- "iPhone 13" button changes to filled/primary style
- Selected device card appears at the bottom
- Card shows full device information
- "Start Repair Order" button becomes enabled

### Test 3.5: Reset Filters
**Steps:**
1. Continue from Test 3.4
2. Click the X button on the selected device card
3. Observe the reset

**Expected Results:**
- All filter chips reset to outline style
- Model grid disappears
- Brand chips disappear
- Only device type chips remain visible
- Interface resets to initial state

### Test 3.6: Complete Order with Filter Method
**Steps:**
1. Filter: Device Type = "Tablet", Brand = "Samsung", Model = "Galaxy Tab S7"
2. Click "Start Repair Order"

**Expected Results:**
- Navigates to /new-order
- Toast appears with success message
- Samsung Galaxy Tab S7 is pre-selected
- Step 1 is complete and user is ready for Step 2

---

## Test Scenario 4: Responsive Design

### Test 4.1: Mobile View (320px - 767px)
**Steps:**
1. Open homepage in mobile device or resize browser to 375px width
2. Test all three selection methods
3. Interact with buttons and inputs

**Expected Results:**
- Hero section is fully visible
- Device selection card is readable
- Selection method tabs stack or wrap appropriately
- Search input is full width
- Dropdowns are touch-friendly
- Filter chips wrap to multiple rows
- Model grid shows 2 columns
- "Start Repair Order" button is full width
- Trust indicators stack vertically

### Test 4.2: Tablet View (768px - 1023px)
**Steps:**
1. Resize browser to 768px width
2. Test all three selection methods

**Expected Results:**
- Layout adapts to tablet width
- Selection method tabs fit in one row
- Dropdowns maintain appropriate size
- Filter chips use 2 rows if needed
- Model grid shows 2 columns
- Trust indicators show in a row
- All text is readable

### Test 4.3: Desktop View (1024px+)
**Steps:**
1. Resize browser to 1440px width
2. Test all three selection methods

**Expected Results:**
- Card is centered with max-width
- All elements have appropriate spacing
- Selection tabs are in one row
- Model grid shows 3 columns
- Trust indicators are in one row
- Layout looks professional and spacious

---

## Test Scenario 5: Error Handling

### Test 5.1: Search with No Results
**Steps:**
1. Use Quick Search method
2. Type "xyzabc123" (non-existent device)
3. Observe the results

**Expected Results:**
- Search dropdown appears
- Message displays: "No devices found. Try a different search term."
- No error toast appears
- Interface remains functional

### Test 5.2: Empty Device Type List
**Steps:**
1. Open browser console
2. Look for any error messages when dropdowns load
3. Test with each selection method

**Expected Results:**
- If device types fail to load, a toast error appears
- Error message: "Failed to load device types"
- Interface shows empty state gracefully
- No console errors other than expected API failures

### Test 5.3: Network Error Simulation
**Steps:**
1. Open browser dev tools → Network tab
2. Enable "Offline" mode
3. Try to search or select device type
4. Observe error handling

**Expected Results:**
- Toast notification appears with error message
- "Failed to load [data type]" message shown
- Interface doesn't crash
- User can retry after going back online

---

## Test Scenario 6: Integration with New Order Page

### Test 6.1: Pre-filled Device Information
**Steps:**
1. From homepage, select any device using any method
2. Click "Start Repair Order"
3. Verify Step 1 of NewOrder page

**Expected Results:**
- Step 1 shows "Select Your Device" completed
- Device search input shows selected device name
- Selected device card is visible with full information
- "Next Step" button is enabled
- User can click "Next Step" to go to Step 2 immediately

### Test 6.2: Continue Full Order Process
**Steps:**
1. Continue from Test 6.1
2. Click "Next Step" to go to Step 2
3. Select repair services
4. Click "Next Step" through all steps
5. Complete the order

**Expected Results:**
- Step 2: Service selection works normally
- Step 3: Add-ons and unlock code work normally
- Step 4: Review and submit works normally
- Step 5: Add to cart works normally
- Order is successfully created with pre-selected device

### Test 6.3: Manual Device Selection After Pre-fill
**Steps:**
1. From homepage, select "iPhone 13"
2. Go to New Order page
3. Click X to clear the pre-selected device
4. Manually search and select a different device

**Expected Results:**
- Clear button works and removes pre-selected device
- Search input is cleared
- User can search and select a different device
- New device selection works normally
- Order process continues with newly selected device

---

## Test Scenario 7: User Experience

### Test 7.1: Loading States
**Steps:**
1. Test each selection method
2. Observe loading indicators during API calls

**Expected Results:**
- Search shows "Searching devices..." with spinning icon
- Dropdowns show "Loading brands..." or "Loading models..."
- Filter method shows brief loading state
- Loading states are smooth and not jarring
- No layout shifts during loading

### Test 7.2: Visual Feedback
**Steps:**
1. Hover over all interactive elements
2. Click/tap on buttons and chips
3. Observe transitions and effects

**Expected Results:**
- Hover effects on all clickable elements
- Active/selected states are clearly visible
- Color changes are smooth (transitions)
- Icons are properly colored
- Focus states are visible for keyboard navigation

### Test 7.3: Help and Guidance
**Steps:**
1. Read all help text and labels
2. Try to find assistance links
3. Test navigation to help pages

**Expected Results:**
- Clear labels on all inputs/selects
- Help text under search: "Type at least 2 characters to search"
- Bottom help text: "Can't find your device? Browse all devices or contact us for help"
- Links work correctly
- Guidance is helpful and clear

### Test 7.4: Toast Notifications
**Steps:**
1. Complete various actions that trigger toasts
2. Note all toast messages

**Expected Results:**
- Success toast when device is pre-selected in NewOrder
- Error toasts for API failures
- Toasts appear in consistent location
- Toasts auto-dismiss after 3-5 seconds
- Toast messages are clear and actionable

---

## Test Scenario 8: Authentication States

### Test 8.1: Unauthenticated User
**Steps:**
1. Log out if logged in
2. Visit homepage
3. Select a device
4. Observe the buttons

**Expected Results:**
- Quick Search is default and works
- All three selection methods work
- Selected device card appears
- "Start Repair Order" button is enabled
- "Sign In" button is visible
- Both buttons work correctly

### Test 8.2: Authenticated User
**Steps:**
1. Log in with any user account
2. Visit homepage
3. Select a device
4. Observe the buttons

**Expected Results:**
- All selection methods work
- Selected device card appears
- "Start Repair Order" button is enabled
- "Sign In" button is NOT visible (replaced with profile menu in header)
- "Start Repair Order" navigates correctly

---

## Test Scenario 9: Performance

### Test 9.1: Search Response Time
**Steps:**
1. Type quickly in the search field
2. Measure time to see results
3. Test with different queries

**Expected Results:**
- Search results appear within 500ms
- No lag or freezing during typing
- Smooth dropdown animations
- Results update as user types

### Test 9.2: Data Loading Performance
**Steps:**
1. Select device types in dropdown method
2. Measure loading time for manufacturers
3. Measure loading time for models

**Expected Results:**
- Manufacturers load within 1 second
- Models load within 1 second
- Loading states show immediately
- No blocking of UI during loading

### Test 9.3: Navigation Performance
**Steps:**
1. Select device and click "Start Repair Order"
2. Measure time to navigate to NewOrder page
3. Measure time for pre-fill to complete

**Expected Results:**
- Navigation is instant (< 100ms)
- Pre-fill happens immediately on page load
- Toast appears within 200ms
- No perceptible lag

---

## Test Scenario 10: Edge Cases

### Test 10.1: Special Characters in Search
**Steps:**
1. Search for "iPhone 13 Pro Max+"
2. Search for "Galaxy S21 (5G)"
3. Search for "iPad 2021"

**Expected Results:**
- Search handles special characters correctly
- Results match the full query including special chars
- No errors in console
- Search works as expected

### Test 10.2: Very Long Device Names
**Steps:**
1. Search for devices with long names
2. Select device with long name
3. Observe display in selected device card

**Expected Results:**
- Long names don't break layout
- Text wraps or truncates appropriately
- Card maintains proper dimensions
- All information is accessible

### Test 10.3: Rapid Selection Changes
**Steps:**
1. Quickly switch between selection methods
2. Rapidly select and clear devices
3. Spam click on buttons

**Expected Results:**
- No errors or crashes
- State updates correctly
- No memory leaks
- Interface remains responsive
- No duplicate API calls

### Test 10.4: Browser Back Button
**Steps:**
1. Select device on homepage
2. Click "Start Repair Order"
3. Click browser back button
4. Observe homepage state

**Expected Results:**
- Returns to homepage
- Device selection is cleared (sessionStorage was cleared)
- Interface is in initial state
- No errors occur
- User can select device again

---

## Regression Testing Checklist

After completing all scenarios above, verify these items have not broken:

- [ ] Homepage header and navigation work correctly
- [ ] Services Overview section displays properly
- [ ] Shop Section loads products correctly
- [ ] Blog Carousel shows articles
- [ ] Footer links work
- [ ] Language selector works
- [ ] Shopping cart icon shows correct count
- [ ] Profile dropdown works (if authenticated)
- [ ] Other homepage sections (Features, Testimonials, About, Contact) display correctly
- [ ] Existing NewOrder page functionality (without pre-selection) still works
- [ ] Shopping cart functionality works
- [ ] Order tracking page works
- [ ] Authentication (login/logout) works

---

## Browser Compatibility Testing

Test the feature on the following browsers:

### Desktop Browsers
- [ ] Chrome (latest version)
- [ ] Firefox (latest version)
- [ ] Safari (latest version)
- [ ] Edge (latest version)

### Mobile Browsers
- [ ] iOS Safari (latest version)
- [ ] Chrome Mobile (Android)
- [ ] Firefox Mobile (Android)
- [ ] Samsung Internet (Android)

### Expected Results for All Browsers
- Layout is consistent
- All functionality works
- No console errors
- Performance is acceptable
- Touch interactions work on mobile
- Hover effects work on desktop

---

## Accessibility Testing

### Keyboard Navigation
**Steps:**
1. Use Tab key to navigate through the interface
2. Use Enter/Space to interact with elements
3. Use Escape to close dropdowns

**Expected Results:**
- All interactive elements are keyboard accessible
- Focus indicators are visible
- Tab order is logical
- Enter/Space activate buttons
- Escape closes search dropdown

### Screen Reader Testing
**Steps:**
1. Enable screen reader (NVDA/JAWS/VoiceOver)
2. Navigate through the device selection interface
3. Listen to announcements

**Expected Results:**
- Labels are read correctly
- Buttons have descriptive names
- Form inputs have proper labels
- Status messages are announced
- Selected device information is accessible

---

## Sign-Off Checklist

Before marking this feature as complete, ensure:

- [ ] All 10 test scenarios pass
- [ ] All test cases within each scenario pass
- [ ] Responsive design works on all viewport sizes
- [ ] Error handling works correctly
- [ ] Performance is acceptable
- [ ] Browser compatibility verified
- [ ] Accessibility requirements met
- [ ] Regression testing shows no broken features
- [ ] Documentation is complete and accurate
- [ ] Code review completed
- [ ] Ready for production deployment

---

## Bug Reporting Template

If you find any issues during testing, use this template:

**Bug Title:** [Brief description]

**Severity:** Critical / High / Medium / Low

**Test Scenario:** [Which scenario number]

**Steps to Reproduce:**
1. Step 1
2. Step 2
3. Step 3

**Expected Result:** [What should happen]

**Actual Result:** [What actually happened]

**Screenshots:** [Attach if available]

**Browser/Device:** [e.g., Chrome 120 on Windows 11]

**Console Errors:** [Copy any error messages]

**Additional Notes:** [Any other relevant information]

---

## Testing Summary Report Template

After completing all tests, fill out this summary:

**Test Date:** [Date]
**Tester Name:** [Your Name]
**Build/Version:** [Version being tested]

**Test Results:**
- Total Test Scenarios: 10
- Scenarios Passed: __/10
- Scenarios Failed: __/10
- Critical Bugs Found: __
- High Priority Bugs Found: __
- Medium Priority Bugs Found: __
- Low Priority Bugs Found: __

**Overall Status:** ✅ Pass / ❌ Fail / ⚠️ Pass with Minor Issues

**Recommendations:**
[Your recommendations for deployment]

**Notes:**
[Any additional notes or observations]

---

## Conclusion

This comprehensive testing guide covers all aspects of the Homepage Device Selection Integration feature. Following these test scenarios will ensure the feature is production-ready, user-friendly, and free of critical bugs.
