# Testing Multiple Workflow Assignment & Deletion

## Prerequisites
- Application is running (client on port 5173, server on port 3000)
- You can access the web interface at https://preview-0iwg067v.ui.pythagora.ai
- Admin user has been seeded

## Manual UI Testing Steps

### Test 1: Admin Login and Navigation to Order Details

**Steps:**
1. Open https://preview-0iwg067v.ui.pythagora.ai in your browser
2. Click on "Login" button
3. Use credentials:
   - Email: `admin@example.com`
   - Password: `admin123`
4. After successful login, you should be redirected to the dashboard
5. Look for "Orders" in the admin menu (left sidebar)
6. Click on Orders to view the list
7. Click on any order to open the Order Details page

**Expected Result:**
- ✓ Login successful
- ✓ Dashboard loads
- ✓ Order Details page displays
- ✓ Workflows section visible (only for admin/staff users)

---

### Test 2: Assign Multiple Workflows to an Order

**Steps:**
1. Navigate to Order Details page (see Test 1)
2. Scroll down to the "Workflows" section
3. If no workflows are assigned, you'll see an empty state with "Assign Workflow" button
4. Click the "+ Assign Workflow" button
5. A dialog will appear showing suggested workflows
6. Click "Assign" button next to the first workflow
7. The dialog closes and the workflow appears as a card
8. Click "+ Assign Workflow" again
9. Click "Assign" button next to a different workflow
10. Verify both workflows now appear as cards in a grid

**Expected Result:**
- ✓ "Assign Workflow" button is visible
- ✓ Dialog opens with suggested workflows
- ✓ First workflow is assigned and displayed as a card
- ✓ Multiple workflows can be assigned to the same order
- ✓ Workflows appear in a grid layout (2 columns on larger screens)
- ✓ Green toast notification shows "Workflow assigned to order successfully"

---

### Test 3: View Workflow Card Details

**Steps:**
1. From Test 2, look at one of the workflow cards displayed
2. Verify the card shows:
   - Workflow name at the top
   - Status badge (e.g., "Not Started", "In Progress")
   - Progress bar showing step completion
   - Count of completed/total steps
   - Estimated time
   - List of workflow steps with status indicators

**Expected Result:**
- ✓ Workflow card displays all information
- ✓ Progress bar fills proportionally to completion
- ✓ Step status indicators show:
  - ✓ = completed steps
  - ⟳ = in-progress steps
  - ⊘ = skipped steps
- ✓ Status badge color changes based on status:
  - Gray for "Not Started"
  - Blue for "In Progress"
  - Yellow for "On Hold"
  - Green for "Completed"

---

### Test 4: Delete a Workflow

**Steps:**
1. From Test 3, look at one of the workflow cards
2. Locate the "Delete" button at the bottom of the card (red text with trash icon)
3. Click the "Delete" button
4. A confirmation dialog appears asking "Are you sure you want to remove the workflow?"
5. Click "Delete" button in the confirmation dialog
6. Wait for the action to complete
7. The workflow card should disappear from the display
8. The remaining workflows should be displayed

**Expected Result:**
- ✓ Delete button is visible on each workflow card
- ✓ Confirmation dialog appears before deletion
- ✓ Clicking "Delete" in confirmation removes the workflow
- ✓ Green toast notification shows "Workflow removed from order successfully"
- ✓ Deleted workflow disappears from the grid
- ✓ Other workflows remain unaffected
- ✓ Workflow count in header updates (e.g., "2 workflows" → "1 workflow")

---

### Test 5: Delete Confirmation Cancel

**Steps:**
1. Assign at least one workflow to an order
2. Click the "Delete" button on a workflow card
3. Confirmation dialog appears
4. Click "Cancel" button in the confirmation dialog
5. The dialog closes
6. The workflow card should still be visible

**Expected Result:**
- ✓ Confirmation dialog closes without action
- ✓ Workflow remains assigned to the order
- ✓ No toast notification appears
- ✓ Grid layout remains unchanged

---

### Test 6: Empty State Display

**Steps:**
1. Navigate to an order with no workflows assigned
2. Look at the Workflows section
3. Verify empty state message and button

**Expected Result:**
- ✓ Empty state displays message: "No workflows assigned"
- ✓ Subtitle message: "Click 'Assign Workflow' to add workflows"
- ✓ "Assign Workflow" button is prominent and clickable
- ✓ No workflow cards are displayed

---

### Test 7: Responsive Design - Desktop

**Steps:**
1. View the Order Details page on a desktop (1920x1080 or similar)
2. Look at the Workflows section with multiple workflows
3. Verify layout

**Expected Result:**
- ✓ Workflows display in a 2-column grid on large screens
- ✓ Cards have adequate spacing
- ✓ All content is readable
- ✓ Action buttons are easily clickable

---

### Test 8: Responsive Design - Tablet

**Steps:**
1. View the Order Details page on a tablet (768px width)
2. Look at the Workflows section
3. Verify layout

**Expected Result:**
- ✓ Workflows display in a 1-column layout on medium screens
- ✓ Cards fill the available width
- ✓ All content is readable
- ✓ Touch targets are large enough (min 44x44px)

---

### Test 9: Responsive Design - Mobile

**Steps:**
1. View the Order Details page on a mobile device (375px width)
2. Look at the Workflows section
3. Verify layout and scrolling

**Expected Result:**
- ✓ Workflows display in a 1-column layout
- ✓ Cards are full width with appropriate margins
- ✓ Scrollable within the section if multiple workflows
- ✓ Text is legible without zooming
- ✓ Buttons are easily tappable

---

### Test 10: Error Handling - Delete Non-existent Workflow

**Steps:**
1. Open browser developer console (F12)
2. In the Network tab, watch the API calls
3. Delete a workflow
4. Watch the DELETE request in the Network tab

**Expected Result:**
- ✓ DELETE request returns 200 success
- ✓ Response shows "success": true
- ✓ Toast notification shows success
- ✓ UI updates correctly

---

### Test 11: Error Handling - Authentication

**Steps:**
1. Log out from the application
2. Try to access an order details page directly (browser history/bookmarks)
3. Verify protection

**Expected Result:**
- ✓ Redirected to login page
- ✓ Cannot access Order Details without authentication
- ✓ Cannot delete workflows without authentication

---

### Test 12: Role-Based Access - Customer User

**Steps:**
1. Log out from admin account
2. Log in as a customer (email: customer@example.com, password: test123)
3. Navigate to your order details
4. Look for Workflows section

**Expected Result:**
- ✓ Workflows section is NOT visible to customers
- ✓ Only admin and staff users see the Workflows section
- ✓ Customer sees other order information but not workflows

---

### Test 13: Toast Notifications

**Steps:**
1. Perform various actions:
   - Assign a workflow
   - Delete a workflow
   - Try to delete then cancel
2. Watch for toast notifications in bottom-right corner

**Expected Result:**
- ✓ Successful assignment: Green toast "Workflow assigned to order successfully"
- ✓ Successful deletion: Green toast "Workflow removed from order successfully"
- ✓ Failed action: Red toast with error message
- ✓ Toasts auto-dismiss after 4 seconds
- ✓ Close button (X) available to dismiss manually

---

### Test 14: Multiple Workflows at Different States

**Steps:**
1. Assign 3 or more workflows to an order
2. Start one workflow (click Start button if available)
3. Pause it (if available)
4. Leave others as "Not Started"
5. Verify display

**Expected Result:**
- ✓ All workflows display simultaneously
- ✓ Different status badges show different colors
- ✓ Progress bars reflect actual progress
- ✓ Action buttons change based on status

---

### Test 15: Integration with Order Timeline

**Steps:**
1. Assign a workflow to an order
2. Delete the workflow
3. Scroll to the Progress Timeline section
4. Look for workflow assignment/deletion entries

**Expected Result:**
- ✓ Timeline shows "Workflow Assigned" entry
- ✓ Timeline shows "Workflow Removed" entry
- ✓ Entries include timestamp
- ✓ Staff member name is recorded

---

## API Testing (Optional - For Developers)

### Test Delete Workflow Endpoint

```bash
# 1. Get auth token
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"admin123"}' | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)

# 2. Get an order ID
ORDERS=$(curl -s -X GET http://localhost:3000/api/admin/orders \
  -H "Authorization: Bearer $TOKEN")
ORDER_ID=$(echo $ORDERS | grep -o '"_id":"[^"]*' | head -1 | cut -d'"' -f4)

# 3. Get order with workflows
FULL_ORDER=$(curl -s -X GET http://localhost:3000/api/admin/orders/$ORDER_ID \
  -H "Authorization: Bearer $TOKEN")

# 4. Extract workflow ID and delete
WORKFLOW_ID=$(echo $FULL_ORDER | python3 -c "import json, sys; data = json.load(sys.stdin); print(data['order']['workflows'][0]['_id'])" 2>/dev/null)

curl -X DELETE http://localhost:3000/api/admin/orders/$ORDER_ID/workflows/$WORKFLOW_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Workflow removed from order successfully",
  "order": { /* updated order object */ }
}
```

---

## Testing Checklist

- [ ] Admin can login successfully
- [ ] Multiple workflows can be assigned to one order
- [ ] Workflows display in a grid
- [ ] Workflow cards show complete information
- [ ] Delete button removes workflow
- [ ] Confirmation dialog prevents accidental deletion
- [ ] Toast notifications appear for all actions
- [ ] Empty state displays when no workflows
- [ ] Responsive design works on desktop/tablet/mobile
- [ ] Only admin/staff users see workflows section
- [ ] Timeline records workflow actions
- [ ] Error messages display appropriately
- [ ] No console errors or warnings
- [ ] Page performance is acceptable

---

## Troubleshooting

### Workflows Not Appearing
- **Solution**: Ensure workflows are configured in admin panel and match order's device type

### Delete Button Not Working
- **Solution**: Check browser console for errors, verify authentication token is valid

### Toast Notifications Not Showing
- **Solution**: Verify toast provider is initialized in App.tsx

### Workflow Count Shows Wrong Number
- **Solution**: Refresh the page to get latest data from server

### Responsive Layout Issues
- **Solution**: Clear browser cache and rebuild frontend
