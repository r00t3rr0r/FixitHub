import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search, Package, AlertCircle } from 'lucide-react';
import { getParts, Part, PartVersion } from '@/api/parts';
import { assignEPartToOrder } from '@/api/adminOrders';
import { useToast } from '@/hooks/useToast';

interface EPartSelectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  onSuccess: () => void;
}

const EPartSelectionDialog: React.FC<EPartSelectionDialogProps> = ({
  open,
  onOpenChange,
  orderId,
  onSuccess,
}) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [parts, setParts] = useState<Part[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [selectedPart, setSelectedPart] = useState<Part | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<PartVersion | null>(null);
  const [quantity, setQuantity] = useState<number>(1);

  // Load parts on mount
  useEffect(() => {
    if (open) {
      loadParts();
    }
  }, [open]);

  const loadParts = async () => {
    try {
      setLoading(true);
      const filters: any = {};
      if (categoryFilter !== 'all') {
        filters.category = categoryFilter;
      }
      if (searchTerm) {
        filters.search = searchTerm;
      }

      const response = await getParts(filters);
      setParts(response.parts || []);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to load parts',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    loadParts();
  };

  const handleAssignEPart = async () => {
    if (!selectedPart || !selectedVersion) {
      toast({
        title: 'Error',
        description: 'Please select a part and version',
        variant: 'destructive',
      });
      return;
    }

    if (quantity <= 0) {
      toast({
        title: 'Error',
        description: 'Quantity must be greater than 0',
        variant: 'destructive',
      });
      return;
    }

    if (quantity > selectedVersion.quantity) {
      toast({
        title: 'Error',
        description: `Insufficient stock. Available: ${selectedVersion.quantity}`,
        variant: 'destructive',
      });
      return;
    }

    try {
      setAssigning(true);
      await assignEPartToOrder(orderId, selectedPart._id, selectedVersion._id, quantity);

      toast({
        title: 'Success',
        description: 'EPart assigned successfully',
      });

      // Reset form
      setSelectedPart(null);
      setSelectedVersion(null);
      setQuantity(1);

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to assign EPart',
        variant: 'destructive',
      });
    } finally {
      setAssigning(false);
    }
  };

  const categories = [
    'all',
    'display',
    'battery',
    'camera',
    'speaker',
    'microphone',
    'charging-port',
    'button',
    'sensor',
    'tool',
    'adhesive',
    'screw',
    'other',
  ];

  const getVersionBadgeColor = (versionType: string) => {
    switch (versionType) {
      case 'original':
        return 'bg-blue-500';
      case 'cheap':
        return 'bg-green-500';
      case 'efficient':
        return 'bg-purple-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Assign EPart to Order</DialogTitle>
          <DialogDescription>
            Search and select a part to assign to this order. The inventory will be updated automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Search and Filter Section */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <Label htmlFor="search">Search Parts</Label>
              <div className="flex gap-2">
                <Input
                  id="search"
                  placeholder="Search by name, SKU, or brand..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
                <Button onClick={handleSearch} size="icon" disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div>
              <Label htmlFor="category">Category</Label>
              <Select value={categoryFilter} onValueChange={(value) => {
                setCategoryFilter(value);
                setTimeout(loadParts, 100);
              }}>
                <SelectTrigger id="category">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat === 'all' ? 'All Categories' : cat.charAt(0).toUpperCase() + cat.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Parts List */}
          <div className="border rounded-lg p-4 space-y-2">
            <Label>Available Parts</Label>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : parts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <Package className="h-12 w-12 mb-2" />
                <p>No parts found</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {parts.map((part) => (
                  <div
                    key={part._id}
                    className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                      selectedPart?._id === part._id
                        ? 'border-primary bg-primary/5'
                        : 'hover:border-primary/50'
                    }`}
                    onClick={() => {
                      setSelectedPart(part);
                      setSelectedVersion(null);
                    }}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-medium">{part.itemName || part.name}</h4>
                        <p className="text-sm text-muted-foreground">
                          {part.description || part.itemDescription}
                        </p>
                        <div className="flex gap-2 mt-2">
                          <Badge variant="outline">{part.category}</Badge>
                          <Badge variant="outline">{part.brand}</Badge>
                          {part.partNumber && (
                            <Badge variant="secondary">{part.partNumber}</Badge>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">
                          Total Stock: {part.stockQuantity || 0}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {part.versions?.length || 0} version(s)
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Version Selection */}
          {selectedPart && selectedPart.versions && selectedPart.versions.length > 0 && (
            <div className="border rounded-lg p-4 space-y-2">
              <Label>Select Version</Label>
              <div className="space-y-2">
                {selectedPart.versions.map((version) => (
                  <div
                    key={version._id}
                    className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                      selectedVersion?._id === version._id
                        ? 'border-primary bg-primary/5'
                        : 'hover:border-primary/50'
                    } ${version.quantity === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                    onClick={() => {
                      if (version.quantity > 0) {
                        setSelectedVersion(version);
                      }
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Badge className={getVersionBadgeColor(version.versionType)}>
                          {version.versionType.toUpperCase()}
                        </Badge>
                        <div>
                          <p className="text-sm font-medium">
                            ${version.sellingPrice?.toFixed(2) || '0.00'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Location: {version.storageLocation}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-medium ${version.quantity === 0 ? 'text-red-500' : ''}`}>
                          Stock: {version.quantity}
                        </p>
                        {version.quantity <= version.minStockLevel && version.quantity > 0 && (
                          <div className="flex items-center gap-1 text-yellow-600">
                            <AlertCircle className="h-3 w-3" />
                            <span className="text-xs">Low Stock</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quantity Input */}
          {selectedVersion && (
            <div>
              <Label htmlFor="quantity">Quantity</Label>
              <Input
                id="quantity"
                type="number"
                min="1"
                max={selectedVersion.quantity}
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Available: {selectedVersion.quantity}
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleAssignEPart}
            disabled={!selectedPart || !selectedVersion || assigning}
          >
            {assigning ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Assigning...
              </>
            ) : (
              'Assign EPart'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EPartSelectionDialog;
