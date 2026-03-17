import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Info } from 'lucide-react';

interface PartsColumnAssignmentPanelProps {
  csvColumns: string[];
  columnMapping: Record<string, string>;
  onMappingChange: (mapping: Record<string, string>) => void;
}

export const PartsColumnAssignmentPanel: React.FC<PartsColumnAssignmentPanelProps> = ({
  csvColumns,
  columnMapping,
  onMappingChange
}) => {
  const requiredFields = [
    { id: 'category', label: 'Category', description: 'Required. Must be one of: display, battery, camera, speaker, microphone, charging-port, button, sensor, tool, adhesive, screw, USB-C Ladebuchse, Microfone Flex, Ladebuchse, microUSB Buchse, other' },
    { id: 'manufacturer', label: 'Manufacturer', description: 'Required. The manufacturer of the part' },
    { id: 'model', label: 'Model', description: 'Required. The model of the part' }
  ];

  const optionalFields = [
    { id: 'itemDescription', label: 'Description', description: 'Optional. Detailed description of the part' },
    { id: 'date', label: 'Date', description: 'Optional. Date field (format: YYYY-MM-DD)' },
    { id: 'compatibleDevices', label: 'Compatible Devices', description: 'Optional. Comma-separated list of compatible devices' },
    { id: 'versionType', label: 'Version Type', description: 'Optional. Type: original, cheap, or efficient' },
    { id: 'quantity', label: 'Quantity', description: 'Optional. Current stock quantity (default: 0)' },
    { id: 'minStockLevel', label: 'Min Stock Level', description: 'Optional. Minimum stock alert level (default: 5)' },
    { id: 'unitCost', label: 'Unit Cost', description: 'Optional. Cost per unit (default: 0)' },
    { id: 'sellingPrice', label: 'Selling Price', description: 'Optional. Selling price per unit (default: 0)' },
    { id: 'storageLocation', label: 'Storage Location', description: 'Optional. Where the part is stored' },
    { id: 'notes', label: 'Notes', description: 'Optional. Additional notes about the part' },
    { id: 'supplierName', label: 'Supplier Name', description: 'Optional. Primary supplier name' },
    { id: 'supplierEmail', label: 'Supplier Email', description: 'Optional. Supplier contact email' },
    { id: 'supplierPhone', label: 'Supplier Phone', description: 'Optional. Supplier contact phone' }
  ];

  const handleFieldChange = (fieldId: string, csvColumn: string) => {
    const newMapping = { ...columnMapping };

    // Remove the csvColumn from any existing mapping
    Object.keys(newMapping).forEach(key => {
      if (newMapping[key] === csvColumn) {
        delete newMapping[key];
      }
    });

    // Set the new mapping
    if (csvColumn !== 'none') {
      newMapping[fieldId] = csvColumn;
    } else {
      delete newMapping[fieldId];
    }

    onMappingChange(newMapping);
  };

  const getSelectedColumn = (fieldId: string): string => {
    return columnMapping[fieldId] || 'none';
  };

  const getMappedFields = () => {
    return Object.keys(columnMapping).filter(key => columnMapping[key]);
  };

  const getUnmappedRequiredFields = () => {
    return requiredFields.filter(field => !columnMapping[field.id]);
  };

  const getUnmappedColumns = () => {
    const mappedColumns = Object.values(columnMapping);
    return csvColumns.filter(col => !mappedColumns.includes(col));
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Column Assignment</CardTitle>
          <CardDescription>
            Map your CSV columns to the corresponding part fields. Required fields must be mapped to proceed.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Auto-Generated Item Name Notice */}
          <Alert className="border-gray-200 bg-white shadow-sm">
            <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <AlertDescription className="text-blue-800 dark:text-blue-200">
              <strong>Item Name is Auto-Generated:</strong> The Item Name field will be automatically created by combining Manufacturer + Model + Category. You do not need to map this field.
            </AlertDescription>
          </Alert>

          {/* Required Fields */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold">Required Fields</h3>
              <Badge variant="destructive">Required</Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {requiredFields.map(field => (
                <div key={field.id} className="space-y-2">
                  <Label htmlFor={field.id} className="flex items-center gap-1">
                    {field.label}
                    <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={getSelectedColumn(field.id)}
                    onValueChange={(value) => handleFieldChange(field.id, value)}
                  >
                    <SelectTrigger id={field.id}>
                      <SelectValue placeholder="Select column..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">-- Not Mapped --</SelectItem>
                      {csvColumns.filter(col => col && col.trim() !== '').map(col => (
                        <SelectItem key={col} value={col}>
                          {col}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">{field.description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Optional Fields */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold">Optional Fields</h3>
              <Badge variant="secondary">Optional</Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {optionalFields.map(field => (
                <div key={field.id} className="space-y-2">
                  <Label htmlFor={field.id}>{field.label}</Label>
                  <Select
                    value={getSelectedColumn(field.id)}
                    onValueChange={(value) => handleFieldChange(field.id, value)}
                  >
                    <SelectTrigger id={field.id}>
                      <SelectValue placeholder="Select column..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">-- Not Mapped --</SelectItem>
                      {csvColumns.filter(col => col && col.trim() !== '').map(col => (
                        <SelectItem key={col} value={col}>
                          {col}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">{field.description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Validation Alerts */}
          <div className="space-y-3">
            {getUnmappedRequiredFields().length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Missing required field mappings: {getUnmappedRequiredFields().map(f => f.label).join(', ')}
                </AlertDescription>
              </Alert>
            )}

            {getUnmappedColumns().length > 0 && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  <strong>{getUnmappedColumns().length} unmapped column(s):</strong> {getUnmappedColumns().join(', ')}
                  <br />
                  <span className="text-xs">These columns will be ignored during import.</span>
                </AlertDescription>
              </Alert>
            )}

            {getMappedFields().length > 0 && (
              <Alert className="border-green-500/50 text-green-700 dark:text-green-400">
                <Info className="h-4 w-4" />
                <AlertDescription>
                  {getMappedFields().length} field(s) mapped successfully
                </AlertDescription>
              </Alert>
            )}
          </div>

          {/* Format Guide */}
          <Card className="bg-muted/50">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Info className="h-4 w-4" />
                Format Guidelines
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs space-y-2">
              <div>
                <strong>Category values:</strong> display, battery, camera, speaker, microphone, charging-port, button, sensor, tool, adhesive, screw, USB-C Ladebuchse, Microfone Flex, Ladebuchse, microUSB Buchse, other
              </div>
              <div>
                <strong>Version Type values:</strong> original, cheap, efficient
              </div>
              <div>
                <strong>Date format:</strong> YYYY-MM-DD (e.g., "2024-12-05")
              </div>
              <div>
                <strong>Numeric fields:</strong> quantity, minStockLevel, unitCost, sellingPrice (must be positive numbers)
              </div>
              <div>
                <strong>Compatible Devices:</strong> comma-separated list (e.g., "iPhone 15 Pro, iPhone 15, iPhone 14")
              </div>
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </div>
  );
};
