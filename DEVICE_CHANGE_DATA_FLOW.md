# Device Change Dialog - Data Flow Diagram

## Fixed Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    DEVICE CHANGE WORKFLOW                        │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ STEP 1: USER SEARCH                                             │
└─────────────────────────────────────────────────────────────────┘

User types: "Samsung Galaxy S24"
        ↓
handleSearchDevice(query)
        ↓
searchDevices("Samsung Galaxy S24")
        ↓
GET /api/devices/search?q=Samsung%20Galaxy%20S24
        ↓
Backend returns:
┌─────────────────────────────────────────────────────────────────┐
│ response.success: true                                          │
│ response.devices: [                                              │
│   {                                                              │
│     _id: "507f1f77bcf86cd799439011",                            │
│     name: "Galaxy S24",                   ← DEVICE MODEL        │
│     deviceType: "Smartphone",             ← DEVICE TYPE        │
│     manufacturer: "Samsung",              ← DEVICE BRAND       │
│     manufacturerId: "507f1f77bcf86cd799439012",                │
│     displayName: "Smartphone • Samsung • Galaxy S24"            │
│   }                                                              │
│ ]                                                                │
└─────────────────────────────────────────────────────────────────┘
        ↓
✅ FIX 1: setSearchResults((response).devices || [])
          (was: response.results - WRONG)
        ↓
Search results displayed in UI:
┌─────────────────────────────────────────────────────────────────┐
│ ┌─────────────────────────────────────────┐                     │
│ │ Samsung Galaxy S24                      │ ✓ Clickable        │
│ │ Smartphone                              │                     │
│ └─────────────────────────────────────────┘                     │
└─────────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────┐
│ STEP 2: USER SELECTION                                          │
└─────────────────────────────────────────────────────────────────┘

User clicks device card
        ↓
handleSelectDevice(device)
        ↓
setSelectedDevice(device)  ← Stores SearchResult object
        ↓
✅ FIX 2: Display uses correct fields:
         - device.manufacturer (not device.brand)
         - device.name (not device.model)
         - device.deviceType (not device.type)
         - selectedDevice?.name (not selectedDevice?.model)


┌─────────────────────────────────────────────────────────────────┐
│ STEP 3: RECALCULATE SERVICES                                    │
└─────────────────────────────────────────────────────────────────┘

User clicks "Recalculate Services"
        ↓
handleRecalculateServices()
        ↓
✅ FIX 3: Extract data from SearchResult:
┌─────────────────────────────────────────────────────────────────┐
│ Input (selectedDevice - SearchResult):                          │
│ {                                                                │
│   name: "Galaxy S24",           ← Device model name             │
│   deviceType: "Smartphone",     ← Device type                   │
│   manufacturer: "Samsung",      ← Brand name                    │
│   ...                                                            │
│ }                                                                │
│                                                                 │
│ Mapping:                                                         │
│   selectedDevice.manufacturer  →  deviceBrand                  │
│   selectedDevice.name          →  deviceModel                  │
│   selectedDevice.deviceType    →  deviceType                   │
│                                                                 │
│ Output (API parameters):                                        │
│ changeDeviceAndRecalculateServices(                            │
│   orderId,                                                      │
│   "Samsung",                    ← deviceBrand (was: undefined) │
│   "Galaxy S24",                 ← deviceModel (was: undefined) │
│   "Smartphone"                  ← deviceType (was: partially)  │
│ )                                                               │
└─────────────────────────────────────────────────────────────────┘
        ↓
POST /api/admin/orders/:id/change-device
{
  deviceBrand: "Samsung",
  deviceModel: "Galaxy S24",
  deviceType: "Smartphone"
}
        ↓
Backend DeviceChangeService processes:
  1. Fetch original order
  2. Update device information
  3. Recalculate service compatibility
  4. Calculate pricing changes for each service
  5. Compute new total cost
  6. Return pricingChangesSummary
        ↓
Returns pricing changes with per-service comparisons
┌─────────────────────────────────────────────────────────────────┐
│ response.pricingChangesSummary: {                               │
│   originalDevice: { brand, model, type },                       │
│   newDevice: { brand, model, type },                            │
│   serviceChanges: [                                              │
│     { serviceName, originalPrice, newPrice, difference, ... }  │
│   ],                                                             │
│   totalCostBefore, totalCostAfter, totalCostDifference,        │
│   totalCostStatus,                                              │
│   requiresConfirmation                                          │
│ }                                                                │
└─────────────────────────────────────────────────────────────────┘
        ↓
Move to "Review" stage
        ↓


┌─────────────────────────────────────────────────────────────────┐
│ STEP 4: REVIEW PRICING                                          │
└─────────────────────────────────────────────────────────────────┘

Display stage shows:
  - Old device info
  - New device info
  - Service-by-service price changes with trends (↑ ↓)
  - Total cost change with highlight
  - Confirmation requirement notice (if prices changed)
        ↓
User reviews and clicks "Continue to Confirmation"
        ↓


┌─────────────────────────────────────────────────────────────────┐
│ STEP 5: CONFIRM DEVICE CHANGE                                   │
└─────────────────────────────────────────────────────────────────┘

Display confirmation stage
        ↓
User clicks "Confirm Device Change"
        ↓
handleConfirmDeviceChange()
        ↓
confirmDeviceChange(orderId, true)
        ↓
POST /api/admin/orders/:id/confirm-device-change
{
  confirmed: true
}
        ↓
Backend:
  1. Finalize device change
  2. Send customer notification with pricing details
  3. Return confirmation
        ↓
Frontend:
  1. Show success toast
  2. Call onDeviceChanged callback
  3. Close dialog
  4. Order Details page refreshes with updated device/services
```

## Key Fixes Summary

| Aspect | Before | After | Impact |
|--------|--------|-------|--------|
| Response field | `response.results` | `response.devices` | Search results now populate |
| Device brand | `device.brand` | `device.manufacturer` | Displays correctly |
| Device model | `device.model` | `device.name` | Displays correctly |
| Device type | `device.type` | `device.deviceType` | Displays correctly |
| Selection comparison | `device.model` | `device.name` | Selection indicator works |
| API brand param | `selectedDevice.brand` (undefined) | `selectedDevice.manufacturer` | API call succeeds |
| API model param | `selectedDevice.model` (undefined) | `selectedDevice.name` | API call succeeds |
| API type param | `selectedDevice.type` or `deviceType` | `selectedDevice.deviceType` | Consistent |

## Component State Flow

```
┌──────────────────────────────────────────────────────────────┐
│                   DeviceChangeDialog State                    │
└──────────────────────────────────────────────────────────────┘

Initial State:
  step: 'select'
  deviceSearchQuery: ""
  searchResults: []
  selectedDevice: null
  pricingChanges: null

After Search:
  searchResults: [SearchResult[], SearchResult[], ...]
  (Fixed: Now correctly populated from response.devices)

After Selection:
  selectedDevice: SearchResult
  (Fixed: Now uses correct manufacturer/name/deviceType fields)

After Recalculation:
  step: 'review'
  pricingChanges: PricingChangesSummary
  (Fixed: API now receives correct parameters)

After Confirmation:
  Dialog closes, onDeviceChanged callback fired
```

## API Contract

### Search Endpoint
```
GET /api/devices/search?q=query

Response: {
  success: boolean,
  devices: SearchResult[]
}

SearchResult: {
  _id: string,
  name: string,           // Model name: "Galaxy S24"
  deviceType: string,     // "Smartphone", "Tablet", etc.
  manufacturer: string,   // Brand: "Samsung", "Apple", etc.
  manufacturerId: string, // MongoDB ID of manufacturer
  displayName: string     // "Smartphone • Samsung • Galaxy S24"
}
```

### Change Device Endpoint
```
POST /api/admin/orders/:id/change-device

Request: {
  deviceBrand: string,     // e.g., "Samsung"
  deviceModel: string,     // e.g., "Galaxy S24"
  deviceType: string       // e.g., "Smartphone"
}

Response: {
  success: boolean,
  order: Order,
  pricingChangesSummary: PricingChangesSummary,
  requiresConfirmation: boolean
}
```

---

**All fixes validated**: ✅ TypeScript compilation successful
**Ready for integration testing**: YES
