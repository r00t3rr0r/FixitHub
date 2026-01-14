# Workflow Form Elements - Visual Guide

## What You Should See After the Fix

### Radio Button Display

**Before Fix:**
```
[Form Section - Appears Empty]
Art des Display-Problems is required
```

**After Fix:**
```
Form Information

Art des Display-Problems *
●  Risse/Bruch
○  Tote Pixel
○  Farbprobleme
○  Touch nicht reagierend
○  Helligkeit-Probleme

[Complete Step]  [Skip Step]
```

**Visual Elements:**
- ● = Selected radio button (filled circle)
- ○ = Unselected radio button (empty circle)
- Proper vertical spacing between options
- Labels clearly readable to right of circles

---

### Multi-Select Checkbox Display

**Before Fix:**
```
[Form Section - Appears Empty]
Beschädigte Komponenten
```

**After Fix:**
```
Form Information

Beschädigte Komponenten
☑ Batterie
☐ Hauptplatine
☑ Display
☐ Anschlüsse
☐ Lautsprecher
☐ Mikrofon
☐ Sonstige

[Complete Step]  [Skip Step]
```

**Visual Elements:**
- ☑ = Selected checkbox (checkmark visible)
- ☐ = Unselected checkbox (empty)
- Proper vertical spacing between options
- Labels clearly readable to right of boxes

---

### File Upload Display

**Before Fix:**
```
[Form Section - Appears Empty]
Upload Photos
```

**After Fix:**
```
Form Information

Upload Photos
┌─────────────────────────────────────┐
│  📁 Click to upload photos or       │
│     drag and drop                   │
└─────────────────────────────────────┘

Selected Files:
• document.pdf [×]
• image.jpg [×]
• report.docx [×]

[Complete Step]  [Skip Step]
```

**Visual Elements:**
- Dashed border indicating drop zone
- Upload icon with clear instruction text
- Selected files listed with clickable remove button (×)
- File names clearly visible

---

## Workflow Step Layout (Complete View)

```
┌─────────────────────────────────────────────────────────────────┐
│ Step 1: Display-Diagnose                            [IN-PROGRESS]│
│ Diagnostizieren Sie den Display-Fehler...                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│ Workflow Progress: ████████░░░░░░░░ 2/3 steps                   │
│ Estimated time: 15 minutes                                      │
│                                                                  │
│ Checklist Items (1/4)                                           │
│ ☑ Überprüfen Sie auf Risse oder Bruchstellen                   │
│ ☐ Testen Sie die Touch-Empfindlichkeit                          │
│ ☐ Überprüfen Sie auf tote Pixel                                 │
│ ☐ Testen Sie die Farbwiedergabe                                 │
│                                                                  │
│ Form Information                                                │
│                                                                  │
│ Art des Display-Problems *                                      │
│ ○  Risse/Bruch                                                  │
│ ●  Tote Pixel          ← Selected Option                        │
│ ○  Farbprobleme                                                 │
│ ○  Touch nicht reagierend                                       │
│ ○  Helligkeit-Probleme                                          │
│                                                                  │
│ Additional Notes                                                │
│ [________________ large text area __________________]           │
│ Add any notes or observations...                                │
│                                                                  │
│ Upload Photos                                                   │
│ ┌─────────────────────────────────────┐                         │
│ │  📁 Click to upload photos or       │                         │
│ │     drag and drop                   │                         │
│ └─────────────────────────────────────┘                         │
│                                                                  │
│ [◄ Previous] Step 1/3 [Next ►]                                 │
│                                                                  │
│ [Complete Step 1]  [Skip Step]                                 │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Form Element Interactions

### Radio Button Interaction Flow

**User Clicks Option:**
```
Before Click:                After Click:
○ Option A                   ● Option A (Selected)
○ Option B                   ○ Option B
○ Option C                   ○ Option C

User Clicks Different Option:
● Option A                   ○ Option A
○ Option B                   ● Option B (Selected)
○ Option C                   ○ Option C
```

**Visual Feedback:**
- Circular indicator fills when selected
- Unfilled circle when not selected
- Cursor changes to pointer on hover
- Label becomes slightly highlighted

---

### Multi-Select Interaction Flow

**User Clicks Items:**
```
Before Selections:        After Clicking Items:
☐ Item 1                 ☑ Item 1 (Selected)
☐ Item 2                 ☐ Item 2
☐ Item 3                 ☑ Item 3 (Selected)
☐ Item 4                 ☐ Item 4

User Unselects Item 1:
☐ Item 1                 ☑ Item 2 (Still Selected)
☑ Item 2                 ☑ Item 3 (Still Selected)
☑ Item 3                 ☐ Item 4
☐ Item 4
```

**Visual Feedback:**
- Checkmark appears when selected
- Checkmark disappears when unselected
- Multiple items can be selected simultaneously
- Selection order maintained

---

### File Upload Interaction Flow

**Initial State:**
```
Upload Photos
┌─────────────────────────────────────┐
│  📁 Click to upload photos or       │
│     drag and drop                   │
└─────────────────────────────────────┘
```

**After First File Selected:**
```
Upload Photos
┌─────────────────────────────────────┐
│  📁 Click to upload photos or       │
│     drag and drop                   │
└─────────────────────────────────────┘
Selected: 1 file
• image.jpg [×]
```

**After Multiple Files Selected:**
```
Upload Photos
┌─────────────────────────────────────┐
│  📁 Click to upload photos or       │
│     drag and drop                   │
└─────────────────────────────────────┘
• document.pdf [×]
• image.jpg [×]
• report.docx [×]
```

**After Removing File (Click × button):**
```
Upload Photos
┌─────────────────────────────────────┐
│  📁 Click to upload photos or       │
│     drag and drop                   │
└─────────────────────────────────────┘
• image.jpg [×]
• report.docx [×]
```

---

## Color and Styling Guide

### Radio Buttons
- **Unselected**: Empty circle, dark gray border (3px)
- **Selected**: Filled circle (primary color), darker border
- **Hover**: Slight background highlight, cursor changes
- **Disabled**: Grayed out, cursor "not-allowed"
- **Focus**: Blue ring around element (for keyboard)

### Checkboxes
- **Unselected**: Empty box, dark gray border (3px)
- **Selected**: Filled box with checkmark (primary color), darker border
- **Hover**: Slight background highlight, cursor changes
- **Disabled**: Grayed out, cursor "not-allowed"
- **Focus**: Blue ring around element (for keyboard)

### File Upload Area
- **Border**: 2px dashed line (light gray #e5e7eb)
- **Background**: Light blue/gray (#f9fafb)
- **Icon**: Medium gray (#9ca3af)
- **Text**: Medium gray (#6b7280)
- **Padding**: 12px (0.75rem)
- **Border Radius**: 8px

### Selected Files List
- **Background**: Very light gray (#f3f4f6)
- **Border**: 1px solid (#e5e7eb)
- **Padding**: 8px
- **Margin**: 4px bottom
- **Border Radius**: 6px
- **File Name**: Gray text (#374151)
- **Remove Button**: Red on hover (#ef4444)

---

## Typography

### Field Labels
- **Font Weight**: Medium (500)
- **Font Size**: 14px (0.875rem)
- **Color**: Dark gray/black (#111827)
- **Margin Bottom**: 8px

### Option Labels (Radio/Checkbox)
- **Font Weight**: Medium (500)
- **Font Size**: 14px
- **Color**: Dark gray/black (#111827)
- **Margin Left**: 8px

### Help Text
- **Font Weight**: Normal (400)
- **Font Size**: 12px (0.75rem)
- **Color**: Medium gray (#6b7280)
- **Margin Top**: 4px

### Error Messages
- **Type**: Toast notification
- **Background**: Light red (#fee2e2)
- **Text Color**: Dark red (#dc2626)
- **Font Weight**: Medium (500)
- **Duration**: 4 seconds auto-dismiss

---

## Spacing Guide

### Vertical Spacing (Radio/Checkbox Options)
```
Item 1: ○ Label One
        ↓ 8px space
Item 2: ○ Label Two
        ↓ 8px space
Item 3: ○ Label Three
```

### Horizontal Spacing
```
○  [8px gap]  Label Text
↑           ↑
16px
(circle size)
```

### Form Section Spacing
```
Form Information
[16px gap]
Art des Display-Problems *
[12px gap]
[Form elements with 8px vertical spacing]
[12px gap]
Upload Photos
[12px gap]
[Upload area]
```

---

## Responsive Breakpoints

### Desktop (1024px and above)
- Form sections in single column
- Radio/checkbox options fully visible
- Upload area full width (with padding)
- All controls at normal size

### Tablet (768px - 1023px)
- Form sections in single column
- Slight padding adjustments
- Upload area responsive width
- Touch targets remain 44px minimum

### Mobile (375px - 767px)
- Single column layout maintained
- Padding reduced to 12px
- Upload area full width with margins
- Touch targets 44px minimum
- Text size remains readable (14px minimum)

---

## Accessibility Features Visual

### Keyboard Focus Indicator
```
When tabbing through form with keyboard:

Before Focus:                After Focus (Tab key):
○ Option 1                   [●] Option 1 ← Blue ring around
○ Option 2                   ○ Option 2
○ Option 3                   ○ Option 3
```

### Required Field Indicator
```
Art des Display-Problems *
                        ↑
                   Red asterisk (*)
              indicates required field
```

### Disabled State
```
Enabled:                    Disabled:
[●] Selected Option         [●] Selected Option (Grayed)

Cursor: pointer             Cursor: not-allowed
```

---

## Error States and Messages

### Validation Error - Toast Notification
```
┌──────────────────────────────────┐
│ ⚠ Validation Error               │
├──────────────────────────────────┤
│ Art des Display-Problems         │
│ is required                      │
│                                  │
│ [×] Close                        │
└──────────────────────────────────┘
```

### Multiselect Validation Error
```
┌──────────────────────────────────┐
│ ⚠ Validation Error               │
├──────────────────────────────────┤
│ Please select at least one       │
│ option for Beschädigte           │
│ Komponenten                      │
│                                  │
│ [×] Close                        │
└──────────────────────────────────┘
```

---

## Success and Loading States

### Form Submission (Loading)
```
[Complete Step 1]  ← Normal button
      ↓
[Completing...] ← Shows loading text
All form fields disabled (grayed out)
Cursor: wait
```

### Step Completion Success
```
┌──────────────────────────────────┐
│ ✓ Success                        │
├──────────────────────────────────┤
│ Step "Display-Diagnose"          │
│ completed successfully           │
│                                  │
│ [×] Close                        │
└──────────────────────────────────┘

Auto-navigates to next step...
```

### Completed Step Display
```
Step Status Badge: [✓ Completed]
                   (Green checkmark)

Status indicates:
"✓ Completed" ← Green background (#dcfce7)
                Dark green text (#166534)
```

---

## Comparison: Before vs After

### Before (Issue)
```
┌─────────────────────────────────┐
│ Art des Display-Problems *      │
│                                 │
│ [Nothing visible - Form broken] │
│                                 │
│ Beschädigte Komponenten         │
│ [Nothing visible - Form broken] │
│                                 │
│ Upload Photos                   │
│ [Nothing visible - Form broken] │
└─────────────────────────────────┘
```

### After (Fixed)
```
┌─────────────────────────────────┐
│ Art des Display-Problems *      │
│ ○ Risse/Bruch                   │
│ ● Tote Pixel ← Selected          │
│ ○ Farbprobleme                  │
│                                 │
│ Beschädigte Komponenten         │
│ ☑ Batterie ← Selected            │
│ ☐ Hauptplatine                  │
│ ☑ Display ← Selected             │
│                                 │
│ Upload Photos                   │
│ ┌─────────────────────┐         │
│ │ 📁 Upload or Drag   │         │
│ └─────────────────────┘         │
│ • image.jpg [×]                 │
│ • photo.png [×]                 │
└─────────────────────────────────┘
```

---

## Summary of Visual Changes

✅ **Radio Buttons**
- Now clearly visible
- Filled circle for selected
- Empty circle for unselected
- Vertical spacing between options

✅ **Multi-Select**
- Now clearly visible
- Checkmark for selected
- Empty for unselected
- Independent selections maintained

✅ **File Upload**
- Now clearly visible
- Dashed border drop zone
- File list with remove buttons
- Clear visual feedback

✅ **Overall Workflow**
- Complete form display
- All elements functional
- Clear visual hierarchy
- Professional appearance

---

**All visual elements are now properly displayed and functional!**
