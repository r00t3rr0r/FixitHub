import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Textarea } from '../../components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Separator } from '../../components/ui/separator';
import { ScrollArea } from '../../components/ui/scroll-area';
import { Plus, Search, Edit, Trash2, Package, AlertTriangle, Eye, DollarSign, MapPin, Calendar, Info } from 'lucide-react';
import { getParts, createInventoryItem, updatePart, deletePart, Part, PartVersion } from '../../api/parts';
import { useToast } from '../../hooks/useToast';

export function PartsManagement() {
  const [parts, setParts] = useState<Part[]>([]);
  const [filteredParts, setFilteredParts] = useState<Part[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [brandFilter, setBrandFilter] = useState('all');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [selectedPart, setSelectedPart] = useState<Part | null>(null);
  const [totalValue, setTotalValue] = useState(0);
  const [lowStockCount, setLowStockCount] = useState(0);
  const { toast } = useToast();

  // Form state for add/edit
  const [formData, setFormData] = useState({
    itemName: '',
    itemDescription: '',
    category: '',
    manufacturer: '',
    brand: '',
    compatibleDevices: [] as string[],
    specifications: {} as { [key: string]: string },
    versions: [] as Partial<PartVersion>[]
  });

  useEffect(() => {
    fetchParts();
  }, []);

  useEffect(() => {
    filterParts();
  }, [parts, searchTerm, categoryFilter, brandFilter]);

  const fetchParts = async () => {
    try {
      console.log('Fetching parts data...');
      setLoading(true);
      const response = await getParts();
      console.log('Parts data received:', response);
      setParts(response.parts || []);
      setTotalValue(response.totalValue || 0);
      setLowStockCount(response.lowStockCount || 0);
    } catch (error) {
      console.error('Error fetching parts:', error);
      toast({
        title: "Error",
        description: "Failed to fetch parts data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filterParts = () => {
    let filtered = parts;

    if (searchTerm) {
      filtered = filtered.filter(part =>
        part.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        part.partNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        part.brand?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (categoryFilter !== 'all') {
      filtered = filtered.filter(part => part.category === categoryFilter);
    }

    if (brandFilter !== 'all') {
      filtered = filtered.filter(part => part.brand === brandFilter);
    }

    setFilteredParts(filtered);
  };

  const handleRowClick = (part: Part) => {
    console.log('PartsManagement: Opening detail view for part:', part._id);
    setSelectedPart(part);
    setShowDetailDialog(true);
  };

  const handleEditClick = (e: React.MouseEvent, part: Part) => {
    e.stopPropagation(); // Prevent row click
    console.log('PartsManagement: Opening edit dialog for part:', part._id);
    setSelectedPart(part);
    setFormData({
      itemName: part.name || '',
      itemDescription: part.description || '',
      category: part.category || '',
      manufacturer: part.supplier || '',
      brand: part.brand || '',
      compatibleDevices: part.compatibleDevices || [],
      specifications: part.specifications || {},
      versions: part.versions || []
    });
    setShowEditDialog(true);
  };

  const handleDeleteClick = async (e: React.MouseEvent, partId: string) => {
    e.stopPropagation(); // Prevent row click
    if (window.confirm('Are you sure you want to delete this part?')) {
      try {
        await deletePart(partId);
        toast({
          title: "Success",
          description: "Part deleted successfully",
        });
        fetchParts();
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to delete part",
          variant: "destructive",
        });
      }
    }
  };

  const handleAddPart = async () => {
    try {
      console.log('PartsManagement: Adding new part with data:', formData);
      await createInventoryItem(formData);
      toast({
        title: "Success",
        description: "Part added successfully",
      });
      setShowAddDialog(false);
      resetForm();
      fetchParts();
    } catch (error) {
      console.error('Error adding part:', error);
      toast({
        title: "Error",
        description: "Failed to add part",
        variant: "destructive",
      });
    }
  };

  const handleUpdatePart = async () => {
    if (!selectedPart) return;
    
    try {
      console.log('PartsManagement: Updating part with data:', formData);
      await updatePart(selectedPart._id, formData);
      toast({
        title: "Success",
        description: "Part updated successfully",
      });
      setShowEditDialog(false);
      resetForm();
      fetchParts();
    } catch (error) {
      console.error('Error updating part:', error);
      toast({
        title: "Error",
        description: "Failed to update part",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setFormData({
      itemName: '',
      itemDescription: '',
      category: '',
      manufacturer: '',
      brand: '',
      compatibleDevices: [],
      specifications: {},
      versions: []
    });
    setSelectedPart(null);
  };

  const addVersion = () => {
    setFormData(prev => ({
      ...prev,
      versions: [...prev.versions, {
        versionType: 'original',
        quantity: 0,
        minStockLevel: 5,
        reorderLevel: 10,
        unitCost: 0,
        sellingPrice: 0,
        storageLocation: '',
        supplierInfo: {
          name: '',
          contactPerson: '',
          email: '',
          phone: '',
          address: ''
        },
        leadTime: 7,
        status: 'active',
        notes: '',
        images: []
      }]
    }));
  };

  const removeVersion = (index: number) => {
    setFormData(prev => ({
      ...prev,
      versions: prev.versions.filter((_, i) => i !== index)
    }));
  };

  const updateVersion = (index: number, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      versions: prev.versions.map((version, i) => 
        i === index ? { ...version, [field]: value } : version
      )
    }));
  };

  const getStockStatus = (part: Part) => {
    const totalStock = part.stockQuantity || 0;
    const minStock = part.minStockLevel || 0;
    
    if (totalStock === 0) {
      return <Badge variant="destructive">Out of Stock</Badge>;
    } else if (totalStock <= minStock) {
      return <Badge variant="secondary">Low Stock</Badge>;
    } else {
      return <Badge variant="default">In Stock</Badge>;
    }
  };

  const categories = [
    'display', 'battery', 'camera', 'speaker', 'microphone', 
    'charging-port', 'button', 'sensor', 'tool', 'adhesive', 'screw', 'other'
  ];

  const versionTypes = [
    { value: 'original', label: 'Original' },
    { value: 'cheap', label: 'Cheap' },
    { value: 'efficient', label: 'Efficient' }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Loading parts...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Parts Management</h1>
          <p className="text-muted-foreground">Manage inventory parts and supplies</p>
        </div>
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button onClick={() => {
              console.log('PartsManagement: Add Part button clicked');
              resetForm();
              setShowAddDialog(true);
            }}>
              <Plus className="mr-2 h-4 w-4" />
              Add Part
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New Part</DialogTitle>
            </DialogHeader>
            <AddEditPartForm
              formData={formData}
              setFormData={setFormData}
              onSubmit={handleAddPart}
              onCancel={() => setShowAddDialog(false)}
              categories={categories}
              versionTypes={versionTypes}
              addVersion={addVersion}
              removeVersion={removeVersion}
              updateVersion={updateVersion}
              isEdit={false}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Parts</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{parts.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Value</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalValue.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Low Stock Items</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{lowStockCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Parts Inventory</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search parts..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Filter by category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map(category => (
                  <SelectItem key={category} value={category}>
                    {category.charAt(0).toUpperCase() + category.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={brandFilter} onValueChange={setBrandFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Filter by brand" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Brands</SelectItem>
                {Array.from(new Set(parts.map(p => p.brand))).map(brand => (
                  <SelectItem key={brand} value={brand}>
                    {brand}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Parts Table */}
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Part Number</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Brand</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredParts.map((part) => (
                  <TableRow 
                    key={part._id} 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleRowClick(part)}
                  >
                    <TableCell className="font-medium">{part.partNumber}</TableCell>
                    <TableCell>{part.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {part.category?.charAt(0).toUpperCase() + part.category?.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell>{part.brand}</TableCell>
                    <TableCell>{part.stockQuantity}</TableCell>
                    <TableCell>{getStockStatus(part)}</TableCell>
                    <TableCell>{part.location}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => handleEditClick(e, part)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => handleDeleteClick(e, part._id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Part</DialogTitle>
          </DialogHeader>
          <AddEditPartForm
            formData={formData}
            setFormData={setFormData}
            onSubmit={handleUpdatePart}
            onCancel={() => setShowEditDialog(false)}
            categories={categories}
            versionTypes={versionTypes}
            addVersion={addVersion}
            removeVersion={removeVersion}
            updateVersion={updateVersion}
            isEdit={true}
          />
        </DialogContent>
      </Dialog>

      {/* Detail View Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Part Details
            </DialogTitle>
          </DialogHeader>
          {selectedPart && <PartDetailView part={selectedPart} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Part Detail View Component
function PartDetailView({ part }: { part: Part }) {
  return (
    <div className="space-y-6">
      {/* Basic Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-4 w-4" />
              Basic Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Part Number</Label>
              <p className="text-sm font-mono">{part.partNumber}</p>
            </div>
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Name</Label>
              <p className="text-sm">{part.name}</p>
            </div>
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Description</Label>
              <p className="text-sm">{part.description || 'No description available'}</p>
            </div>
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Category</Label>
              <Badge variant="outline" className="ml-2">
                {part.category?.charAt(0).toUpperCase() + part.category?.slice(1)}
              </Badge>
            </div>
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Brand</Label>
              <p className="text-sm">{part.brand}</p>
            </div>
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Supplier</Label>
              <p className="text-sm">{part.supplier}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Stock Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Current Stock</Label>
              <p className="text-2xl font-bold">{part.stockQuantity}</p>
            </div>
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Minimum Stock Level</Label>
              <p className="text-sm">{part.minStockLevel}</p>
            </div>
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Storage Location</Label>
              <p className="text-sm flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {part.location}
              </p>
            </div>
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Condition</Label>
              <Badge variant="default">{part.condition}</Badge>
            </div>
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Warranty</Label>
              <p className="text-sm">{part.warranty} days</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pricing Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Pricing Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Cost Price</Label>
              <p className="text-lg font-semibold">${part.cost?.toFixed(2)}</p>
            </div>
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Selling Price</Label>
              <p className="text-lg font-semibold">${part.sellingPrice?.toFixed(2)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Compatible Devices */}
      {part.compatibleDevices && part.compatibleDevices.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Compatible Devices</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {part.compatibleDevices.map((device, index) => (
                <Badge key={index} variant="secondary">
                  {device}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Specifications */}
      {part.specifications && Object.keys(part.specifications).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Specifications</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {Object.entries(part.specifications).map(([key, value]) => (
                <div key={key}>
                  <Label className="text-sm font-medium text-muted-foreground">
                    {key.charAt(0).toUpperCase() + key.slice(1)}
                  </Label>
                  <p className="text-sm">{value}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Versions */}
      {part.versions && part.versions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Part Versions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {part.versions.map((version, index) => (
                <div key={version._id || index} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <Badge variant="outline">
                      {version.versionType?.charAt(0).toUpperCase() + version.versionType?.slice(1)}
                    </Badge>
                    <Badge variant={version.status === 'active' ? 'default' : 'secondary'}>
                      {version.status}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div>
                      <Label className="text-xs text-muted-foreground">Quantity</Label>
                      <p className="font-medium">{version.quantity}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Unit Cost</Label>
                      <p className="font-medium">${version.unitCost?.toFixed(2)}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Selling Price</Label>
                      <p className="font-medium">${version.sellingPrice?.toFixed(2)}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Location</Label>
                      <p className="font-medium">{version.storageLocation}</p>
                    </div>
                  </div>
                  {version.notes && (
                    <div className="mt-3">
                      <Label className="text-xs text-muted-foreground">Notes</Label>
                      <p className="text-sm">{version.notes}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Last Updated */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            Last updated: {part.lastUpdated ? new Date(part.lastUpdated).toLocaleString() : 'Unknown'}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Add/Edit Part Form Component
function AddEditPartForm({
  formData,
  setFormData,
  onSubmit,
  onCancel,
  categories,
  versionTypes,
  addVersion,
  removeVersion,
  updateVersion,
  isEdit
}: {
  formData: any;
  setFormData: (data: any) => void;
  onSubmit: () => void;
  onCancel: () => void;
  categories: string[];
  versionTypes: { value: string; label: string }[];
  addVersion: () => void;
  removeVersion: (index: number) => void;
  updateVersion: (index: number, field: string, value: any) => void;
  isEdit: boolean;
}) {
  return (
    <div className="space-y-6">
      <Tabs defaultValue="basic" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="basic">Basic Info</TabsTrigger>
          <TabsTrigger value="versions">Versions</TabsTrigger>
          <TabsTrigger value="additional">Additional</TabsTrigger>
        </TabsList>

        <TabsContent value="basic" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="itemName">Item Name *</Label>
              <Input
                id="itemName"
                value={formData.itemName}
                onChange={(e) => setFormData(prev => ({ ...prev, itemName: e.target.value }))}
                placeholder="Enter item name"
              />
            </div>
            <div>
              <Label htmlFor="category">Category *</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(category => (
                    <SelectItem key={category} value={category}>
                      {category.charAt(0).toUpperCase() + category.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="manufacturer">Manufacturer *</Label>
              <Input
                id="manufacturer"
                value={formData.manufacturer}
                onChange={(e) => setFormData(prev => ({ ...prev, manufacturer: e.target.value }))}
                placeholder="Enter manufacturer"
              />
            </div>
            <div>
              <Label htmlFor="brand">Brand *</Label>
              <Input
                id="brand"
                value={formData.brand}
                onChange={(e) => setFormData(prev => ({ ...prev, brand: e.target.value }))}
                placeholder="Enter brand"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="itemDescription">Description</Label>
            <Textarea
              id="itemDescription"
              value={formData.itemDescription}
              onChange={(e) => setFormData(prev => ({ ...prev, itemDescription: e.target.value }))}
              placeholder="Enter item description"
            />
          </div>
        </TabsContent>

        <TabsContent value="versions" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium">Part Versions</h3>
            <Button type="button" onClick={addVersion} variant="outline">
              <Plus className="mr-2 h-4 w-4" />
              Add Version
            </Button>
          </div>
          
          <ScrollArea className="h-[400px]">
            <div className="space-y-4">
              {formData.versions.map((version: any, index: number) => (
                <Card key={index}>
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-center">
                      <CardTitle className="text-sm">Version {index + 1}</CardTitle>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeVersion(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <Label>Version Type *</Label>
                        <Select
                          value={version.versionType}
                          onValueChange={(value) => updateVersion(index, 'versionType', value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent>
                            {versionTypes.map(type => (
                              <SelectItem key={type.value} value={type.value}>
                                {type.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Quantity *</Label>
                        <Input
                          type="number"
                          value={version.quantity || 0}
                          onChange={(e) => updateVersion(index, 'quantity', parseInt(e.target.value) || 0)}
                          min="0"
                        />
                      </div>
                      <div>
                        <Label>Min Stock Level</Label>
                        <Input
                          type="number"
                          value={version.minStockLevel || 5}
                          onChange={(e) => updateVersion(index, 'minStockLevel', parseInt(e.target.value) || 5)}
                          min="0"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <Label>Unit Cost *</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={version.unitCost || 0}
                          onChange={(e) => updateVersion(index, 'unitCost', parseFloat(e.target.value) || 0)}
                          min="0"
                        />
                      </div>
                      <div>
                        <Label>Selling Price *</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={version.sellingPrice || 0}
                          onChange={(e) => updateVersion(index, 'sellingPrice', parseFloat(e.target.value) || 0)}
                          min="0"
                        />
                      </div>
                    </div>
                    <div>
                      <Label>Storage Location *</Label>
                      <Input
                        value={version.storageLocation || ''}
                        onChange={(e) => updateVersion(index, 'storageLocation', e.target.value)}
                        placeholder="Enter storage location"
                      />
                    </div>
                    <div>
                      <Label>Notes</Label>
                      <Textarea
                        value={version.notes || ''}
                        onChange={(e) => updateVersion(index, 'notes', e.target.value)}
                        placeholder="Enter notes"
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="additional" className="space-y-4">
          <div>
            <Label>Compatible Devices</Label>
            <Input
              value={formData.compatibleDevices.join(', ')}
              onChange={(e) => setFormData(prev => ({ 
                ...prev, 
                compatibleDevices: e.target.value.split(',').map(d => d.trim()).filter(d => d) 
              }))}
              placeholder="Enter compatible devices (comma separated)"
            />
          </div>
        </TabsContent>
      </Tabs>

      <Separator />

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="button" onClick={onSubmit}>
          {isEdit ? 'Update Part' : 'Add Part'}
        </Button>
      </div>
    </div>
  );
}