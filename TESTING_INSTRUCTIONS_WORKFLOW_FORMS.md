# Testing Instructions - Workflow Step Form Elements

## Quick Start Testing

### Test 1: Radio Button Visibility (5 minutes)

**Setup:**
1. Open browser to https://preview-0usremq6.ui.pythagora.ai
2. Login with staff or admin credentials

**Steps:**
1. Click "Orders" in the left sidebar
2. Find any order in the list
3. Click on an order to view details
4. In the "Workflows" section, find "Display-Reparatur und -Kalibrierung" workflow
5. Click "Start Workflow" or "Resume" button
6. You should be on "Step 1: Display-Diagnose"
7. Scroll down to the form fields section

**Verify:**
✓ See "Art des Display-Problems" field with radio button options
✓ Options should be: "Risse/Bruch", "Tote Pixel", "Farbprobleme", "Touch nicht reagierend", "Helligkeit-Probleme"
✓ Options are visible and properly spaced
✓ Each option has a circular radio button
✓ Labels are clearly readable

**Success Indicators:**
- Radio buttons are visible (not hidden)
- You can click each option
- Only one option can be selected at a time
- Browser console shows no errors (F12 → Console tab)

**Expected Time:** 2-3 minutes

---

### Test 2: Multi-Select Checkboxes Functionality (5 minutes)

**Setup:**
1. Stay on the same browser/app

**Steps:**
1. Navigate to Orders
2. Click on an order
3. Assign or start the "Wasserschaden-Wiederherstellung" (Water Damage Recovery) workflow
4. Click through steps 1 and 2 to reach Step 3: "Komponentenbewertung"
5. In Step 3, look for "Beschädigte Komponenten" (Damaged Components) field

**Verify:**
✓ See multiple checkbox options for different components
✓ Components listed: "Batterie", "Hauptplatine", "Display", "Anschlüsse", "Lautsprecher", "Mikrofon", "Sonstige"
✓ Each option has a checkbox
✓ Multiple options can be selected (checkboxes accumulate)

**Test Actions:**
1. Click "Batterie" - verify checkbox becomes checked
2. Click "Hauptplatine" - verify both checkboxes remain checked
3. Click "Display" - verify three are now checked
4. Click "Batterie" again - verify it becomes unchecked, other two stay checked

**Success Indicators:**
- Multiple checkboxes can be selected
- Unselecting works correctly
- Checkmarks persist when you select/unselect other items
- No console errors

**Expected Time:** 3-4 minutes

---

### Test 3: Form Validation (5 minutes)

**Setup:**
1. Navigate to an order with workflow

**Steps:**
1. Start workflow with radio button fields (Display-Reparatur → Step 1)
2. Look at form with "Art des Display-Problems" (required radio field)
3. Click "Complete Step" button WITHOUT selecting any radio option

**Verify:**
✓ A red toast error message appears
✓ Message says: "Art des Display-Problems is required"
✓ Step does NOT complete (you stay on same step)
✓ Form data is NOT lost

**Then:**
1. Select any radio option (e.g., click "Risse/Bruch")
2. Click "Complete Step" again

**Verify:**
✓ Error message disappears
✓ Step progresses to next step
✓ Success message appears

**Success Indicators:**
- Validation prevents submission when required fields empty
- Clear error messages guide user
- Validation passes once field is filled
- No console errors

**Expected Time:** 3-4 minutes

---

### Test 4: File Upload (Optional - if available)

**Steps:**
1. Navigate to a workflow step that has file upload fields
2. Look for file upload area (should have dashed border and upload icon)

**Verify:**
✓ File upload area is visible with dashed border
✓ Upload icon is displayed
✓ Instruction text says "Click to upload files"

**Test Actions:**
1. Click on the upload area
2. Select a file from your computer (any image or document)
3. Verify file appears in list below with file name
4. Click X button on the file
5. Verify file is removed from list

**Success Indicators:**
- File selection dialog opens
- Selected file appears in list
- File removal works
- No console errors

**Expected Time:** 2-3 minutes

---

### Test 5: Complete Workflow with All Elements (10 minutes)

**Setup:**
1. Navigate to Orders
2. Find or create a new order
3. Select "Display-Reparatur und -Kalibrierung" workflow

**Steps:**

**Step 1: Display-Diagnose (Radio)**
1. See radio options for "Art des Display-Problems"
2. Select "Tote Pixel"
3. Note any visible form data
4. Click "Complete Step"

**Step 2: Display-Austausch (Radio)**
1. Enter Display Model Name (e.g., "OLED-Display")
2. Select "Ja" for "Alter Klebstoff vollständig entfernt?"
3. Click "Complete Step"

**Step 3: Display-Kalibrierung (Select & Radio)**
1. Select "Ausgezeichnet" for "Display-Farbqualität"
2. Select "Gut" for "Touch-Empfindlichkeit"
3. Select "Nein" for "Tote Pixel gefunden?"
4. Click "Complete Step"

**Verify:**
✓ All steps complete without errors
✓ Radio selections work in each step
✓ Form validation passes
✓ Success messages appear after each step
✓ Workflow marked as complete when finished
✓ No console errors throughout workflow

**Success Indicators:**
- Complete workflow executes successfully
- All form elements function correctly in sequence
- Form data is properly collected at each step
- Workflow completion is confirmed

**Expected Time:** 8-10 minutes

---

## In-Depth Testing

### Test 6: Responsive Design (Mobile)

**Setup:**
1. Open https://preview-0usremq6.ui.pythagora.ai in desktop browser
2. Press F12 to open Developer Tools
3. Click responsive design mode icon (or press Ctrl+Shift+M)
4. Set viewport to mobile (375 x 667)

**Steps:**
1. Navigate to order with radio button workflow
2. Start workflow
3. View form on mobile size

**Verify:**
✓ Radio options are visible and clearly spaced
✓ Labels are readable (no cut off)
✓ Radio buttons are large enough to tap (44x44px minimum)
✓ Form is not horizontally scrolled (fully visible)
✓ Selections work on mobile view

**Test on Tablet:**
1. Set viewport to tablet (768 x 1024)
2. Repeat verification steps

**Success Indicators:**
- Form is fully responsive
- Touch targets are adequate size
- No horizontal scrolling needed
- All elements functional on mobile

---

### Test 7: Keyboard Navigation

**Setup:**
1. Open workflow form on desktop
2. Ensure NumLock is off for keyboard testing

**Steps:**
1. Press Tab to navigate through form fields
2. Verify focus indicator is visible on each field
3. When focus is on radio button, press arrow keys (left/right or up/down)
4. Verify radio selection changes with arrow keys
5. When focus is on checkbox, press Space bar
6. Verify checkbox toggles on/off

**Verify:**
✓ Tab key navigates through all fields
✓ Focus indicator is clearly visible
✓ Radio buttons respond to arrow keys
✓ Checkboxes respond to Space bar
✓ Enter key confirms selections

**Success Indicators:**
- Keyboard navigation complete
- All interactions possible with keyboard
- Focus always visible
- Accessibility standards met

---

### Test 8: Error Handling

**Setup:**
1. Open browser console (F12 → Console)
2. Navigate to workflow

**Steps:**
1. Execute workflow steps as normal
2. Watch console for any errors or warnings
3. Try invalid actions (skip required fields, try invalid input)
4. Verify console shows helpful errors

**Verify:**
✓ No JavaScript errors appear in console
✓ No warnings (except possible bundle size warning)
✓ Error messages are user-friendly
✓ Application recovers from errors gracefully

**Look For:**
- Red error messages in console → potential issue
- Yellow warnings → usually OK, can ignore
- Missing component errors → issue
- Network errors → API connection issue

**Success Indicators:**
- Console remains clean
- No errors that prevent functionality
- Application handles errors gracefully

---

## Visual Verification Checklist

### Radio Buttons Visual Check
- [ ] Radio circles are 16-20px in size
- [ ] Radio circles have proper border
- [ ] Selected radio shows filled circle
- [ ] Unselected radio is empty
- [ ] Labels positioned to right of radio
- [ ] Proper vertical spacing between options
- [ ] Proper left alignment of all radios
- [ ] Consistent styling with other form elements

### Multi-Select Visual Check
- [ ] Checkboxes are 16-20px in size
- [ ] Checkboxes have proper border
- [ ] Selected checkbox shows checkmark
- [ ] Unselected checkbox is empty
- [ ] Labels positioned to right of checkbox
- [ ] Proper vertical spacing between options
- [ ] Can select multiple items
- [ ] Deselection works cleanly

### File Upload Visual Check
- [ ] Upload area has clear dashed border
- [ ] Upload icon is visible and clear
- [ ] Instruction text is readable
- [ ] Selected files listed below area
- [ ] File names not truncated excessively
- [ ] Each file has remove button (X)
- [ ] Remove button is easily clickable

---

## Performance Testing

### Load Time Test
1. Open DevTools (F12)
2. Go to Network tab
3. Hard refresh page (Ctrl+Shift+R)
4. Wait for page to load
5. Note load time in bottom status bar

**Expected:** Page loads in 2-3 seconds

### Form Interaction Speed Test
1. Open a workflow form
2. Test radio selection - should be instant
3. Test multiselect - should be instant
4. Test file selection - should be instant
5. Test form submission - should complete in < 2 seconds

**Expected:** All interactions smooth and responsive

### Multiple File Test
1. Upload 5 files sequentially
2. Verify no lag or slowness
3. Try to remove files
4. Verify responsive throughout

**Expected:** Smooth performance with multiple files

---

## Browser Compatibility Test

### Test on Different Browsers
1. **Chrome/Edge** - Most common
   - [ ] Test radio buttons
   - [ ] Test multiselect
   - [ ] Test file upload

2. **Firefox** - Alternative
   - [ ] Test radio buttons
   - [ ] Test multiselect
   - [ ] Test file upload

3. **Safari** - macOS/iOS
   - [ ] Test radio buttons
   - [ ] Test multiselect
   - [ ] Test file upload

**Expected:** All browsers work identically

---

## Troubleshooting During Testing

### Issue: Radio buttons not visible
**Solution:**
1. Refresh page (F5 or Ctrl+R)
2. Hard refresh (Ctrl+Shift+R) to clear cache
3. Check browser console for errors
4. Try different workflow
5. Try different browser

### Issue: Form won't submit
**Solution:**
1. Check for validation error messages
2. Fill all required fields
3. Check browser console for JavaScript errors
4. Verify network connection is working
5. Try step again

### Issue: File upload not working
**Solution:**
1. Check file size (should be < 10MB)
2. Try different file type
3. Check browser permissions for file access
4. Check browser console for specific error
5. Try in private/incognito window

### Issue: Multiselect not saving selections
**Solution:**
1. Verify checkbox state changes when clicked
2. Check browser console for errors
3. Try completing the step
4. Verify data is sent to server (check Network tab)

---

## Success Criteria Checklist

### Functionality
- [ ] Radio buttons display correctly
- [ ] Radio buttons can be selected
- [ ] Only one radio option selected at a time
- [ ] Multiselect checkboxes display correctly
- [ ] Multiple checkboxes can be selected
- [ ] File upload area is visible
- [ ] Files can be uploaded
- [ ] Files can be removed
- [ ] Form validation works

### User Experience
- [ ] All elements are clearly visible
- [ ] Elements are properly spaced
- [ ] Labels are readable
- [ ] Selections are clear (visual feedback)
- [ ] Error messages are helpful
- [ ] Navigation between steps works
- [ ] Form data is preserved

### Technical
- [ ] No JavaScript errors in console
- [ ] No warning messages (except bundle size)
- [ ] Application responsive
- [ ] Fast form interactions
- [ ] Works on mobile
- [ ] Works on tablet
- [ ] Works on desktop

### Accessibility
- [ ] Keyboard navigation works
- [ ] Focus indicators visible
- [ ] Labels associated with inputs
- [ ] Tab order logical
- [ ] Larger text readable
- [ ] High contrast sufficient

---

## Documentation References

For more detailed information, see:
- **WORKFLOW_FORM_ELEMENTS_QUICK_REFERENCE.md** - Quick overview
- **WORKFLOW_STEP_FORM_ELEMENTS_FIX.md** - Technical details
- **WORKFLOW_FORM_ELEMENTS_TESTING_GUIDE.md** - Comprehensive test procedures

---

## Test Report Template

```
Date: ________________
Tester: _______________
Browser: ______________
OS: ____________________

Test Results:
[ ] Test 1: Radio Buttons - PASS / FAIL
[ ] Test 2: Multi-Select - PASS / FAIL
[ ] Test 3: Validation - PASS / FAIL
[ ] Test 4: File Upload - PASS / FAIL
[ ] Test 5: Complete Workflow - PASS / FAIL

Overall Status: __________ (PASS/FAIL)

Issues Found:
1. ___________________
2. ___________________
3. ___________________

Notes:
_____________________
_____________________

Tester Signature: _____________ Date: _______
```

---

## Contact & Support

If you encounter issues:
1. Document exact steps to reproduce
2. Note any error messages
3. Check browser console
4. Test in different browser
5. Report with test report template above

**Expected Testing Time:** 30-45 minutes (all tests)
**Quick Testing Time:** 15-20 minutes (Tests 1-5 only)
