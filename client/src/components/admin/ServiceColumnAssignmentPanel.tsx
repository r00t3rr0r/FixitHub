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

const NOT_MAPPED_VALUE = '__UNMAPPED__';
const COLUMN_OPTION_PREFIX = '__CSV_COL__';

const ServiceColumnAssignmentPanel: React.FC<ServiceColumnAssignmentPanelProps> = ({
  csvColumns,
  columnMapping,
  onColumnMappingChange,
}) => {
  const normalizeDisplayColumn = (value: string) => {
    return String(value)
      .replace(/^\uFEFF/, '')
      .replace(/[\x00-\x1F\x7F]/g, ' ')
      .trim();
  };

  // Build stable option IDs for Radix Select and avoid duplicate/invalid raw values.
  const columnOptions = Array.from(
    csvColumns.reduce((acc, rawColumn, index) => {
      const raw = String(rawColumn ?? '');
      const label = normalizeDisplayColumn(raw);
      if (!label || raw === '__parsed_extra' || acc.seen.has(raw)) {
        return acc;
      }
      acc.seen.add(raw);
      acc.items.push({
        id: `${COLUMN_OPTION_PREFIX}${index}`,
        raw,
        label,
      });
      return acc;
    }, {
      seen: new Set<string>(),
      items: [] as Array<{ id: string; raw: string; label: string }>,
    }).items
  );

  // Service fields that need to be mapped
  const serviceFields = [
    { field: 'articleNumber', label: 'Artikelnummer', required: false, description: 'Internal article number / SKU.' },
    { field: 'name', label: 'Service Name (Artikelname)', required: true, description: 'Full article name (e.g. "Apple iPhone 15 Display Reparatur")' },
    { field: 'service', label: 'Service', required: false, description: 'Service family/type field from source CSV.' },
    { field: 'category', label: 'Category / Service (Service)', required: true, description: 'Repair type, e.g. "Display Reparatur", "Akkutausch"' },
    { field: 'price', label: 'Price (generic)', required: false, description: 'Generic price column. Used if no gross/net price is mapped.' },
    { field: 'priceGross', label: 'Gross Price (Std. VK Brutto)', required: false, description: 'Sales price incl. VAT. Preferred over generic price.' },
    { field: 'priceNet', label: 'Net Price (Std. VK Netto)', required: false, description: 'Sales price excl. VAT.' },
    { field: 'purchasePrice', label: 'Purchase Cost (EK Netto)', required: false, description: 'Internal purchase cost.' },
    { field: 'msrp', label: 'UVP', required: false, description: 'Recommended retail price.' },
    { field: 'taxClass', label: 'Steuerklasse', required: false, description: 'Tax class from ERP/JTL export.' },
    { field: 'source', label: '_quelle', required: false, description: 'Source/origin marker from CSV.' },
    { field: 'manufacturer', label: 'Manufacturer (Hersteller)', required: false, description: 'Brand name (e.g. Apple, Samsung).' },
    { field: 'manufacturerPrecise', label: 'Manufacturer Precise (Hersteller_precise)', required: false, description: 'Exact brand match used by the repair configurator.' },
    { field: 'model', label: 'Model (Gerätemodell)', required: false, description: 'Device model name.' },
    { field: 'modelPrecise', label: 'Model Precise (Gerätemodell_precise)', required: false, description: 'Exact model match (e.g. "iPhone 15", "Galaxy A54 (A546B)"). Used to filter services per device.' },
    { field: 'color', label: 'Color (Farbe)', required: false, description: 'Color variant for the spare part.' },
    { field: 'searchKeywords', label: 'Suchbegriffe', required: false, description: 'Keywords used for search and discoverability.' },
    { field: 'seoName', label: 'SEO Namen (Suchmaschienenname)', required: false, description: 'SEO-friendly URL/slug name.' },
    { field: 'seoTitleTag', label: 'SEO Titel-Tag', required: false, description: 'SEO title tag.' },
    { field: 'seoMetaKeywords', label: 'SEO Meta-Keywords', required: false, description: 'SEO meta keywords.' },
    { field: 'seoMetaDescription', label: 'SEO Meta-Description', required: false, description: 'SEO meta description.' },
    { field: 'shortDescription', label: 'Kurzbeschreibung', required: false, description: 'Short service summary.' },
    { field: 'description', label: 'Description', required: false, description: 'Free text description. Defaults to article name if empty.' },
    { field: 'printShortDescription', label: 'Druck Kurzbeschreibung', required: false, description: 'Short print description.' },
    { field: 'printDescription', label: 'Druck Beschreibung', required: false, description: 'Long print description.' },
    { field: 'note', label: 'Amerkung / Anmerkung', required: false, description: 'Internal note from CSV.' },
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
  const unmappedColumns = columnOptions.filter((col) => !mappedColumns.has(col.raw));

  const getSelectValue = (field: string) => {
    const mappedColumn = columnMapping[field];
    const option = columnOptions.find((col) => col.raw === mappedColumn);
    return option?.id || NOT_MAPPED_VALUE;
  };

  const handleSelectValueChange = (field: string, value: string) => {
    if (value === NOT_MAPPED_VALUE) {
      onColumnMappingChange(field, '');
      return;
    }
    const option = columnOptions.find((col) => col.id === value);
    onColumnMappingChange(field, option?.raw || '');
  };

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
              value={getSelectValue(serviceField.field)}
              onValueChange={(value) => handleSelectValueChange(serviceField.field, value)}
            >
              <SelectTrigger id={`field-${serviceField.field}`}>
                <SelectValue placeholder="Select CSV column" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NOT_MAPPED_VALUE}>-- Not mapped --</SelectItem>
                {columnOptions.map((column) => (
                  <SelectItem key={column.id} value={column.id}>
                    {column.label}
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
                  <Badge key={col.id} variant="secondary">
                    {col.label}
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
