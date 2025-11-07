# Quick Translation Testing (5 Minutes)

## Quick Test Checklist - Complete in 5 Minutes

### Step 1: Start Your App (30 seconds)
```
npm run dev
# Wait for app to load, then open it in browser
```

### Step 2: Navigate to an Order (30 seconds)
- Go to `/orders` page
- Click on any order to open Order Details

### Step 3: Verify English is Default (30 seconds)
Look for these English labels on the page:
- ✓ "Customer Information" heading
- ✓ "Assigned Staff" heading (if admin/staff)
- ✓ "Device Information" heading
- ✓ "Add-On Services" heading (if admin/staff)
- ✓ "Repair Progress" heading
- ✓ "Back to Orders" button at top

If you see all English text → **✅ English Working**

### Step 4: Switch to German (1 minute)
- Look for language selector in header/navbar
- Click it and select "German" or "Deutsch"
- Page should update immediately

### Step 5: Verify German Translation (1.5 minutes)
After switching to German, verify you see:
- ✓ "Kundeninformationen" (Customer Information)
- ✓ "Zugewiesenes Personal" (Assigned Staff)
- ✓ "Geräteinformationen" (Device Information)
- ✓ "Zusatzdienste" (Add-On Services)
- ✓ "Reparaturfortschritt" (Repair Progress)
- ✓ "Zurück zu Bestellungen" (Back to Orders)
- ✓ NO English text visible on page

If all German and no English → **✅ German Working**

### Step 6: Verify No Errors (30 seconds)
- Press F12 to open Developer Tools
- Go to "Console" tab
- Look for red error messages
- Should see NO errors about translations

If console is clean → **✅ No Errors**

### Step 7: Switch Back to English (30 seconds)
- Use language selector to switch back to English
- Verify English text appears again

If English appears → **✅ Language Switching Works**

---

## Test Dialogs (Optional - 2 Minutes)

### If You Have Admin/Staff Role:

1. **Test Feedback Dialog**
   - Click "Feedback" button
   - In English: Should see "Send Feedback Request to Customer"
   - Switch to German: Should see German translation

2. **Test Quick Action Dialog**
   - Click "Action" button
   - In English: Should see "Send Quick Action to Customer"
   - Switch to German: Should see German translation

---

## ✅ Success = All These Are True

- [ ] English labels visible initially
- [ ] Language selector found and working
- [ ] Switching to German shows German text
- [ ] No English text visible in German mode
- [ ] Switching back to English works
- [ ] No red errors in console
- [ ] Language persists when clicking between pages

## ❌ If Something's Wrong

**Problem:** German text not showing
- Solution: Hard refresh browser (Ctrl+Shift+R or Cmd+Shift+R)

**Problem:** Errors in console about translations
- Solution: Check that translation files are in `/client/src/locales/`

**Problem:** Can't find language selector
- Solution: Look in header/navbar, may be in dropdown menu

---

## Expected Sections with Translations

### Main Page (OrderDetails)
- Customer Information
- Assigned Staff
- Device Information
- Add-On Services
- Electronic Parts
- Workflows
- Repair Progress
- Order Summary

### Inspection Section (InspectionResultsDisplay)
- Device Inspection Report
- Model Verification
- Device Identification
- Accessories (Packaging, Case, Adapter)
- External Condition (Display, Frame, Back Cover, Buttons)

### Communication Section (CommunicationPanel)
- Communication & Feedback
- Feedback button
- Action button
- Dialog titles and forms

---

## ⏱️ Timing Summary

- **Total Time:** ~5 minutes
- Setup: 1 min
- Test English: 1 min
- Test German: 1.5 min
- Verify Errors: 30 sec
- Test Dialogs (optional): 2 min

---

## Next Steps

If all checks pass:
✅ **Implementation is complete and working!**

For detailed testing with all edge cases, see: `TRANSLATION_TESTING_GUIDE.md`

For implementation details, see: `TRANSLATION_IMPLEMENTATION_SUMMARY.md`
