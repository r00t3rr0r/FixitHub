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
  // Filter out any empty strings from CSV columns to prevent Radix UI Select errors
  const filteredCsvColumns = csvColumns.filter((col) => col && col.trim() !== '');

  // Service fields that need to be mapped
  const serviceFields = [
    { field: 'name', label: 'Service Name (Artikelname)', required: true, description: 'Full article name (e.g. "Apple iPhone 15 Display Reparatur")' },
    { field: 'category', label: 'Category / Service (Service)', required: true, description: 'Repair type, e.g. "Display Reparatur", "Akkutausch"' },
    { field: 'price', label: 'Price (generic)', required: false, description: 'Generic price column. Used if no gross/net price is mapped.' },
    { field: 'priceGross', label: 'Gross Price (Std. VK Brutto)', required: false, description: 'Sales price incl. VAT. Preferred over generic price.' },
    { field: 'priceNet', label: 'Net Price (Std. VK Netto)', required: false, description: 'Sales price excl. VAT.' },
    { field: 'purchasePrice', label: 'Purchase Cost (EK Netto)', required: false, description: 'Internal purchase cost.' },
    { field: 'manufacturer', label: 'Manufacturer (Hersteller)', required: false, description: 'Brand name (e.g. Apple, Samsung).' },
    { field: 'manufacturerPrecise', label: 'Manufacturer Precise (Hersteller_precise)', required: false, description: 'Exact brand match used by the repair configurator.' },
    { field: 'model', label: 'Model (Gerätemodell)', required: false, description: 'Device model name.' },
    { field: 'modelPrecise', label: 'Model Precise (Gerätemodell_precise)', required: false, description: 'Exact model match (e.g. "iPhone 15", "Galaxy A54 (A546B)"). Used to filter services per device.' },
    { field: 'color', label: 'Color (Farbe)', required: false, description: 'Color variant for the spare part.' },
    { field: 'description', label: 'Description', required: false, description: 'Free text description. Defaults to article name if empty.' },
    { field: 'estimatedTime', label: 'Estimated Time', required: false, description: 'Free text (e.g. "60" min or "2 hours").' },
    { field: 'deviceTypes', label: 'Device Types', required: false, description: 'Comma-separated list. Auto-derived from manufacturer + model if empty.' },
    { field: 'isActive', label: 'Active Status', required: false, description: 'true/false, ja/nein, 1/0. Defaults to true.' },
  ];

  // Check if all required fields are mapped (price counts if any of price/gross/net is mapped)
  const requiredFields = serviceFields.filter((f) => f.required);
  const isFieldMapped = (f: typeof serviceFields[number]) => {
    if (f.field === 'price') {
      return !!(columnMapping['price'] || columnMapping['priceGross'] || columnMapping['priceNet']);
    }
    return !!columnMapping[f.field];
  };
  const mappedRequiredFields = requiredFields.filter(isFieldMapped);
  const allRequiredFieldsMapped = mappedRequiredFields.length === requiredFields.length;

  // Get unmapped columns
  const mappedColumns = new Set(Object.values(columnMapping).filter((col) => col));
  const unmappedColumns = filteredCsvColumns.filter((col) => !mappedColumns.has(col));

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
              value={columnMapping[serviceField.field] || '__UNMAPPED__'}
              onValueChange={(value) => onColumnMappingChange(serviceField.field, value === '__UNMAPPED__' ? '' : value)}
            >
              <SelectTrigger id={`field-${serviceField.field}`}>
                <SelectValue placeholder="Select CSV column" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__UNMAPPED__">-- Not mapped --</SelectItem>
                {filteredCsvColumns.map((column) => (
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
              <li><strong>Category / Service:</strong> Free text repair type, e.g. "Display Reparatur", "Akkutausch", "USB-Anschluss"</li>
              <li><strong>Price:</strong> Numeric value, German (99,90) or English (99.90) format both supported</li>
              <li><strong>Manufacturer / Model Precise:</strong> Used by the repair configurator to show services for the selected device</li>
              <li><strong>Color:</strong> Optional color variant (e.g. "awesome black", "Schwarz")</li>
              <li><strong>Device Types:</strong> Comma-separated. Auto-derived from manufacturer + model if not provided.</li>
              <li><strong>Active Status:</strong> true/false, ja/nein, 1/0. Defaults to true.</li>
            </ul>
          </div>
        </AlertDescription>
      </Alert>
    </div>
  );
};

export default ServiceColumnAssignmentPanel;
