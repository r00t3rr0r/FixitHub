import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface ColumnAssignmentPanelProps {
  csvColumns: string[];
  columnMapping: Record<string, string>;
  onMappingChange: (mapping: Record<string, string>) => void;
}

export const ColumnAssignmentPanel: React.FC<ColumnAssignmentPanelProps> = ({
  csvColumns,
  columnMapping,
  onMappingChange
}) => {
  const { t } = useTranslation();

  const systemFields = [
    { id: 'email', label: 'Email (Required)', required: true },
    { id: 'name', label: 'Name (Required)', required: true },
    { id: 'phone', label: 'Phone', required: false },
    { id: 'role', label: 'Role (customer/staff/admin)', required: false },
    { id: 'company', label: 'Company', required: false },
    { id: 'country', label: 'Country', required: false },
    { id: 'isActive', label: 'Active Status (true/false)', required: false }
  ];

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

  // Check if all required fields are mapped
  const requiredFields = systemFields.filter(f => f.required);
  const mappedRequiredFields = requiredFields.filter(f => columnMapping[f.id]);
  const allRequiredFieldsMapped = requiredFields.length === mappedRequiredFields.length;

  // Check for unmapped CSV columns
  const mappedCsvColumns = Object.values(columnMapping).filter(col => col);
  const unmappedColumns = csvColumns.filter(col => !mappedCsvColumns.includes(col));

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Column Mapping</CardTitle>
          <CardDescription>
            Assign CSV columns to the corresponding system fields. Fields marked as Required must be mapped.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {!allRequiredFieldsMapped && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Please map all required fields: {requiredFields
                  .filter(f => !columnMapping[f.id])
                  .map(f => f.label)
                  .join(', ')}
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-4">
            {systemFields.map(field => (
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
                    {csvColumns.map(column => (
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
