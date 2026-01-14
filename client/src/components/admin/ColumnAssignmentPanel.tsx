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
    // Basic information
    { id: 'email', label: 'Email', required: false },
    { id: 'name', label: 'Name', required: false },
    { id: 'phone', label: 'Phone', required: false },
    { id: 'firstName', label: 'First Name', required: false },
    { id: 'lastName', label: 'Last Name', required: false },
    { id: 'surname', label: 'Surname', required: false },
    { id: 'role', label: 'Role (customer/staff/admin)', required: false },
    { id: 'isActive', label: 'Active Status (true/false)', required: false },
    // Customer information
    { id: 'customerNumber', label: 'Customer Number', required: false },
    { id: 'customerGroup', label: 'Customer Group', required: false },
    { id: 'salutation', label: 'Salutation (Mr/Ms/Mrs/Dr/Prof)', required: false },
    { id: 'title', label: 'Title', required: false },
    { id: 'company', label: 'Company', required: false },
    { id: 'country', label: 'Country', required: false },
    { id: 'vatId', label: 'Ust-ID (VAT ID)', required: false },
    { id: 'addressAddition', label: 'Address Addition', required: false },
    { id: 'customerOrigin', label: 'Customer Origin', required: false },
    { id: 'postId', label: 'Post ID', required: false },
    { id: 'paymentMethod', label: 'Payment Method', required: false },
    { id: 'paymentTerms', label: 'Payment Terms (e.g., Net 30)', required: false },
    { id: 'internalKey', label: 'Internal Key', required: false },
    { id: 'discount', label: 'Discount (0-100)', required: false },
    { id: 'status', label: 'Status (active/inactive/suspended/blocked)', required: false },
    { id: 'newsletter', label: 'Newsletter Subscription (true/false)', required: false },
    { id: 'comment', label: 'Internal Comment', required: false }
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
            Assign CSV columns to the corresponding system fields. At least one column must be mapped.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {Object.values(columnMapping).filter(v => v).length === 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Please map at least one CSV column to a system field to proceed.
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
