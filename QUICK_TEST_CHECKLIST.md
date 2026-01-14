# Quick Test Checklist: Step 5 Cart Integration

## Pre-Test Setup
- [ ] Application running on `npm run dev`
- [ ] Logged in as a customer user
- [ ] Browser console open (F12)

---

## Step-by-Step Testing (5 minutes)

### 1. Navigate to New Order Page
- [ ] Click "New Order" or "Repair Services" in navigation
- [ ] See "Create New Repair Order" heading
- [ ] Progress bar visible with Step 1 highlighted

### 2. Complete Step 1 (Device Selection)
- [ ] Select device type: ✓ (e.g., "Smartphone")
- [ ] Select manufacturer: ✓ (e.g., "Apple")
- [ ] Select model: ✓ (e.g., "iPhone 14")
- [ ] Click "Next" → Progress bar shows 20%

### 3. Complete Step 2 (Services)
- [ ] Select 2+ services with checkboxes ✓
- [ ] Services highlighted in the list ✓
- [ ] Click "Next" → Progress bar shows 40%

### 4. Complete Step 3 (Add-ons)
- [ ] Select 1+ add-on services ✓
- [ ] Click "Next" → Progress bar shows 60%

### 5. Review Step 4 (Details)
- [ ] Device/services/add-ons displayed ✓
- [ ] Enter customer notes ✓
- [ ] **Check button text**: Should say "Review Order in Cart" (NOT "Create Order & Submit")
- [ ] Click "Review Order in Cart" → Progress bar shows 80%

### 6. Verify Step 5 Displays (Critical Check!)
- [ ] Page title: "Add to Cart" with shopping cart icon ✓
- [ ] Order Details box shows:
  - [ ] Device type, manufacturer, and model
  - [ ] All selected services with prices
  - [ ] All selected add-ons with prices
  - [ ] Total Cost calculation is correct ✓
- [ ] Blue info box explains cart benefits ✓
- [ ] 4 benefit cards visible:
  - [ ] ✓ Review & Modify
  - [ ] ✓ Apply Discount Codes
  - [ ] ✓ Multiple Orders
  - [ ] ✓ Secure Checkout

### 7. Test Navigation
- [ ] Click "Previous" → Back to Step 4 (data preserved)
- [ ] Click "Next" → Forward to Step 5

### 8. Test Action Buttons
- [ ] **"Continue Shopping" button**
  - [ ] Clicked
  - [ ] Toast says "Order ready!"
  - [ ] Redirected to `/shop` (shopping page) ✓

### 9. Return to Step 5 and Test Add to Cart
- [ ] Go back through Steps 1-4 again
- [ ] In Step 5, click "Add to Cart & Review"
- [ ] **During click:**
  - [ ] Button shows loading spinner
  - [ ] Button text says "Adding to Cart..."
  - [ ] Button is disabled
- [ ] **After completion:**
  - [ ] Success toast appears
  - [ ] Toast says "Your repair order has been added to your cart..."
  - [ ] Redirected to `/cart` (Shopping Cart page) ✓

---

## Browser Console Checks

While testing, open F12 console and verify:

- [ ] **No red errors** in console
- [ ] **No TypeScript errors** about undefined components
- [ ] **No icon import errors**
- [ ] **Network requests** show successful responses (if applicable)

---

## Quick Issue Checklist

If something's wrong:

| Issue | Check |
|-------|-------|
| Step 5 doesn't appear | Verify button says "Review Order in Cart" in Step 4 |
| Button text is broken | Check icon import (should use ShoppingCartIcon) |
| Page layout is broken | Clear browser cache (Ctrl+Shift+Del) and reload |
| Services/add-ons missing in Step 5 | Verify they were selected in Steps 2-3 |
| Total Cost is wrong | Verify service/add-on prices sum correctly |
| Console errors about icons | Check import: `ShoppingCart as ShoppingCartIcon` |

---

## Desktop Testing (1920px)

- [ ] Layout looks clean and balanced
- [ ] Benefits grid shows 2 columns
- [ ] Buttons are side-by-side on right
- [ ] Order details readable

## Tablet Testing (768px)

- [ ] Layout adjusts properly
- [ ] Benefits grid still 2 columns
- [ ] Order details still readable
- [ ] Buttons stack if needed

## Mobile Testing (375px)

- [ ] Benefits grid stacks to 1 column
- [ ] Buttons stack vertically
- [ ] No horizontal scroll needed
- [ ] Text is legible

---

## Final Verification

- [ ] ✅ Step 4 button changed to "Review Order in Cart"
- [ ] ✅ Step 5 renders with all elements
- [ ] ✅ Progress bar shows 5 steps (20%, 40%, 60%, 80%, 100%)
- [ ] ✅ Navigation works (Previous, Next, Continue Shopping)
- [ ] ✅ "Add to Cart & Review" shows loading and success
- [ ] ✅ No console errors
- [ ] ✅ Responsive on all screen sizes

---

## Pass/Fail

- **PASS**: All checkboxes completed, no errors
- **FAIL**: Any checkbox unchecked or console errors

---

**Test Date**: _______________
**Tested By**: _______________
**Result**: ☐ PASS ☐ FAIL

**Notes**:
___________________________________________________________________________
___________________________________________________________________________
