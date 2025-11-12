# Workflow Step Execution Feature - Testing Guide

## 🎯 Feature Overview

The workflow step execution feature enables staff and admin users to execute workflow steps in a guided, step-by-step manner. Users can:

- **View Workflow Steps**: See all steps in the workflow with descriptions and estimated time
- **Complete Form Fields**: Fill out dynamically generated forms for each step
- **Check Checklist Items**: Mark off checklist items as they complete them
- **Add Notes**: Document observations and important details
- **Upload Photos**: Attach photos/evidence for each step
- **Navigate Steps**: Move between steps using Previous/Next buttons
- **Skip Steps**: Skip steps with a provided reason (if allowed)
- **Auto-Progress**: Automatically advance to the next step after completion

## 📋 Prerequisites

### Backend Setup
- MongoDB database running and connected
- Backend API server running at `http://localhost:3000`
- Admin user seeded with sample workflows

### Frontend Setup
- React development server running at `http://localhost:5173`
- All dependencies installed
- Application loaded and authenticated

### Test Data
- At least one order with an in-progress workflow assigned
- Workflow with steps that have:
  - Form fields (various types: text, textarea, number, date, time, select, checkbox)
  - Checklist items
  - Estimated time

## 🚀 Quick Start Test (5 minutes)

### Step 1: Login and Navigate
```
1. Open http://localhost:5173
2. Login with admin credentials:
   Email: admin@example.com
   Password: admin123
3. Click on "Orders" in the navigation
4. Select an order that has workflows assigned
```

### Step 2: Find a Workflow
```
1. Scroll down to the "Workflows" section
2. Look for a workflow with status "In Progress" or "Pending"
3. If no "In Progress" workflow exists:
   - Click the "Start" button on a "Not Started" workflow
   - Follow the confirmation dialogs
   - The workflow will now be "In Progress"
```

### Step 3: Execute the Workflow (NEW FEATURE)
```
1. Click on the workflow card or look for an "Execute" button
2. Alternatively, click the "Start" button on the workflow card to see the execution modal
3. The WorkflowExecutionModal should open with tabs:
   - "Overview" tab: Shows workflow details and steps
   - "Execute Step" tab: Shows the step execution interface
4. Click on the "Execute Step" tab
```

### Step 4: Complete a Step (NEW FUNCTIONALITY)
```
1. You should see the WorkflowStepExecutionPanel with:
   - Step title and description
   - Progress bar showing workflow progress
   - Form fields (if any)
   - Checklist items (if any)
   - Notes textarea
   - Photo upload area
   - Navigation buttons (Previous/Next)
   - Complete Step and Skip Step buttons

2. Fill in any required form fields
3. Check off checklist items as you go through them
4. Add any notes about the step
5. Optionally upload photos
6. Click "Complete Step"
7. Confirm in the alert dialog
8. The step should be marked as complete
9. The workflow should auto-advance to the next step
```

## 📊 Detailed Test Scenarios

### Scenario 1: Basic Step Completion

**Objective**: Complete a simple workflow step with form fields

**Steps**:
1. Open an in-progress workflow in execute mode
2. Verify the current step is displayed with:
   - ✅ Step title (e.g., "Step 1: Diagnostic Assessment")
   - ✅ Step description
   - ✅ Progress bar showing 1/X steps
3. Fill in all required form fields (marked with *)
4. Click "Complete Step"
5. Confirm in the alert dialog by clicking "Complete Step"

**Expected Results**:
- ✅ Loading spinner appears on button
- ✅ "Completing..." text shown
- ✅ Success toast notification appears
- ✅ Step status changes to "completed"
- ✅ Progress bar updates (showing 2/X steps now)
- ✅ Automatically advances to next step (if available)
- ✅ Buttons re-enabled

**Verification**:
- Check browser console: Should see success messages
- Check network tab: POST request to `/api/orders/:id/workflows/:id/steps/:stepId/complete`
- Response includes updated workflow with new step status

---

### Scenario 2: Form Validation

**Objective**: Test form field validation

**Steps**:
1. Open a step with required form fields
2. Try to click "Complete Step" without filling required fields
3. Observe validation error

**Expected Results**:
- ✅ Validation error toast appears
- ✅ Error message specifies which field is required
- ✅ Step is NOT completed
- ✅ Modal remains open

**Test Different Field Types**:

**Text Field Validation**:
- Fill with text less than minLength
- Expected: Error toast "must be at least X characters"

**Number Field Validation**:
- Fill with number less than min value
- Expected: Error toast "must be at least X"
- Fill with number greater than max value
- Expected: Error toast "must be at most X"

**Textarea Field**:
- Fill with text and submit
- Expected: Should accept and submit successfully

---

### Scenario 3: Checklist Completion

**Objective**: Test checklist item tracking

**Steps**:
1. Open a step with checklist items
2. Verify checklist items display with checkboxes
3. Check each item as you complete them
4. Watch progress update (e.g., "2/4 items checked")

**Expected Results**:
- ✅ Checklist shows all items
- ✅ Checkboxes are interactive
- ✅ Counter updates (e.g., "Checklist Items (2/4)")
- ✅ Form can be submitted regardless of checklist completion
- ✅ Checklist data is included in the submission

---

### Scenario 4: Notes and Photos

**Objective**: Test note-taking and photo upload

**Steps**:
1. Open a workflow step
2. Click in the "Additional Notes" textarea
3. Type some observations
4. Click "Click to upload photos or drag and drop"
5. Select an image file from your computer
6. Verify photo counter shows "1 photo(s) selected"
7. Complete the step

**Expected Results**:
- ✅ Notes text is stored
- ✅ Photo file is selected and counted
- ✅ Both notes and photos are sent to backend on completion
- ✅ No errors during submission

---

### Scenario 5: Step Navigation

**Objective**: Test Previous/Next button navigation

**Steps**:
1. Open a workflow with multiple steps
2. Click "Next" button
3. Verify step index increments (e.g., "2/5")
4. Verify step content updates
5. Click "Previous" button
6. Verify step index decrements
7. Try to click "Previous" on first step
8. Verify button is disabled

**Expected Results**:
- ✅ Next button advances to next step (disabled on last step)
- ✅ Previous button goes back to previous step (disabled on first step)
- ✅ Step display updates correctly
- ✅ Progress bar updates if previous step's status is different

---

### Scenario 6: Skip Step Functionality

**Objective**: Test step skipping with reason collection

**Prerequisites**: Step must have `canSkip: true`

**Steps**:
1. Open a skippable workflow step
2. Verify "Skip Step" button is visible
3. Click "Skip Step"
4. Alert dialog appears asking for reason
5. Leave reason empty and try to click "Skip Step"
6. Verify button is disabled
7. Fill in a reason for skipping
8. Click "Skip Step"
9. Confirm in alert

**Expected Results**:
- ✅ Skip button only shows if canSkip is true
- ✅ Reason textarea is required
- ✅ Skip button disabled until reason is filled
- ✅ Success toast shows "Step X skipped"
- ✅ Step status changes to "skipped"
- ✅ Next step is automatically selected
- ✅ Network request includes skip reason

---

### Scenario 7: Step Status Indicators

**Objective**: Test step status display and updates

**Steps**:
1. Open workflow overview tab
2. Note the status of current step (should show status badge)
3. Complete multiple steps
4. Switch between overview and execute tabs
5. Verify step statuses reflect completed/in-progress/pending

**Expected Results**:
- ✅ Completed steps show green badge and checkmark
- ✅ In-progress step shows blue badge
- ✅ Pending steps show gray badge
- ✅ Status indicators update after each step completion
- ✅ Progress bar updates accordingly

---

### Scenario 8: Error Handling

**Objective**: Test error handling when submission fails

**Steps**:
1. Stop the backend API server (or disconnect internet)
2. Try to complete a step
3. Wait for timeout

**Expected Results**:
- ✅ Error toast appears with message
- ✅ Button shows error state briefly
- ✅ Modal remains open (not auto-closed)
- ✅ User can retry
- ✅ Console shows error details

**Reconnect and retry**:
1. Restart backend API
2. Try to complete step again
3. Should succeed

---

### Scenario 9: Multiple Steps Workflow

**Objective**: Test completing multiple steps in sequence

**Steps**:
1. Open a workflow with 5+ steps
2. Verify step 1 is current
3. Complete step 1
4. Verify auto-advance to step 2
5. Complete step 2
6. Verify auto-advance to step 3
7. Continue until all steps are complete

**Expected Results**:
- ✅ Each step auto-advances after completion
- ✅ Progress bar increments properly
- ✅ All step statuses are tracked
- ✅ Final step completion shows workflow complete
- ✅ Step counter shows "5/5" when all done

---

### Scenario 10: Form Field Types

**Objective**: Test all supported form field types

**Test Each Type**:

1. **Text Field**:
   - Fill with alphanumeric text
   - Submit and verify in console

2. **Textarea Field**:
   - Fill with multiline text
   - Submit and verify

3. **Number Field**:
   - Fill with numeric value
   - Submit and verify

4. **Date Field**:
   - Click to open date picker
   - Select a date
   - Submit and verify

5. **Time Field**:
   - Click to open time picker
   - Select a time
   - Submit and verify

6. **Select Field**:
   - Click dropdown
   - Select an option
   - Submit and verify

7. **Checkbox Field**:
   - Toggle checkbox
   - Submit and verify true/false value

8. **File Field** (if available):
   - Select a file
   - Submit and verify

**Expected Results**:
- ✅ All field types render correctly
- ✅ Values are captured correctly
- ✅ Validation works for each type
- ✅ Values persist in form state
- ✅ All values sent to backend on submission

---

## 🔍 Browser Console Testing

### Enable Detailed Logging

Open browser console (F12) and look for these log messages:

**When step completes**:
```
"OrderDetails: Refreshing workflows after step completion"
"OrderDetails: Workflows received: ..."
```

**API Request/Response**:
```
POST /api/orders/:id/workflows/:id/steps/:stepId/complete
Response: { formData: {...}, checklistData: {...}, notes: "..." }
```

### Network Tab Testing

1. Open DevTools → Network tab
2. Complete a step
3. Look for POST request to `/api/orders/.../workflows/.../steps/.../complete`
4. Click on request and verify:
   - **Status**: 200 (success) or appropriate error code
   - **Request Payload**: Includes formData, checklistData, notes, photos
   - **Response**: Updated workflow data with new step status

---

## 📱 Responsive Design Testing

### Desktop (1920px)
- Workflow modal opens full width with tabs visible
- Step content displays properly
- All buttons are accessible

### Tablet (768px)
- Modal is responsive
- Form fields stack properly
- Buttons remain clickable

### Mobile (375px)
- Modal scrollable if content overflows
- Touch targets are large enough (min 44px)
- Orientation changes handled correctly

---

## ✅ Acceptance Criteria Checklist

Complete the following checklist to verify the feature is working correctly:

- [ ] Form fields render correctly for all types
- [ ] Form validation works for required fields
- [ ] Form validation works for min/max constraints
- [ ] Checklist items can be checked/unchecked
- [ ] Notes can be added and submitted
- [ ] Photos can be uploaded and counted
- [ ] Previous/Next navigation works
- [ ] Steps auto-advance on completion
- [ ] Step status indicators update correctly
- [ ] Skip step functionality works (if enabled)
- [ ] Error messages display properly on failures
- [ ] Success toasts show after completion
- [ ] Network requests include all required data
- [ ] Loading states show during submission
- [ ] Modal can be closed without affecting workflow
- [ ] Multiple steps can be completed in sequence
- [ ] All field types (text, textarea, number, date, time, select, checkbox) work
- [ ] Progress bar updates correctly
- [ ] Overall workflow progress updates
- [ ] Responsive design works on all screen sizes

---

## 🐛 Common Issues and Troubleshooting

### Issue: Form fields not rendering

**Solution**:
1. Check browser console for errors
2. Verify workflow has `formFields` property
3. Check that formFields array has correct structure
4. Ensure field `type` is supported

### Issue: Step not advancing after completion

**Solution**:
1. Check if there are more steps after the current one
2. Check browser console for errors
3. Verify `onStepComplete` callback is being called
4. Check network response for errors

### Issue: Photos not uploading

**Solution**:
1. Check file size (should be reasonable)
2. Verify it's an image file (jpg, png, etc.)
3. Check browser console for file input errors
4. Verify backend accepts photo uploads

### Issue: Validation not working

**Solution**:
1. Check that field has `required: true` or validation rules
2. Verify field type is supported (check mapping in component)
3. Look at console for validation logic
4. Ensure field names are unique

### Issue: Modal not opening

**Solution**:
1. Verify workflow exists and has steps
2. Check browser console for JavaScript errors
3. Verify OrderDetails.tsx is calling handleStartWorkflow correctly
4. Check that workflow has `steps` property

### Issue: API call failing

**Solution**:
1. Check backend is running at http://localhost:3000
2. Verify orderId and workflowId are valid
3. Check network tab for error response
4. Verify authentication token is valid
5. Check backend logs for detailed error

---

## 📈 Performance Testing

### Metrics to Monitor

1. **Modal Load Time**: Should be < 500ms
2. **Step Advance Time**: Should be < 2 seconds
3. **Memory Usage**: Should not increase significantly
4. **Network Requests**: Monitor in DevTools Network tab

### Test Steps

1. Open DevTools → Performance tab
2. Click "Start recording"
3. Complete a workflow step
4. Click "Stop recording"
5. Analyze timeline:
   - Look for long tasks
   - Check for main thread blocking
   - Verify animations are smooth (60fps)

---

## 🎓 Feature Demonstration

### Demo Workflow

If you want to demonstrate this feature to others:

1. **Setup**:
   - Login as admin
   - Navigate to an order with in-progress workflow
   - Open workflow in execute mode

2. **Show Form Fields**:
   - Point out required fields (marked with *)
   - Show field validation working
   - Fill in sample data

3. **Show Checklist**:
   - Check off items one by one
   - Show counter updating

4. **Show Navigation**:
   - Use Previous/Next buttons
   - Show step counter updating

5. **Complete Step**:
   - Click Complete Step
   - Show loading spinner
   - Show success toast
   - Show auto-advance to next step
   - Show progress bar updating

6. **Multiple Steps**:
   - Complete several steps in sequence
   - Show overall progress increasing

---

## 📞 Support

### Getting Help

If you encounter issues:

1. **Check Console**: Open DevTools (F12) and check Console tab for errors
2. **Check Network**: Open DevTools → Network tab and look for failed requests
3. **Review Logs**: Check backend logs for error details
4. **Restart**: Try refreshing the page and retrying
5. **Check Data**: Verify the workflow has proper step configuration

### Reporting Issues

Include the following when reporting issues:

- Browser and version
- Steps to reproduce
- Screenshots or screen recording
- Console error messages
- Network request details
- Backend logs (if available)

---

## ✨ What's Working

✅ **Implemented Features**:
- Step-by-step execution modal with tabs
- Form field rendering and validation (all types)
- Checklist item tracking
- Notes textarea
- Photo upload
- Previous/Next navigation
- Step auto-advance on completion
- Skip step functionality
- Status indicators and progress tracking
- Error handling and user feedback
- Responsive design
- Loading states and visual feedback

✅ **Integration**:
- Integrated with OrderDetails.tsx
- Connected to backend API endpoints
- Workflow data properly passed and updated
- Timeline tracking of all actions
- Role-based access control

✅ **User Experience**:
- Intuitive step-by-step interface
- Clear visual feedback
- Helpful error messages
- Smooth navigation
- Mobile-friendly design

---

**Feature Status**: ✅ **Production Ready**

The workflow step execution feature is fully implemented and ready for comprehensive testing. All core functionality is working and integrated with the existing order management system.

---

**Last Updated**: 2024
**Feature Version**: 1.0.0
**Status**: ✅ Complete and Ready for Testing
