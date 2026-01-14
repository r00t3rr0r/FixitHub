# Workflow Step Form Elements - Testing Guide

## Overview
This guide provides comprehensive testing procedures for the newly implemented form elements (radio buttons, multi-select, and file uploads) in the workflow step execution interface.

## Prerequisites
- Admin or Staff user account with access to orders
- At least one workflow with form fields that includes radio, multiselect, or file type fields
- Browser with console access for error checking

## Test Environment
- URL: https://preview-0usremq6.ui.pythagora.ai
- Application: FixitHub Device Repair Management System
- Workflows Available: Display-Reparatur und -Kalibrierung, Batteriewechsel und -kalibrierung, etc.

## Test Workflows with Form Elements
The following German workflows contain radio buttons, multiselect, and other form fields:

1. **Display-Reparatur und -Kalibrierung** (Display Repair and Calibration)
   - Step 1: Radio field for display issue types
   - Step 2: Radio field for adhesive removal status
   - Step 3: Radio field for dead pixels and Select fields

2. **Batteriewechsel und -kalibrierung** (Battery Replacement and Calibration)
   - Step 2: Radio field for old battery disposal
   - Step 3: Radio field for battery recognition and Select fields

3. **Wasserschaden-Wiederherstellung** (Water Damage Recovery)
   - Step 1: Select and radio fields
   - Step 3: Multiselect field for damaged components

4. **Allgemeine Qualitätskontrolle** (General Quality Control)
   - Multiple steps with radio buttons and text fields

## Test Case 1: Radio Button Visibility and Selection

### Steps
1. Navigate to https://preview-0usremq6.ui.pythagora.ai/admin/orders
2. Click on any order that has a workflow assigned
3. In the workflow section, click "Start Workflow" or "Resume"
4. Navigate to a step with radio button fields (e.g., "Display-Diagnose" step)
5. Look for the form fields section

### Expected Results
✓ Radio button options are visible and properly formatted
✓ Each radio option has a clear label
✓ Options are spaced vertically for easy selection
✓ Only one option can be selected at a time
✓ Selected option shows a filled circle indicator
✓ Labels are clickable (cursor changes to pointer)

### Verification
- Check browser console for any errors (F12 → Console)
- Verify radio buttons are clearly visible in the form
- Attempt to select different radio options and verify only one is selected
- Check that the selected value persists when navigating between steps

### Success Criteria
☑ All radio buttons render without errors
☑ Selection works correctly (only one option selected)
☑ Labels are clickable and responsive
☑ No console errors appear

---

## Test Case 2: Multi-Select Checkbox Functionality

### Steps
1. Navigate to https://preview-0usremq6.ui.pythagora.ai/admin/orders
2. Find an order with workflow containing multiselect fields
   - Suggested: "Wasserschaden-Wiederherstellung" workflow, step 3
3. Execute the workflow and navigate to the multiselect field
4. Look for the "Beschädigte Komponenten" (Damaged Components) field

### Expected Results
✓ Multiple checkbox options are visible
✓ Each option can be independently selected
✓ Multiple options can be selected simultaneously
✓ Selected items show checkmarks
✓ Labels clearly describe each option
✓ User can unselect previously selected items

### Verification
- Select multiple options and verify all checkmarks appear
- Unselect an option and verify checkmark disappears
- Check form data persists when navigating steps
- Verify required field validation works if field is marked required

### Test Scenario
1. Select "Batterie" (Battery)
2. Select "Hauptplatine" (Motherboard)
3. Select "Display"
4. Verify all three are checked
5. Click "Hauptplatine" to uncheck it
6. Verify only "Batterie" and "Display" remain checked

### Success Criteria
☑ Multiple selections work correctly
☑ Unselection works correctly
☑ All checked items are visually indicated
☑ Form data is properly collected

---

## Test Case 3: File Upload Functionality

### Steps
1. Navigate to https://preview-0usremq6.ui.pythagora.ai/admin/orders
2. Find a workflow step with file upload fields (if available in your workflows)
3. Execute workflow and navigate to the file upload field
4. Test file upload interaction

### Expected Results
✓ File upload area is clearly visible with dashed border
✓ Upload icon and instruction text are displayed
✓ Click on upload area triggers file selection dialog
✓ Files can be selected from the system
✓ Selected files are listed below the upload area
✓ Each file has a remove button (X icon)
✓ Multiple files can be uploaded sequentially
✓ File names are displayed and truncated if too long

### Verification
- Click on the file upload area
- Select an image file (JPG, PNG)
- Verify file appears in the list below
- Click X button on the file and verify it's removed
- Upload another file and verify it's added to the list
- Verify you can have multiple files selected

### Success Criteria
☑ File selection dialog opens
☑ Selected files appear in the list
☑ File removal works correctly
☑ Multiple files can be managed
☑ No console errors during file operations

---

## Test Case 4: Form Validation for New Elements

### Steps
1. Navigate to a workflow step with radio/multiselect/file fields
2. Navigate to the "Complete Step" action
3. If fields are marked as required, attempt to complete without filling them

### Expected Results for Radio (Required)
✓ Toast error message appears: "[Field Label] is required"
✓ Step does not complete
✓ User is prompted to select an option
✓ After selecting an option, validation passes

### Expected Results for Multiselect (Required)
✓ Toast error message appears: "Please select at least one option for [Field Label]"
✓ Step does not complete until at least one option is selected
✓ Multiple selections satisfy the requirement

### Expected Results for All Fields
✓ Form validation runs before submission
✓ Clear error messages guide the user
✓ Errors disappear once field is filled correctly
✓ Form can be successfully submitted after fixing errors

### Test Scenario
1. Navigate to "Display-Reparatur" workflow, Step 1 (required radio field)
2. Click "Complete Step" without selecting any option
3. Verify error message appears
4. Select an option for "Art des Display-Problems"
5. Click "Complete Step" again
6. Verify step completes successfully

### Success Criteria
☑ Required field validation works
☑ Error messages are clear and helpful
☑ Form submits after validation passes
☑ No duplicate validations or errors

---

## Test Case 5: Form Field States and Interactions

### Steps
1. Open a workflow execution with form fields
2. Test field behavior during submission and navigation
3. Verify form state is maintained across navigation

### Expected Results
✓ Fields are disabled during form submission (buttons showing "Completing...")
✓ Radio buttons are disabled during submission
✓ Checkboxes are disabled during submission
✓ File upload is disabled during submission
✓ After submission, form resets for next step
✓ Navigation between steps preserves form data

### Verification
- Start completing a step
- Click "Complete Step" to trigger submission
- Verify all form elements become disabled
- Wait for step to complete
- Verify new form fields are empty/reset
- Use Previous button to go back
- Verify previous step's form data is still visible

### Success Criteria
☑ Form elements are disabled during submission
☑ User receives visual feedback during processing
☑ Form resets properly for next step
☑ Navigation preserves data appropriately

---

## Test Case 6: Responsive Design and Accessibility

### Mobile Testing (Tablet/Phone)
1. Open workflow on mobile device or use browser DevTools
2. Switch to responsive design mode (F12 → Responsive Design Mode)
3. Test viewport sizes: 375px, 768px, 1024px

### Expected Results
✓ Radio buttons remain clearly visible on small screens
✓ Multi-select checkboxes are properly spaced
✓ File upload area is usable on mobile
✓ Labels are readable and not truncated
✓ Touch targets are adequate size (min 44px)

### Accessibility Testing
1. Press Tab key to navigate through form fields
2. Verify focus indicators are visible
3. Use keyboard arrows for radio button selection
4. Space/Enter to toggle checkboxes

### Expected Results
✓ All form elements are keyboard navigable
✓ Focus indicators are clearly visible
✓ Radio buttons respond to arrow keys
✓ Checkboxes respond to space bar
✓ Labels are associated with form inputs
✓ Required fields are indicated

### Success Criteria
☑ Form works on mobile viewports
☑ Touch-friendly spacing and sizing
☑ All keyboard navigation works
☑ Accessibility features functioning

---

## Test Case 7: Error Handling and Edge Cases

### Test Scenario 1: Long Labels and Option Text
1. In a workflow with radio/multiselect, look at fields with longer labels
2. Verify text wraps and doesn't overflow

### Expected Results
✓ Long labels wrap properly to next line
✓ No horizontal scrolling required
✓ Radio circles remain aligned with text
✓ Checkboxes remain aligned with text

### Test Scenario 2: Many Options
1. Find a workflow with multiselect field with many options
   - Example: "Komponenten-Austausch" in Wasserschaden workflow
2. Scroll through options to verify all are accessible

### Expected Results
✓ All options are visible (may require scrolling)
✓ Scrolling doesn't interfere with selection
✓ No layout shift when selecting/unselecting

### Test Scenario 3: Browser Console Errors
1. Open browser DevTools (F12)
2. Navigate to Console tab
3. Execute a complete workflow step
4. Execute another step

### Expected Results
✓ No JavaScript errors appear
✓ No warnings about missing components
✓ No validation errors that shouldn't appear
✓ Console remains clean throughout workflow

### Success Criteria
☑ Long text handled gracefully
☑ Many options navigable
☑ No console errors or warnings
☑ Robust error handling

---

## Test Case 8: Complete Workflow Execution

### Full Workflow Test
1. Login as Admin or Staff (https://preview-0usremq6.ui.pythagora.ai)
2. Navigate to Order Management
3. Select an order and assign "Display-Reparatur und -Kalibrierung" workflow
4. Execute workflow from start to finish

### Step Checklist
- [ ] Step 1 (Display-Diagnose): Complete with radio field selection
- [ ] Step 2 (Display-Austausch): Complete with radio field (Ja/Nein) selection
- [ ] Step 3 (Display-Kalibrierung): Complete with radio and select fields
- [ ] Verify "Complete Workflow" message appears
- [ ] Order status reflects workflow completion

### Expected Results
✓ All form elements display correctly in sequence
✓ Form validation works at each step
✓ Navigation between steps works smoothly
✓ Workflow completes successfully
✓ Completion toast message appears
✓ Order is updated with workflow completion data

### Success Criteria
☑ Complete workflow execution succeeds
☑ All form types work throughout workflow
☑ Data is properly saved
☑ No errors during complete workflow

---

## Regression Testing Checklist

### Existing Form Elements Still Work
- [ ] Text input fields work correctly
- [ ] Textarea fields work correctly
- [ ] Number input fields with validation work
- [ ] Date/Time fields work correctly
- [ ] Select dropdown fields work correctly
- [ ] Single checkbox fields work correctly
- [ ] Checklist items work correctly
- [ ] Photo upload functionality works
- [ ] Notes field works correctly

### Navigation and Flow
- [ ] Previous button navigates correctly
- [ ] Next button navigates correctly
- [ ] Skip step functionality works (if applicable)
- [ ] Complete step button works
- [ ] Progress bar updates correctly
- [ ] Step counter displays correctly

### General Functionality
- [ ] Workflow start works
- [ ] Workflow pause/resume works
- [ ] Error messages display clearly
- [ ] Toast notifications appear correctly
- [ ] Form data persists during navigation
- [ ] Form resets between steps appropriately

---

## Common Issues and Troubleshooting

### Issue: Radio buttons not appearing
**Solution:**
1. Check browser console for errors (F12 → Console)
2. Verify workflow has form fields with type: 'radio'
3. Refresh page and try again
4. Clear browser cache and reload

### Issue: Multiselect selections not saving
**Solution:**
1. Verify field type is correctly set to 'multiselect'
2. Check that array values are being stored correctly
3. Verify browser console shows no errors
4. Test with different field to isolate issue

### Issue: File upload not working
**Solution:**
1. Verify file size is reasonable (< 10MB)
2. Check browser console for specific errors
3. Try different file format
4. Verify upload field is not disabled

### Issue: Form validation blocking submission
**Solution:**
1. Verify all required fields are filled
2. Check validation error message for specific issue
3. Correct the identified field and try again
4. For multiselect: ensure at least one option selected

### Issue: Console shows errors
**Solution:**
1. Note the exact error message
2. Check if it prevents functionality
3. Refresh page and try again
4. Report persistent errors with full error message

---

## Performance Testing

### Load Testing
- [ ] Page loads in < 2 seconds
- [ ] Form renders smoothly without jank
- [ ] Radio selection responds immediately
- [ ] Checkbox selection responds immediately
- [ ] File selection doesn't lag

### Memory Usage
- [ ] Multiple file selections don't cause memory issues
- [ ] Switching between steps doesn't leak memory
- [ ] Form data remains efficient

---

## Sign-Off Checklist

| Test Case | Status | Date | Tester |
|-----------|--------|------|--------|
| Radio Button Visibility | ☑ Pass / ☐ Fail | | |
| Multi-Select Functionality | ☑ Pass / ☐ Fail | | |
| File Upload | ☑ Pass / ☐ Fail | | |
| Form Validation | ☑ Pass / ☐ Fail | | |
| Form Field States | ☑ Pass / ☐ Fail | | |
| Responsive Design | ☑ Pass / ☐ Fail | | |
| Error Handling | ☑ Pass / ☐ Fail | | |
| Complete Workflow | ☑ Pass / ☐ Fail | | |
| Regression Tests | ☑ Pass / ☐ Fail | | |

---

## Notes and Observations

_Use this space to document any issues, unexpected behaviors, or additional observations:_

```
[Space for tester notes]
```

---

## Approval

- **QA Verified:** ☑ Yes / ☐ No
- **Date:** _______________
- **Tester Name:** _______________
- **Known Issues:** _______________

---

## Related Documentation
- WORKFLOW_STEP_FORM_ELEMENTS_FIX.md - Technical implementation details
- WORKFLOW_STEP_EXECUTION_README.md - General documentation
- README.md - Project setup and overview
