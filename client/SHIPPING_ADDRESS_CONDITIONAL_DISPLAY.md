# Shipping Address Conditional Display Implementation

## Overview
Implemented conditional display of shipping address fields in the checkout registration dialog. The shipping address form now only appears when the user unchecks the "Billing address is the same as shipping address" checkbox.

## Changes Made

### 1. Frontend Component Updates

#### File: `client/src/components/checkout/CheckoutDialog.tsx`

**Added:**
- Imported `Checkbox` component from shadcn-ui
- Added state variable `billingIsShipping` (default: `true`)
- Added checkbox UI element before shipping address section
- Wrapped shipping address form fields in conditional rendering (`{!billingIsShipping && ...}`)
- Updated registration submission logic to use billing address as shipping address when checkbox is checked

**Key Features:**
- Checkbox is checked by default (billing = shipping)
- Shipping address fields only appear when checkbox is unchecked
- When checkbox is checked, billing address is automatically copied to shipping address during registration
- Smooth conditional rendering without page reload

### 2. Translation Updates

#### File: `client/public/locales/en/translation.json`
**Added:**
```json
"billingIsShippingAddress": "Billing address is the same as shipping address"
```

#### File: `client/public/locales/de/translation.json`
**Added:**
```json
"billingIsShippingAddress": "Rechnungsadresse ist identisch mit Lieferadresse"
```

## User Experience Flow

### Default State (Checkbox Checked)
1. User opens the checkout dialog
2. "Create Account" tab is selected
3. User sees personal information, company information, and billing address fields
4. Checkbox "Billing address is the same as shipping address" is checked
5. Shipping address fields are hidden
6. User fills in billing address
7. On submission, billing address is used for both billing and shipping

### Custom Shipping Address (Checkbox Unchecked)
1. User opens the checkout dialog
2. "Create Account" tab is selected
3. User fills in personal information, company information, and billing address
4. User unchecks "Billing address is the same as shipping address"
5. Shipping address fields appear below the checkbox
6. User fills in different shipping address
7. On submission, separate addresses are sent to the backend

## Technical Implementation

### State Management
```typescript
const [billingIsShipping, setBillingIsShipping] = useState(true);
```

### Checkbox Component
```tsx
<Checkbox
  id="billingIsShipping"
  checked={billingIsShipping}
  onCheckedChange={(checked) => setBillingIsShipping(checked === true)}
/>
```

### Conditional Rendering
```tsx
{!billingIsShipping && (
  <div className="space-y-4">
    {/* Shipping address fields */}
  </div>
)}
```

### Data Submission Logic
```typescript
const finalShippingAddress = billingIsShipping ? {
  street: billingStreet,
  city: billingCity,
  state: billingState,
  zipCode: billingZipCode,
  country: billingCountry
} : {
  street: shippingStreet,
  city: shippingCity,
  state: shippingState,
  zipCode: shippingZipCode,
  country: shippingCountry
};
```

## Benefits

1. **Improved UX**: Reduces form clutter when shipping and billing addresses are the same
2. **Cleaner Form**: Only shows relevant fields based on user selection
3. **Less Scrolling**: Shorter form when checkbox is checked (most common scenario)
4. **Clear Intent**: Explicit checkbox makes it obvious when addresses will be different
5. **Internationalized**: Supports both English and German translations
6. **Accessible**: Uses semantic HTML with proper label associations

## Build Verification

✅ Build completed successfully
✅ No TypeScript errors
✅ No linting issues
✅ All imports resolved correctly

## Files Modified

1. `client/src/components/checkout/CheckoutDialog.tsx` - Main component logic
2. `client/public/locales/en/translation.json` - English translation
3. `client/public/locales/de/translation.json` - German translation

## Deployment Status

✅ Ready for production deployment
✅ Backward compatible (existing API unchanged)
✅ No database schema changes required
✅ No backend modifications needed
