import { useEffect, useState } from 'react';
import {
  getNeedLists,
  getNeedListStatistics,
  createNeedList,
  updateNeedList,
  deleteNeedList,
  addItemToNeedList,
  removeItemFromNeedList,
  convertNeedListToOrder,
  type NeedList,
  type NeedListStatistics,
  type NeedListItem,
  type NeedListConvertItemConfig,
} from '@/api/needLists';
import { getParts, type Part } from '@/api/parts';
import { getSuppliers, type Supplier } from '@/api/epartOrders';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/useToast';
import {
  Plus,
  Search,
  ClipboardList,
  Package,
  AlertCircle,
  Edit,
  Trash2,
  Eye,
  ShoppingCart,
  X,
  FileText,
} from 'lucide-react';
import { format } from 'date-fns';

interface NeedListManagementProps {
  onOrderCreated?: () => void;
}

export default function NeedListManagement({ onOrderCreated }: NeedListManagementProps = {}) {
  const { toast } = useToast();
  const VAT_RATE = 0.19;

  const renderNotesWithLinks = (notes?: string) => {
    if (!notes) {
      return '-';
    }

    const urlSplitRegex = /(https?:\/\/[^\s]+)/g;
    const urlMatchRegex = /^https?:\/\/[^\s]+$/;
    const segments = notes.split(urlSplitRegex);

    return (
      <span className="break-words whitespace-pre-wrap">
        {segments.map((segment, index) => {
          if (urlMatchRegex.test(segment)) {
            return (
              <a
                key={`${segment}-${index}`}
                href={segment}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline"
              >
                {segment}
              </a>
            );
          }

          return <span key={`${segment}-${index}`}>{segment}</span>;
        })}
      </span>
    );
  };

  // State
  const [needLists, setNeedLists] = useState<NeedList[]>([]);
  const [parts, setParts] = useState<Part[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [statistics, setStatistics] = useState<NeedListStatistics | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Dialogs
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [showAddItemDialog, setShowAddItemDialog] = useState(false);
  const [showConvertDialog, setShowConvertDialog] = useState(false);
  const [showEditItemDialog, setShowEditItemDialog] = useState(false);
  const [selectedNeedList, setSelectedNeedList] = useState<NeedList | null>(null);
  const [editItemData, setEditItemData] = useState<{
    _id?: string;
    part: string;
    quantity: number;
    unitPrice: number;
    priceType: 'net' | 'gross';
    shippingCost: number;
    additionalCost: number;
    notes: string;
    supplier: string;
  }>({
    part: '',
    quantity: 1,
    unitPrice: 0,
    priceType: 'net',
    shippingCost: 0,
    additionalCost: 0,
    notes: '',
    supplier: '',
  });
  // Update NeedList Item
  const handleEditItem = (item: NeedListItem) => {
    setEditItemData({
      _id: item._id,
      part: item.part,
      quantity: item.quantity,
      unitPrice: typeof item.unitPrice === 'number' ? item.unitPrice : 0,
      priceType: item.priceType === 'gross' ? 'gross' : 'net',
      shippingCost: typeof item.shippingCost === 'number' ? item.shippingCost : 0,
      additionalCost: typeof item.additionalCost === 'number' ? item.additionalCost : 0,
      notes: item.notes || '',
      supplier: item.supplier || '',
    });
    setShowEditItemDialog(true);
  };

  const handleUpdateItem = async () => {
    if (!selectedNeedList || !editItemData._id) return;
    try {
      // PATCH-API: updateNeedListItem(needListId, itemId, data)
      await updateNeedList(selectedNeedList._id, {
        items: selectedNeedList.items.map((item) =>
          item._id === editItemData._id
            ? {
                ...item,
                quantity: editItemData.quantity,
                unitPrice: editItemData.unitPrice,
                priceType: editItemData.priceType,
                shippingCost: editItemData.shippingCost,
                additionalCost: editItemData.additionalCost,
                supplier: editItemData.supplier,
                notes: editItemData.notes,
              }
            : item
        ),
      });
      toast({ title: 'Success', description: 'Item updated successfully' });
      setShowEditItemDialog(false);
      setEditItemData({
        part: '',
        quantity: 1,
        unitPrice: 0,
        priceType: 'net',
        shippingCost: 0,
        additionalCost: 0,
        notes: '',
        supplier: '',
      });
      loadData();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  // Form data
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    priority: 'medium',
    tags: '',
  });

  const [orderItems, setOrderItems] = useState<Array<{ part: string; quantity: number; notes: string; supplier: string }>>([
    { part: '', quantity: 1, notes: '', supplier: '' },
  ]);

  const [addItemData, setAddItemData] = useState<{
    part: string;
    quantity: number;
    notes: string;
    supplier: string;
    unitPrice: number;
    priceType: 'net' | 'gross';
    shippingCost: number;
    additionalCost: number;
  }>({
    part: '',
    quantity: 1,
    notes: '',
    supplier: '',
    unitPrice: 0,
    priceType: 'net',
    shippingCost: 0,
    additionalCost: 0,
  });
  const [addItemPartSearch, setAddItemPartSearch] = useState('');

  const [convertData, setConvertData] = useState<{
    supplier: string;
    notes: string;
    itemConfigurations: NeedListConvertItemConfig[];
  }>({
    supplier: '',
    notes: '',
    itemConfigurations: [],
  });

  // Load data
  useEffect(() => {
    loadData();
  }, [statusFilter, priorityFilter, searchQuery]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [needListsData, partsData, suppliersData, statsData] = await Promise.all([
        getNeedLists({
          status: statusFilter || undefined,
          priority: priorityFilter || undefined,
          search: searchQuery || undefined,
        }),
        getParts({ limit: 1000 }),
        getSuppliers({ isActive: true }),
        getNeedListStatistics(),
      ]);

      setNeedLists(needListsData);
      setParts(partsData.parts);
      setSuppliers(suppliersData.suppliers);
      setStatistics(statsData);
    } catch (error: any) {
      console.error('Error loading need list data:', error);
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredAddItemParts = parts.filter((part) => {
    if (!addItemPartSearch.trim()) {
      return true;
    }

    const query = addItemPartSearch.toLowerCase();
    const haystack = `${part.partNumber || ''} ${part.name || ''}`.toLowerCase();
    return haystack.includes(query);
  });

  const handleCreateNeedList = async () => {
    try {
      const items = orderItems.filter((item) => item.part && item.quantity > 0);
      if (items.length === 0) {
        toast({
          title: 'Error',
          description: 'Please add at least one item to the need list',
          variant: 'destructive',
        });
        return;
      }

      await createNeedList({
        name: formData.name,
        description: formData.description,
        priority: formData.priority,
        tags: formData.tags.split(',').map((t) => t.trim()).filter(Boolean),
        items,
      });

      toast({
        title: 'Success',
        description: 'Need list created successfully',
      });

      setShowCreateDialog(false);
      resetForm();
      loadData();
    } catch (error: any) {
      console.error('Error creating need list:', error);
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleUpdateNeedList = async () => {
    if (!selectedNeedList) return;

    try {
      await updateNeedList(selectedNeedList._id, {
        name: formData.name,
        description: formData.description,
        priority: formData.priority,
        tags: formData.tags.split(',').map((t) => t.trim()).filter(Boolean),
      });

      toast({
        title: 'Success',
        description: 'Need list updated successfully',
      });

      setShowEditDialog(false);
      setSelectedNeedList(null);
      resetForm();
      loadData();
    } catch (error: any) {
      console.error('Error updating need list:', error);
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleDeleteNeedList = async (id: string) => {
    if (!confirm('Are you sure you want to delete this need list?')) return;

    try {
      await deleteNeedList(id);

      toast({
        title: 'Success',
        description: 'Need list deleted successfully',
      });

      loadData();
    } catch (error: any) {
      console.error('Error deleting need list:', error);
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleAddItem = async () => {
    if (!selectedNeedList) return;

    try {
      await addItemToNeedList(selectedNeedList._id, addItemData);

      toast({
        title: 'Success',
        description: 'Item added successfully',
      });

      setShowAddItemDialog(false);
      setAddItemData({
        part: '',
        quantity: 1,
        notes: '',
        supplier: '',
        unitPrice: 0,
        priceType: 'net',
        shippingCost: 0,
        additionalCost: 0,
      });
      setAddItemPartSearch('');
      loadData();
    } catch (error: any) {
      console.error('Error adding item:', error);
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleRemoveItem = async (needListId: string, itemId: string) => {
    if (!confirm('Remove this item from the need list?')) return;

    try {
      await removeItemFromNeedList(needListId, itemId);

      toast({
        title: 'Success',
        description: 'Item removed successfully',
      });

      loadData();
      if (selectedNeedList && selectedNeedList._id === needListId) {
        const updatedList = needLists.find((nl) => nl._id === needListId);
        if (updatedList) setSelectedNeedList(updatedList);
      }
    } catch (error: any) {
      console.error('Error removing item:', error);
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleConvertToOrder = async () => {
    if (!selectedNeedList) return;

    const invalidItem = convertData.itemConfigurations.find((config) => !config.supplier);
    if (invalidItem) {
      toast({
        title: 'Missing Supplier',
        description: 'Please select a supplier for every item before converting.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const result = await convertNeedListToOrder(selectedNeedList._id, {
        supplier: convertData.supplier || undefined,
        notes: convertData.notes,
        itemConfigurations: convertData.itemConfigurations,
      });

      toast({
        title: 'Success',
        description: `Order ${result.order.orderNumber} created successfully`,
      });

      setShowConvertDialog(false);
      setConvertData({ supplier: '', notes: '', itemConfigurations: [] });
      setSelectedNeedList(null);
      loadData();

      // Notify parent component to refresh orders
      if (onOrderCreated) {
        onOrderCreated();
      }
    } catch (error: any) {
      console.error('Error converting to order:', error);
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      priority: 'medium',
      tags: '',
    });
    setOrderItems([{ part: '', quantity: 1, notes: '' }]);
  };

  const openEditDialog = (needList: NeedList) => {
    setSelectedNeedList(needList);
    setFormData({
      name: needList.name,
      description: needList.description || '',
      priority: needList.priority,
      tags: needList.tags?.join(', ') || '',
    });
    setShowEditDialog(true);
  };

  const openViewDialog = (needList: NeedList) => {
    setSelectedNeedList(needList);
    setShowViewDialog(true);
  };

  const openConvertDialog = (needList: NeedList) => {
    const itemConfigurations: NeedListConvertItemConfig[] = needList.items.map((item) => ({
      needListItemId: item._id || item.part,
      supplier: item.supplier || '',
      priceType: item.priceType === 'gross' ? 'gross' : 'net',
      price: typeof item.unitPrice === 'number' ? item.unitPrice : 0,
      shippingCost: typeof item.shippingCost === 'number' ? item.shippingCost : 0,
      additionalCost: typeof item.additionalCost === 'number' ? item.additionalCost : 0,
    }));

    setSelectedNeedList(needList);
    setConvertData({
      supplier: '',
      notes: '',
      itemConfigurations,
    });
    setShowConvertDialog(true);
  };

  const updateConvertItemConfig = (
    needListItemId: string,
    patch: Partial<NeedListConvertItemConfig>
  ) => {
    setConvertData((prev) => ({
      ...prev,
      itemConfigurations: prev.itemConfigurations.map((config) =>
        config.needListItemId === needListItemId
          ? { ...config, ...patch }
          : config
      ),
    }));
  };

  const convertSummary = convertData.itemConfigurations.reduce(
    (acc, itemConfig) => {
      const sourceItem = selectedNeedList?.items.find((it) => (it._id || it.part) === itemConfig.needListItemId);
      if (!sourceItem) {
        return acc;
      }

      const lineSubtotal = (sourceItem.quantity * itemConfig.price) + itemConfig.additionalCost;
      const lineTotal = lineSubtotal + itemConfig.shippingCost;

      acc.subtotal += lineSubtotal;
      acc.shipping += itemConfig.shippingCost;
      acc.total += lineTotal;
      return acc;
    },
    { subtotal: 0, shipping: 0, total: 0 }
  );

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
      draft: 'outline',
      ready: 'default',
      ordered: 'secondary',
      archived: 'destructive',
    };
    return <Badge variant={variants[status] || 'outline'}>{status}</Badge>;
  };

  const getPriorityBadge = (priority: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
      low: 'outline',
      medium: 'secondary',
      high: 'default',
      urgent: 'destructive',
    };
    return <Badge variant={variants[priority] || 'secondary'}>{priority}</Badge>;
  };

  const getPartName = (partId: string) => {
    const part = parts.find((p) => p._id === partId);
    return part ? `${part.partNumber} - ${part.name}` : 'Unknown Part';
  };

  const toNet = (amount: number, priceType: 'net' | 'gross') => {
    const normalized = Math.max(0, Number(amount) || 0);
    if (priceType === 'gross') {
      return normalized / (1 + VAT_RATE);
    }
    return normalized;
  };

  const toGross = (amount: number, priceType: 'net' | 'gross') => {
    const normalized = Math.max(0, Number(amount) || 0);
    if (priceType === 'net') {
      return normalized * (1 + VAT_RATE);
    }
    return normalized;
  };

  const selectedNeedListTotals = selectedNeedList
    ? selectedNeedList.items.reduce(
      (acc, item) => {
        const priceType = item.priceType === 'gross' ? 'gross' : 'net';
        const quantity = Math.max(1, Number(item.quantity) || 1);
        const unitPrice = Math.max(0, Number(item.unitPrice) || 0);
        const shipping = Math.max(0, Number(item.shippingCost) || 0);
        const additional = Math.max(0, Number(item.additionalCost) || 0);

        const lineNet = (toNet(unitPrice, priceType) * quantity) + toNet(shipping, priceType) + toNet(additional, priceType);
        const lineGross = (toGross(unitPrice, priceType) * quantity) + toGross(shipping, priceType) + toGross(additional, priceType);

        acc.net += lineNet;
        acc.gross += lineGross;
        return acc;
      },
      { net: 0, gross: 0 }
    )
    : { net: 0, gross: 0 };

  if (loading) {
    return <div className="flex justify-center items-center p-8">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Need Lists</h2>
          <p className="text-muted-foreground">Plan and organize parts before creating orders</p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create Need List
        </Button>
      </div>

      {/* Statistics Cards */}
      {statistics && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Lists</CardTitle>
              <ClipboardList className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{statistics.total}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Draft</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{statistics.byStatus.draft || 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ready</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{statistics.byStatus.ready || 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Urgent</CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{statistics.byPriority.urgent || 0}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label>Search</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search need lists..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>

            <div>
              <Label>Status</Label>
              <Select value={statusFilter || 'all'} onValueChange={(value) => setStatusFilter(value === 'all' ? '' : value)}>
                <SelectTrigger>
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="ready">Ready</SelectItem>
                  <SelectItem value="ordered">Ordered</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Priority</Label>
              <Select value={priorityFilter || 'all'} onValueChange={(value) => setPriorityFilter(value === 'all' ? '' : value)}>
                <SelectTrigger>
                  <SelectValue placeholder="All Priorities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priorities</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={() => {
                  setStatusFilter('');
                  setPriorityFilter('');
                  setSearchQuery('');
                }}
              >
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Need Lists Table */}
      <Card>
        <CardHeader>
          <CardTitle>Need Lists</CardTitle>
          <CardDescription>View and manage all need lists</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Created By</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {needLists.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    No need lists found
                  </TableCell>
                </TableRow>
              ) : (
                needLists.map((needList) => (
                  <TableRow
                    key={needList._id}
                    onClick={() => openViewDialog(needList)}
                    className="cursor-pointer hover:bg-slate-50 transition-colors"
                  >
                    <TableCell className="font-medium">{needList.name}</TableCell>
                    <TableCell>{needList.items.length}</TableCell>
                    <TableCell>{getStatusBadge(needList.status)}</TableCell>
                    <TableCell>{getPriorityBadge(needList.priority)}</TableCell>
                    <TableCell>{format(new Date(needList.createdAt), 'MMM dd, yyyy')}</TableCell>
                    <TableCell>
                      {needList.createdBy
                        ? `${needList.createdBy.firstName} ${needList.createdBy.lastName}`
                        : 'Unknown User'
                      }
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openViewDialog(needList)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {needList.status !== 'ordered' && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openEditDialog(needList)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openConvertDialog(needList)}
                              disabled={needList.items.length === 0}
                            >
                              <ShoppingCart className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteNeedList(needList._id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create Need List Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Need List</DialogTitle>
            <DialogDescription>Create a new need list for planning part orders</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., iPhone 12 Screen Replacement Parts"
              />
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optional description..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="priority">Priority</Label>
                <Select value={formData.priority} onValueChange={(value) => setFormData({ ...formData, priority: value })}>
                  <SelectTrigger>
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

              <div>
                <Label htmlFor="tags">Tags (comma-separated)</Label>
                <Input
                  id="tags"
                  value={formData.tags}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                  placeholder="e.g., screens, batteries"
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <Label>Items *</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setOrderItems([...orderItems, { part: '', quantity: 1, notes: '' }])}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Item
                </Button>
              </div>

              {orderItems.map((item, index) => (
                <div key={index} className="grid grid-cols-12 gap-2 mb-2">
                  <div className="col-span-5">
                    <Select
                      value={item.part}
                      onValueChange={(value) => {
                        const newItems = [...orderItems];
                        newItems[index].part = value;
                        setOrderItems(newItems);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select part" />
                      </SelectTrigger>
                      <SelectContent>
                        {parts.map((part) => (
                          <SelectItem key={part._id} value={part._id}>
                            {part.partNumber} - {part.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="col-span-2">
                    <Input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => {
                        const newItems = [...orderItems];
                        newItems[index].quantity = parseInt(e.target.value) || 1;
                        setOrderItems(newItems);
                      }}
                      placeholder="Qty"
                    />
                  </div>

                  <div className="col-span-4">
                    <Input
                      value={item.notes}
                      onChange={(e) => {
                        const newItems = [...orderItems];
                        newItems[index].notes = e.target.value;
                        setOrderItems(newItems);
                      }}
                      placeholder="Notes"
                    />
                  </div>

                  <div className="col-span-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const newItems = orderItems.filter((_, i) => i !== index);
                        setOrderItems(newItems.length > 0 ? newItems : [{ part: '', quantity: 1, notes: '' }]);
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowCreateDialog(false);
              resetForm();
            }}>
              Cancel
            </Button>
            <Button onClick={handleCreateNeedList} disabled={!formData.name}>
              Create Need List
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Need List Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Need List</DialogTitle>
            <DialogDescription>Update the details of this need list</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-priority">Priority</Label>
                <Select value={formData.priority} onValueChange={(value) => setFormData({ ...formData, priority: value })}>
                  <SelectTrigger>
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

              <div>
                <Label htmlFor="edit-tags">Tags (comma-separated)</Label>
                <Input
                  id="edit-tags"
                  value={formData.tags}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowEditDialog(false);
              setSelectedNeedList(null);
              resetForm();
            }}>
              Cancel
            </Button>
            <Button onClick={handleUpdateNeedList}>Update</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Need List Dialog */}
      <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
        <DialogContent className="w-[96vw] max-w-7xl max-h-[88vh] overflow-hidden gap-0 border-slate-200 p-0 shadow-xl">
          <DialogHeader className="space-y-1 border-b border-slate-800 bg-[#1a2a5e] px-4 py-3 text-left">
            <DialogTitle className="text-base font-semibold !text-yellow-300">{selectedNeedList?.name}</DialogTitle>
            <DialogDescription className="text-xs text-slate-200">
              {selectedNeedList?.description || 'No description'}
            </DialogDescription>
          </DialogHeader>

          {selectedNeedList && (
            <div className="space-y-4 overflow-y-auto p-4">
              {/* Info Grid */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600 mb-1">Status</p>
                  {getStatusBadge(selectedNeedList.status)}
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600 mb-1">Priority</p>
                  {getPriorityBadge(selectedNeedList.priority)}
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600 mb-1">Created By</p>
                  <p className="text-xs">
                    {selectedNeedList.createdBy
                      ? `${selectedNeedList.createdBy.firstName} ${selectedNeedList.createdBy.lastName}`
                      : 'Unknown User'
                    }
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600 mb-1">Created At</p>
                  <p className="text-xs">
                    {format(new Date(selectedNeedList.createdAt), 'MMM dd, yyyy HH:mm')}
                  </p>
                </div>
              </div>

              {selectedNeedList.tags && selectedNeedList.tags.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600 mb-2">Tags</p>
                  <div className="flex gap-2 flex-wrap">
                    {selectedNeedList.tags.map((tag, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {selectedNeedList.convertedToOrder && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-md text-xs">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600 mb-1">Converted to Order</p>
                  <p>
                    Order #{selectedNeedList.convertedToOrder.orderNumber} -{' '}
                    {selectedNeedList.convertedToOrder.status}
                  </p>
                </div>
              )}

              {/* Items Section */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600">Items ({selectedNeedList.items.length})</p>
                  {selectedNeedList.status !== 'ordered' && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => {
                        setShowAddItemDialog(true);
                      }}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Add Item
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                  <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Total Net</p>
                    <p className="text-base font-semibold text-slate-900">{selectedNeedListTotals.net.toFixed(2)}</p>
                  </div>
                  <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Total Gross</p>
                    <p className="text-base font-semibold text-slate-900">{selectedNeedListTotals.gross.toFixed(2)}</p>
                  </div>
                </div>

                <div className="border border-slate-200 rounded-md overflow-hidden">
                  <Table className="w-full table-fixed">
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        <TableHead className="w-[10%] h-8 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Part #</TableHead>
                        <TableHead className="w-[13%] h-8 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Part Name</TableHead>
                        <TableHead className="w-[10%] h-8 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Supplier</TableHead>
                        <TableHead className="w-[5%] h-8 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Qty</TableHead>
                        <TableHead className="w-[6%] h-8 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Stock</TableHead>
                        <TableHead className="w-[6%] h-8 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Price Type</TableHead>
                        <TableHead className="w-[7%] h-8 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Unit Price</TableHead>
                        <TableHead className="w-[7%] h-8 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Shipping</TableHead>
                        <TableHead className="w-[7%] h-8 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Additional</TableHead>
                        <TableHead className="w-[8%] h-8 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Line Net</TableHead>
                        <TableHead className="w-[8%] h-8 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Line Gross</TableHead>
                        <TableHead className="w-[8%] h-8 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Notes</TableHead>
                        {selectedNeedList.status !== 'ordered' && <TableHead className="w-[5%] h-8 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Actions</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedNeedList.items.map((item) => {
                        const supplierObj = suppliers.find((s) => s._id === item.supplier);
                        const priceType = item.priceType === 'gross' ? 'gross' : 'net';
                        const quantity = Math.max(1, Number(item.quantity) || 1);
                        const unitPrice = Math.max(0, Number(item.unitPrice) || 0);
                        const shippingCost = Math.max(0, Number(item.shippingCost) || 0);
                        const additionalCost = Math.max(0, Number(item.additionalCost) || 0);
                        const lineNet = (toNet(unitPrice, priceType) * quantity) + toNet(shippingCost, priceType) + toNet(additionalCost, priceType);
                        const lineGross = (toGross(unitPrice, priceType) * quantity) + toGross(shippingCost, priceType) + toGross(additionalCost, priceType);
                        return (
                          <TableRow key={item._id} className="text-xs">
                            <TableCell className="px-2 py-1 text-xs break-words">{item.partNumber}</TableCell>
                            <TableCell className="px-2 py-1 text-xs break-words">{item.partName}</TableCell>
                            <TableCell className="px-2 py-1 text-xs break-words">{supplierObj ? supplierObj.name : (item.supplier || '-')}</TableCell>
                            <TableCell className="px-2 py-1 text-xs text-center">{item.quantity}</TableCell>
                            <TableCell className="px-2 py-1 text-xs">
                              <Badge variant={item.currentStock < item.quantity ? 'destructive' : 'default'} className="text-xs">
                                {item.currentStock}
                              </Badge>
                            </TableCell>
                            <TableCell className="px-2 py-1 text-xs uppercase">{priceType}</TableCell>
                            <TableCell className="px-2 py-1 text-xs">{unitPrice.toFixed(2)}</TableCell>
                            <TableCell className="px-2 py-1 text-xs">{shippingCost.toFixed(2)}</TableCell>
                            <TableCell className="px-2 py-1 text-xs">{additionalCost.toFixed(2)}</TableCell>
                            <TableCell className="px-2 py-1 text-xs">{lineNet.toFixed(2)}</TableCell>
                            <TableCell className="px-2 py-1 text-xs">{lineGross.toFixed(2)}</TableCell>
                            <TableCell className="px-2 py-1 text-xs break-words">{renderNotesWithLinks(item.notes)}</TableCell>
                            {selectedNeedList.status !== 'ordered' && (
                              <TableCell className="px-2 py-1 text-xs">
                                <div className="flex gap-1">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-6 w-6 p-0"
                                    onClick={() => handleEditItem(item)}
                                  >
                                    <Edit className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-6 w-6 p-0"
                                    onClick={() => handleRemoveItem(selectedNeedList._id, item._id!)}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </TableCell>
                            )}
                              {/* Edit Item Dialog */}
                              <Dialog open={showEditItemDialog} onOpenChange={setShowEditItemDialog}>
                                <DialogContent className="max-h-[88vh] overflow-hidden gap-0 border-slate-200 p-0 shadow-xl">
                                  <DialogHeader className="space-y-1 border-b border-slate-800 bg-[#1a2a5e] px-4 py-3 text-left">
                                    <DialogTitle className="text-base font-semibold text-white">Edit Item</DialogTitle>
                                    <DialogDescription className="text-xs text-slate-200">Menge, Supplier und Notizen anpassen</DialogDescription>
                                  </DialogHeader>
                                  <div className="space-y-3 p-4">
                                    <div>
                                      <Label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600 mb-2 block">Supplier</Label>
                                      <Select value={editItemData.supplier} onValueChange={(value) => setEditItemData({ ...editItemData, supplier: value })}>
                                        <SelectTrigger className="h-8 text-xs">
                                          <SelectValue placeholder="Select supplier" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {suppliers.map((supplier) => (
                                            <SelectItem key={supplier._id} value={supplier._id}>
                                              {supplier.name}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div>
                                      <Label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600 mb-2 block">Quantity</Label>
                                      <Input
                                        type="number"
                                        min="1"
                                        className="h-8 text-xs"
                                        value={editItemData.quantity}
                                        onChange={(e) => setEditItemData({ ...editItemData, quantity: parseInt(e.target.value) || 1 })}
                                      />
                                    </div>
                                    <div>
                                      <Label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600 mb-2 block">Price Type</Label>
                                      <Select
                                        value={editItemData.priceType}
                                        onValueChange={(value: 'net' | 'gross') => setEditItemData({ ...editItemData, priceType: value })}
                                      >
                                        <SelectTrigger className="h-8 text-xs">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="net">Net</SelectItem>
                                          <SelectItem value="gross">Gross</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div>
                                      <Label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600 mb-2 block">Order Price</Label>
                                      <Input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        className="h-8 text-xs"
                                        value={editItemData.unitPrice === 0 ? '' : editItemData.unitPrice}
                                        onChange={(e) => setEditItemData({ ...editItemData, unitPrice: parseFloat(e.target.value) || 0 })}
                                        placeholder="0.00"
                                      />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                      <div>
                                        <Label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600 mb-2 block">Shipping Cost</Label>
                                        <Input
                                          type="number"
                                          min="0"
                                          step="0.01"
                                          className="h-8 text-xs"
                                          value={editItemData.shippingCost === 0 ? '' : editItemData.shippingCost}
                                          onChange={(e) => setEditItemData({ ...editItemData, shippingCost: Math.max(0, parseFloat(e.target.value) || 0) })}
                                          placeholder="0.00"
                                        />
                                      </div>
                                      <div>
                                        <Label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600 mb-2 block">Additional Cost</Label>
                                        <Input
                                          type="number"
                                          min="0"
                                          step="0.01"
                                          className="h-8 text-xs"
                                          value={editItemData.additionalCost === 0 ? '' : editItemData.additionalCost}
                                          onChange={(e) => setEditItemData({ ...editItemData, additionalCost: Math.max(0, parseFloat(e.target.value) || 0) })}
                                          placeholder="0.00"
                                        />
                                      </div>
                                    </div>
                                    <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                                      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Estimated Line Total</p>
                                      <p className="text-base font-semibold text-slate-900">
                                        {((editItemData.unitPrice * editItemData.quantity) + editItemData.shippingCost + editItemData.additionalCost).toFixed(2)}
                                      </p>
                                    </div>
                                    <div>
                                      <Label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600 mb-2 block">Notes</Label>
                                      <Textarea
                                        className="min-h-[88px] text-xs"
                                        value={editItemData.notes}
                                        onChange={(e) => setEditItemData({ ...editItemData, notes: e.target.value })}
                                        placeholder="Optional notes..."
                                      />
                                    </div>
                                  </div>
                                  <div className="border-t border-slate-200 bg-slate-50 px-4 py-3 flex justify-end gap-2">
                                    <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setShowEditItemDialog(false)}>
                                      Cancel
                                    </Button>
                                    <Button size="sm" className="h-8 text-xs" onClick={handleUpdateItem}>
                                      Save
                                    </Button>
                                  </div>
                                </DialogContent>
                              </Dialog>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                </div>
              </div>
            </div>
          )}

          <div className="border-t border-slate-200 bg-slate-50 px-4 py-3 flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={() => {
                setShowViewDialog(false);
                setSelectedNeedList(null);
              }}
            >
              Close
            </Button>
            {selectedNeedList && selectedNeedList.status !== 'ordered' && (
              <Button
                size="sm"
                className="h-8 text-xs"
                onClick={() => {
                  setShowViewDialog(false);
                  openConvertDialog(selectedNeedList);
                }}
                disabled={selectedNeedList.items.length === 0}
              >
                <ShoppingCart className="h-3 w-3 mr-1" />
                Convert to Order
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Item Dialog */}
      <Dialog open={showAddItemDialog} onOpenChange={setShowAddItemDialog}>
        <DialogContent className="max-h-[88vh] overflow-hidden gap-0 border-slate-200 p-0 shadow-xl">
          <DialogHeader className="space-y-1 border-b border-slate-800 bg-[#1a2a5e] px-4 py-3 text-left">
            <DialogTitle className="text-base font-semibold !text-yellow-300">Add Item to Need List</DialogTitle>
            <DialogDescription className="text-xs text-slate-200">Select part, supplier and costs in one compact step.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 overflow-y-auto p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600 mb-2 block" htmlFor="add-part-search">Search Part</Label>
                <div className="relative">
                  <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-slate-400" />
                  <Input
                    id="add-part-search"
                    className="h-8 pl-7 text-xs"
                    value={addItemPartSearch}
                    onChange={(e) => setAddItemPartSearch(e.target.value)}
                    placeholder="Search by part number or name"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="add-part" className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600 mb-2 block">Part</Label>
                <Select value={addItemData.part} onValueChange={(value) => setAddItemData({ ...addItemData, part: value })}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Select part" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredAddItemParts.map((part) => (
                      <SelectItem key={part._id} value={part._id}>
                        {part.partNumber} - {part.name} (Stock: {part.currentStock})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="add-supplier" className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600 mb-2 block">Supplier</Label>
                <Select value={addItemData.supplier} onValueChange={(value) => setAddItemData({ ...addItemData, supplier: value })}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Select supplier" />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map((supplier) => (
                      <SelectItem key={supplier._id} value={supplier._id}>
                        {supplier.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="add-quantity" className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600 mb-2 block">Quantity</Label>
                <Input
                  id="add-quantity"
                  type="number"
                  min="1"
                  className="h-8 text-xs"
                  value={addItemData.quantity}
                  onChange={(e) => setAddItemData({ ...addItemData, quantity: parseInt(e.target.value) || 1 })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600 mb-2 block">Price Type</Label>
                <Select
                  value={addItemData.priceType}
                  onValueChange={(value: 'net' | 'gross') => setAddItemData({ ...addItemData, priceType: value })}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="net">Net</SelectItem>
                    <SelectItem value="gross">Gross</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600 mb-2 block">Unit Price</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  className="h-8 text-xs"
                  value={addItemData.unitPrice === 0 ? '' : addItemData.unitPrice}
                  onChange={(e) => setAddItemData({ ...addItemData, unitPrice: Math.max(0, parseFloat(e.target.value) || 0) })}
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600 mb-2 block">Shipping Cost</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  className="h-8 text-xs"
                  value={addItemData.shippingCost === 0 ? '' : addItemData.shippingCost}
                  onChange={(e) => setAddItemData({ ...addItemData, shippingCost: Math.max(0, parseFloat(e.target.value) || 0) })}
                  placeholder="0.00"
                />
              </div>
              <div>
                <Label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600 mb-2 block">Additional Cost</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  className="h-8 text-xs"
                  value={addItemData.additionalCost === 0 ? '' : addItemData.additionalCost}
                  onChange={(e) => setAddItemData({ ...addItemData, additionalCost: Math.max(0, parseFloat(e.target.value) || 0) })}
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Estimated Line Total</p>
              <p className="text-base font-semibold text-slate-900">
                {((addItemData.unitPrice * addItemData.quantity) + addItemData.shippingCost + addItemData.additionalCost).toFixed(2)}
              </p>
            </div>

            <div>
              <Label htmlFor="add-notes" className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600 mb-2 block">Notes</Label>
              <Textarea
                id="add-notes"
                className="min-h-[88px] text-xs"
                value={addItemData.notes}
                onChange={(e) => setAddItemData({ ...addItemData, notes: e.target.value })}
                placeholder="Optional notes..."
              />
            </div>
          </div>

          <div className="border-t border-slate-200 bg-slate-50 px-4 py-3 flex justify-end gap-2">
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => {
              setShowAddItemDialog(false);
              setAddItemData({
                part: '',
                quantity: 1,
                notes: '',
                supplier: '',
                unitPrice: 0,
                priceType: 'net',
                shippingCost: 0,
                additionalCost: 0,
              });
              setAddItemPartSearch('');
            }}>
              Cancel
            </Button>
            <Button size="sm" className="h-8 text-xs" onClick={handleAddItem} disabled={!addItemData.part}>
              Add Item
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Convert to Order Dialog */}
      <Dialog open={showConvertDialog} onOpenChange={setShowConvertDialog}>
        <DialogContent className="w-[96vw] max-w-7xl max-h-[90vh] overflow-hidden gap-0 border-slate-200 p-0 shadow-xl">
          <DialogHeader className="space-y-1 border-b border-slate-800 bg-[#1a2a5e] px-4 py-3 text-left">
            <DialogTitle className="text-base font-semibold !text-yellow-300">Convert Need List to Order</DialogTitle>
            <DialogDescription className="text-xs text-slate-200">
              Configure supplier and costs per item before creating the order.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 overflow-y-auto p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600 mb-2 block">Default Supplier (Optional)</Label>
                <Select
                  value={convertData.supplier}
                  onValueChange={(value) => {
                    setConvertData((prev) => ({
                      ...prev,
                      supplier: value,
                      itemConfigurations: prev.itemConfigurations.map((config) => ({
                        ...config,
                        supplier: config.supplier || value,
                      })),
                    }));
                  }}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Apply supplier to all empty items" />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map((supplier) => (
                      <SelectItem key={supplier._id} value={supplier._id}>
                        {supplier.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="convert-notes" className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600 mb-2 block">Order Notes</Label>
                <Textarea
                  id="convert-notes"
                  className="min-h-[70px] text-xs"
                  value={convertData.notes}
                  onChange={(e) => setConvertData({ ...convertData, notes: e.target.value })}
                  placeholder="Optional notes for the supplier order..."
                />
              </div>
            </div>

            <div className="border border-slate-200 rounded-md overflow-hidden">
              <Table className="w-full table-fixed">
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="w-[18%] h-9 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Item</TableHead>
                    <TableHead className="w-[16%] h-9 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Supplier</TableHead>
                    <TableHead className="w-[10%] h-9 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Price Type</TableHead>
                    <TableHead className="w-[12%] h-9 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Unit Price</TableHead>
                    <TableHead className="w-[12%] h-9 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Shipping</TableHead>
                    <TableHead className="w-[12%] h-9 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Additional</TableHead>
                    <TableHead className="w-[8%] h-9 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500 text-center">Qty</TableHead>
                    <TableHead className="w-[12%] h-9 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500 text-right">Line Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedNeedList?.items.map((item) => {
                    const itemId = item._id || item.part;
                    const itemConfig = convertData.itemConfigurations.find((cfg) => cfg.needListItemId === itemId);
                    if (!itemConfig) {
                      return null;
                    }

                    const lineTotal = (item.quantity * itemConfig.price) + itemConfig.shippingCost + itemConfig.additionalCost;

                    return (
                      <TableRow key={itemId}>
                        <TableCell className="px-2 py-2 align-top">
                          <p className="text-xs font-medium text-slate-900 break-words">{item.partName}</p>
                          <p className="text-[11px] text-slate-500 break-words">{item.partNumber}</p>
                        </TableCell>
                        <TableCell className="px-2 py-2 align-top">
                          <Select
                            value={itemConfig.supplier}
                            onValueChange={(value) => updateConvertItemConfig(itemId, { supplier: value })}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                            <SelectContent>
                              {suppliers.map((supplier) => (
                                <SelectItem key={supplier._id} value={supplier._id}>
                                  {supplier.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="px-2 py-2 align-top">
                          <Select
                            value={itemConfig.priceType}
                            onValueChange={(value: 'net' | 'gross') => updateConvertItemConfig(itemId, { priceType: value })}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="net">Net</SelectItem>
                              <SelectItem value="gross">Gross</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="px-2 py-2 align-top">
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            className="h-8 text-xs"
                            value={itemConfig.price === 0 ? '' : itemConfig.price}
                            onChange={(e) => updateConvertItemConfig(itemId, { price: Math.max(0, parseFloat(e.target.value) || 0) })}
                            placeholder="0.00"
                          />
                        </TableCell>
                        <TableCell className="px-2 py-2 align-top">
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            className="h-8 text-xs"
                            value={itemConfig.shippingCost === 0 ? '' : itemConfig.shippingCost}
                            onChange={(e) => updateConvertItemConfig(itemId, { shippingCost: Math.max(0, parseFloat(e.target.value) || 0) })}
                            placeholder="0.00"
                          />
                        </TableCell>
                        <TableCell className="px-2 py-2 align-top">
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            className="h-8 text-xs"
                            value={itemConfig.additionalCost === 0 ? '' : itemConfig.additionalCost}
                            onChange={(e) => updateConvertItemConfig(itemId, { additionalCost: Math.max(0, parseFloat(e.target.value) || 0) })}
                            placeholder="0.00"
                          />
                        </TableCell>
                        <TableCell className="px-2 py-2 text-xs text-center align-top">{item.quantity}</TableCell>
                        <TableCell className="px-2 py-2 text-xs text-right font-semibold align-top">{lineTotal.toFixed(2)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Subtotal</p>
                <p className="text-lg font-bold text-slate-900">{convertSummary.subtotal.toFixed(2)}</p>
              </div>
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Shipping</p>
                <p className="text-lg font-bold text-slate-900">{convertSummary.shipping.toFixed(2)}</p>
              </div>
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Estimated Total</p>
                <p className="text-lg font-bold text-slate-900">{convertSummary.total.toFixed(2)}</p>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-200 bg-slate-50 px-4 py-3 flex justify-end gap-2">
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => {
              setShowConvertDialog(false);
              setConvertData({ supplier: '', notes: '', itemConfigurations: [] });
              setSelectedNeedList(null);
            }}>
              Cancel
            </Button>
            <Button size="sm" className="h-8 text-xs" onClick={handleConvertToOrder}>
              Create Order
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
