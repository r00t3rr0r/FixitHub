# Testing Instructions - Communication Panel on Inspection Page

Follow these steps to verify the implementation is working correctly. The application should already be running.

---

## Test 1: Verify Panel Appears on Inspection Page

**Objective:** Confirm the Communication Panel appears on the right side of the inspection workflow page.

**Steps:**

1. **Open Orders Page**
   - Navigate to `http://localhost:5173/orders`
   - You should see a list of orders

2. **Start or Open an Inspection**
   - Click on any order to view details
   - Scroll to find the "Device Inspection Report" section
   - If inspection is not started, click "Start Device Inspection" button
   - If inspection is in progress, click "Continue Inspection" button
   - This will take you to the Device Inspection page at `http://localhost:5173/inspection/{orderId}`

3. **Verify Layout**
   - You should see a two-column layout:
     - **LEFT SIDE (2/3 width):** Inspection form with steps like "Model Verification", "Device Identification", etc.
     - **RIGHT SIDE (1/3 width):** A white card with title "Customer Communication" and subtitle "Feedback & Updates"

4. **Expected Result:**
   - ✅ The Communication Panel appears as a sticky card on the right side
   - ✅ The panel stays visible while scrolling through inspection steps
   - ✅ On mobile devices, the panel appears below the inspection form

---

## Test 2: Verify Panel Shows No Content Initially

**Objective:** Confirm the Communication Panel shows nothing when there are no feedback requests or quick actions.

**Steps:**

1. **Continue from Test 1**
   - You should still be on the Inspection page with the Communication Panel visible

2. **Check Panel Content**
   - Look at the right side Communication Panel
   - You should see "Customer Communication" header and "Feedback & Updates" subtitle
   - The panel content area should be empty OR show "No communication messages" message

3. **Expected Result:**
   - ✅ Panel displays headers but no feedback requests or quick actions
   - ✅ No buttons or content visible in the communication area

---

## Test 3: Simulate Staff Sending a Feedback Request

**Objective:** Verify that when staff sends a feedback request, it appears in the Communication Panel.

**Steps:**

1. **Using Backend Test Script (Optional)**
   - Open a terminal in the server directory
   - Run: `node scripts/test-inspection-communication.js`
   - This will authenticate as admin/staff and create a feedback request
   - Note: You may need to modify the test script with an actual orderId from the database

   **OR** Use curl to create a feedback request:
   ```bash
   # First get a token
   TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"admin@example.com","password":"password123"}' | jq -r '.token')

   # Then send feedback request
   curl -X POST http://localhost:3000/api/inspection-communication/{orderId}/feedback-request \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "inspectionId": null,
       "question": "Do you approve the $45 battery replacement?",
       "options": [
         {"label": "Yes, proceed with the repair", "value": "approve"},
         {"label": "No, I need to think about it", "value": "decline"}
       ]
     }'
   ```

2. **Refresh Inspection Page**
   - Go back to the inspection page if you left it
   - Or reload the page with F5
   - The Communication Panel should now show the feedback question

3. **Expected Result:**
   - ✅ Communication Panel now displays content
   - ✅ Shows amber-colored card with left border
   - ✅ Displays the feedback question: "Do you approve the $45 battery replacement?"
   - ✅ Shows two buttons: "Yes, proceed with the repair" and "No, I need to think about it"

---

## Test 4: Customer Responds to Feedback

**Objective:** Verify that customers can click buttons to respond to feedback requests.

**Steps:**

1. **Continue from Test 3**
   - You should see the feedback request in the Communication Panel with buttons

2. **Click Accept Button**
   - Click on the "Yes, proceed with the repair" button
   - The button should become disabled briefly (showing loading state)
   - Wait 1-2 seconds for the response to be recorded

3. **Verify Response Confirmation**
   - The buttons should disappear
   - You should see a green checkmark icon (✓)
   - Text should show: "You responded: Yes, proceed with the repair"
   - Confirmation message should appear at the bottom: "Your response has been recorded"

4. **Expected Result:**
   - ✅ Clicking button shows loading state
   - ✅ Response is recorded successfully
   - ✅ UI updates to show green checkmark and "You responded" message
   - ✅ Buttons are replaced with confirmation
   - ✅ Toast notification shows success message

---

## Test 5: Test Decline Response

**Objective:** Verify that customers can also decline/choose other options.

**Steps:**

1. **Create Another Feedback Request**
   - Using the backend test or curl command from Test 3
   - Create another feedback request with a different question
   - Example: "Do you want to add AppleCare protection for $29?"

2. **Refresh Page**
   - Reload the inspection page

3. **Click Decline Button**
   - Click on the "No" or decline option
   - Wait for response to be recorded

4. **Verify Different Response**
   - Should show "You responded: No, I don't want the protection"
   - Similar green checkmark confirmation should appear

5. **Expected Result:**
   - ✅ Multiple feedback requests can be displayed
   - ✅ Different response options work correctly
   - ✅ Each response is recorded and confirmed

---

## Test 6: Verify Quick Action Alerts

**Objective:** Confirm that quick action messages appear and display correctly.

**Steps:**

1. **Create a Quick Action**
   - Use backend test script or curl command:
   ```bash
   TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"admin@example.com","password":"password123"}' | jq -r '.token')

   curl -X POST http://localhost:3000/api/inspection-communication/{orderId}/quick-action \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "inspectionId": null,
       "actionType": "part_replacement",
       "description": "Your device requires a battery replacement. This will add $45 to the repair cost."
     }'
   ```

2. **Refresh Inspection Page**
   - Reload the page

3. **Verify Quick Action Display**
   - Communication Panel should now show both:
     - Feedback requests (amber cards with buttons)
     - Quick actions (blue cards with status badges)
   - Quick action should show:
     - Label: "Part Replacement Required" (or the action label)
     - Description: "Your device requires a battery replacement..."
     - Status badge: "pending"

4. **Expected Result:**
   - ✅ Quick action appears in blue card
   - ✅ Action label and description display correctly
   - ✅ Status badge shows "pending"
   - ✅ Multiple message types can appear together

---

## Test 7: Verify Customer Receives Notification

**Objective:** Confirm that customers see notifications on the Messages page when feedback/quick actions are sent.

**Steps:**

1. **Log in as Customer**
   - Open browser and log in with customer credentials (from Login page)
   - Example: email: `customer@example.com`, password: `password123`

2. **Navigate to Messages Page**
   - Click on the Messages link in the sidebar
   - Or navigate to `http://localhost:5173/messages`

3. **Look for Notifications**
   - Check if you see any notifications about inspection feedback or quick actions
   - They should appear with:
     - Icon: 📋 or 🔔
     - Title: "Feedback Required on Your Repair Inspection" or "[Action Type]"
     - Description: The feedback question or action description
     - Timestamp: "a few seconds ago"

4. **Check Notification Bell**
   - Look at the notification bell icon in the header
   - Should show a badge with a count of unread notifications

5. **Expected Result:**
   - ✅ Notification appears on Messages page
   - ✅ Notification contains feedback question or action details
   - ✅ Notification bell shows unread count
   - ✅ Notification is marked as unread initially

---

## Test 8: Responsive Design on Mobile

**Objective:** Verify the Communication Panel works on mobile devices.

**Steps:**

1. **Open Browser Developer Tools**
   - Press F12 to open developer tools
   - Click the mobile device icon (or press Ctrl+Shift+M)
   - Select a mobile device like "iPhone 12"

2. **Navigate to Inspection Page**
   - Go to inspection page in mobile view
   - Panel should now stack vertically below the form

3. **Verify Layout**
   - On mobile, you should see:
     - Inspection form taking full width at top
     - Communication panel below it, taking full width
     - Panel is NOT sticky on mobile (scrolls normally)

4. **Test Feedback Response on Mobile**
   - Scroll down to Communication Panel
   - Tap the feedback button
   - Verify response works the same way

5. **Expected Result:**
   - ✅ Layout stacks vertically on mobile (not side-by-side)
   - ✅ Communication panel is full width on mobile
   - ✅ All buttons and interactions work on mobile
   - ✅ No horizontal scrolling required

---

## Test 9: Sticky Panel Behavior on Desktop

**Objective:** Verify the Communication Panel remains visible while scrolling through inspection steps.

**Steps:**

1. **Switch to Desktop View**
   - Close or exit mobile view
   - Inspection page should show two-column layout

2. **Scroll Down Through Inspection Steps**
   - Scroll down through the inspection form
   - Watch the Communication Panel on the right side

3. **Verify Sticky Behavior**
   - The Communication Panel should stay visible
   - As you scroll, the panel moves with you (stays in viewport)
   - The inspection form scrolls but panel remains at same position

4. **Continue Scrolling**
   - Keep scrolling until you reach the Important Notes section
   - Panel should stick around until it passes the bottom

5. **Expected Result:**
   - ✅ Communication Panel is sticky (doesn't scroll out of view)
   - ✅ Panel position is fixed while form scrolls
   - ✅ "Important Notes" section appears below both columns
   - ✅ Panel eventually scrolls off at the very bottom

---

## Test 10: Verify Panel Removed from OrderDetails

**Objective:** Confirm Communication Panel no longer appears on the Order Details page.

**Steps:**

1. **Open Order Details Page**
   - Go to an order by clicking on one from the orders list
   - Navigate to the OrderDetails page
   - Or go directly to `http://localhost:5173/orders/{orderId}`

2. **Find Device Inspection Section**
   - Scroll to find the "Device Inspection Report" section

3. **Check for Communication Panel**
   - Look at the Device Inspection Report card
   - Inspect the content

4. **Expected Result:**
   - ✅ NO separate "Customer Communication" card appears
   - ✅ Communication Panel is NOT visible on OrderDetails
   - ✅ Only the inspection results are shown (model, tests, accessories, etc.)
   - ✅ This confirms panel is only on the inspection workflow page

---

## Test 11: Error Handling

**Objective:** Verify the system handles errors gracefully.

**Steps:**

1. **Test With Invalid Order**
   - Manually navigate to: `http://localhost:5173/inspection/invalid-id`
   - Should show "Order not found" error message
   - No crashes or JavaScript errors in console

2. **Test Network Error Simulation**
   - Open browser Developer Tools (F12)
   - Go to Network tab
   - Check "Offline" to simulate network disconnection
   - Navigate to inspection page
   - Should handle gracefully without page crashes

3. **Expected Result:**
   - ✅ Invalid order shows error message
   - ✅ No JavaScript console errors
   - ✅ Application remains stable
   - ✅ Communication Panel fails gracefully if thread doesn't exist

---

## Test 12: Multiple Feedback Requests

**Objective:** Verify the system can handle and display multiple feedback requests.

**Steps:**

1. **Create Multiple Feedback Requests**
   - Create 3-4 different feedback requests using the test script or curl
   - Each with different questions:
     - "Do you approve the battery replacement?"
     - "Should we also fix the cracked screen?"
     - "Do you want Express Shipping?"

2. **Refresh Inspection Page**
   - Reload the page

3. **Verify All Questions Display**
   - Communication Panel should show all feedback requests
   - Each in its own amber card
   - Each with its own set of buttons

4. **Respond to Some**
   - Answer the first feedback request
   - Don't answer the others yet

5. **Verify State**
   - First one shows "You responded: [answer]"
   - Other ones still show buttons

6. **Expected Result:**
   - ✅ Multiple feedback requests can exist simultaneously
   - ✅ Each displays independently
   - ✅ Can respond to them individually
   - ✅ Responses are tracked separately

---

## Quick Troubleshooting

### Issue: Communication Panel Shows Empty
- **Cause:** No feedback requests or quick actions created yet
- **Solution:** Create one using test script or curl command

### Issue: Panel Not Sticky on Desktop
- **Cause:** Browser zoom level might be affecting the layout
- **Solution:** Reset zoom to 100% (Ctrl+0) and try again

### Issue: Buttons Not Responding
- **Cause:** API endpoint not working or authentication token expired
- **Solution:** Check server logs for errors, re-login if needed

### Issue: Notification Not Appearing
- **Cause:** Notification service might not be creating notifications
- **Solution:** Check server logs for errors in notificationService

### Issue: Mobile Layout Broken
- **Cause:** Browser viewport not actually mobile size
- **Solution:** Use F12 developer tools to enable mobile view properly

---

## Success Criteria ✅

After completing all tests, you should be able to confirm:

- ✅ Communication Panel appears on the right side of the inspection page
- ✅ Panel shows feedback requests in amber cards
- ✅ Panel shows quick actions in blue cards
- ✅ Customers can respond with Accept/Decline buttons
- ✅ Responses update UI with confirmation
- ✅ Notifications are created and appear on Messages page
- ✅ Layout is responsive on mobile
- ✅ Panel is sticky on desktop
- ✅ Panel no longer appears on OrderDetails page
- ✅ Multiple messages can be displayed
- ✅ All error cases handled gracefully

---

## Additional Notes

- **Time Estimate:** 15-20 minutes to complete all tests
- **Prerequisites:** Application must be running on localhost:5173
- **Test Data:** Use the test script to generate feedback requests and quick actions
- **Browser:** Works on Chrome, Firefox, Safari, and Edge
- **No Setup Required:** No additional configuration or database changes needed

---

**Implementation Complete!** 🎉

The Communication Panel is now successfully integrated into the Device Inspection page, positioned to the right of the inspection steps. Customers can easily respond to feedback questions, and all updates are automatically notified via the Messages page.
