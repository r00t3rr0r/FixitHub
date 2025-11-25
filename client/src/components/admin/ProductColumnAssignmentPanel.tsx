import React from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

interface ProductColumnAssignmentPanelProps {
  csvHeaders: string[];
  columnMapping: Record<string, string>;
  onColumnMappingChange: (mapping: Record<string, string>) => void;
}

const ProductColumnAssignmentPanel: React.FC<ProductColumnAssignmentPanelProps> = ({
  csvHeaders,
  columnMapping,
  onColumnMappingChange,
}) => {
  const requiredFields = [
    { key: 'name', label: 'Product Name *', description: 'Full name of the product' },
    { key: 'category', label: 'Category *', description: 'Product category (e.g., Accessories, Parts)' },
    { key: 'price', label: 'Price *', description: 'Product price (numeric value)' },
  ];

  const optionalFields = [
    { key: 'description', label: 'Description', description: 'Product description' },
    { key: 'brand', label: 'Brand', description: 'Product brand or manufacturer' },
    { key: 'sku', label: 'SKU', description: 'Stock Keeping Unit (unique identifier)' },
    { key: 'stockQuantity', label: 'Stock Quantity', description: 'Available quantity (integer)' },
    { key: 'lowStockThreshold', label: 'Low Stock Threshold', description: 'Minimum stock alert level (integer)' },
    { key: 'discount', label: 'Discount %', description: 'Discount percentage (0-100)' },
    { key: 'images', label: 'Images', description: 'Comma-separated image URLs' },
    { key: 'features', label: 'Features', description: 'Comma-separated list of features' },
    { key: 'compatibility', label: 'Compatibility', description: 'Comma-separated compatible devices' },
    { key: 'weight', label: 'Weight (kg)', description: 'Product weight in kilograms' },
    { key: 'dimensionLength', label: 'Length (cm)', description: 'Product length in centimeters' },
    { key: 'dimensionWidth', label: 'Width (cm)', description: 'Product width in centimeters' },
    { key: 'dimensionHeight', label: 'Height (cm)', description: 'Product height in centimeters' },
    { key: 'tags', label: 'Tags', description: 'Comma-separated tags for searching' },
  ];

  const handleFieldChange = (field: string, value: string) => {
    const newMapping = { ...columnMapping };

    if (value === 'none') {
      delete newMapping[field];
    } else {
      newMapping[field] = value;
    }

    onColumnMappingChange(newMapping);
  };

  const getMappedFields = () => {
    return Object.keys(columnMapping);
  };

  const getUnmappedRequiredFields = () => {
    return requiredFields.filter(field => !columnMapping[field.key]);
  };

  const renderFieldSelector = (field: { key: string; label: string; description: string }, isRequired: boolean) => {
    // Filter out empty or invalid headers to prevent Radix UI SelectItem errors
    const validHeaders = csvHeaders.filter(header => header && header.trim() !== '');

    return (
      <div key={field.key} className="space-y-2">
        <Label htmlFor={field.key}>
          {field.label}
          {isRequired && <span className="text-red-500 ml-1">*</span>}
        </Label>
        <Select
          value={columnMapping[field.key] || 'none'}
          onValueChange={(value) => handleFieldChange(field.key, value)}
        >
          <SelectTrigger id={field.key}>
            <SelectValue placeholder="Select CSV column" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">-- Do not import --</SelectItem>
            {validHeaders.map((header) => (
              <SelectItem key={header} value={header}>
                {header}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground">{field.description}</p>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Column Assignment</h3>
        <p className="text-sm text-muted-foreground">
          Map the columns from your CSV file to the product fields in the system.
        </p>
      </div>

      {getUnmappedRequiredFields().length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Please map all required fields: {getUnmappedRequiredFields().map(f => f.label).join(', ')}
          </AlertDescription>
        </Alert>
      )}

      {getUnmappedRequiredFields().length === 0 && (
        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>
            All required fields are mapped. You can proceed to validation.
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-4">
        <div>
          <h4 className="font-semibold mb-3">Required Fields</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {requiredFields.map((field) => renderFieldSelector(field, true))}
          </div>
        </div>

        <div>
          <h4 className="font-semibold mb-3">Optional Fields</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {optionalFields.map((field) => renderFieldSelector(field, false))}
          </div>
        </div>
      </div>

      <div className="bg-muted p-4 rounded-md">
        <h4 className="font-semibold mb-2">Format Guidelines</h4>
        <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
          <li><strong>Price:</strong> Numeric value (e.g., 29.99)</li>
          <li><strong>Stock Quantity:</strong> Integer value (e.g., 100)</li>
          <li><strong>Discount:</strong> Percentage value between 0-100 (e.g., 15)</li>
          <li><strong>Weight & Dimensions:</strong> Numeric values</li>
          <li><strong>Lists (Images, Features, etc.):</strong> Comma-separated values</li>
          <li><strong>SKU:</strong> Unique identifier for each product</li>
        </ul>
      </div>
    </div>
  );
};

export default ProductColumnAssignmentPanel;
