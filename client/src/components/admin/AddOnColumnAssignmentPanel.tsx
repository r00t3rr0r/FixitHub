import React from 'react';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';

interface AddOnColumnAssignmentPanelProps {
  csvColumns: string[];
  columnMapping: Record<string, string>;
  onColumnMappingChange: (field: string, column: string) => void;
}

// Special value to represent "not mapped" state
const NOT_MAPPED_VALUE = '__NOT_MAPPED__';

const AddOnColumnAssignmentPanel: React.FC<AddOnColumnAssignmentPanelProps> = ({
  csvColumns,
  columnMapping,
  onColumnMappingChange,
}) => {
  console.log('[AddOnColumnAssignmentPanel] Received csvColumns:', csvColumns);
  console.log('[AddOnColumnAssignmentPanel] Current columnMapping:', columnMapping);

  // Field definitions for Add-On Services
  const fields = [
    {
      key: 'name',
      label: 'Service Name',
      required: true,
      description: 'Name of the add-on service (e.g., Screen Protector Installation)',
    },
    {
      key: 'category',
      label: 'Category',
      required: true,
      description: 'Category: Protection, Service, Warranty, Accessory, or Data',
    },
    {
      key: 'price',
      label: 'Price',
      required: true,
      description: 'Price in dollars (e.g., 29.99)',
    },
    {
      key: 'description',
      label: 'Description',
      required: false,
      description: 'Detailed description of the add-on service',
    },
    {
      key: 'estimatedTime',
      label: 'Estimated Time',
      required: false,
      description: 'Time required to complete (e.g., 15 minutes, 30 minutes)',
    },
    {
      key: 'bundleDiscount',
      label: 'Bundle Discount',
      required: false,
      description: 'Discount percentage when bundled (0-100)',
    },
    {
      key: 'popularity',
      label: 'Popularity',
      required: false,
      description: 'Popularity percentage (0-100)',
    },
    {
      key: 'deviceTypes',
      label: 'Device Types',
      required: false,
      description: 'Comma-separated device types (e.g., iPhone,iPad,Samsung)',
    },
    {
      key: 'brands',
      label: 'Brands',
      required: false,
      description: 'Comma-separated brands (e.g., Apple,Samsung,Google)',
    },
    {
      key: 'isActive',
      label: 'Active Status',
      required: false,
      description: 'Active status (true/false, yes/no, 1/0)',
    },
  ];

  // Filter out empty or whitespace-only columns
  const validCsvColumns = csvColumns.filter((col) => col && col.trim() !== '');
  console.log('[AddOnColumnAssignmentPanel] Valid CSV columns after filtering:', validCsvColumns);

  // Check if all required fields are mapped
  const requiredFields = fields.filter((f) => f.required);
  const allRequiredMapped = requiredFields.every(
    (field) => columnMapping[field.key] && columnMapping[field.key] !== '' && columnMapping[field.key] !== NOT_MAPPED_VALUE
  );

  // Check for unmapped columns
  const mappedColumns = Object.values(columnMapping).filter((col) => col !== '' && col !== NOT_MAPPED_VALUE);
  const unmappedColumns = validCsvColumns.filter((col) => !mappedColumns.includes(col));

  // Handle value change with proper mapping
  const handleValueChange = (field: string, value: string) => {
    console.log(`[AddOnColumnAssignmentPanel] Mapping field "${field}" to column "${value}"`);
    // Convert NOT_MAPPED_VALUE back to empty string for the parent component
    onColumnMappingChange(field, value === NOT_MAPPED_VALUE ? '' : value);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h3 className="text-lg font-semibold">Column Assignment</h3>
        <p className="text-sm text-muted-foreground">
          Map your CSV columns to the add-on service fields. Required fields are marked with an asterisk (*).
        </p>
      </div>

      {/* Validation Alerts */}
      {!allRequiredMapped && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Please map all required fields (marked with *) before proceeding.
          </AlertDescription>
        </Alert>
      )}

      {allRequiredMapped && (
        <Alert className="border-green-200 bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-200">
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>All required fields are mapped!</AlertDescription>
        </Alert>
      )}

      {unmappedColumns.length > 0 && (
        <Alert>
          <AlertDescription>
            <strong>Unmapped columns:</strong> {unmappedColumns.join(', ')}
          </AlertDescription>
        </Alert>
      )}

      {/* Field Mapping Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border rounded-lg p-4">
        {fields.map((field) => {
          // Get current value, converting empty string to NOT_MAPPED_VALUE for the Select component
          const currentValue = columnMapping[field.key] || NOT_MAPPED_VALUE;

          return (
            <div key={field.key} className="space-y-2">
              <Label htmlFor={`field-${field.key}`}>
                {field.label}
                {field.required && <span className="text-red-500 ml-1">*</span>}
              </Label>
              <Select
                value={currentValue}
                onValueChange={(value) => handleValueChange(field.key, value)}
              >
                <SelectTrigger id={`field-${field.key}`}>
                  <SelectValue placeholder="Select column..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NOT_MAPPED_VALUE}>-- Not Mapped --</SelectItem>
                  {validCsvColumns.map((column) => (
                    <SelectItem key={column} value={column}>
                      {column}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{field.description}</p>
            </div>
          );
        })}
      </div>

      {/* Format Guide */}
      <div className="border rounded-lg p-4 bg-muted/50">
        <h4 className="font-semibold mb-2">Format Guidelines</h4>
        <ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground">
          <li>
            <strong>Category:</strong> Must be one of: Protection, Service, Warranty, Accessory, Data
          </li>
          <li>
            <strong>Price:</strong> Numeric value (e.g., 29.99). Currency symbols will be removed.
          </li>
          <li>
            <strong>Bundle Discount:</strong> Percentage value between 0 and 100 (e.g., 15)
          </li>
          <li>
            <strong>Popularity:</strong> Percentage value between 0 and 100 (e.g., 85)
          </li>
          <li>
            <strong>Device Types & Brands:</strong> Comma-separated values (e.g., iPhone,iPad)
          </li>
          <li>
            <strong>Active Status:</strong> true/false, yes/no, 1/0, or active/inactive
          </li>
        </ul>
      </div>
    </div>
  );
};

export default AddOnColumnAssignmentPanel;
