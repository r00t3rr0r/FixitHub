# Device Inspection Section - UI Layout Guide

## OrderDetails Page Structure

```
┌─────────────────────────────────────────────────────────────────────┐
│  [← Back to Orders]                                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  📦 Order #12345                           [Status Badge] [Payment] │
│  iPhone 12 • Created 2024-01-15                      $299.99 Total   │
│                                                                       │
├──────────────────────────────────────────┬──────────────────────────┤
│  MAIN CONTENT (lg:col-span-2)            │  SIDEBAR (lg:col-span-1) │
│                                          │                          │
│  ┌─ Customer Information ────────────┐   │  ┌─ Order Summary ────┐ │
│  │ Avatar | Name, Email, Phone, Addr │   │  │ Services, Add-ons  │ │
│  └────────────────────────────────────┘   │  │ Total, Payment Sts │ │
│                                          │  └────────────────────┘ │
│  ┌─ Add-On Services ─────────────────┐   │                        │
│  │ Service 1: $X (Status)             │   │  ┌─ Order Status ────┐ │
│  │ Service 2: $X (Status)             │   │  │ - Order Received   │ │
│  │ [+ Add Add-On]                     │   │  │ - Diagnostic...    │ │
│  └────────────────────────────────────┘   │  │ - Repair...        │ │
│                                          │  │ - Quality Check    │ │
│  ┌─ Electronic Parts ────────────────┐   │  │ - Ready for...     │ │
│  │ Part 1: SKU#123 (Status)           │   │  └────────────────────┘ │
│  │ Part 2: SKU#456 (Status)           │   │                        │
│  │ [+ Add EPart]                      │   │  ┌─ Team Members ────┐ │
│  └────────────────────────────────────┘   │  │ - Tech 1           │ │
│                                          │  │ - Tech 2           │ │
│  ┌─ Workflows ───────────────────────┐   │  │ [+ Assign Staff]   │ │
│  │ Workflow Name                      │   │  └────────────────────┘ │
│  │ ├─ Step 1: [=====>    ]            │   │                        │
│  │ └─ Step 2: [          ]            │   │  ┌─ Messages ────────┐ │
│  │ [+ Assign Workflow]                │   │  │ Chat history...    │ │
│  └────────────────────────────────────┘   │  │ [Input message]    │ │
│                                          │  └────────────────────┘ │
│  ┌─ Repair Progress ─────────────────┐   │                        │
│  │ Overall Progress: 65%  [========] │   │                        │
│  │ Estimated: 2024-01-20             │   │                        │
│  │ Timeline:                          │   │                        │
│  │ ✓ Order Received                   │   │                        │
│  │ ✓ Diagnostic Assessment            │   │                        │
│  │ ⊙ Repair in Progress               │   │                        │
│  │ ○ Quality Check                    │   │                        │
│  │ ○ Ready for Pickup                 │   │                        │
│  └────────────────────────────────────┘   │                        │
│                                          │                        │
│  ┌─ Device Inspection ───────────────┐   │  ← NEW SECTION        │
│  │ 📄 Device Inspection Report        │   │                       │
│  │ Status: [Completed] [Failed Tests] │   │                       │
│  │ Completed on 2024-01-18            │   │                       │
│  │                                    │   │                       │
│  │ ├─ Model Verification ────────────┐│   │                       │
│  │ │ 📱 Model Verification           ││   │                       │
│  │ │ Reported: iPhone 12             ││   │                       │
│  │ │ Actual: iPhone 12               ││   │                       │
│  │ │ Status: ✓ Correct               ││   │                       │
│  │ └─────────────────────────────────┘│   │                       │
│  │                                    │   │                       │
│  │ ├─ Device Identification ─────────┐│   │                       │
│  │ │ 📱 Device Identification        ││   │                       │
│  │ │ Device Type: Smartphone         ││   │                       │
│  │ │ IMEI: 351234567890123           ││   │                       │
│  │ └─────────────────────────────────┘│   │                       │
│  │                                    │   │                       │
│  │ ├─ Accessories & Packaging ───────┐│   │                       │
│  │ │ 📦 Accessories & Packaging      ││   │                       │
│  │ │ Original Packaging: ✓ Present   ││   │                       │
│  │ │ Case/Cover: ✓ Present           ││   │                       │
│  │ │ Power Adapter: ✓ Present        ││   │                       │
│  │ └─────────────────────────────────┘│   │                       │
│  │                                    │   │                       │
│  │ ├─ External Inspection ───────────┐│   │                       │
│  │ │ 👁 External Inspection          ││   │                       │
│  │ │ Display: ✓ OK                   ││   │                       │
│  │ │ Frame: ✓ OK                     ││   │                       │
│  │ │ Back Cover: ✓ OK                ││   │                       │
│  │ │ Buttons: ✓ OK                   ││   │                       │
│  │ └─────────────────────────────────┘│   │                       │
│  │                                    │   │                       │
│  │ ├─ Device Testing ────────────────┐│   │                       │
│  │ │ ⚡ Device Testing               ││   │                       │
│  │ │ Charging: ✓ OK                  ││   │                       │
│  │ │ Power: ✓ OK                     ││   │                       │
│  │ │ Wi-Fi: ✓ OK                     ││   │                       │
│  │ │ Front Camera: ✓ OK              ││   │                       │
│  │ │ Main Camera: ✓ OK               ││   │                       │
│  │ └─────────────────────────────────┘│   │                       │
│  │                                    │   │                       │
│  │ ├─ Apple-Specific Checks ────────┐│   │                       │
│  │ │ 🍎 Apple-Specific Checks       ││   │                       │
│  │ │ Modem Firmware: ✓ Present       ││   │                       │
│  │ │ Face ID: ✓ Working              ││   │                       │
│  │ └─────────────────────────────────┘│   │                       │
│  │                                    │   │                       │
│  │ ├─ Repair Assessment ─────────────┐│   │                       │
│  │ │ Repairable: ✓ Yes               ││   │                       │
│  │ │ Estimated Cost: $299            ││   │                       │
│  │ │ Timeframe: 3-5 days             ││   │                       │
│  │ │ Description: Screen replacement ││   │                       │
│  │ └─────────────────────────────────┘│   │                       │
│  │                                    │   │                       │
│  │ ├─ Action Timeline ───────────────┐│   │                       │
│  │ │ 🕐 Action Timeline (Last 5)     ││   │                       │
│  │ │ ✓ Model verification updated    ││   │                       │
│  │ │   2024-01-18 14:23:45            ││   │                       │
│  │ │ ✓ Device test updated           ││   │                       │
│  │ │   2024-01-18 14:20:12            ││   │                       │
│  │ │ ✓ Inspection completed          ││   │                       │
│  │ │   2024-01-18 14:15:00            ││   │                       │
│  │ └─────────────────────────────────┘│   │                       │
│  │                                    │   │                       │
│  │ [📥 Download Inspection Report]    │   │                       │
│  └────────────────────────────────────┘   │                       │
│                                          │                        │
└──────────────────────────────────────────┴──────────────────────────┘
```

## No Inspection Yet State

```
┌─────────────────────────────────────────┐
│ 📄 Device Inspection                    │ (Dashed border)
│ No inspection has been completed yet    │
│ for this device                         │
│                                         │
│      [→ Start Device Inspection]        │
└─────────────────────────────────────────┘
```

## With Inspection Results State

```
┌─────────────────────────────────────────────────────────────────┐
│ 📄 Device Inspection Report      [Completed] [Failed Tests]     │
│ Completed on January 18, 2024                                   │
│                                                                 │
│ ├─ Model Verification ────────────────────────────────────────┐ │
│ │ 📱 Model Verification                                       │ │
│ │ Reported Model: iPhone 12                                   │ │
│ │ Actual Model: iPhone 12                                     │ │
│ │ Status: ✓ Correct - Model matches                           │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ├─ Device Identification ─────────────────────────────────────┐ │
│ │ 📱 Device Identification                                    │ │
│ │ Device Type: Smartphone                                     │ │
│ │ IMEI: 351234567890123                                       │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ├─ Accessories & Packaging ───────────────────────────────────┐ │
│ │ 📦 Accessories & Packaging                                  │ │
│ │ Original Packaging: ✓ Present                               │ │
│ │ Case/Cover: ✓ Present                                       │ │
│ │ Power Adapter: ✓ Present                                    │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ├─ External Inspection ───────────────────────────────────────┐ │
│ │ 👁 External Inspection                                      │ │
│ │ Display: ✓ OK - Screen in good condition                    │ │
│ │ Frame: ✓ OK - No frame damage                               │ │
│ │ Back Cover: ✓ OK - Back glass intact                        │ │
│ │ Buttons: ✓ OK - All buttons responsive                      │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ├─ Device Testing ────────────────────────────────────────────┐ │
│ │ ⚡ Device Testing                                           │ │
│ │ Charging: ✓ OK - Charges normally                           │ │
│ │ Power: ✓ OK - Powers on and off                             │ │
│ │ Wi-Fi: ✓ OK - Wi-Fi connects                                │ │
│ │ Front Camera: ✓ OK - Front camera functional                │ │
│ │ Main Camera: ✓ OK - Main camera functional                  │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ├─ Apple-Specific Checks ────────────────────────────────────┐ │
│ │ 🍎 Apple-Specific Checks                                   │ │
│ │ Modem Firmware: ✓ Present - Modem firmware present          │ │
│ │ Touch ID / Face ID: ✓ Working - Face ID working             │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ├─ Repair Assessment ─────────────────────────────────────────┐ │
│ │ Repairable: ✓ Yes                                           │ │
│ │ Estimated Cost: $299                                        │ │
│ │ Timeframe: 3-5 days                                         │ │
│ │ Description: Screen replacement and battery service         │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ├─ Action Timeline ──────────────────────────────────────────┐ │
│ │ 🕐 Action Timeline (Last 5 Actions)                         │ │
│ │                                                              │ │
│ │ ✓ Model verification updated         success               │ │
│ │   Jan 18, 2024, 14:23:45                                    │ │
│ │                                                              │ │
│ │ ✓ Device test updated. Failed tests: 0  success           │ │
│ │   Jan 18, 2024, 14:20:12                                    │ │
│ │                                                              │ │
│ │ ✓ Inspection completed: 507f1f77bcf86cd799439011  success │ │
│ │   Jan 18, 2024, 14:15:00                                    │ │
│ │                                                              │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│   [📥 Download Inspection Report (PDF)]                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Color Scheme Reference

| Section | Color | Hex Code |
|---------|-------|----------|
| Model Verification | Blue | #3b82f6 |
| Device Identification | Purple | #a855f7 |
| Accessories | Cyan | #06b6d4 |
| External Inspection | Orange | #f97316 |
| Device Testing | Green | #22c55e |
| Apple-Specific | Gray | #6b7280 |
| Repair Assessment (Repairable) | Green | #22c55e |
| Repair Assessment (Not Repairable) | Red | #ef4444 |

## Component Hierarchy

```
OrderDetails
├── Header (Back button, Order info)
├── Grid Layout (lg:grid-cols-3)
│   ├── Main Content (lg:col-span-2)
│   │   ├── Customer Information Card
│   │   ├── Add-On Services Card
│   │   ├── Electronic Parts Card (admin/staff only)
│   │   ├── Workflows Section
│   │   ├── Repair Progress Card
│   │   └── **Device Inspection Section** (NEW - admin/staff only)
│   │       └── InspectionResultsDisplay Component
│   │           ├── Loading State
│   │           ├── No Inspection State
│   │           └── Inspection Results State
│   │               ├── Model Verification Section
│   │               ├── Device Identification Section
│   │               ├── Accessories Section
│   │               ├── External Inspection Section
│   │               ├── Device Testing Section
│   │               ├── Apple-Specific Section
│   │               ├── Repair Assessment Section
│   │               ├── Action Timeline Section
│   │               └── Download Report Button
│   └── Sidebar (lg:col-span-1)
│       ├── Order Summary Card
│       ├── Order Status Card
│       ├── Team Members Card
│       └── Messages Card
```

## Responsive Behavior

### Desktop (lg screens, 1024px+)
- Main content and sidebar side-by-side
- Full-width inspection section in main content
- All inspection details visible

### Tablet (md screens, 768px+)
- Main content still takes majority width
- Sidebar below main content on smaller tablets
- Inspection section wraps properly

### Mobile (sm screens, 640px-)
- Full-width layout
- Inspection section adapts to narrow screens
- Color-coded sections maintain readability
- All buttons and controls accessible

## Accessibility Features

- ✅ Semantic HTML structure
- ✅ Color-coded sections with text labels (not color-only)
- ✅ Icons accompanied by text descriptions
- ✅ Proper heading hierarchy
- ✅ Button states (hover, focus, disabled)
- ✅ Loading states with spinner
- ✅ Error messages and tooltips
- ✅ Keyboard navigation support

## Interactions

### User Actions:

1. **View Inspection** - Automatically loads when order details open
2. **Start Inspection** - Click button → Navigate to inspection workflow
3. **Download Report** - Click button → PDF downloads to computer
4. **View Details** - Expand sections to see more information
5. **Return to Order** - Back button or browser back navigation

### System Actions:

1. **Auto-load** - Component fetches inspection data on mount
2. **Error Handling** - Gracefully handles missing inspections
3. **Status Updates** - Real-time status badge updates
4. **Report Generation** - Async PDF generation with loading state

## Testing Scenarios

### Scenario 1: No Inspection Exists
- Show: Dashed border card with "Start Device Inspection" button
- Action: Click button → Navigate to `/inspection/{orderId}`

### Scenario 2: Inspection In Progress
- Show: Status badge "In Progress" (blue)
- Show: Completed steps with results
- Show: Incomplete steps as placeholders

### Scenario 3: Inspection Completed Successfully
- Show: Status badge "Completed" (green)
- Show: All 6 inspection sections with results
- Show: Green checkmarks for passing tests
- Show: Repair assessment with cost

### Scenario 4: Inspection with Failed Tests
- Show: Status badge "Failed Tests" (red)
- Show: Red warning box in Device Testing section
- Show: List of failed tests with reasons

### Scenario 5: Customer Viewing Order
- Show: Order details without inspection section
- Note: Section is hidden via role-based access control

---

This layout guide provides a visual representation of how the Device Inspection section integrates into the Order Details page and how information is organized and displayed to users.
