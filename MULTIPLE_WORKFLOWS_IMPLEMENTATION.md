# Multiple Workflow Assignment & Management Implementation

## Overview
This implementation adds the capability for admin users to assign multiple workflows to orders and delete workflows. It includes an enhanced UI for displaying multiple workflows in a user-friendly way.

## Implementation Summary

### Backend Changes

#### 1. **New API Endpoint** (`server/routes/adminOrderRoutes.js`)
```
DELETE /api/admin/orders/:id/workflows/:workflowId
```
- Removes a workflow from an order
- Requires admin or staff authentication
- Adds timeline entry for the deletion
- Returns updated order object

#### 2. **Service Layer Method** (`server/services/orderService.js`)
```javascript
static async removeWorkflowFromOrder(orderId, workflowId, staffId)
```
- Finds the workflow by subdocument _id
- Removes it from the order's workflows array
- Logs the action to order timeline
- Handles errors gracefully

### Frontend Changes

#### 1. **New API Client Function** (`client/src/api/workflow.ts`)
```typescript
export const deleteWorkflowFromOrder = async (orderId: string, workflowId: string)
```
- Calls the DELETE endpoint
- Includes proper error handling and logging

#### 2. **New Workflow Card Component** (`client/src/components/admin/WorkflowCard.tsx`)
Features:
- Displays workflow name, status, and steps
- Shows progress bar with step completion
- Displays estimated time
- Action buttons (Delete, Start, Pause, Resume)
- Confirmation dialog for deletion
- Step-by-step progress visualization
- Responsive design (grid layout)

#### 3. **OrderDetails Component Updates** (`client/src/pages/OrderDetails.tsx`)
Enhancements:
- Import new `deleteWorkflowFromOrder` API function
- Import new `WorkflowCard` component
- Add `deletingWorkflowId` state to track deletion progress
- Add `handleDeleteWorkflow` function with error handling
- Replace single workflow display with grid of `WorkflowCard` components
- Add workflow count to section header
- Improved UI layout with 2-column grid on larger screens

## Features Implemented

✅ **Multiple Workflow Assignment**
- Orders support multiple workflows (already in data model)
- Admin can assign multiple different workflows to the same order
- Workflows are displayed in a grid layout

✅ **Workflow Deletion**
- Delete button on each workflow card
- Confirmation dialog before deletion
- Proper error handling with user feedback
- Toast notifications for success/error
- Timeline entry recorded for deletion

✅ **Enhanced UI**
- WorkflowCard component showing:
  - Workflow name and status badge
  - Progress bar with completion percentage
  - List of steps with their status (completed ✓, in-progress ⟳, skipped ⊘)
  - Estimated completion time
  - Action buttons
- Grid layout on larger screens (2 columns on lg, 1 on md)
- Color-coded status badges
- Responsive design

✅ **User Experience Improvements**
- Deletion confirmation dialog
- Toast notifications for all actions
- Loading states during deletion
- Error messages for failed operations
- Real-time UI updates after deletion
- Timeline tracking of all actions

## API Endpoint Details

### Delete Workflow from Order
```
DELETE /api/admin/orders/:orderId/workflows/:workflowId
Authorization: Bearer <token>

Response:
{
  "success": true,
  "message": "Workflow removed from order successfully",
  "order": { /* updated order object */ }
}

Error Response:
{
  "error": "Order not found" | "Workflow not found in order"
}
```

## Database Schema
- No schema changes needed
- Order model already supports `workflows: [orderWorkflowSchema]` array
- Each workflow subdocument has its own `_id`

## File Changes Summary

| File | Changes |
|------|---------|
| `server/routes/adminOrderRoutes.js` | Added DELETE endpoint for workflow removal |
| `server/services/orderService.js` | Added `removeWorkflowFromOrder` method |
| `client/src/api/workflow.ts` | Added `deleteWorkflowFromOrder` function |
| `client/src/pages/OrderDetails.tsx` | Integrated workflow deletion and new card component |
| `client/src/components/admin/WorkflowCard.tsx` | NEW: Workflow display component |

## Testing

### API Testing
```bash
# Get auth token
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"admin123"}'

# Get order workflows
curl -X GET http://localhost:3000/api/admin/orders/{orderId}/workflows \
  -H "Authorization: Bearer {token}"

# Delete workflow
curl -X DELETE http://localhost:3000/api/admin/orders/{orderId}/workflows/{workflowId} \
  -H "Authorization: Bearer {token}"
```

### UI Testing
1. Navigate to Order Details page as admin
2. Scroll to Workflows section
3. Assign multiple workflows to an order
4. Verify they appear as cards in a grid
5. Click delete button on a workflow
6. Confirm deletion in the dialog
7. Verify workflow is removed from the list
8. Check toast notification for success

## Error Handling

- **Order not found**: Returns 404 with appropriate message
- **Workflow not found**: Returns 404 with appropriate message
- **Authentication error**: Returns 403 if not admin/staff
- **Database errors**: Logged and returned as 500 error

## Logging

Comprehensive logging added for debugging:
- Backend: `OrderService: Removing workflow from order`
- Backend: `OrderService: Workflow removed successfully`
- Frontend: `OrderDetails: Deleting workflow`
- Frontend: `OrderWorkflowAPI: Deleting workflow from order`

## Security

- ✅ Authentication required (Bearer token)
- ✅ Role-based access control (admin/staff only)
- ✅ Order ownership validation
- ✅ Proper error messages (no sensitive data leaking)

## Performance Considerations

- Deletion is a direct array removal operation (O(n) where n is workflows count)
- No index lookups required
- Automatic MongoDB update
- Real-time UI updates

## Browser Compatibility

- Modern browsers (Chrome, Firefox, Safari, Edge)
- React 18+
- TypeScript support
- Responsive design tested on desktop, tablet, mobile

## Future Enhancements

- Bulk workflow deletion
- Workflow reordering
- Workflow cloning
- Workflow templates library
- Workflow execution history
- Workflow status filtering/sorting

## Version Information

- Implementation Date: 2024
- Last Updated: 2024
- Compatible with: React 18+, Node 18+, MongoDB 4.4+
