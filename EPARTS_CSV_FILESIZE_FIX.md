# EParts CSV Import File Size Limit Fix

## Issue Summary
Users were receiving a "File too large" error when attempting to upload CSV files greater than 10MB for EParts import, even though the backend was configured to accept files up to 100MB.

## Root Cause
The frontend validation in `PartsCSVImportDialog.tsx` was checking for a 10MB file size limit and rejecting larger files before they could be sent to the backend.

## Solution
Updated the frontend file size validation from 10MB to 100MB to match the backend configuration.

## Files Modified

### 1. `client/src/components/admin/PartsCSVImportDialog.tsx`

**Changes:**
- Line 75-83: Updated file size validation from `10 * 1024 * 1024` (10MB) to `100 * 1024 * 1024` (100MB)
- Line 389: Updated CardDescription text from "Maximum file size: 10MB" to "Maximum file size: 100MB"
- Line 436: Updated Alert requirements list from "Maximum file size: 10MB" to "Maximum file size: 100MB"

**Before:**
```typescript
// Check file size (max 10MB)
if (file.size > 10 * 1024 * 1024) {
  toast({
    variant: 'destructive',
    title: 'File too large',
    description: 'CSV file must be smaller than 10MB for optimal performance'
  });
  return;
}
```

**After:**
```typescript
// Check file size (max 100MB)
if (file.size > 100 * 1024 * 1024) {
  toast({
    variant: 'destructive',
    title: 'File too large',
    description: 'CSV file must be smaller than 100MB'
  });
  return;
}
```

## Backend Configuration (No Changes Required)
The backend was already properly configured in `server/routes/csvPartsImportRoutes.js`:
- Line 22: `limits: { fileSize: 100 * 1024 * 1024 }` // 100MB limit

## Impact
- Users can now upload CSV files up to 100MB for EParts import
- Consistent file size limits between frontend validation and backend processing
- Improved user experience for bulk imports

## Testing Recommendations
1. Test uploading a CSV file between 10MB and 100MB
2. Verify the file uploads successfully without error
3. Test uploading a CSV file larger than 100MB to ensure validation still works
4. Verify the error message displays correctly for files exceeding 100MB
