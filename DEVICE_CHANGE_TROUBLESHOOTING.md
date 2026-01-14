# Device Change Dialog - Troubleshooting Guide

## Quick Reference

### Common Issues & Solutions

#### Issue 1: "No devices found" message appears even though backend is returning results

**Symptoms**:
- Backend logs show devices being returned: `DeviceService: Found 9 matching devices`
- Frontend shows: "No devices found. Try a different search query."
- Frontend console shows empty array: `searchResults: []`

**Root Cause**:
Response field name mismatch

**Solution**:
Verify line 117 in `client/src/components/admin/DeviceChangeDialog.tsx`:
```typescript
// ✅ CORRECT
setSearchResults((response as any).devices || [])

// ❌ WRONG (old buggy code)
setSearchResults((response as any).results || [])
```

**Verification**:
1. Open browser DevTools → Console
2. Search for device
3. Look for log: `[DeviceChange] Searching for devices: Samsung`
4. Check that searchResults array is populated (not empty)

---

#### Issue 2: Device cards show "undefined undefined" in search results

**Symptoms**:
- Search results display but text shows: "undefined undefined"
- Device type shows: "undefined"
- Cards are not clickable or not selectable

**Root Cause**:
Component trying to access wrong field names

**Solution**:
Verify lines 272-290 in `client/src/components/admin/DeviceChangeDialog.tsx`:
```typescript
// ✅ CORRECT
key={`${device.manufacturer}-${device.name}`}
{device.manufacturer} {device.name}
{device.deviceType}
selectedDevice?.name === device.name

// ❌ WRONG (old buggy code)
key={`${device.brand}-${device.model}`}
{device.brand} {device.model}
{device.type}
selectedDevice?.model === device.model
```

**Verification**:
1. Search for device
2. Inspect device card with DevTools
3. Verify text shows actual brand and model (e.g., "Samsung Galaxy S24")
4. Verify device type shows (e.g., "Smartphone")

---

#### Issue 3: "Recalculate Services" button fails with error

**Symptoms**:
- Error toast appears: "Failed to recalculate services"
- Browser console shows: `Error: Cannot read property 'deviceBrand'`
- Backend logs show: `Error: Device brand, model, and type are required`

**Root Cause**:
API parameters are undefined due to wrong field names

**Solution**:
Verify lines 152-156 in `client/src/components/admin/DeviceChangeDialog.tsx`:
```typescript
// ✅ CORRECT
const result = await changeDeviceAndRecalculateServices(
  orderId,
  selectedDevice.manufacturer,
  selectedDevice.name,
  selectedDevice.deviceType
)

// ❌ WRONG (old buggy code)
const result = await changeDeviceAndRecalculateServices(
  orderId,
  selectedDevice.brand,
  selectedDevice.model,
  selectedDevice.type || selectedDevice.deviceType
)
```

**Verification**:
1. In browser DevTools, set breakpoint in handleRecalculateServices
2. Check selectedDevice object contains: manufacturer, name, deviceType (not brand, model, type)
3. Verify API call parameters in Network tab

---

### Data Structure Reference

#### SearchResult (from API /api/devices/search?q=...)
```typescript
{
  _id: "507f1f77bcf86cd799439011",
  name: "Galaxy S24",              // ✅ Use this for model
  deviceType: "Smartphone",        // ✅ Use this for type
  manufacturer: "Samsung",         // ✅ Use this for brand
  manufacturerId: "507f...",
  displayName: "Smartphone • Samsung • Galaxy S24"
}
```

#### API Endpoint changeDeviceAndRecalculateServices
```typescript
changeDeviceAndRecalculateServices(
  orderId: string,           // Order ID
  deviceBrand: string,       // Maps to SearchResult.manufacturer
  deviceModel: string,       // Maps to SearchResult.name
  deviceType: string         // Maps to SearchResult.deviceType
)
```

### Debug Checklist

When troubleshooting Device Change issues:

- [ ] Check browser console for `[DeviceChange]` log messages
- [ ] Verify response.devices (not response.results) is populated
- [ ] Verify searchResults array contains SearchResult objects
- [ ] Confirm SearchResult has: `name`, `deviceType`, `manufacturer`
- [ ] Check that device cards display proper brand/model/type
- [ ] Verify selected device object structure
- [ ] Check API call parameters in Network tab
- [ ] Verify backend receives correct deviceBrand/deviceModel/deviceType
- [ ] Check pricing calculation response in Network tab

### Log Messages to Look For

#### ✅ Successful Flow
```javascript
[DeviceChange] Searching for devices: Samsung Galaxy S24
API: Searching devices with query: Samsung Galaxy S24
API: Search results: [{_id: "...", name: "Galaxy S24", ...}]
[DeviceChange] Selected device: {name: "Galaxy S24", ...}
[DeviceChange] Recalculating services for new device: {name: "Galaxy S24", ...}
Success: Services recalculated based on new device
```

#### ❌ Error Flow
```javascript
[DeviceChange] Searching for devices: Samsung Galaxy S24
API: Search results: []  // Empty!
// OR
API: Search results: [{...}]
[DeviceChange] Selected device: {name: "Galaxy S24", ...}
[DeviceChange] Recalculating services for new device: {name: "Galaxy S24", ...}
Error recalculating services: Error: ...
```

---

## Feature Flow Verification

### Step 1: Search
```
✓ User types "Samsung Galaxy S24"
✓ handleSearchDevice() called
✓ searchDevices() API called
✓ Backend returns { success: true, devices: [...] }
✓ Component sets searchResults from response.devices
✓ Cards display with manufacturer, name, deviceType
```

**If failing**: Check Issue #1 or #2 above

### Step 2: Selection
```
✓ User clicks device card
✓ handleSelectDevice() called
✓ selectedDevice state updated
✓ Card highlights with blue border and checkmark
```

**If failing**: Check Issue #2 above

### Step 3: Recalculation
```
✓ User clicks "Recalculate Services"
✓ handleRecalculateServices() called
✓ Extract: manufacturer → deviceBrand, name → deviceModel, deviceType → deviceType
✓ changeDeviceAndRecalculateServices() called with correct params
✓ Backend processes and returns pricingChangesSummary
✓ Dialog moves to review stage
```

**If failing**: Check Issue #3 above

### Step 4: Review
```
✓ Dialog shows pricing changes
✓ Per-service comparisons displayed
✓ Total cost change highlighted
```

**If failing**: Backend issue or API response structure problem

### Step 5: Confirmation
```
✓ User clicks "Confirm Device Change"
✓ confirmDeviceChange() called
✓ Backend finalizes change
✓ Customer notification sent
✓ Dialog closes
✓ Order updated with new device
```

**If failing**: Backend issue

---

## Console Commands for Debugging

### Test Device Search API
```javascript
// In browser console
fetch('/api/devices/search?q=Samsung')
  .then(r => r.json())
  .then(data => console.log('API Response:', data))
```

### Check SearchResult Structure
```javascript
// After search in component
const device = selectedDevice;
console.log('Device structure:', {
  manufacturer: device.manufacturer,
  name: device.name,
  deviceType: device.deviceType,
  displayName: device.displayName
});
```

### Verify API Parameters
```javascript
// In handleRecalculateServices before API call
console.log('API will receive:', {
  orderId: orderId,
  deviceBrand: selectedDevice.manufacturer,
  deviceModel: selectedDevice.name,
  deviceType: selectedDevice.deviceType
});
```

---

## Network Request Inspection

### Device Search Request
```
URL: /api/devices/search?q=Samsung%20Galaxy%20S24
Method: GET
Status: 200

Response:
{
  "success": true,
  "devices": [
    {
      "_id": "...",
      "name": "Galaxy S24",
      "deviceType": "Smartphone",
      "manufacturer": "Samsung",
      "manufacturerId": "...",
      "displayName": "..."
    }
  ]
}

✓ Verify: response.devices exists (not response.results)
```

### Device Change Request
```
URL: /api/admin/orders/507f.../change-device
Method: POST
Status: 200

Request Body:
{
  "deviceBrand": "Samsung",
  "deviceModel": "Galaxy S24",
  "deviceType": "Smartphone"
}

Response:
{
  "success": true,
  "order": {...},
  "pricingChangesSummary": {...},
  "requiresConfirmation": true
}

✓ Verify: All three fields have proper values (not undefined)
```

---

## Common Mistakes to Avoid

### ❌ DON'T
```typescript
// Wrong field names
device.brand
device.model
device.type
selectedDevice?.model
response.results
```

### ✅ DO
```typescript
// Correct field names
device.manufacturer
device.name
device.deviceType
selectedDevice?.name
response.devices
```

---

## Performance Tips

- Device search debounces on user input
- Results limited to 20 items from backend
- Use DevTools Network tab to monitor requests
- Check for duplicate API calls in console

---

## Related Files

- **Component**: `client/src/components/admin/DeviceChangeDialog.tsx`
- **API Client**: `client/src/api/adminOrders.ts`
- **Device Search**: `client/src/api/devices.ts`
- **Backend Service**: `server/services/deviceChangeService.js`
- **Backend Routes**: `server/routes/adminOrderRoutes.js`

---

## Support & Escalation

If issue persists after checking above:

1. Verify all three fixes are applied (lines 117, 272-290, 152-156)
2. Clear browser cache and restart development server
3. Check browser console for any other errors
4. Check backend server logs for errors
5. Verify database connection is working
6. Check if device search endpoint is available

---

**Last Updated**: November 2024
**Fixes Applied**: All 3 critical issues resolved
