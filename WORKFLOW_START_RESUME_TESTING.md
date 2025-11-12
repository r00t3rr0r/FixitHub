# Workflow Start/Resume/Pause Feature Testing Guide

## Overview
This document provides comprehensive testing instructions for the new workflow start, resume, and pause functionality added to the Order Details page. The feature enables admin and staff users to initiate workflow execution, pause workflows when needed, and resume paused workflows with an intuitive, step-by-step guided interface.

## Prerequisites
- Application is running (client on port 5173, server on port 3000)
- Web interface is accessible at https://preview-0iwg067v.ui.pythagora.ai
- Admin and staff users are seeded in the database
- At least one workflow template is configured in the system
- Orders with assigned workflows are available

## Feature Summary

### New Capabilities
✅ **Start Workflow**: Admin/Staff can initiate a "not-started" workflow
✅ **Pause Workflow**: Admin/Staff can pause an "in-progress" workflow
✅ **Resume Workflow**: Admin/Staff can resume a paused ("on-hold") workflow
✅ **Workflow Execution Modal**: Intuitive step-by-step guidance interface
✅ **Progress Tracking**: Visual progress indicators and step details
✅ **Confirmation Dialogs**: Double-confirmation to prevent accidental actions
✅ **Loading States**: Clear visual feedback during workflow operations
✅ **Toast Notifications**: Success/error messages for all actions
✅ **Timeline Tracking**: All workflow actions recorded in order timeline

---

## Manual UI Testing Steps

### Test 1: Admin Login and Navigation to Order with Workflows

**Steps:**
1. Open https://preview-0iwg067v.ui.pythagora.ai in your browser
2. Click on "Login" button
3. Use credentials:
   - Email: `admin@example.com`
   - Password: `admin123`
4. After successful login, navigate to the Admin Dashboard
5. Click on "Orders" in the admin menu (left sidebar)
6. Select an order that has workflows assigned to it
7. Scroll down to the "Workflows" section

**Expected Result:**
- ✓ Login successful
- ✓ Dashboard loads
- ✓ Order Details page displays
- ✓ Workflows section is visible with workflow cards
- ✓ Each workflow card shows: name, status, progress bar, steps list

---

### Test 2: Start a Workflow - Modal Display

**Steps:**
1. From Order Details page, locate a workflow with status "Not Started"
2. Click the "Start" button on the workflow card
3. Observe the Workflow Execution Modal that opens

**Expected Result:**
- ✓ Modal opens showing workflow details
- ✓ Modal displays:
  - Workflow name and title
  - Total number of steps and estimated time
  - Overall progress bar
  - Current step details (highlighted in blue)
  - Complete list of all steps (scrollable)
  - Important guidelines section
  - Step navigation controls (previous/next arrows)
  - "Confirm & Start" button
- ✓ Modal shows step counter (e.g., "1 / 5")
- ✓ Step descriptions are clear and visible
- ✓ All workflow steps are listed with their status indicators:
  - Gray dot for pending steps
  - Blue dot for in-progress steps
  - Green dot for completed steps

---

### Test 3: Start Workflow - Step Navigation

**Steps:**
1. With Workflow Execution Modal open, verify step navigation
2. Click the "next" arrow to navigate to the next step
3. Verify the current step display updates
4. Click on different steps in the step list to jump to them
5. Verify the step counter and description update

**Expected Result:**
- ✓ Next arrow is enabled when not on the last step
- ✓ Previous arrow is enabled when not on the first step
- ✓ Current step display updates when navigating
- ✓ Clicking step in list jumps to that step immediately
- ✓ Step counter updates correctly (e.g., "2 / 5")
- ✓ Descriptions change as you navigate

---

### Test 4: Start Workflow - Confirmation and Execution

**Steps:**
1. Review the workflow details in the modal
2. Click "Confirm & Start" button
3. Confirmation dialog appears
4. Review the confirmation message
5. Click "Start Workflow" in confirmation dialog
6. Wait for the action to complete

**Expected Result:**
- ✓ Confirmation dialog appears with message:
  - "You are about to start '[workflow name]'"
  - Shows number of steps and estimated time
- ✓ "Start Workflow" button is present
- ✓ Green toast notification shows "Workflow started successfully"
- ✓ Modal closes automatically
- ✓ Workflow card updates with new status ("In Progress")
- ✓ Start button changes to "Pause" button
- ✓ Progress bar shows first step as in-progress
- ✓ Order timeline records "Workflow Started" entry

---

### Test 5: Pause a Workflow

**Steps:**
1. Navigate to an order with an "In Progress" workflow
2. Locate the workflow card with "Pause" button
3. Click the "Pause" button
4. Confirm the pause action in the confirmation dialog
5. Wait for the action to complete

**Expected Result:**
- ✓ "Pause" button is visible for in-progress workflows
- ✓ Pause button shows loading state with spinning icon
- ✓ Button text changes to "Pausing..." during action
- ✓ Green toast notification shows "Workflow paused successfully"
- ✓ Workflow card status changes to "On Hold" (yellow badge)
- ✓ Pause button changes to "Resume" button
- ✓ Progress bar remains at same completion percentage
- ✓ Order timeline records workflow status change

---

### Test 6: Resume a Workflow - Modal Display

**Steps:**
1. Navigate to an order with an "On Hold" workflow
2. Click the "Resume" button on the workflow card
3. Observe the Workflow Execution Modal that opens in resume mode

**Expected Result:**
- ✓ Modal opens with "Ready to Resume" badge
- ✓ Modal shows same workflow details as start modal
- ✓ Current step shows the step that was paused/in-progress
- ✓ Progress bar shows same progress as before pause
- ✓ "Confirm & Resume" button is displayed instead of "Confirm & Start"
- ✓ All previous steps show as completed if they were completed before pause

---

### Test 7: Resume Workflow - Confirmation and Execution

**Steps:**
1. With Resume modal open, click "Confirm & Resume"
2. Confirmation dialog appears
3. Read the confirmation message
4. Click "Resume Workflow" button
5. Wait for completion

**Expected Result:**
- ✓ Confirmation dialog appears with:
  - "You are about to resume '[workflow name]'"
  - Message about workflow continuing from where it was paused
- ✓ Green toast notification shows "Workflow resumed successfully"
- ✓ Modal closes
- ✓ Workflow card status changes back to "In Progress" (blue badge)
- ✓ Resume button changes to "Pause" button
- ✓ Current step remains the same as before pause
- ✓ Order timeline records workflow status change

---

### Test 8: Multiple Workflows - Independent Actions

**Steps:**
1. Assign multiple workflows to the same order
2. Start Workflow A
3. Start Workflow B
4. Pause Workflow A
5. Resume Workflow A
6. Pause Workflow B
7. Verify each action only affects the target workflow

**Expected Result:**
- ✓ Each workflow can be controlled independently
- ✓ Starting one workflow doesn't affect others
- ✓ Pausing one workflow doesn't affect others
- ✓ Status changes are workflow-specific
- ✓ Progress bars are independent for each workflow
- ✓ All workflows display correct status badges
- ✓ Timeline shows all actions for each workflow

---

### Test 9: Error Handling - Invalid Actions

**Steps:**
1. Try to start a workflow that's already "In Progress"
   - Expected: Button not available or error message
2. Try to pause a workflow that's "Not Started"
   - Expected: Button not available or error message
3. Try to resume a workflow that's "In Progress"
   - Expected: Button not available or error message
4. Try to resume a workflow that's "Completed"
   - Expected: Button not available or error message

**Expected Result:**
- ✓ Invalid action buttons are disabled or hidden
- ✓ Appropriate error messages if action is attempted
- ✓ No state changes on invalid actions
- ✓ UI remains consistent and usable

---

### Test 10: Modal Cancellation

**Steps:**
1. Click Start/Resume button to open modal
2. Review the workflow details
3. Click "Cancel" button instead of confirming
4. Verify modal closes without taking action
5. Check that workflow status hasn't changed

**Expected Result:**
- ✓ Modal closes when Cancel is clicked
- ✓ No API calls are made
- ✓ No toast notifications appear
- ✓ Workflow status remains unchanged
- ✓ Order timeline has no new entries

---

### Test 11: Confirmation Dialog Cancellation

**Steps:**
1. Open workflow start/resume modal
2. Click "Confirm & Start/Resume"
3. In the confirmation dialog, click "Cancel"
4. Modal returns to workflow details view
5. Verify no action was taken

**Expected Result:**
- ✓ Confirmation dialog closes
- ✓ Back to workflow execution modal
- ✓ No workflow status change
- ✓ No timeline entries
- ✓ Can try again or close the modal

---

### Test 12: Loading States and Disabled Buttons

**Steps:**
1. Click Start button on a workflow
2. Observe button state during processing
3. Try to click other buttons while loading
4. Wait for operation to complete

**Expected Result:**
- ✓ Start button shows spinning icon
- ✓ Button text changes to "Starting..."
- ✓ Button is disabled during operation
- ✓ Other action buttons are also disabled during operation
- ✓ Delete button is disabled during operation
- ✓ Navigation works normally (can leave page)
- ✓ After completion, buttons return to normal state

---

### Test 13: Toast Notifications

**Steps:**
1. Start a workflow and observe toast
2. Pause a workflow and observe toast
3. Resume a workflow and observe toast
4. Trigger an error (e.g., network failure simulation)

**Expected Result:**
- ✓ Green toast appears for successful start: "Workflow started successfully"
- ✓ Green toast appears for successful pause: "Workflow paused successfully"
- ✓ Green toast appears for successful resume: "Workflow resumed successfully"
- ✓ Red toast appears for errors with descriptive message
- ✓ Toast appears in bottom-right corner
- ✓ Toast auto-dismisses after ~4 seconds
- ✓ Manual close button (X) is available
- ✓ Multiple toasts can be displayed simultaneously

---

### Test 14: Role-Based Access

**Steps:**
1. Log out from admin account
2. Log in as a different user with different role:
   - Staff: `staff@example.com` / `test123`
   - Customer: `customer@example.com` / `test123`
3. Navigate to order details
4. Check workflow action buttons

**Expected Result (Admin/Staff):**
- ✓ Workflows section is visible
- ✓ Start/Pause/Resume buttons are available and functional
- ✓ All features work as expected

**Expected Result (Customer):**
- ✓ Workflows section is NOT visible
- ✓ No Start/Pause/Resume options available
- ✓ Customer sees only order information

---

### Test 15: Responsive Design - Desktop

**Steps:**
1. View Order Details on desktop browser (1920x1080 or similar)
2. Check workflow cards layout
3. Check modal appearance
4. Verify button sizes and spacing
5. Test modal navigation

**Expected Result:**
- ✓ Workflow cards display in 2-column grid on large screens
- ✓ Modal is centered and readable
- ✓ All buttons are easily clickable (min 44x44px)
- ✓ Text is readable without zooming
- ✓ Modal fits on screen with scroll if needed
- ✓ Step list is scrollable
- ✓ All controls are accessible

---

### Test 16: Responsive Design - Tablet

**Steps:**
1. View Order Details on tablet (768px width)
2. Check workflow cards layout
3. Check modal appearance
4. Test touch interactions
5. Verify button accessibility

**Expected Result:**
- ✓ Workflow cards display in 1-column layout
- ✓ Modal is sized appropriately for tablet
- ✓ Buttons have adequate touch targets (min 44x44px)
- ✓ No horizontal scrolling needed
- ✓ Step navigation arrows work with touch
- ✓ Scrolling is smooth

---

### Test 17: Responsive Design - Mobile

**Steps:**
1. View Order Details on mobile device (375px width)
2. Check workflow cards layout
3. Check modal appearance
4. Verify modal fits on screen
5. Test all interactions

**Expected Result:**
- ✓ Workflow cards display in 1-column layout
- ✓ Modal is readable and usable
- ✓ All buttons are tappable
- ✓ Text is legible without zooming
- ✓ Modal scrolls if needed
- ✓ Step list is scrollable
- ✓ Bottom button controls are accessible

---

### Test 18: Workflow Progress Tracking

**Steps:**
1. Start a workflow
2. Check the progress display in the card
3. Check the timeline entry for the start action
4. Pause the workflow
5. Check timeline entry for pause action
6. Resume the workflow
7. Check timeline entry for resume action

**Expected Result:**
- ✓ Workflow card shows progress bar at 0% initially
- ✓ Progress bar updates when steps are completed
- ✓ Timeline shows "Workflow Started" entry with timestamp
- ✓ Timeline shows staff member name who started it
- ✓ Timeline shows "Workflow Status Updated" for pause with old/new status
- ✓ Timeline shows "Workflow Status Updated" for resume with old/new status
- ✓ All timeline entries have correct dates/times
- ✓ Progress updates persist across page refreshes

---

### Test 19: Page Refresh and State Persistence

**Steps:**
1. Start a workflow
2. Refresh the page
3. Navigate back to the same order
4. Check workflow status

**Expected Result:**
- ✓ Workflow shows as "In Progress" after refresh
- ✓ Progress bar remains at correct percentage
- ✓ All data is consistent
- ✓ Timeline entries persist
- ✓ No duplicate actions in timeline

---

### Test 20: Concurrent Actions

**Steps:**
1. Open two browser tabs with the same order
2. In Tab 1: Start a workflow
3. Observe Tab 2 (if auto-refresh is enabled)
4. In Tab 2: Try to pause the workflow
5. Check both tabs for consistency

**Expected Result:**
- ✓ Action in Tab 1 succeeds
- ✓ Tab 2 may show stale data until refresh
- ✓ Pause action in Tab 2 succeeds if workflow is in progress
- ✓ Both browsers can see updated state after refresh
- ✓ No data corruption
- ✓ Timeline shows both actions

---

## API Testing (For Developers)

### Test Start Workflow Endpoint

```bash
# Get auth token
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"admin123"}' | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)

# Get an order ID with workflows
ORDER_ID="your_order_id_here"
WORKFLOW_ID="your_workflow_id_here"

# Start workflow
curl -X POST http://localhost:3000/api/admin/orders/$ORDER_ID/workflows/$WORKFLOW_ID/start \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Workflow started successfully",
  "order": {
    "_id": "order_id",
    "workflows": [
      {
        "_id": "workflow_id",
        "status": "in-progress",
        "startedAt": "2024-01-15T10:30:00Z",
        "steps": [
          {
            "_id": "step_id",
            "status": "in-progress",
            "startedAt": "2024-01-15T10:30:00Z"
          }
        ]
      }
    ],
    "timeline": [
      {
        "status": "Workflow Started",
        "description": "Workflow \"Repair Process\" started by John Doe",
        "completedAt": "2024-01-15T10:30:00Z",
        "staffName": "John Doe"
      }
    ]
  }
}
```

### Test Pause Workflow Endpoint

```bash
# Pause workflow (transition from in-progress to on-hold)
curl -X PUT http://localhost:3000/api/admin/orders/$ORDER_ID/workflows/$WORKFLOW_ID/status \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"on-hold"}'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Workflow status updated successfully",
  "order": {
    "workflows": [
      {
        "_id": "workflow_id",
        "status": "on-hold",
        "startedAt": "2024-01-15T10:30:00Z"
      }
    ],
    "timeline": [
      {
        "status": "Workflow Status Updated",
        "description": "Workflow \"Repair Process\" status changed from in-progress to on-hold",
        "completedAt": "2024-01-15T10:35:00Z",
        "staffName": "John Doe"
      }
    ]
  }
}
```

### Test Resume Workflow Endpoint

```bash
# Resume workflow (transition from on-hold to in-progress)
curl -X PUT http://localhost:3000/api/admin/orders/$ORDER_ID/workflows/$WORKFLOW_ID/status \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"in-progress"}'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Workflow status updated successfully",
  "order": {
    "workflows": [
      {
        "_id": "workflow_id",
        "status": "in-progress",
        "startedAt": "2024-01-15T10:30:00Z"
      }
    ],
    "timeline": [
      {
        "status": "Workflow Status Updated",
        "description": "Workflow \"Repair Process\" status changed from on-hold to in-progress",
        "completedAt": "2024-01-15T10:40:00Z",
        "staffName": "John Doe"
      }
    ]
  }
}
```

### Error Cases

```bash
# Try to start an already started workflow
curl -X POST http://localhost:3000/api/admin/orders/$ORDER_ID/workflows/$WORKFLOW_ID/start \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response:**
```json
{
  "error": "Workflow has already been started"
}
```

---

## Testing Checklist

- [ ] Admin can login successfully
- [ ] Workflows section is visible on Order Details
- [ ] Start button visible for "not-started" workflows
- [ ] Workflow Execution Modal opens with complete details
- [ ] Step navigation works correctly
- [ ] Modal displays all steps with status indicators
- [ ] Start action transitions workflow to "in-progress"
- [ ] Pause button visible for "in-progress" workflows
- [ ] Pause action transitions workflow to "on-hold"
- [ ] Resume button visible for "on-hold" workflows
- [ ] Resume action transitions workflow back to "in-progress"
- [ ] Toast notifications appear for all actions
- [ ] Timeline entries recorded for all actions
- [ ] Loading states display during operations
- [ ] Cancel buttons work correctly
- [ ] Confirmation dialogs prevent accidental actions
- [ ] Multiple workflows can be controlled independently
- [ ] Staff users have same capabilities as admin
- [ ] Customers cannot see or control workflows
- [ ] Responsive design works on desktop/tablet/mobile
- [ ] Progress tracking is accurate
- [ ] Error messages display appropriately
- [ ] Page refreshes maintain state correctly
- [ ] All API endpoints respond with correct data
- [ ] No console errors appear

---

## Troubleshooting

### Start Button Not Appearing
- **Solution**: Verify workflow status is "not-started" in database
- **Solution**: Refresh the page to reload workflow data
- **Solution**: Check browser console for JavaScript errors

### Modal Not Opening
- **Solution**: Ensure WorkflowExecutionModal component is imported
- **Solution**: Check network tab for failed API calls
- **Solution**: Verify workflow data is loading correctly

### Toast Notification Not Showing
- **Solution**: Verify toast provider is initialized in App.tsx
- **Solution**: Check browser console for JavaScript errors
- **Solution**: Verify workflow action completed successfully

### Status Not Updating
- **Solution**: Refresh the page to fetch latest data from server
- **Solution**: Check network tab for successful API response
- **Solution**: Verify user has admin/staff role

### Modal Buttons Disabled
- **Solution**: This is expected during action execution
- **Solution**: Wait for operation to complete (1-3 seconds)
- **Solution**: Check for error toasts

---

## Performance Notes

- **Modal Load Time**: < 500ms for modal appearance
- **API Response Time**: < 2 seconds for workflow status update
- **UI Update Time**: < 500ms for workflow card status change
- **Animation Smoothness**: 60fps spinning icon animation

---

## Browser Compatibility

- ✓ Chrome 90+
- ✓ Firefox 88+
- ✓ Safari 14+
- ✓ Edge 90+
- ✓ Mobile browsers (iOS Safari, Chrome Mobile)

---

## Version Information

- **Implementation Date**: 2024
- **Last Updated**: 2024
- **Compatible with**: React 18+, Node 18+, MongoDB 4.4+

---

## Summary of Components

### Frontend Components Modified/Created
1. **OrderDetails.tsx** - Added workflow action handlers and modal integration
2. **WorkflowCard.tsx** - Enhanced with loading states and action handlers
3. **WorkflowExecutionModal.tsx** - New component for step-by-step workflow guidance

### Backend Endpoints Used
1. `POST /api/admin/orders/:id/workflows/:workflowId/start` - Start workflow
2. `PUT /api/admin/orders/:id/workflows/:workflowId/status` - Pause/Resume workflow
3. `GET /api/admin/orders/:id/workflows` - Get order workflows

### API Functions
1. `startWorkflow(orderId, workflowId)` - Start a workflow
2. `updateWorkflowStatus(orderId, workflowId, status)` - Update workflow status (pause/resume)

---

## Next Steps

After completing all tests, consider implementing:
- [ ] Step execution modal for workflow step completion
- [ ] Form data collection for workflow steps
- [ ] Photo/attachment upload for workflow steps
- [ ] Workflow performance analytics
- [ ] Workflow history and audit trail
- [ ] Workflow automation rules
- [ ] Batch workflow operations
