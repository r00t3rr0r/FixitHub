# Device Inspection Workflow - Quick Start Guide

## For Admin & Staff Users

### Getting Started (2 Minutes)

#### Step 1: Open an Order
1. Go to **Admin Dashboard** → **Orders**
2. Click on any repair order
3. Order details page opens

#### Step 2: Find Inspection Section
1. Scroll down in the main content area
2. Look for **"Device Inspection"** section
3. (It's located after the "Repair Progress" section)

#### Step 3: Two Possible Scenarios

### Scenario A: No Inspection Yet ✗

**What You'll See**:
```
┌─────────────────────────────┐
│ 📄 Device Inspection        │
│ No inspection has been      │
│ completed yet for this      │
│ device                      │
│                             │
│ [→ Start Device Inspection] │
└─────────────────────────────┘
```

**What To Do**:
1. Click **"Start Device Inspection"** button
2. You'll be taken to the inspection workflow page
3. Complete all 6 steps:
   - Model Verification
   - Device Identification
   - Accessories & Packaging
   - External Inspection
   - Device Testing
   - Apple-Specific Checks
4. Mark device as repairable/non-repairable
5. Click "Complete Inspection"
6. You'll return to order details

### Scenario B: Inspection Complete ✓

**What You'll See**:
A detailed inspection report with all information organized in color-coded sections:

#### Status at Top
```
[Completed] [Failed Tests] (if applicable)
```

#### 6 Inspection Steps (Color-Coded)
1. **📱 Model Verification** (Blue)
   - Reported Model
   - Actual Model
   - Verification Status

2. **📱 Device Identification** (Purple)
   - Device Type
   - IMEI or Serial Number

3. **📦 Accessories & Packaging** (Cyan)
   - Original Packaging ✓/✗
   - Case/Cover ✓/✗
   - Power Adapter ✓/✗

4. **👁 External Inspection** (Orange)
   - Display Status
   - Frame Status
   - Back Cover Status
   - Buttons Status
   - Any Visible Damage ⚠️

5. **⚡ Device Testing** (Green)
   - Charging ✓/✗
   - Power ✓/✗
   - Wi-Fi ✓/✗
   - Front Camera ✓/✗
   - Main Camera ✓/✗

6. **🍎 Apple-Specific** (Gray) *(if applicable)*
   - Modem Firmware ✓/✗
   - Touch ID / Face ID ✓/✗

#### Repair Assessment
```
Repairable: ✓ Yes
Estimated Cost: $299
Timeframe: 3-5 days
Description: Screen replacement
```

#### Action Timeline
Last 5 actions with timestamps:
- ✓ Model verification updated | Jan 18, 14:23
- ✓ Device test updated | Jan 18, 14:20
- ✓ Inspection completed | Jan 18, 14:15

#### Download Button
```
[📥 Download Inspection Report (PDF)]
```

---

## Common Tasks

### Task 1: Start a New Inspection
```
1. Open order details
2. Scroll to "Device Inspection" section
3. Click "Start Device Inspection"
4. Complete workflow (5-10 minutes)
5. Return to order to see results
```

### Task 2: View Inspection Results
```
1. Open order details
2. Scroll to "Device Inspection" section
3. Review all 6 inspection steps
4. Check repair assessment
5. See action history
```

### Task 3: Download Inspection Report
```
1. Open order details
2. Scroll to "Device Inspection" section
3. Click "Download Inspection Report (PDF)"
4. PDF saves to Downloads folder
5. Share with customer if needed
```

### Task 4: Check for Failed Tests
```
1. Open order details
2. Look for "Failed Tests" badge (red)
3. Scroll to "Device Testing" section
4. See red warning box with failed tests
5. Review failed test details
```

### Task 5: Assess Repairability
```
1. Complete all inspection steps
2. Scroll to "Repair Assessment" section
3. See "Repairable: Yes/No" status
4. If Yes: See estimated cost and timeframe
5. Use info for customer quote
```

---

## Tips & Tricks

### 💡 Tip 1: Use Color Coding
- Each inspection step has its own color
- Quickly scan for specific section you need
- Colors help organize information visually

### 💡 Tip 2: Check the Timeline
- Action timeline shows who did what and when
- Useful for tracking inspection history
- Helps identify any issues or delays

### 💡 Tip 3: Use the Download Button
- Always generate PDF for your records
- Send to customer for documentation
- Keep in order file for reference

### 💡 Tip 4: Failed Tests Alert
- Red "Failed Tests" badge shows immediately
- Scroll to Device Testing section to see details
- System creates customer notification automatically

### 💡 Tip 5: Return to Start Inspection
- If you need to re-do an inspection
- Complete a new inspection for same order
- Previous results are preserved in history

---

## Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Scroll Down | Space / Page Down |
| Back to Orders | Alt + Left Arrow |
| Download Report | Ctrl + S (when PDF downloads) |
| Refresh Page | F5 / Ctrl + R |
| Search in Report | Ctrl + F |

---

## Frequently Asked Questions

### Q: Where do I start an inspection?
**A**: On the Order Details page, scroll down to the "Device Inspection" section and click "Start Device Inspection"

### Q: How long does inspection take?
**A**: 5-10 minutes depending on complexity. Each step takes 1-2 minutes.

### Q: Can I edit an inspection after completing it?
**A**: Currently, you complete a new inspection for the order. Previous results are preserved.

### Q: What if a test fails?
**A**: The system automatically creates a customer notification. You can see failed tests in the red warning box in the Device Testing section.

### Q: How do I share the inspection report?
**A**: Download the PDF report and email it to the customer. The report includes all inspection details.

### Q: What if the device is not repairable?
**A**: Select "No" in the repair assessment. The system marks it accordingly. You can provide notes explaining why.

### Q: Can customers see inspection results?
**A**: No. Only admin and staff users can see the inspection section. It's hidden from customers.

### Q: How do I know which order is ready for inspection?
**A**: Orders with no inspection show "Device Inspection" section with a "Start" button. Orders with completed inspections show all results.

### Q: Where does the PDF get saved?
**A**: To your computer's Downloads folder. File name format: `inspection-report-{orderId}.pdf`

### Q: What if I need to re-inspect the same device?
**A**: Complete a new inspection. Previous inspections are preserved in the action timeline.

### Q: Is my work saved automatically?
**A**: Yes. Each inspection step is saved as you complete it. You don't need to manually save.

---

## Troubleshooting

### Problem: "Inspection section not visible"
**Solution**:
- Check your user role (must be admin or staff)
- Refresh the page
- Clear browser cache

### Problem: "Start Inspection button doesn't work"
**Solution**:
- Check browser console for errors (F12)
- Try refreshing the page
- Contact support if error persists

### Problem: "Can't download PDF report"
**Solution**:
- Check if pop-ups are blocked in browser
- Try a different browser
- Check download folder for file
- Ensure you have disk space

### Problem: "Inspection results not showing"
**Solution**:
- Refresh the page
- Check your internet connection
- Make sure backend is running
- Try a different order

### Problem: "Failed tests notification not received"
**Solution**:
- Check your notifications center
- Verify notifications are enabled
- Contact admin to check system

---

## Workflow Example

### Complete Inspection Workflow (Step by Step)

**Time**: 10 minutes
**Device**: iPhone 12

1. **Navigate to Order** (30 seconds)
   - Go to Admin → Orders
   - Find and click the iPhone 12 order

2. **Start Inspection** (1 minute)
   - Scroll to "Device Inspection" section
   - Click "Start Device Inspection"
   - See inspection workflow page

3. **Model Verification** (1 minute)
   - Enter: Reported Model = iPhone 12
   - Enter: Actual Model = iPhone 12
   - Select: Status = Correct
   - Click: "Save & Continue"

4. **Device ID** (1 minute)
   - Enter: IMEI = 351234567890123
   - Click: "Save & Continue"

5. **Accessories** (1 minute)
   - Check: Original Packaging ✓
   - Check: Case/Cover ✓
   - Check: Power Adapter ✓
   - Click: "Save & Continue"

6. **External Inspection** (2 minutes)
   - Set: Display = OK
   - Set: Frame = OK
   - Set: Back Cover = OK
   - Set: Buttons = OK
   - No visible damage
   - Click: "Save & Continue"

7. **Device Tests** (2 minutes)
   - Set: Charging = OK
   - Set: Power = OK
   - Set: Wi-Fi = OK
   - Set: Front Camera = OK
   - Set: Main Camera = OK
   - Click: "Save & Continue"

8. **Apple-Specific** (1 minute)
   - Check: Modem Firmware ✓
   - Check: Face ID Working ✓
   - Click: "Save & Continue"

9. **Repair Assessment** (1 minute)
   - Select: Repairable = Yes
   - Enter: Estimated Cost = $299
   - Enter: Timeframe = 3-5 days
   - Enter: Description = Screen replacement
   - Click: "Complete Inspection"

10. **View Results** (1 minute)
    - Back on Order Details page
    - Scroll to "Device Inspection"
    - See all results displayed
    - Download PDF if needed

---

## Contact & Support

**Need Help?**
- Check this quick start guide
- Review the troubleshooting section
- Contact your admin or IT support
- Check system documentation

**Report Issues**
- Note the exact error message
- Screenshot the problem
- Record the time it occurred
- Include your user role/name

---

**Last Updated**: 2024
**Version**: 1.0
**Status**: Ready for Production Use

Happy inspecting! 🔍
