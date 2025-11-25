import React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle } from 'lucide-react';

interface ServiceColumnAssignmentPanelProps {
  csvColumns: string[];
  columnMapping: Record<string, string>;
  onColumnMappingChange: (field: string, column: string) => void;
}

const ServiceColumnAssignmentPanel: React.FC<ServiceColumnAssignmentPanelProps> = ({
  csvColumns,
  columnMapping,
  onColumnMappingChange,
}) => {
  // Service fields that need to be mapped
  const serviceFields = [
    { field: 'name', label: 'Service Name', required: true, description: 'The name of the repair service' },
    { field: 'category', label: 'Category', required: true, description: 'Service category (e.g., Screen Repair, Battery Replacement)' },
    { field: 'price', label: 'Price', required: true, description: 'Service price in dollars' },
    { field: 'description', label: 'Description', required: false, description: 'Detailed description of the service' },
    { field: 'estimatedTime', label: 'Estimated Time', required: false, description: 'Estimated repair time in minutes' },
    { field: 'difficulty', label: 'Difficulty', required: false, description: 'Difficulty level (Easy, Medium, Hard)' },
    { field: 'warrantyPeriod', label: 'Warranty Period', required: false, description: 'Warranty period in days' },
    { field: 'deviceTypes', label: 'Device Types', required: false, description: 'Comma-separated list of compatible device types' },
    { field: 'isActive', label: 'Active Status', required: false, description: 'Whether the service is active (true/false, yes/no, 1/0)' },
  ];

  // Check if all required fields are mapped
  const requiredFields = serviceFields.filter((f) => f.required);
  const mappedRequiredFields = requiredFields.filter((f) => columnMapping[f.field]);
  const allRequiredFieldsMapped = mappedRequiredFields.length === requiredFields.length;

  // Get unmapped columns
  const mappedColumns = new Set(Object.values(columnMapping).filter((col) => col));
  const unmappedColumns = csvColumns.filter((col) => !mappedColumns.has(col));

  return (
    <div className="space-y-6">
      {/* Instructions */}
      <Alert>
        <AlertDescription>
          Map each CSV column to the corresponding service field. Required fields are marked with{' '}
          <Badge variant="destructive" className="ml-1">Required</Badge>
        </AlertDescription>
      </Alert>

      {/* Required Fields Warning */}
      {!allRequiredFieldsMapped && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Please map all required fields: {requiredFields.filter((f) => !columnMapping[f.field]).map((f) => f.label).join(', ')}
          </AlertDescription>
        </Alert>
      )}

      {/* Column Mapping */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {serviceFields.map((serviceField) => (
          <div key={serviceField.field} className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor={`field-${serviceField.field}`}>
                {serviceField.label}
              </Label>
              {serviceField.required && (
                <Badge variant="destructive" className="text-xs">Required</Badge>
              )}
            </div>
            <Select
              value={columnMapping[serviceField.field] || ''}
              onValueChange={(value) => onColumnMappingChange(serviceField.field, value)}
            >
              <SelectTrigger id={`field-${serviceField.field}`}>
                <SelectValue placeholder="Select CSV column" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">-- Not mapped --</SelectItem>
                {csvColumns.map((column) => (
                  <SelectItem key={column} value={column}>
                    {column}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">{serviceField.description}</p>
          </div>
        ))}
      </div>

      {/* Unmapped Columns Warning */}
      {unmappedColumns.length > 0 && (
        <Alert>
          <AlertDescription>
            <div className="space-y-1">
              <p className="font-semibold">Unmapped CSV columns:</p>
              <div className="flex flex-wrap gap-2">
                {unmappedColumns.map((col) => (
                  <Badge key={col} variant="secondary">
                    {col}
                  </Badge>
                ))}
              </div>
              <p className="text-sm mt-2">
                These columns will be ignored during import.
              </p>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Field Format Guide */}
      <Alert>
        <AlertDescription>
          <div className="space-y-2">
            <p className="font-semibold">Field Format Guide:</p>
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li><strong>Category:</strong> Screen Repair, Battery Replacement, Water Damage, Software, Hardware, Other</li>
              <li><strong>Price:</strong> Numeric value (e.g., 99.99, $150, 75)</li>
              <li><strong>Estimated Time:</strong> Minutes (e.g., 60) or hours (e.g., "2 hours")</li>
              <li><strong>Difficulty:</strong> Easy, Medium, or Hard</li>
              <li><strong>Warranty Period:</strong> Number of days (e.g., 90)</li>
              <li><strong>Device Types:</strong> Comma-separated (e.g., "Smartphone,Tablet")</li>
              <li><strong>Active Status:</strong> true/false, yes/no, 1/0, active/inactive</li>
            </ul>
          </div>
        </AlertDescription>
      </Alert>
    </div>
  );
};

export default ServiceColumnAssignmentPanel;
