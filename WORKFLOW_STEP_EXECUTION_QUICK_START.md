# Workflow Step Execution - Quick Start Guide

## ⚡ 5-Minute Setup

### 1. Prerequisites ✅
- Backend running at `http://localhost:3000`
- Frontend running at `http://localhost:5173`
- Logged in as admin (`admin@example.com` / `admin123`)

### 2. Navigate to Workflow ✅
```
Orders → Select Order → Scroll to Workflows Section
```

### 3. Start a Workflow ✅
- Click "Start" on any "Not Started" workflow
- Click "Confirm & Start" button
- Confirm in the dialog

### 4. Execute Steps ✅
- Workflow is now "In Progress"
- Click the workflow card to open modal
- Click "Execute Step" tab
- Fill in form fields and checklist items
- Click "Complete Step"
- Step is marked complete, advance to next

## 📝 Form Field Types

| Type | Usage | Example |
|------|-------|---------|
| **text** | Single line input | Name, Description |
| **textarea** | Multi-line input | Observations, Notes |
| **number** | Numeric value | Quantity, Cost |
| **date** | Date picker | Date of service |
| **time** | Time picker | Start time |
| **select** | Dropdown choice | Status, Category |
| **checkbox** | Boolean toggle | Agreed, Confirmed |
| **radio** | Single choice | Yes/No, Option A/B |
| **file** | File upload | Attach document |
| **multiselect** | Multiple choices | Select multiple items |

## ✨ Key Features

### ✅ Complete a Step
1. Fill all required fields (marked with *)
2. Check off checklist items
3. Add notes (optional)
4. Upload photos (optional)
5. Click "Complete Step"
6. Confirm in dialog
7. **Auto-advances to next step**

### ✅ Skip a Step
1. Click "Skip Step" button (if available)
2. Enter reason for skipping
3. Click "Skip Step"
4. Step marked as "skipped"
5. **Auto-advances to next step**

### ✅ Navigate Between Steps
- **Previous**: Go back one step (disabled on first)
- **Next**: Go forward one step (disabled on last)
- Step counter shows current position (e.g., "3/5")

### ✅ Track Progress
- Progress bar shows overall completion %
- Completed steps: Green ✓
- Current step: Blue ⟳
- Pending steps: Gray •

## 🎯 Common Tasks

### Add Notes
```
1. Scroll to "Additional Notes" section
2. Click textarea
3. Type observations
4. Notes auto-saved in memory
5. Included when step is completed
```

### Upload Photos
```
1. Scroll to "Upload Photos" section
2. Click to select or drag-drop images
3. Multiple files supported
4. Counter shows: "X photo(s) selected"
5. Photos included when step is completed
```

### Fill Form Fields
```
1. For Text/Textarea: Type in field
2. For Number: Enter numeric value (validates min/max)
3. For Date: Click to open date picker
4. For Time: Click to open time picker
5. For Select: Click dropdown, choose option
6. For Checkbox: Click to toggle on/off
```

### Check Checklist Items
```
1. Each item has checkbox
2. Click checkbox to toggle
3. Counter updates (e.g., "2/4 items")
4. No validation - all optional
5. Completion tracked automatically
```

## 🚨 Validation Errors

If you see an error:

| Error | Solution |
|-------|----------|
| "X is required" | Fill in the required field (marked with *) |
| "must be at least X" | Number or text too small, increase value/length |
| "must be at most X" | Number or text too large, decrease value/length |
| "at least X characters" | Text field too short, add more text |
| "at most X characters" | Text field too long, remove text |
| "API request failed" | Check backend is running, try again |

## 📊 Progress Tracking

### What Gets Tracked

✅ **Step Status**:
- `pending` → `in-progress` → `completed`/`skipped`

✅ **Form Data**:
- All form field values captured
- Associated with completed step

✅ **Checklist Progress**:
- Number of items checked
- Tracked per step

✅ **Overall Workflow**:
- Percentage complete (based on completed steps)
- Progress bar updates after each step

### View Timeline
- Look at "Order Progress Timeline" section
- Shows all workflow actions and timestamps
- Tracks who completed what and when

## 🎓 Workflow Modes

### 1. **View Mode** (Read-only)
```
Shows workflow details
Cannot execute steps
Use to preview workflow before starting
```

### 2. **Start Mode** (New workflow)
```
Opens before starting a workflow
Review all steps first
Confirm before workflow begins
```

### 3. **Execute Mode** (Active workflow) ⭐ **NEW**
```
Step-by-step execution interface
Fill forms, check checklists
Complete steps one by one
Auto-advance through workflow
```

### 4. **Resume Mode** (Paused workflow)
```
Opens when resuming paused workflow
Shows current progress
Resume from where you left off
```

## 🔄 Workflow Lifecycle

```
Not Started
     ↓ (Click "Start")
In Progress → [EXECUTE STEPS HERE] ← NEW FEATURE
     ├→ (Click "Pause")
     │  On Hold
     │  ├→ (Click "Resume")
     │  └→ Back to In Progress
     └→ (All steps completed)
        Completed
```

## 📱 Works On

✅ Desktop (1920px)
✅ Tablet (768px)
✅ Mobile (375px)
✅ All modern browsers (Chrome, Firefox, Safari, Edge)

## ⚙️ Troubleshooting

### Modal Won't Open
```
✓ Check workflow exists
✓ Check order has workflows assigned
✓ Refresh page and try again
✓ Check browser console for errors (F12)
```

### Step Won't Complete
```
✓ Fill all required fields (marked with *)
✓ Check for validation error toasts
✓ Verify internet connection
✓ Backend should be running
```

### Photos Won't Upload
```
✓ Check file is an image (jpg, png, etc.)
✓ Check file size is reasonable
✓ Try different image file
✓ Check browser console for errors
```

### Form Fields Not Showing
```
✓ Verify workflow has formFields property
✓ Refresh page
✓ Try different workflow
✓ Check backend workflow configuration
```

## 🎯 Next Steps

1. **Try It Now**: Login and start a workflow
2. **Test All Features**: Forms, checklists, notes, photos
3. **Report Issues**: Use browser console (F12) for error details
4. **Read Full Docs**: See WORKFLOW_STEP_EXECUTION_TESTING.md

## 📖 Documentation

| Document | Purpose |
|----------|---------|
| **QUICK_START.md** | This file - quick reference |
| **TESTING.md** | Detailed test scenarios |
| **IMPLEMENTATION.md** | Technical architecture |

## 💡 Pro Tips

### Tip 1: Save Time
```
Complete multiple workflows in sequence
Auto-advance makes workflow quick
Use keyboard: Tab to navigate, Enter to click
```

### Tip 2: Organize Notes
```
Use structured notes format:
- Issue: ...
- Resolution: ...
- Follow-up: ...
```

### Tip 3: Photo Documentation
```
Take photos from multiple angles
Capture before/after states
Include measurement references
```

### Tip 4: Checklist Usage
```
Check items as you complete them
Helps track progress visually
Ensures nothing is missed
```

### Tip 5: Skip Responsibly
```
Only skip when absolutely necessary
Always document skip reason
Follow up on skipped steps
```

## ✅ Workflow Best Practices

### ✓ DO
- Fill required fields completely
- Review step details before completing
- Add helpful notes for future reference
- Take photos of important steps
- Complete steps in order

### ✗ DON'T
- Skip required fields
- Skip steps unnecessarily
- Rush through steps
- Ignore validation errors
- Close modal without saving

## 🔗 Quick Links

- **Backend API**: http://localhost:3000
- **Frontend App**: http://localhost:5173
- **Admin Dashboard**: http://localhost:5173/admin
- **Orders Page**: http://localhost:5173/orders

## 📞 Need Help?

1. **Check Console**: F12 → Console tab for errors
2. **Check Network**: F12 → Network tab for API calls
3. **Refresh**: Try refreshing page
4. **Restart**: Try logging out and back in
5. **Read Docs**: Check WORKFLOW_STEP_EXECUTION_TESTING.md

---

**Ready to start?** 🚀

1. Login to http://localhost:5173
2. Go to Orders
3. Select an order with workflows
4. Click "Start" on a workflow
5. Click "Execute Step" to begin

**Happy workflow execution!** ✨
