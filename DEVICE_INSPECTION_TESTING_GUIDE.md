# Device Inspection Workflow - Testing Guide

## Quick Start

The Device Inspection Workflow is now fully integrated into your FixitHub application. Follow these steps to test and verify the implementation.

---

## Testing Instructions

### 1. **Login to Dashboard**
**Action:**
- Open your web browser and visit `http://localhost:5173/`
- Use the following credentials:
  - Email: `admin@example.com`
  - Password: `admin123`

**Expected Result:**
- You are logged in as an Admin user
- You should see the admin dashboard with various management options
- The left sidebar shows admin navigation menu

---

### 2. **Access Orders Management**
**Action:**
- From the admin dashboard, click on "Admin" in the left sidebar (if not already on admin section)
- Click on "Orders" or navigate to the Orders section
- You should see a list of existing device repair orders

**Expected Result:**
- Orders list is displayed with columns: Order Number, Device, Customer, Status, etc.
- Each order shows device brand and model
- Orders have status indicators (pending, in-progress, etc.)

---

### 3. **Open an Order for Inspection**
**Action:**
- Click on any order from the list to open its details page
- For example, click on "ORD-2025-001" or the first order in the list

**Expected Result:**
- The Order Details page opens
- Shows order information: order number, device brand/model, customer name, total cost
- Shows status badges and payment information
- Multiple tabs or sections are visible

---

### 4. **Start Device Inspection**
**Action:**
- On the Order Details page, look for an "Inspection" section or button
- If you don't see a direct inspection button, navigate to: `http://localhost:5173/inspection/[ORDER_ID]`
- Replace `[ORDER_ID]` with the actual order ID (copy from the URL or use the first part of order number)
- For example: `http://localhost:5173/inspection/68acb7f9c405dad4de3a6c84`

**Expected Result:**
- The Device Inspection Workflow page loads
- Shows the order summary with device brand, model, and type
- A "Generate Report" button is visible in the top right
- The inspection form appears below with 6 expandable step sections

---

### 5. **Step 1 - Model Verification**
**Action:**
- Expand "Step 1: Model Verification" by clicking on it
- Enter the following information:
  - Reported Model: `iPhone 12`
  - Actual Model: `iPhone 12`
  - Verification Status: Select `Correct - Model matches`
  - Notes: `Model verified as correct` (optional)
- Click "Save & Continue"

**Expected Result:**
- Success toast notification appears with message "Model verification saved"
- Step 1 is marked as completed
- The form automatically moves focus to Step 2
- Step 1 badge changes to show "completed" status

---

### 6. **Step 2 - Device Identification**
**Action:**
- Step 2 should now be expanded (or click to expand)
- For Smartphone device type:
  - Enter IMEI Number: `351234567890123`
- Click "Save & Continue"

**Expected Result:**
- Success toast notification: "Identification saved"
- IMEI number is recorded
- Step 2 is marked as completed
- Step 3 automatically opens

---

### 7. **Step 3 - Accessories & Packaging**
**Action:**
- Step 3 expands automatically
- Check the following items:
  - ✓ Original Packaging Present
  - ✓ Case/Cover Present
  - ✓ Power Adapter Present (if applicable)
- Add notes: `All original accessories included in excellent condition`
- Click "Save & Continue"

**Expected Result:**
- Toast: "Accessories saved"
- Accessories checklist items are recorded
- Step 3 completed
- Step 4 opens

---

### 8. **Step 4 - External Inspection**
**Action:**
- Step 4 expands automatically
- For each component, select the condition:
  - Display: `OK`
  - Frame: `OK`
  - Back Cover: `OK`
  - Buttons: `OK`
- Check if visible damage exists:
  - Visible Damage Detected: Leave **unchecked** (no damage)
- Add unique notes: `Device in excellent physical condition, no visible damage`
- Click "Save & Continue"

**Expected Result:**
- Toast: "External inspection saved"
- All component statuses recorded
- Step 4 completed
- Step 5 opens

---

### 9. **Step 5 - Device Testing**
**Action:**
- Step 5 expands automatically
- Select test results for each component:
  - Charging: `OK`
  - Power: `OK`
  - Wi-Fi: `OK`
  - Front Camera: `OK`
  - Main Camera: `OK`
- Click "Save & Continue"

**Expected Result:**
- Toast: "Device tests saved"
- All test results recorded with OK status
- Since all tests passed, no failed test notification should be created
- Step 5 completed
- Step 6 opens

---

### 10. **Step 6 - Apple-Specific Checks**
**Action:**
- Step 6 (Apple-Specific Checks) expands automatically
- Check the following:
  - ✓ Modem Firmware Present
  - ✓ Touch ID / Face ID Applicable
  - ✓ Touch ID / Face ID Working (appears after checking applicable)
- Click "Save & Continue"

**Expected Result:**
- Toast: "Apple-specific checks saved"
- All Apple checks recorded
- Step 6 completed
- Summary/Final step opens

---

### 11. **Step 7 - Inspection Summary & Completion**
**Action:**
- The Summary section expands showing:
  - "Is Device Repairable?" buttons
- Click the **"Yes"** button to mark as repairable
- This reveals additional fields:
  - Estimated Repair Cost: `299`
  - Repair Timeframe: `3-5 days`
  - Repair Description: `Screen replacement and battery service`
- Click "Complete Inspection"

**Expected Result:**
- Toast: "Inspection completed successfully!"
- You're redirected back to the order details page
- A success message confirms all inspection steps are complete

---

### 12. **Verify Inspection Data**
**Action:**
- Return to the inspection page or check in browser developer tools Network tab
- Open browser console (F12) and check for successful API calls
- You should see logs like:
  - `[DeviceInspection] Initializing inspection for order`
  - `[DeviceInspection] Model verification updated`
  - `[DeviceInspection] Device test updated`
  - etc.

**Expected Result:**
- All API calls return 200 status codes
- No error messages in console
- Inspection data is persisted in database

---

### 13. **Generate Inspection Report**
**Action:**
- Navigate back to the inspection workflow page for the same order
- Click the "Generate Report" button in the top right corner

**Expected Result:**
- A loading state appears briefly
- Success toast: "Report generated and downloaded"
- A PDF file is downloaded to your Downloads folder
- The PDF contains:
  - Order information
  - Customer details
  - Technician information
  - Inspection results (model, ID numbers, test results)
  - Repair assessment
  - Timestamp of report generation

---

### 14. **Test Failed Tests Scenario** (Optional)
**Action:**
- Start a new inspection on a different order
- Complete all steps 1-4 normally
- In Step 5 (Device Testing), select:
  - Charging: `Not OK`
  - Wi-Fi: `Not OK`
  - Main Camera: `Not OK`
- Leave other tests as `OK`
- Click "Save & Continue"

**Expected Result:**
- Toast: "Device tests saved"
- System detects failed tests
- A customer notification should be automatically created in the notifications system
- Response indicates: `hasFailedTests: true` with list of failed tests
- Step 6 opens normally to continue inspection

---

### 15. **View Technician Inspections List** (Optional)
**Action:**
- Open browser console and make API call:
```javascript
fetch('http://localhost:3000/api/device-inspections', {
  headers: { 'Authorization': 'Bearer YOUR_TOKEN_HERE' }
})
.then(r => r.json())
.then(d => console.log(d))
```
- Or navigate to inspection list page if implemented

**Expected Result:**
- List of all inspections created by the logged-in technician
- Shows order numbers, device info, inspection status
- Can filter by status or failed tests

---

## Testing Failed Tests Notification Workflow

### Test Scenario: Failed Tests Create Notification
**Setup:**
1. Start a new inspection
2. Complete all steps through Device Testing
3. In Device Testing step, select one or more "Not OK" tests

**Expected Behavior:**
- Toast confirms tests saved
- Inspection record shows `hasFailedTests: true`
- Response includes `failedTestDetails` array with test names and reasons
- A customer notification should be created automatically
- Order status may change to indicate attention needed

---

## Automated Testing via CLI

You can also run an automated test script to verify all endpoints:

```bash
# From project root, run the automated test script
node server/scripts/test-inspection.js
```

This script will:
1. Authenticate as admin
2. Fetch a test order
3. Initialize an inspection
4. Complete all 6 inspection steps
5. Finalize the inspection
6. Generate a PDF report
7. Verify all operations succeeded

**Expected Output:**
```
=== All Tests Passed! ===

Summary:
✓ Inspection initialized
✓ Model verified
✓ Device identification recorded
✓ Accessories checked
✓ External inspection completed
✓ Device tests completed
✓ Apple-specific checks completed
✓ Inspection finalized
✓ Report generated
```

---

## Troubleshooting

### Issue: Inspection page doesn't load
**Solution:**
- Verify you're logged in as admin or staff user
- Check browser console for errors
- Ensure order ID in URL is valid (copied from order list)
- Clear browser cache and reload

### Issue: "Save & Continue" button does nothing
**Solution:**
- Check browser console for error messages
- Verify all required fields are filled
- Check network tab for failed API requests
- Verify backend is running (should see logs in terminal)

### Issue: API returns 404 Not Found
**Solution:**
- Restart the server to ensure routes are registered
- Check that deviceInspectionRoutes.js is loaded in server.js
- Verify correct API endpoint URL in frontend calls

### Issue: PDF report not generating
**Solution:**
- Check that `/uploads/reports` directory exists
- Verify pdfkit is installed: `npm list pdfkit`
- Check server logs for PDF generation errors
- Ensure file system permissions allow write access

### Issue: Failed tests don't trigger notifications
**Solution:**
- Check that NotificationService is working correctly
- Verify database connection is active
- Check server logs for notification creation errors
- Manually verify database for created notifications

### Issue: Database connection error
**Solution:**
- Ensure MongoDB is running: `mongodb://localhost:27017`
- Check .env file for correct DATABASE_URL
- Verify MongoDB credentials if authentication enabled
- Check server logs for connection error details

---

## Success Indicators

After completing the test steps, you should observe:

✓ **Backend:**
- No 500 errors in console
- Inspection model created with all data
- PDF report file generated in `/uploads/reports/`
- Action logs recorded with timestamps

✓ **Frontend:**
- Form steps complete and save successfully
- Toast notifications appear for each step
- No JavaScript errors in browser console
- Redirect occurs after final completion

✓ **Database:**
- New DeviceInspection document created
- All steps and test results stored
- Action logs contain technician details
- Report URL stored in inspection record

✓ **API Responses:**
- All endpoints return 200 or 201 status codes
- Response includes complete inspection object
- Error responses are detailed and helpful

---

## Performance Notes

- Initial form load: ~500ms
- Each step save: ~200-300ms
- PDF generation: ~1-2 seconds
- Report download: immediate

If operations take longer, check:
- Network connection speed
- Database query performance
- Server CPU/memory usage
- File system I/O performance

---

## Next Steps

After successful testing:

1. **Integration with Order Status:** Link inspection completion to order status updates
2. **Customer Notifications:** Implement customer-facing inspection notifications
3. **Mobile Access:** Test inspection workflow on mobile devices
4. **Advanced Reporting:** Add charts and analytics to inspection reports
5. **Photo Uploads:** Implement photo capture during inspection steps
6. **Multi-technician Support:** Allow multiple technicians to collaborate on inspections

