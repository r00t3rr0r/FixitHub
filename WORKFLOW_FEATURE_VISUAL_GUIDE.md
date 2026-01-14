# Workflow Start/Resume/Pause Feature - Visual Guide

## Feature Overview Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    ORDER DETAILS PAGE                            │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │               WORKFLOWS SECTION                             │ │
│  │  (Visible to Admin/Staff users only)                       │ │
│  │                                                             │ │
│  │  ┌─────────────────────┐  ┌─────────────────────┐         │ │
│  │  │  WORKFLOW CARD 1    │  │  WORKFLOW CARD 2    │         │ │
│  │  ├─────────────────────┤  ├─────────────────────┤         │ │
│  │  │ Repair Process      │  │ Quality Check       │         │ │
│  │  │ Status: Not Started │  │ Status: In Progress │         │ │
│  │  │                     │  │                     │         │ │
│  │  │ ░░░░░░░░░░░ 0%     │  │ ▓▓▓▓▓░░░░░░ 50%    │         │ │
│  │  │ 0/5 steps completed │  │ 3/6 steps completed │         │ │
│  │  │                     │  │                     │         │ │
│  │  │ [Start] [Delete]    │  │ [Pause] [Delete]    │         │ │
│  │  └─────────────────────┘  └─────────────────────┘         │ │
│  │                                                             │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Workflow Execution Modal

### Start Workflow Modal
```
┌──────────────────────────────────────────────────────────────────┐
│  Repair Process - Ready to Start          [✕ Close]              │
├──────────────────────────────────────────────────────────────────┤
│ 5 steps • 45 minutes estimated                                   │
│                                                                  │
│ Overall Progress                                                 │
│ ▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░░░ 20%                           │
│                                                                  │
│ ┌──────────────────────────────────────────────────────────────┐ │
│ │ ◉ Step 1: Diagnostic Assessment                              │ │
│ │   Perform initial device inspection. Check for physical      │ │
│ │   damage, test all functions, and document findings.         │ │
│ │                                                               │ │
│ │   Status: In Progress (Blue Badge)                           │ │
│ │   ⏱️  15 minutes                                               │ │
│ └──────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ All Steps:                                                       │
│ ▼ (Scrollable list)                                             │
│ ◉ Step 1: Diagnostic Assessment                                │
│ ○ Step 2: Parts Assessment                                     │
│ ○ Step 3: Repair Execution                                     │
│ ○ Step 4: Quality Check                                        │
│ ○ Step 5: Final Inspection                                     │
│ △ (Scroll indicator)                                            │
│                                                                  │
│ Important Guidelines:                                           │
│ ⚠️  • Follow each step in order for best results                │
│   • Take time to review step details before proceeding         │
│   • You can pause the workflow at any time if needed           │
│   • Don't skip steps unless absolutely necessary               │
│   • Document any issues or notes for quality assurance         │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│ [Cancel]  [◄]  1 / 5  [►]  [Confirm & Start >>]                │
└──────────────────────────────────────────────────────────────────┘
```

### Resume Workflow Modal
```
┌──────────────────────────────────────────────────────────────────┐
│  Repair Process - Ready to Resume         [✕ Close]              │
├──────────────────────────────────────────────────────────────────┤
│ 5 steps • 45 minutes estimated                                   │
│                                                                  │
│ Overall Progress                                                 │
│ ▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░░ 20%                           │
│                                                                  │
│ ┌──────────────────────────────────────────────────────────────┐ │
│ │ ◉ Step 2: Parts Assessment                                   │ │
│ │   (Currently paused at this step)                            │ │
│ │                                                               │ │
│ │   Assess which parts need replacement based on diagnostics. │ │
│ │   Identify required components and check inventory.          │ │
│ │                                                               │ │
│ │   Status: In Progress (Blue Badge)                           │ │
│ │   ⏱️  20 minutes                                               │ │
│ └──────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ All Steps:                                                       │
│ ✓ Step 1: Diagnostic Assessment                                │
│ ◉ Step 2: Parts Assessment                                     │
│ ○ Step 3: Repair Execution                                     │
│ ○ Step 4: Quality Check                                        │
│ ○ Step 5: Final Inspection                                     │
│                                                                  │
│ Important Guidelines:                                           │
│ ⚠️  • Follow each step in order for best results                │
│   • Take time to review step details before proceeding         │
│   • You can pause the workflow at any time if needed           │
│   • Don't skip steps unless absolutely necessary               │
│   • Document any issues or notes for quality assurance         │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│ [Cancel]  [◄]  2 / 5  [►]  [Confirm & Resume >>]               │
└──────────────────────────────────────────────────────────────────┘
```

---

## Confirmation Dialogs

### Start Confirmation
```
┌────────────────────────────────────────┐
│ Start Workflow?                         │
├────────────────────────────────────────┤
│ You are about to start "Repair         │
│ Process". This workflow has 5 steps    │
│ and should take approximately 45       │
│ minutes.                               │
│                                        │
├────────────────────────────────────────┤
│           [Cancel]  [Start Workflow]   │
└────────────────────────────────────────┘
```

### Pause Confirmation (Implicit)
```
When clicking Pause:
- No dialog shown
- Immediately sets to "On Hold"
- Toast: "Workflow paused successfully"
- Button changes to "Resume"
```

### Resume Confirmation
```
┌────────────────────────────────────────┐
│ Resume Workflow?                        │
├────────────────────────────────────────┤
│ You are about to resume "Repair        │
│ Process". The workflow will continue   │
│ from where it was paused.              │
│                                        │
├────────────────────────────────────────┤
│          [Cancel]  [Resume Workflow]   │
└────────────────────────────────────────┘
```

---

## Workflow Status Transitions

```
┌─────────────────────────────────────────────────────────────┐
│                   WORKFLOW STATES                            │
└─────────────────────────────────────────────────────────────┘

                    ┌───────────────────┐
                    │  NOT STARTED      │
                    │  (Gray Badge)     │
                    │  ░░░░░░░░░ 0%    │
                    └────────┬──────────┘
                             │
                      [User clicks Start]
                             │
                             ▼
        ┌──────────────────────────────────────┐
        │     CONFIRMATION DIALOG              │
        │   [Cancel]  [Start Workflow]        │
        └────────────────────┬─────────────────┘
                             │
              [User confirms start]
                             │
                             ▼
                    ┌───────────────────┐
                    │  IN PROGRESS      │
                    │  (Blue Badge)     │
                    │  ▓▓▓▓░░░░░ ~50%  │
                    └────────┬──────────┘
                       ┌─────┴─────┐
                       │           │
            [User clicks Pause] [Automatic on
                       │        completion]
                       │           │
                       ▼           ▼
            ┌──────────────────┐ ┌──────────────┐
            │   ON HOLD        │ │  COMPLETED   │
            │ (Yellow Badge)   │ │ (Green Badge)│
            │ ▓▓▓░░░░░ ~30%   │ │ ▓▓▓▓▓ 100%  │
            └────────┬─────────┘ └──────────────┘
                     │
            [User clicks Resume]
                     │
                     ▼
        ┌──────────────────────────────────────┐
        │     CONFIRMATION DIALOG              │
        │  [Cancel]  [Resume Workflow]        │
        └────────────────────┬─────────────────┘
                             │
             [User confirms resume]
                             │
                             ▼
                    ┌───────────────────┐
                    │  IN PROGRESS      │
                    │  (Blue Badge)     │
                    │  ▓▓▓▓░░░░░ ~50%  │
                    └───────────────────┘
```

---

## User Interaction Flow

### Starting a Workflow

```
Step 1: User sees Workflow Card
┌──────────────────────┐
│ Repair Process       │
│ Status: Not Started  │
│ ░░░░░░░░░░░ 0%      │
│                      │
│ [Start]   [Delete]   │
└──────────────────────┘
         │
         │ User clicks [Start]
         ▼
Step 2: Modal Opens
- Shows workflow overview
- Lists all steps
- Displays guidelines
- User reviews content
         │
         │ User clicks [Confirm & Start]
         ▼
Step 3: Confirmation Dialog
- Confirms workflow name
- Shows number of steps
- Displays time estimate
- User clicks [Start Workflow]
         │
         │ API Call: POST /api/admin/orders/:id/workflows/:id/start
         ▼
Step 4: Processing
- Button shows "Starting..." with spinner
- Buttons disabled during action
- No user interaction allowed
         │
         │ Server responds with success
         ▼
Step 5: Update Complete
- Modal closes automatically
- Toast shows: "Workflow started successfully"
- Workflow card updates:
  * Status changes to "In Progress"
  * Badge turns blue
  * Progress bar updates
  * [Start] button changes to [Pause]
  * Timeline entry created
```

### Pausing a Workflow

```
Step 1: User sees In-Progress Workflow
┌──────────────────────┐
│ Repair Process       │
│ Status: In Progress  │
│ ▓▓▓░░░░░░░░ 30%     │
│                      │
│ [Pause]   [Delete]   │
└──────────────────────┘
         │
         │ User clicks [Pause]
         ▼
Step 2: Processing (Instant)
- Button shows "Pausing..." with spinner
- Buttons disabled during action
         │
         │ API Call: PUT /api/admin/orders/:id/workflows/:id/status
         ▼
Step 3: Update Complete
- No modal shown (direct update)
- Toast shows: "Workflow paused successfully"
- Workflow card updates:
  * Status changes to "On Hold"
  * Badge turns yellow
  * Progress preserved
  * [Pause] button changes to [Resume]
  * Timeline entry created
```

### Resuming a Workflow

```
Step 1: User sees Paused Workflow
┌──────────────────────┐
│ Repair Process       │
│ Status: On Hold      │
│ ▓▓▓░░░░░░░░ 30%     │
│                      │
│ [Resume]  [Delete]   │
└──────────────────────┘
         │
         │ User clicks [Resume]
         ▼
Step 2: Modal Opens (Resume Mode)
- Shows workflow overview
- Shows current progress (30%)
- Shows where it was paused
- User reviews content
         │
         │ User clicks [Confirm & Resume]
         ▼
Step 3: Confirmation Dialog
- Confirms workflow name
- Says "will continue from where paused"
- User clicks [Resume Workflow]
         │
         │ API Call: PUT /api/admin/orders/:id/workflows/:id/status
         ▼
Step 4: Processing
- Button shows "Resuming..." with spinner
- Buttons disabled during action
         │
         │ Server responds with success
         ▼
Step 5: Update Complete
- Modal closes automatically
- Toast shows: "Workflow resumed successfully"
- Workflow card updates:
  * Status changes to "In Progress"
  * Badge turns blue
  * Progress remains at 30%
  * [Resume] button changes to [Pause]
  * Timeline entry created
```

---

## Toast Notifications

```
Success Scenarios:

1. Start Workflow
   ┌─────────────────────────────────┐
   │ ✓ Workflow started successfully │
   └─────────────────────────────────┘
   (Green background, auto-dismiss in 4s)

2. Pause Workflow
   ┌─────────────────────────────────┐
   │ ✓ Workflow paused successfully  │
   └─────────────────────────────────┘
   (Green background, auto-dismiss in 4s)

3. Resume Workflow
   ┌──────────────────────────────────┐
   │ ✓ Workflow resumed successfully  │
   └──────────────────────────────────┘
   (Green background, auto-dismiss in 4s)

Error Scenarios:

1. Invalid State Transition
   ┌────────────────────────────────────┐
   │ ✕ Workflow has already been       │
   │   started                          │
   └────────────────────────────────────┘
   (Red background, requires close)

2. Network Error
   ┌────────────────────────────────────┐
   │ ✕ Failed to start workflow         │
   │   Please check your connection     │
   └────────────────────────────────────┘
   (Red background, requires close)

3. Permission Error
   ┌────────────────────────────────────┐
   │ ✕ Access denied. Admin or staff    │
   │   role required.                   │
   └────────────────────────────────────┘
   (Red background, requires close)
```

---

## Button States

### Start Button

```
NOT STARTED WORKFLOW:
┌─────────────┐
│   [Start]   │  ← Normal (clickable)
└─────────────┘

WHILE STARTING:
┌─────────────┐
│ 🔄Starting..│  ← Disabled, spinning icon
└─────────────┘

AFTER START:
(Button hidden, Pause button shown)
```

### Pause Button

```
IN PROGRESS WORKFLOW:
┌─────────────┐
│  [Pause]    │  ← Normal (clickable)
└─────────────┘

WHILE PAUSING:
┌─────────────┐
│ 🔄Pausing...│  ← Disabled, spinning icon
└─────────────┘

AFTER PAUSE:
(Button hidden, Resume button shown)
```

### Resume Button

```
ON HOLD WORKFLOW:
┌─────────────┐
│  [Resume]   │  ← Normal (clickable)
└─────────────┘

WHILE RESUMING:
┌──────────────┐
│ 🔄Resuming...│  ← Disabled, spinning icon
└──────────────┘

AFTER RESUME:
(Button hidden, Pause button shown)
```

### Delete Button

```
ALWAYS:
┌─────────────┐
│ [Delete]    │  ← Clickable when no action in progress
└─────────────┘

DURING ACTION:
┌─────────────┐
│ [Delete]    │  ← Disabled (grayed out)
└─────────────┘
```

---

## Workflow Card Visual States

### Not Started State
```
┌──────────────────────────┐
│ Repair Process           │  ← Workflow name
│ ⏱️  Not Started (Gray)   │  ← Status badge
├──────────────────────────┤
│ Progress: 0/5 steps      │  ← Progress info
│ ░░░░░░░░░░░░░░░░░░░ 0% │  ← Progress bar (gray)
│                          │
│ ⏱️  Estimated: 45 min    │  ← Time estimate
│                          │
│ Steps:                   │  ← Step list
│ • Diagnostic Assessment  │
│ • Parts Assessment       │
│ • Repair Execution       │
│ • Quality Check          │
│ • Final Inspection       │
│                          │
│ [Start]    [Delete]      │  ← Action buttons
└──────────────────────────┘
```

### In Progress State
```
┌──────────────────────────┐
│ Repair Process           │  ← Workflow name
│ ◉ In Progress (Blue)     │  ← Status badge (BLUE)
├──────────────────────────┤
│ Progress: 3/5 steps      │  ← Progress info
│ ▓▓▓▓▓░░░░░░░░░░░░░░ 60%│  ← Progress bar (blue)
│                          │
│ ⏱️  Estimated: 45 min    │  ← Time estimate
│                          │
│ Steps:                   │  ← Step list with status
│ ✓ Diagnostic Assessment  │  (✓ completed)
│ ✓ Parts Assessment       │  (✓ completed)
│ ⟳ Repair Execution       │  (⟳ in-progress)
│ • Quality Check          │  (• pending)
│ • Final Inspection       │  (• pending)
│                          │
│ [Pause]    [Delete]      │  ← Action buttons
└──────────────────────────┘
```

### On Hold State
```
┌──────────────────────────┐
│ Repair Process           │  ← Workflow name
│ ⏸️  On Hold (Yellow)      │  ← Status badge (YELLOW)
├──────────────────────────┤
│ Progress: 3/5 steps      │  ← Progress info (preserved)
│ ▓▓▓▓▓░░░░░░░░░░░░░░ 60%│  ← Progress bar
│                          │
│ ⏱️  Estimated: 45 min    │  ← Time estimate
│                          │
│ Steps:                   │  ← Step list
│ ✓ Diagnostic Assessment  │
│ ✓ Parts Assessment       │
│ ⟳ Repair Execution       │
│ • Quality Check          │
│ • Final Inspection       │
│                          │
│ [Resume]   [Delete]      │  ← Action buttons
└──────────────────────────┘
```

### Completed State
```
┌──────────────────────────┐
│ Repair Process           │  ← Workflow name
│ ✓ Completed (Green)      │  ← Status badge (GREEN)
├──────────────────────────┤
│ Progress: 5/5 steps      │  ← Progress info (100%)
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ 100%   │  ← Progress bar (full)
│                          │
│ ⏱️  Completed in 47 min   │  ← Completion time
│                          │
│ Steps:                   │  ← All completed
│ ✓ Diagnostic Assessment  │
│ ✓ Parts Assessment       │
│ ✓ Repair Execution       │
│ ✓ Quality Check          │
│ ✓ Final Inspection       │
│                          │
│           [Delete]       │  ← Only delete available
└──────────────────────────┘
```

---

## Timeline Entries

```
When workflow actions occur, entries appear in the Timeline section:

┌──────────────────────────────────────────────────────┐
│ PROGRESS TIMELINE                                    │
├──────────────────────────────────────────────────────┤
│                                                      │
│ 🔹 Workflow Started                                 │
│    2024-01-15 10:30 AM                             │
│    Workflow "Repair Process" started by John Doe   │
│                                                      │
│ 🔹 Workflow Status Updated                          │
│    2024-01-15 10:35 AM                             │
│    Workflow paused (in-progress → on-hold)         │
│    by John Doe                                      │
│                                                      │
│ 🔹 Workflow Status Updated                          │
│    2024-01-15 10:40 AM                             │
│    Workflow resumed (on-hold → in-progress)        │
│    by John Doe                                      │
│                                                      │
│ 🔹 Workflow Step Completed                          │
│    2024-01-15 10:45 AM                             │
│    Step "Diagnostic Assessment" completed          │
│    by John Doe                                      │
│                                                      │
└──────────────────────────────────────────────────────┘
```

---

## Responsive Design

### Desktop View (1920px)
```
┌─────────────────────────────────────────────────────────────────┐
│                        ORDER DETAILS                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  WORKFLOWS (2 workflows)                                        │
│  ┌─────────────────────────────┐  ┌─────────────────────────┐  │
│  │  Workflow 1 - In Progress   │  │  Workflow 2 - On Hold   │  │
│  │  ▓▓▓▓░░░░░░░ 40%            │  │  ▓▓░░░░░░░░░░ 20%      │  │
│  │  [Pause] [Delete]           │  │  [Resume] [Delete]      │  │
│  └─────────────────────────────┘  └─────────────────────────┘  │
│                                                                 │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  ORDER SERVICES                                            │ │
│  │  ...                                                       │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Tablet View (768px)
```
┌────────────────────────────────────────┐
│        ORDER DETAILS                   │
├────────────────────────────────────────┤
│                                        │
│  WORKFLOWS (2 workflows)               │
│  ┌────────────────────────────────┐   │
│  │  Workflow 1 - In Progress      │   │
│  │  ▓▓▓▓░░░░░░░ 40%               │   │
│  │  [Pause] [Delete]              │   │
│  └────────────────────────────────┘   │
│                                        │
│  ┌────────────────────────────────┐   │
│  │  Workflow 2 - On Hold          │   │
│  │  ▓▓░░░░░░░░░░ 20%              │   │
│  │  [Resume] [Delete]             │   │
│  └────────────────────────────────┘   │
│                                        │
│  ┌────────────────────────────────┐   │
│  │  ORDER SERVICES                │   │
│  │  ...                           │   │
│  └────────────────────────────────┘   │
│                                        │
└────────────────────────────────────────┘
```

### Mobile View (375px)
```
┌─────────────────────────┐
│   ORDER DETAILS         │
├─────────────────────────┤
│                         │
│  WORKFLOWS             │
│  (2 workflows)         │
│                         │
│  ┌───────────────────┐  │
│  │ Workflow 1        │  │
│  │ In Progress       │  │
│  │ ▓▓▓▓░░░░ 40%     │  │
│  │ [Pause]           │  │
│  │ [Delete]          │  │
│  └───────────────────┘  │
│                         │
│  ┌───────────────────┐  │
│  │ Workflow 2        │  │
│  │ On Hold           │  │
│  │ ▓▓░░░░░░ 20%     │  │
│  │ [Resume]          │  │
│  │ [Delete]          │  │
│  └───────────────────┘  │
│                         │
│  ORDER SERVICES        │
│  ...                   │
│                         │
└─────────────────────────┘
```

---

## Keyboard Navigation

```
Tab Navigation Order:
1. Workflow Cards → Start/Pause/Resume Button
2. Workflow Cards → Delete Button
3. Modal (if open) → Previous Button
4. Modal → Step Counter
5. Modal → Next Button
6. Modal → Confirm Button
7. Modal → Cancel Button

In Modal:
- Escape: Close modal
- Tab: Move through buttons
- Enter/Space: Click focused button
- Arrow Keys: (optional) Navigate steps in list

Accessibility Features:
- ✓ All buttons have ARIA labels
- ✓ Focus indicators visible
- ✓ Color not only indicator (icons + text)
- ✓ Minimum touch target: 44x44px
```

---

## Color Scheme

```
Status Badges:
┌──────────────┬─────────┬────────────────────────┐
│ Status       │ Color   │ Hex Code               │
├──────────────┼─────────┼────────────────────────┤
│ Not Started  │ Gray    │ #808080 / #d1d5db     │
│ In Progress  │ Blue    │ #3b82f6               │
│ On Hold      │ Yellow  │ #eab308               │
│ Completed    │ Green   │ #22c55e               │
└──────────────┴─────────┴────────────────────────┘

Progress Bars:
- Unfilled: Light Gray (#e5e7eb)
- Filled: Blue (#3b82f6)
- Height: 8px

Buttons:
- Primary: Blue (#3b82f6)
- Secondary: Gray (#6b7280)
- Danger: Red (#ef4444)
- Hover: Slightly darker shade
- Disabled: Gray (#d1d5db)

Text:
- Headings: Dark Gray (#1f2937)
- Body: Medium Gray (#4b5563)
- Muted: Light Gray (#9ca3af)
```

---

## Summary

This visual guide shows:
- ✅ Overall feature architecture
- ✅ Modal and dialog layouts
- ✅ Status transitions
- ✅ User interaction flows
- ✅ Toast notifications
- ✅ Button states
- ✅ Card visual states
- ✅ Timeline appearance
- ✅ Responsive design layouts
- ✅ Keyboard navigation
- ✅ Color scheme

All visuals represent the actual implementation in the FixitHub application.
