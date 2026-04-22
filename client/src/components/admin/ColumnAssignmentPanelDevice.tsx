import React from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

interface ColumnAssignmentPanelDeviceProps {
  csvColumns: string[];
  columnMapping: Record<string, string>;
  onMappingChange: (mapping: Record<string, string>) => void;
}

// Alle DeviceModel Felder
const deviceFields = [
  { id: 'name', label: 'Model Name', required: true },
  { id: 'manufacturer', label: 'Manufacturer', required: true },
  { id: 'deviceType', label: 'Device Type / Category', required: true },
  { id: 'brandId', label: 'Brand ID', required: false },
  { id: 'image', label: 'Image URL', required: false },
  { id: 'modelNumbers', label: 'Model Numbers', required: false },
  { id: 'commonProblems', label: 'Common Problems', required: false },
  { id: 'specifications', label: 'Specifications (JSON/Text)', required: false },
  { id: 'images', label: 'Images (JSON/Text)', required: false },
  { id: 'network', label: 'Network (JSON/Text)', required: false },
  { id: 'physical', label: 'Physical (JSON/Text)', required: false },
  { id: 'display', label: 'Display (JSON/Text)', required: false },
  { id: 'platform', label: 'Platform (JSON/Text)', required: false },
  { id: 'memory', label: 'Memory (JSON/Text)', required: false },
  { id: 'rearCamera', label: 'Rear Camera (JSON/Text)', required: false },
  { id: 'frontCamera', label: 'Front Camera (JSON/Text)', required: false },
  { id: 'audio', label: 'Audio (JSON/Text)', required: false },
  { id: 'connectivity', label: 'Connectivity (JSON/Text)', required: false },
  { id: 'features', label: 'Features (JSON/Text)', required: false },
  { id: 'battery', label: 'Battery (JSON/Text)', required: false },
  { id: 'other', label: 'Other (JSON/Text)', required: false },
  { id: 'other.models', label: 'Other: Model Variants', required: false },
  { id: 'other.sarValues.head', label: 'Other: SAR Head', required: false },
  { id: 'other.sarValues.body', label: 'Other: SAR Body', required: false },
  { id: 'other.price', label: 'Other: Price', required: false },
  { id: 'other.releaseDate', label: 'Other: Release Date', required: false },
  { id: 'other.colors', label: 'Other: Colors', required: false },
];

export const ColumnAssignmentPanelDevice: React.FC<ColumnAssignmentPanelDeviceProps> = ({
  csvColumns,
  columnMapping,
  onMappingChange
}) => {
  const handleMappingChange = (fieldId: string, csvColumn: string) => {
    const newMapping = { ...columnMapping };
    newMapping[fieldId] = csvColumn;
    onMappingChange(newMapping);
  };

  const handleRemoveMapping = (fieldId: string) => {
    const newMapping = { ...columnMapping };
    delete newMapping[fieldId];
    onMappingChange(newMapping);
  };

  const requiredFields = deviceFields.filter(f => f.required);
  const mappedRequiredFields = requiredFields.filter(f => columnMapping[f.id]);
  const allRequiredFieldsMapped = requiredFields.length === mappedRequiredFields.length;

  const mappedCsvColumns = Object.values(columnMapping).filter(col => col);
  const unmappedColumns = csvColumns.filter(col => !mappedCsvColumns.includes(col));

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Column Mapping</CardTitle>
          <CardDescription>
            Assign CSV columns to the corresponding device model fields. Required fields must be mapped.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {Object.values(columnMapping).filter(v => v).length === 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Please map at least one CSV column to a device field to proceed.
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-4">
            {deviceFields.map(field => (
              <div key={field.id} className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium flex-1">
                    {field.label}
                    {field.required && <span className="text-red-500 ml-1">*</span>}
                  </label>
                  {columnMapping[field.id] && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveMapping(field.id)}
                      className="h-8"
                    >
                      Clear
                    </Button>
                  )}
                </div>

                <Select
                  value={columnMapping[field.id] || '__unmapped__'}
                  onValueChange={(value) => {
                    if (value === '__unmapped__') {
                      handleRemoveMapping(field.id);
                    } else {
                      handleMappingChange(field.id, value);
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={`Select CSV column for ${field.label}`} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__unmapped__">-- Not mapped --</SelectItem>
                    {csvColumns.filter(column => column && column.trim().length > 0).map(column => (
                      <SelectItem key={column} value={column}>
                        {column}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>

          {unmappedColumns.length > 0 && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {unmappedColumns.length} CSV column(s) are not mapped: {unmappedColumns.join(', ')}.
                This is fine - these columns will be ignored during import.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
