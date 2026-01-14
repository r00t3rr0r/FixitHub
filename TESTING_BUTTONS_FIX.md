# Testing Guide: Communication Panel Buttons Fix

## Quick Summary

The "📤 Feedback" and "➕ Action" buttons in the Communication Panel header are now fixed and should be visible to staff and admin users on the Device Inspection page.

## Prerequisites

✅ Application is running (`npm start`)
✅ Frontend: http://localhost:5173
✅ Backend: http://localhost:3000
✅ MongoDB is running

## Step-by-Step Testing

### Step 1: Login as Admin

1. Navigate to http://localhost:5173
2. Enter credentials:
   - Email: `admin@example.com`
   - Password: `password123` (or your admin password)
3. Click "Login"
4. **Expected**: You should see the dashboard
5. **Verify**: Check browser console:
   ```
   User profile loaded: {..., role: "admin", ...}
   ```

### Step 2: Navigate to an Order

1. Go to Orders page or Admin panel
2. Select any existing order
3. Click to view Order Details
4. **Expected**: Order details page loads with inspection option

### Step 3: Start Device Inspection

1. On the Order Details page, click "Inspect Device" or similar button
2. This navigates to the Device Inspection page (InspectionWorkflow)
3. **Expected**: You should see a two-column layout:
   - Left: Inspection Form
   - Right: Communication & Feedback Panel

### Step 4: Verify Buttons Appear

1. Look at the right panel header labeled "Communication & Feedback"
2. You should see **two buttons** on the right side of the header:
   - **📤 Feedback** button (with Send icon)
   - **➕ Action** button (with Plus icon)
3. **Expected**: Both buttons should be visible and clickable
4. **If Not Visible**:
   - Check browser console for errors
   - Try hard refresh (Ctrl+Shift+R)
   - Verify user role is "admin" in console logs

### Step 5: Test Feedback Button

1. Click the **📤 Feedback** button
2. **Expected**: A dialog opens with title "Send Feedback Request to Customer"
3. Dialog should have three fields:
   - **Question** (textarea)
   - **First Option** (input)
   - **Second Option** (input)
4. Fill in example values:
   ```
   Question: "Do you approve the $45 battery replacement?"
   First Option: "Yes, proceed with repair"
   Second Option: "No, don't proceed"
   ```
5. Click "Send Feedback Request"
6. **Expected**:
   - Success toast notification appears
   - Dialog closes
   - Feedback request appears in the Communication Panel below

### Step 6: Test Action Button

1. Click the **➕ Action** button
2. **Expected**: A dialog opens with title "Send Quick Action to Customer"
3. Dialog should have two fields:
   - **Action Type** (dropdown with options)
   - **Description** (textarea)
4. Fill in example values:
   ```
   Action Type: "Part Replacement Required"
   Description: "We need to replace the charging port. Estimated cost: $45"
   ```
5. Click "Send Action"
6. **Expected**:
   - Success toast notification appears
   - Dialog closes
   - Quick action appears in the Communication Panel below

### Step 7: Test as Different User Roles

#### Test as Staff User
1. Logout (click profile > Logout)
2. Login as staff user (if available)
3. Navigate to an order and inspection page
4. **Expected**: Buttons should appear (role === 'staff')

#### Test as Customer User
1. Logout
2. Login as customer user
3. Navigate to your own order
4. View inspection page
5. **Expected**:
   - Panel should be visible (or hidden if no messages)
   - Buttons should NOT appear (role !== 'staff' and role !== 'admin')

### Step 8: Verify in Browser Console

Watch the browser console (F12) for these logs:

**On initial load:**
```
User profile loaded: {
  _id: "...",
  email: "admin@example.com",
  role: "admin",
  ...
}

Communication thread loaded: {
  _id: "...",
  messages: [],
  ...
}
```

**After sending feedback:**
```
POST /api/inspection-communication/[orderId]/feedback-request 201
```

**After sending action:**
```
POST /api/inspection-communication/[orderId]/quick-action 201
```

## Expected UI Elements

### When Logged In as Admin/Staff:

```
┌─────────────────────────────────────────┐
│ Communication & Feedback      [📤 Feedback] [➕ Action]
├─────────────────────────────────────────┤
│                                          │
│  No communication messages yet.          │
│  Use the buttons above to send           │
│  feedback or actions to the customer.    │
│                                          │
└─────────────────────────────────────────┘
```

### After Sending Feedback:

```
┌─────────────────────────────────────────┐
│ Communication & Feedback      [📤 Feedback] [➕ Action]
├─────────────────────────────────────────┤
│                                          │
│ ┌─────────────────────────────────────┐ │
│ │ Do you approve the $45 battery      │ │
│ │ replacement?                        │ │
│ │                                     │ │
│ │ [Yes, proceed with repair]          │ │
│ │ [No, don't proceed]                 │ │
│ └─────────────────────────────────────┘ │
│                                          │
└─────────────────────────────────────────┘
```

## Troubleshooting

### Problem: Buttons Don't Appear

**Check 1: User Authentication**
- Open browser console (F12)
- Check for "User profile loaded" log
- Verify `role` field is "admin" or "staff"

**Check 2: Component Rendering**
- Check if panel is visible at all
- Look for any console errors
- Try hard refresh (Ctrl+Shift+R)

**Check 3: JWT Token**
- Check localStorage:
  - F12 → Application → Local Storage
  - Look for `accessToken`
  - If missing, user needs to re-login

**Check 4: API Endpoint**
- Verify `/api/users/me` is working:
  ```bash
  curl http://localhost:3000/api/users/me \
    -H "Authorization: Bearer YOUR_TOKEN"
  ```

### Problem: Dialog Doesn't Open

- Check browser console for errors
- Verify buttons are clickable (cursor changes to pointer)
- Try different action (refresh and try again)

### Problem: Can't Send Feedback/Action

- Verify all required fields are filled
- Check network tab for API errors
- Look for validation error messages
- Check server logs for errors

### Problem: Changes Not Reflecting After Code Update

- Hard refresh browser: `Ctrl+Shift+R`
- Clear browser cache: `Ctrl+Shift+Delete`
- Restart dev server: `npm start`

## Browser Compatibility

✅ Chrome 90+ (tested)
✅ Firefox 88+ (should work)
✅ Safari 14+ (should work)
✅ Edge 90+ (should work)
✅ Mobile browsers (responsive)

## Performance Expectations

- Panel loads: < 500ms
- Buttons render: Instant
- Dialog opens: < 100ms
- Feedback/Action sends: 1-2 seconds
- No page lag or slowdown

## Success Criteria

✅ Buttons visible for admin/staff users
✅ Buttons NOT visible for customer users
✅ Dialogs open correctly when clicked
✅ Feedback requests send successfully
✅ Quick actions send successfully
✅ Notifications appear in Communication Panel
✅ No console errors or warnings
✅ No performance degradation

## Regression Testing

Make sure these still work:
- [ ] Inspection workflow still functions
- [ ] Can complete device inspection
- [ ] Communication messages display correctly
- [ ] Customer can respond to feedback
- [ ] Mobile responsive layout works
- [ ] Sticky panel behavior works on desktop
- [ ] No impact on other pages

---

**Status**: ✅ READY FOR TESTING

**Test Environment**: http://localhost:5173 (with npm start running)

**Expected Result**: Both buttons visible and fully functional for admin/staff users! 🎉
