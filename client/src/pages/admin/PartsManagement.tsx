import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Textarea } from '../../components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Separator } from '../../components/ui/separator';
import { ScrollArea } from '../../components/ui/scroll-area';
import { Checkbox } from '../../components/ui/checkbox';
import { Plus, Search, Edit, Trash2, Package, AlertTriangle, Eye, DollarSign, MapPin, Calendar, Info, ListPlus, ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight, Upload } from 'lucide-react';
import { getParts, createInventoryItem, updatePart, deletePart, Part, PartVersion } from '../../api/parts';
import { getNeedLists, createNeedList, addItemToNeedList, NeedList } from '../../api/needLists';
import { PartsCSVImportDialog } from '../../components/admin/PartsCSVImportDialog';
import { useToast } from '../../hooks/useToast';

const adminDialogHeaderClassName = "-mx-4 -mt-4 border-b border-[#2a3f7e] bg-[#1a2a5e] px-4 py-2.5 text-left text-white sm:-mx-5 sm:-mt-5 sm:px-5";
const compactFieldClassName = "h-8 text-xs";
const compactLabelClassName = "text-[11px] font-medium uppercase tracking-wide text-muted-foreground";

export function PartsManagement() {
  const { t } = useTranslation()
  const [parts, setParts] = useState<Part[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [modelFilter, setModelFilter] = useState('all');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Sorting state
  const [sortBy, setSortBy] = useState<string>('lastUpdated');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [selectedPart, setSelectedPart] = useState<Part | null>(null);
  const [totalValue, setTotalValue] = useState(0);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [selectedParts, setSelectedParts] = useState<Set<string>>(new Set());
  const [showAddToNeedListDialog, setShowAddToNeedListDialog] = useState(false);
  const [needLists, setNeedLists] = useState<NeedList[]>([]);
  const [selectedNeedList, setSelectedNeedList] = useState<string>('');
  const [createNewNeedList, setCreateNewNeedList] = useState(false);
  const [newNeedListName, setNewNeedListName] = useState('');
  const [newNeedListDescription, setNewNeedListDescription] = useState('');
  const [newNeedListPriority, setNewNeedListPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [addingToNeedList, setAddingToNeedList] = useState(false);
  const [showCSVImportDialog, setShowCSVImportDialog] = useState(false);
  const { toast } = useToast();

  // Form state for add/edit
  const [formData, setFormData] = useState({
    itemName: '',
    itemDescription: '',
    category: '',
    manufacturer: '',
    model: '',
    date: null as Date | null,
    compatibleDevices: [] as string[],
    specifications: {} as { [key: string]: string },
    versions: [] as Partial<PartVersion>[]
  });

  // Auto-generate Item Name when manufacturer, model, or category changes
  const generateItemName = (manufacturer: string, model: string, category: string) => {
    if (manufacturer && model && category) {
      return `${manufacturer} ${model} ${category}`;
    }
    return '';
  };

  useEffect(() => {
    fetchParts();
  }, [currentPage, itemsPerPage, searchTerm, categoryFilter, modelFilter, sortBy, sortOrder]);

  const fetchParts = async () => {
    try {
      console.log('PartsManagement: Fetching parts data with pagination and sorting...');
      setLoading(true);

      const filters = {
        page: currentPage,
        limit: itemsPerPage,
        sortBy,
        sortOrder,
        search: searchTerm || undefined,
        category: categoryFilter !== 'all' ? categoryFilter : undefined,
        model: modelFilter !== 'all' ? modelFilter : undefined
      };

      const response = await getParts(filters);
      console.log('PartsManagement: Parts data received:', response);

      setParts(response.parts || []);
      setTotalPages(response.totalPages || 1);
      setTotalItems(response.totalItems || 0);
      setTotalValue(response.totalValue || 0);
      setLowStockCount(response.lowStockCount || 0);
    } catch (error) {
      console.error('PartsManagement: Error fetching parts:', error);
      toast({
        title: t('common.error'),
        description: t('partsManagement.failedToLoadParts'),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
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
      itemName: part.itemName || part.name || '',
      itemDescription: part.itemDescription || part.description || '',
      category: part.category || '',
      manufacturer: part.manufacturer || part.supplier || '',
      model: part.model || '',
      date: part.date ? new Date(part.date) : null,
      compatibleDevices: part.compatibleDevices || [],
      specifications: part.specifications || {},
      versions: part.versions || []
    });
    setShowEditDialog(true);
  };

  const handleDeleteClick = async (e: React.MouseEvent, partId: string) => {
    e.stopPropagation(); // Prevent row click
    if (window.confirm(t('partsManagement.confirmDelete'))) {
      try {
        await deletePart(partId);
        toast({
          title: t('common.success'),
          description: t('partsManagement.partDeleted'),
        });
        fetchParts();
      } catch (error) {
        toast({
          title: t('common.error'),
          description: t('partsManagement.failedToDeletePart'),
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
        title: t('common.success'),
        description: t('partsManagement.partCreatedSuccess'),
      });
      setShowAddDialog(false);
      resetForm();
      fetchParts();
    } catch (error) {
      console.error('Error adding part:', error);
      toast({
        title: t('common.error'),
        description: t('partsManagement.failedToCreatePart'),
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
        title: t('common.success'),
        description: t('partsManagement.partUpdated'),
      });
      setShowEditDialog(false);
      resetForm();
      fetchParts();
    } catch (error) {
      console.error('Error updating part:', error);
      toast({
        title: t('common.error'),
        description: t('partsManagement.failedToUpdatePart'),
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
      model: '',
      date: null,
      compatibleDevices: [],
      specifications: {},
      versions: []
    });
    setSelectedPart(null);
  };

  const handleSelectPart = (partId: string, checked: boolean) => {
    const newSelection = new Set(selectedParts);
    if (checked) {
      newSelection.add(partId);
    } else {
      newSelection.delete(partId);
    }
    setSelectedParts(newSelection);
  };

  const handleSelectAllParts = (checked: boolean) => {
    if (checked) {
      setSelectedParts(new Set(parts.map(p => p._id)));
    } else {
      setSelectedParts(new Set());
    }
  };

  const handleSort = (column: string) => {
    console.log('PartsManagement: Sorting by column:', column);
    if (sortBy === column) {
      // Toggle sort order if clicking the same column
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      // Set new column and default to ascending
      setSortBy(column);
      setSortOrder('asc');
    }
    // Reset to first page when sorting changes
    setCurrentPage(1);
  };

  const getSortIcon = (column: string) => {
    if (sortBy !== column) {
      return <ChevronsUpDown className="ml-1 h-4 w-4 inline-block text-muted-foreground" />;
    }
    return sortOrder === 'asc'
      ? <ChevronUp className="ml-1 h-4 w-4 inline-block" />
      : <ChevronDown className="ml-1 h-4 w-4 inline-block" />;
  };

  const handlePageChange = (newPage: number) => {
    console.log('PartsManagement: Changing to page:', newPage);
    setCurrentPage(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleItemsPerPageChange = (value: string) => {
    console.log('PartsManagement: Changing items per page to:', value);
    setItemsPerPage(parseInt(value));
    setCurrentPage(1); // Reset to first page
  };

  const fetchNeedLists = async () => {
    try {
      console.log('Fetching need lists...');
      const lists = await getNeedLists({ status: 'draft' });
      setNeedLists(lists);
    } catch (error) {
      console.error('Error fetching need lists:', error);
      toast({
        title: t('common.error'),
        description: "Failed to fetch need lists",
        variant: "destructive",
      });
    }
  };

  const handleOpenAddToNeedList = async () => {
    if (selectedParts.size === 0) {
      toast({
        title: "No parts selected",
        description: "Please select at least one part to add to a need list",
        variant: "destructive",
      });
      return;
    }
    await fetchNeedLists();
    setShowAddToNeedListDialog(true);
  };

  const handleAddToNeedList = async () => {
    try {
      setAddingToNeedList(true);

      // Get selected part objects
      const partsToAdd = parts.filter(p => selectedParts.has(p._id));

      let targetNeedListId = selectedNeedList;

      // Create new need list if requested
      if (createNewNeedList) {
        if (!newNeedListName.trim()) {
          toast({
            title: t('common.error'),
            description: "Please enter a name for the new need list",
            variant: "destructive",
          });
          setAddingToNeedList(false);
          return;
        }

        console.log('Creating new need list:', newNeedListName);
        const newList = await createNeedList({
          name: newNeedListName,
          description: newNeedListDescription,
          priority: newNeedListPriority,
          items: [] // Will add items next
        });
        targetNeedListId = newList._id;
      }

      if (!targetNeedListId) {
        toast({
          title: t('common.error'),
          description: "Please select a need list or create a new one",
          variant: "destructive",
        });
        setAddingToNeedList(false);
        return;
      }

      // Add each selected part to the need list
      console.log(`Adding ${partsToAdd.length} parts to need list ${targetNeedListId}`);
      for (const part of partsToAdd) {
        await addItemToNeedList(targetNeedListId, {
          part: part._id,
          quantity: 1, // Default quantity
          notes: `Added from Parts Management`
        });
      }

      toast({
        title: t('common.success'),
        description: `Added ${partsToAdd.length} part(s) to need list successfully`,
      });

      // Reset state
      setSelectedParts(new Set());
      setShowAddToNeedListDialog(false);
      setCreateNewNeedList(false);
      setNewNeedListName('');
      setNewNeedListDescription('');
      setNewNeedListPriority('medium');
      setSelectedNeedList('');
    } catch (error: any) {
      console.error('Error adding to need list:', error);
      toast({
        title: t('common.error'),
        description: error.message || "Failed to add parts to need list",
        variant: "destructive",
      });
    } finally {
      setAddingToNeedList(false);
    }
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
      return <Badge variant="destructive">{t('partsManagement.outOfStock')}</Badge>;
    } else if (totalStock <= minStock) {
      return <Badge variant="secondary">{t('partsManagement.lowStock')}</Badge>;
    } else {
      return <Badge variant="default">{t('partsManagement.inStock')}</Badge>;
    }
  };

  const categories = [
    'display', 'battery', 'camera', 'speaker', 'microphone',
    'charging-port', 'button', 'sensor', 'tool', 'adhesive', 'screw',
    'USB-C Ladebuchse', 'Microfone Flex', 'Ladebuchse', 'microUSB Buchse', 'other'
  ];

  const versionTypes = [
    { value: 'original', label: 'Original' },
    { value: 'cheap', label: 'Cheap' },
    { value: 'efficient', label: 'Efficient' }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">{t('common.loading')}</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 rounded-xl border border-[#0f1d45] bg-gradient-to-r from-[#1a2a5e] via-[#1a2a5e] to-[#2a3f7e] px-4 py-4 text-white shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="flex items-center gap-2 text-2xl font-bold leading-none">
            <Package className="h-6 w-6" />
            {t('partsManagement.title')}
          </h1>
          <p className="text-sm text-white/80">{t('partsManagement.description')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            className="border-white/40 bg-white/10 text-white hover:bg-white/20 hover:text-white"
            onClick={() => {
              console.log('PartsManagement: CSV Import button clicked');
              setShowCSVImportDialog(true);
            }}
          >
            <Upload className="mr-2 h-4 w-4" />
            Import CSV
          </Button>
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button onClick={() => {
                console.log('PartsManagement: Add Part button clicked');
                resetForm();
                setShowAddDialog(true);
              }} size="sm" className="bg-white text-[#1a2a5e] hover:bg-[#f8f9fc]">
                <Plus className="mr-2 h-4 w-4" />
                {t('partsManagement.createNewPart')}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[88vh] max-w-4xl overflow-y-auto p-4 sm:p-5">
              <DialogHeader className={adminDialogHeaderClassName}>
                <DialogTitle className="text-base font-semibold">{t('partsManagement.createNewPart')}</DialogTitle>
                <DialogDescription className="text-xs text-[#d8dce6]">
                  Create a new inventory item with compact stock and version details.
                </DialogDescription>
              </DialogHeader>
              <div className="pt-4">
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
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 px-4 py-3 pb-1">
            <CardTitle className="text-sm font-medium text-blue-700">Total Parts</CardTitle>
            <Package className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent className="px-4 pb-3 pt-0">
            <div className="text-2xl font-bold text-blue-950">{parts.length}</div>
          </CardContent>
        </Card>
        <Card className="border-green-200 bg-gradient-to-br from-green-50 to-green-100">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 px-4 py-3 pb-1">
            <CardTitle className="text-sm font-medium text-green-700">Total Value</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent className="px-4 pb-3 pt-0">
            <div className="text-2xl font-bold text-green-950">${totalValue.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card className="border-orange-200 bg-gradient-to-br from-orange-50 to-orange-100">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 px-4 py-3 pb-1">
            <CardTitle className="text-sm font-medium text-orange-700">Low Stock Items</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent className="px-4 pb-3 pt-0">
            <div className="text-2xl font-bold text-orange-700">{lowStockCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="px-4 py-4">
          <CardTitle className="text-lg">Parts Inventory</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 pt-0">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder={t('partsManagement.searchParts')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="h-9 pl-10 text-sm"
                />
              </div>
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="h-9 w-full text-sm sm:w-[190px]">
                <SelectValue placeholder={t('partsManagement.filterByCategory')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('partsManagement.allCategories')}</SelectItem>
                {categories.map(category => (
                  <SelectItem key={category} value={category}>
                    {category.charAt(0).toUpperCase() + category.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={modelFilter} onValueChange={setModelFilter}>
              <SelectTrigger className="h-9 w-full text-sm sm:w-[190px]">
                <SelectValue placeholder="Filter by model" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Models</SelectItem>
                {Array.from(new Set(parts.map(p => p.model))).filter(m => m).map(model => (
                  <SelectItem key={model} value={model}>
                    {model}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Add to Need List button */}
          {selectedParts.size > 0 && (
            <div className="mb-3">
              <Button
                onClick={handleOpenAddToNeedList}
                variant="outline"
                size="sm"
                className="h-8 text-xs"
              >
                <ListPlus className="mr-2 h-4 w-4" />
                Add {selectedParts.size} Part{selectedParts.size > 1 ? 's' : ''} to Need List
              </Button>
            </div>
          )}

          {/* Parts Table */}
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12 h-10 px-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <Checkbox
                      checked={selectedParts.size === parts.length && parts.length > 0}
                      onCheckedChange={handleSelectAllParts}
                    />
                  </TableHead>
                  <TableHead
                    className="h-10 cursor-pointer select-none px-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground hover:bg-muted/50"
                    onClick={() => handleSort('sku')}
                  >
                    <div className="flex items-center">
                      {t('partsManagement.partNumber')}
                      {getSortIcon('sku')}
                    </div>
                  </TableHead>
                  <TableHead
                    className="h-10 cursor-pointer select-none px-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground hover:bg-muted/50"
                    onClick={() => handleSort('itemName')}
                  >
                    <div className="flex items-center">
                      {t('partsManagement.partName')}
                      {getSortIcon('itemName')}
                    </div>
                  </TableHead>
                  <TableHead
                    className="h-10 cursor-pointer select-none px-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground hover:bg-muted/50"
                    onClick={() => handleSort('category')}
                  >
                    <div className="flex items-center">
                      {t('partsManagement.category')}
                      {getSortIcon('category')}
                    </div>
                  </TableHead>
                  <TableHead
                    className="h-10 cursor-pointer select-none px-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground hover:bg-muted/50"
                    onClick={() => handleSort('model')}
                  >
                    <div className="flex items-center">
                      Model
                      {getSortIcon('model')}
                    </div>
                  </TableHead>
                  <TableHead className="h-10 px-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Stock</TableHead>
                  <TableHead className="h-10 px-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t('partsManagement.status')}</TableHead>
                  <TableHead className="h-10 px-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Location</TableHead>
                  <TableHead className="h-10 px-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t('common.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {parts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="py-8 text-center text-sm text-muted-foreground">
                      {t('partsManagement.noPartsFound')}
                    </TableCell>
                  </TableRow>
                ) : (
                  parts.map((part) => (
                    <TableRow
                      key={part._id}
                      className="cursor-pointer hover:bg-muted/50"
                    >
                      <TableCell className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedParts.has(part._id)}
                          onCheckedChange={(checked) => handleSelectPart(part._id, checked as boolean)}
                        />
                      </TableCell>
                      <TableCell className="px-2 py-2 text-xs font-medium" onClick={() => handleRowClick(part)}>{part.partNumber}</TableCell>
                      <TableCell className="px-2 py-2 text-sm" onClick={() => handleRowClick(part)}>{part.name}</TableCell>
                      <TableCell className="px-2 py-2" onClick={() => handleRowClick(part)}>
                        <Badge variant="outline" className="text-[11px]">
                          {part.category}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-2 py-2 text-xs" onClick={() => handleRowClick(part)}>{part.model}</TableCell>
                      <TableCell className="px-2 py-2 text-xs font-medium" onClick={() => handleRowClick(part)}>{part.stockQuantity}</TableCell>
                      <TableCell className="px-2 py-2" onClick={() => handleRowClick(part)}>{getStockStatus(part)}</TableCell>
                      <TableCell className="px-2 py-2 text-xs" onClick={() => handleRowClick(part)}>{part.location}</TableCell>
                      <TableCell className="px-2 py-2">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={(e) => handleEditClick(e, part)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={(e) => handleDeleteClick(e, part._id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination Controls */}
          <div className="mt-4 flex flex-col gap-3 border-t pt-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <Label htmlFor="itemsPerPage" className="text-xs">Items per page:</Label>
              <Select value={itemsPerPage.toString()} onValueChange={handleItemsPerPageChange}>
                <SelectTrigger id="itemsPerPage" className="h-8 w-[78px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5</SelectItem>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-xs text-muted-foreground">
                Showing {parts.length === 0 ? 0 : ((currentPage - 1) * itemsPerPage) + 1} to{' '}
                {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems} parts
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-2 text-xs"
                onClick={() => handlePageChange(1)}
                disabled={currentPage === 1}
              >
                First
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-2"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>

              <div className="flex items-center gap-1">
                {/* Show page numbers */}
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }

                  return (
                    <Button
                      key={pageNum}
                      variant={currentPage === pageNum ? "default" : "outline"}
                      size="sm"
                      onClick={() => handlePageChange(pageNum)}
                      className="h-8 w-8 text-xs"
                    >
                      {pageNum}
                    </Button>
                  );
                })}
              </div>

              <Button
                variant="outline"
                size="sm"
                className="h-8 px-2"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-2 text-xs"
                onClick={() => handlePageChange(totalPages)}
                disabled={currentPage === totalPages}
              >
                Last
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-h-[88vh] max-w-4xl overflow-y-auto p-4 sm:p-5">
          <DialogHeader className={adminDialogHeaderClassName}>
            <DialogTitle className="text-base font-semibold">{t('partsManagement.editPart')}</DialogTitle>
            <DialogDescription className="text-xs text-[#d8dce6]">
              Update inventory metadata, device compatibility and version stock levels.
            </DialogDescription>
          </DialogHeader>
          <div className="pt-4">
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
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail View Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-h-[88vh] max-w-4xl overflow-y-auto p-4 sm:p-5">
          <DialogHeader className={adminDialogHeaderClassName}>
            <DialogTitle className="flex items-center gap-2 text-base font-semibold">
              <Eye className="h-5 w-5" />
              Part Details
            </DialogTitle>
            <DialogDescription className="text-xs text-[#d8dce6]">
              Review inventory, pricing, specifications and versions in a condensed layout.
            </DialogDescription>
          </DialogHeader>
          <div className="pt-4">
            {selectedPart && <PartDetailView part={selectedPart} />}
          </div>
        </DialogContent>
      </Dialog>

      {/* Add to Need List Dialog */}
      <Dialog open={showAddToNeedListDialog} onOpenChange={setShowAddToNeedListDialog}>
        <DialogContent className="max-w-2xl p-4 sm:p-5">
          <DialogHeader className={adminDialogHeaderClassName}>
            <DialogTitle className="flex items-center gap-2 text-base font-semibold">
              <ListPlus className="h-5 w-5" />
              {t('partsManagement.bulkAddToNeedList')}
            </DialogTitle>
            <DialogDescription className="text-xs text-[#d8dce6]">
              Assign selected parts to an existing draft list or create a new one.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <p className="text-sm text-muted-foreground">
                You are adding {selectedParts.size} part{selectedParts.size > 1 ? 's' : ''} to a need list.
              </p>
            </div>

            <Separator />

            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="createNew"
                  checked={createNewNeedList}
                  onCheckedChange={(checked) => setCreateNewNeedList(checked as boolean)}
                />
                <Label htmlFor="createNew" className="text-sm font-medium">
                  Create new need list
                </Label>
              </div>

              {createNewNeedList ? (
                <div className="space-y-3 pl-6">
                  <div className="space-y-1.5">
                    <Label htmlFor="newListName" className={compactLabelClassName}>Need List Name *</Label>
                    <Input
                      id="newListName"
                      value={newNeedListName}
                      onChange={(e) => setNewNeedListName(e.target.value)}
                      placeholder="Enter need list name"
                      className={compactFieldClassName}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="newListDescription" className={compactLabelClassName}>Description</Label>
                    <Textarea
                      id="newListDescription"
                      value={newNeedListDescription}
                      onChange={(e) => setNewNeedListDescription(e.target.value)}
                      placeholder="Enter description (optional)"
                      rows={2}
                      className="min-h-[70px] text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="newListPriority" className={compactLabelClassName}>Priority</Label>
                    <Select
                      value={newNeedListPriority}
                      onValueChange={(value) => setNewNeedListPriority(value as 'low' | 'medium' | 'high' | 'urgent')}
                    >
                      <SelectTrigger className={compactFieldClassName}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label htmlFor="existingList" className={compactLabelClassName}>Select Existing Need List *</Label>
                  <Select
                    value={selectedNeedList}
                    onValueChange={setSelectedNeedList}
                  >
                    <SelectTrigger className={compactFieldClassName}>
                      <SelectValue placeholder="Select a need list" />
                    </SelectTrigger>
                    <SelectContent>
                      {needLists.length === 0 ? (
                        <SelectItem value="none" disabled>
                          No draft need lists available
                        </SelectItem>
                      ) : (
                        needLists.map(list => (
                          <SelectItem key={list._id} value={list._id}>
                            {list.name} ({list.items.length} items)
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <Separator />

            <DialogFooter className="gap-3 sm:justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowAddToNeedListDialog(false);
                  setCreateNewNeedList(false);
                  setNewNeedListName('');
                  setNewNeedListDescription('');
                  setNewNeedListPriority('medium');
                  setSelectedNeedList('');
                }}
                disabled={addingToNeedList}
              >
                {t('common.cancel')}
              </Button>
              <Button
                onClick={handleAddToNeedList}
                disabled={addingToNeedList}
                size="sm"
              >
                {addingToNeedList ? t('common.loading') : t('partsManagement.addToNeedList')}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* CSV Import Dialog */}
      <PartsCSVImportDialog
        open={showCSVImportDialog}
        onOpenChange={setShowCSVImportDialog}
        onImportSuccess={() => {
          console.log('PartsManagement: CSV import successful, refreshing parts list');
          fetchParts();
        }}
      />
    </div>
  );
}

// Part Detail View Component
function PartDetailView({ part }: { part: Part }) {
  const { t } = useTranslation()
  return (
    <div className="space-y-4">
      {/* Basic Information */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="px-4 py-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Info className="h-4 w-4" />
              Basic Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5 px-4 pb-4 pt-0">
            <div className="space-y-1">
              <Label className={compactLabelClassName}>{t('partsManagement.partNumber')}</Label>
              <p className="text-sm font-mono">{part.partNumber}</p>
            </div>
            <div className="space-y-1">
              <Label className={compactLabelClassName}>{t('partsManagement.partName')}</Label>
              <p className="text-sm">{part.name}</p>
            </div>
            <div className="space-y-1">
              <Label className={compactLabelClassName}>Description</Label>
              <p className="text-sm leading-snug">{part.description || 'No description available'}</p>
            </div>
            <div className="space-y-1">
              <Label className={compactLabelClassName}>{t('partsManagement.category')}</Label>
              <Badge variant="outline" className="text-[11px]">
                {part.category?.charAt(0).toUpperCase() + part.category?.slice(1)}
              </Badge>
            </div>
            <div className="space-y-1">
              <Label className={compactLabelClassName}>Model</Label>
              <p className="text-sm">{part.model}</p>
            </div>
            <div className="space-y-1">
              <Label className={compactLabelClassName}>{t('partsManagement.supplier')}</Label>
              <p className="text-sm">{part.supplier}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="px-4 py-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Package className="h-4 w-4" />
              Stock Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5 px-4 pb-4 pt-0">
            <div className="space-y-1">
              <Label className={compactLabelClassName}>Current Stock</Label>
              <p className="text-2xl font-bold">{part.stockQuantity}</p>
            </div>
            <div className="space-y-1">
              <Label className={compactLabelClassName}>Minimum Stock Level</Label>
              <p className="text-sm">{part.minStockLevel}</p>
            </div>
            <div className="space-y-1">
              <Label className={compactLabelClassName}>Storage Location</Label>
              <p className="text-sm flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {part.location}
              </p>
            </div>
            <div className="space-y-1">
              <Label className={compactLabelClassName}>Condition</Label>
              <Badge variant="default" className="text-[11px]">{part.condition}</Badge>
            </div>
            <div className="space-y-1">
              <Label className={compactLabelClassName}>Warranty</Label>
              <p className="text-sm">{part.warranty} days</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pricing Information */}
      <Card>
        <CardHeader className="px-4 py-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <DollarSign className="h-4 w-4" />
            Pricing Information
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 pt-0">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <Label className={compactLabelClassName}>{t('partsManagement.costPrice')}</Label>
              <p className="text-lg font-semibold">${part.cost?.toFixed(2)}</p>
            </div>
            <div className="space-y-1">
              <Label className={compactLabelClassName}>{t('partsManagement.sellingPrice')}</Label>
              <p className="text-lg font-semibold">${part.sellingPrice?.toFixed(2)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Compatible Devices */}
      {part.compatibleDevices && part.compatibleDevices.length > 0 && (
        <Card>
          <CardHeader className="px-4 py-3">
            <CardTitle className="text-base">Compatible Devices</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-0">
            <div className="flex flex-wrap gap-1.5">
              {part.compatibleDevices.map((device, index) => (
                <Badge key={index} variant="secondary" className="text-[11px]">
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
          <CardHeader className="px-4 py-3">
            <CardTitle className="text-base">Specifications</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-0">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {Object.entries(part.specifications).map(([key, value]) => (
                <div key={key} className="space-y-1">
                  <Label className={compactLabelClassName}>
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
          <CardHeader className="px-4 py-3">
            <CardTitle className="text-base">Part Versions</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-0">
            <div className="space-y-3">
              {part.versions.map((version, index) => (
                <div key={version._id || index} className="rounded-lg border p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <Badge variant="outline" className="text-[11px]">
                      {version.versionType?.charAt(0).toUpperCase() + version.versionType?.slice(1)}
                    </Badge>
                    <Badge variant={version.status === 'active' ? 'default' : 'secondary'} className="text-[11px]">
                      {version.status}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                    <div>
                      <Label className={compactLabelClassName}>{t('partsManagement.quantity')}</Label>
                      <p className="font-medium">{version.quantity}</p>
                    </div>
                    <div>
                      <Label className={compactLabelClassName}>Unit Cost</Label>
                      <p className="font-medium">${version.unitCost?.toFixed(2)}</p>
                    </div>
                    <div>
                      <Label className={compactLabelClassName}>{t('partsManagement.sellingPrice')}</Label>
                      <p className="font-medium">${version.sellingPrice?.toFixed(2)}</p>
                    </div>
                    <div>
                      <Label className={compactLabelClassName}>Location</Label>
                      <p className="font-medium">{version.storageLocation}</p>
                    </div>
                  </div>
                  {version.notes && (
                    <div className="mt-2 space-y-1">
                      <Label className={compactLabelClassName}>Notes</Label>
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
        <CardContent className="px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            {t('partsManagement.lastUpdated')}: {part.lastUpdated ? new Date(part.lastUpdated).toLocaleString() : 'Unknown'}
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
  const { t } = useTranslation()
  // Auto-generate Item Name when manufacturer, model, or category changes
  const handleFieldChange = (field: string, value: any) => {
    const updatedFormData = { ...formData, [field]: value };

    // Auto-generate itemName if manufacturer, model, and category are all present
    if (['manufacturer', 'model', 'category'].includes(field)) {
      const { manufacturer, model, category } = updatedFormData;
      if (manufacturer && model && category) {
        updatedFormData.itemName = `${manufacturer} ${model} ${category}`;
      }
    }

    setFormData(updatedFormData);
  };

  return (
    <div className="space-y-4">
      <Tabs defaultValue="basic" className="w-full">
        <TabsList className="grid h-8 w-full grid-cols-3">
          <TabsTrigger value="basic" className="text-xs">Basic Info</TabsTrigger>
          <TabsTrigger value="versions" className="text-xs">Versions</TabsTrigger>
          <TabsTrigger value="additional" className="text-xs">Additional</TabsTrigger>
        </TabsList>

        <TabsContent value="basic" className="space-y-3 pt-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="itemName" className={compactLabelClassName}>Item Name * (Auto-generated)</Label>
              <Input
                id="itemName"
                value={formData.itemName}
                readOnly
                disabled
                placeholder="Auto-generated from Manufacturer + Model + Category"
                className={`${compactFieldClassName} bg-muted`}
              />
              <p className="text-xs text-muted-foreground mt-1">
                This field is automatically generated from Manufacturer, Model, and Category
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="category" className={compactLabelClassName}>{t('partsManagement.category')} *</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => handleFieldChange('category', value)}
              >
                <SelectTrigger className={compactFieldClassName}>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(category => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="manufacturer" className={compactLabelClassName}>Manufacturer *</Label>
              <Input
                id="manufacturer"
                value={formData.manufacturer}
                onChange={(e) => handleFieldChange('manufacturer', e.target.value)}
                placeholder="Enter manufacturer"
                className={compactFieldClassName}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="model" className={compactLabelClassName}>Model *</Label>
              <Input
                id="model"
                value={formData.model}
                onChange={(e) => handleFieldChange('model', e.target.value)}
                placeholder="Enter model"
                className={compactFieldClassName}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="date" className={compactLabelClassName}>Date</Label>
              <Input
                id="date"
                type="date"
                value={formData.date ? formData.date.toISOString().split('T')[0] : ''}
                onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value ? new Date(e.target.value) : null }))}
                className={compactFieldClassName}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="itemDescription" className={compactLabelClassName}>Description</Label>
            <Textarea
              id="itemDescription"
              value={formData.itemDescription}
              onChange={(e) => setFormData(prev => ({ ...prev, itemDescription: e.target.value }))}
              placeholder="Enter item description"
              rows={3}
              className="min-h-[84px] text-sm leading-snug"
            />
          </div>
        </TabsContent>

        <TabsContent value="versions" className="space-y-3 pt-3">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-semibold">Part Versions</h3>
            <Button type="button" onClick={addVersion} variant="outline" size="sm" className="h-8 text-xs">
              <Plus className="mr-2 h-4 w-4" />
              Add Version
            </Button>
          </div>
          
          <ScrollArea className="h-[320px]">
            <div className="space-y-3 pr-3">
              {formData.versions.map((version: any, index: number) => (
                <Card key={index}>
                  <CardHeader className="px-4 py-3 pb-2">
                    <div className="flex justify-between items-center">
                      <CardTitle className="text-sm">Version {index + 1}</CardTitle>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => removeVersion(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 px-4 pb-4 pt-0">
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                      <div className="space-y-1.5">
                        <Label className={compactLabelClassName}>Version Type *</Label>
                        <Select
                          value={version.versionType}
                          onValueChange={(value) => updateVersion(index, 'versionType', value)}
                        >
                          <SelectTrigger className={compactFieldClassName}>
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
                      <div className="space-y-1.5">
                        <Label className={compactLabelClassName}>{t('partsManagement.quantity')} *</Label>
                        <Input
                          type="number"
                          value={version.quantity || 0}
                          onChange={(e) => updateVersion(index, 'quantity', parseInt(e.target.value) || 0)}
                          min="0"
                          className={compactFieldClassName}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className={compactLabelClassName}>Min Stock Level</Label>
                        <Input
                          type="number"
                          value={version.minStockLevel || 5}
                          onChange={(e) => updateVersion(index, 'minStockLevel', parseInt(e.target.value) || 5)}
                          min="0"
                          className={compactFieldClassName}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label className={compactLabelClassName}>Unit Cost *</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={version.unitCost || 0}
                          onChange={(e) => updateVersion(index, 'unitCost', parseFloat(e.target.value) || 0)}
                          min="0"
                          className={compactFieldClassName}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className={compactLabelClassName}>{t('partsManagement.sellingPrice')} *</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={version.sellingPrice || 0}
                          onChange={(e) => updateVersion(index, 'sellingPrice', parseFloat(e.target.value) || 0)}
                          min="0"
                          className={compactFieldClassName}
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className={compactLabelClassName}>Storage Location *</Label>
                      <Input
                        value={version.storageLocation || ''}
                        onChange={(e) => updateVersion(index, 'storageLocation', e.target.value)}
                        placeholder="Enter storage location"
                        className={compactFieldClassName}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className={compactLabelClassName}>Notes</Label>
                      <Textarea
                        value={version.notes || ''}
                        onChange={(e) => updateVersion(index, 'notes', e.target.value)}
                        placeholder="Enter notes"
                        rows={2}
                        className="min-h-[70px] text-sm"
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="additional" className="space-y-3 pt-3">
          <div className="space-y-1.5">
            <Label className={compactLabelClassName}>Compatible Devices</Label>
            <Input
              value={formData.compatibleDevices.join(', ')}
              onChange={(e) => setFormData(prev => ({ 
                ...prev, 
                compatibleDevices: e.target.value.split(',').map(d => d.trim()).filter(d => d) 
              }))}
              placeholder="Enter compatible devices (comma separated)"
              className={compactFieldClassName}
            />
          </div>
        </TabsContent>
      </Tabs>

      <Separator />

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel} size="sm">
          {t('common.cancel')}
        </Button>
        <Button type="button" onClick={onSubmit} size="sm">
          {isEdit ? t('partsManagement.editPart') : t('partsManagement.createNewPart')}
        </Button>
      </div>
    </div>
  );
}