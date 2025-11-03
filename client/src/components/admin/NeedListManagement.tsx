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

export default function NeedListManagement() {
  const { toast } = useToast();

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
  const [selectedNeedList, setSelectedNeedList] = useState<NeedList | null>(null);

  // Form data
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    priority: 'medium',
    tags: '',
  });

  const [orderItems, setOrderItems] = useState<Array<{ part: string; quantity: number; notes: string }>>([
    { part: '', quantity: 1, notes: '' },
  ]);

  const [addItemData, setAddItemData] = useState({
    part: '',
    quantity: 1,
    notes: '',
  });

  const [convertData, setConvertData] = useState({
    supplier: '',
    notes: '',
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
      setAddItemData({ part: '', quantity: 1, notes: '' });
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

    try {
      const result = await convertNeedListToOrder(selectedNeedList._id, convertData);

      toast({
        title: 'Success',
        description: `Order ${result.order.orderNumber} created successfully`,
      });

      setShowConvertDialog(false);
      setConvertData({ supplier: '', notes: '' });
      setSelectedNeedList(null);
      loadData();
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
    setSelectedNeedList(needList);
    setShowConvertDialog(true);
  };

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
              <Select value={statusFilter || ''} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Statuses</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="ready">Ready</SelectItem>
                  <SelectItem value="ordered">Ordered</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Priority</Label>
              <Select value={priorityFilter || ''} onValueChange={setPriorityFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Priorities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Priorities</SelectItem>
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
                  <TableRow key={needList._id}>
                    <TableCell className="font-medium">{needList.name}</TableCell>
                    <TableCell>{needList.items.length}</TableCell>
                    <TableCell>{getStatusBadge(needList.status)}</TableCell>
                    <TableCell>{getPriorityBadge(needList.priority)}</TableCell>
                    <TableCell>{format(new Date(needList.createdAt), 'MMM dd, yyyy')}</TableCell>
                    <TableCell>
                      {needList.createdBy.firstName} {needList.createdBy.lastName}
                    </TableCell>
                    <TableCell>
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
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedNeedList?.name}</DialogTitle>
            <DialogDescription>
              {selectedNeedList?.description || 'No description'}
            </DialogDescription>
          </DialogHeader>

          {selectedNeedList && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Status</Label>
                  <div className="mt-1">{getStatusBadge(selectedNeedList.status)}</div>
                </div>
                <div>
                  <Label>Priority</Label>
                  <div className="mt-1">{getPriorityBadge(selectedNeedList.priority)}</div>
                </div>
                <div>
                  <Label>Created By</Label>
                  <p className="text-sm">
                    {selectedNeedList.createdBy.firstName} {selectedNeedList.createdBy.lastName}
                  </p>
                </div>
                <div>
                  <Label>Created At</Label>
                  <p className="text-sm">
                    {format(new Date(selectedNeedList.createdAt), 'MMM dd, yyyy HH:mm')}
                  </p>
                </div>
              </div>

              {selectedNeedList.tags && selectedNeedList.tags.length > 0 && (
                <div>
                  <Label>Tags</Label>
                  <div className="flex gap-2 mt-1">
                    {selectedNeedList.tags.map((tag, index) => (
                      <Badge key={index} variant="outline">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {selectedNeedList.convertedToOrder && (
                <div className="p-4 bg-muted rounded-lg">
                  <Label>Converted to Order</Label>
                  <p className="text-sm">
                    Order #{selectedNeedList.convertedToOrder.orderNumber} -{' '}
                    {selectedNeedList.convertedToOrder.status}
                  </p>
                </div>
              )}

              <div>
                <div className="flex justify-between items-center mb-2">
                  <Label>Items ({selectedNeedList.items.length})</Label>
                  {selectedNeedList.status !== 'ordered' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setShowAddItemDialog(true);
                      }}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add Item
                    </Button>
                  )}
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Part Number</TableHead>
                      <TableHead>Part Name</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead>Current Stock</TableHead>
                      <TableHead>Notes</TableHead>
                      {selectedNeedList.status !== 'ordered' && <TableHead>Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedNeedList.items.map((item) => (
                      <TableRow key={item._id}>
                        <TableCell>{item.partNumber}</TableCell>
                        <TableCell>{item.partName}</TableCell>
                        <TableCell>{item.quantity}</TableCell>
                        <TableCell>
                          <Badge variant={item.currentStock < item.quantity ? 'destructive' : 'default'}>
                            {item.currentStock}
                          </Badge>
                        </TableCell>
                        <TableCell>{item.notes || '-'}</TableCell>
                        {selectedNeedList.status !== 'ordered' && (
                          <TableCell>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRemoveItem(selectedNeedList._id, item._id!)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowViewDialog(false);
              setSelectedNeedList(null);
            }}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Item Dialog */}
      <Dialog open={showAddItemDialog} onOpenChange={setShowAddItemDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Item to Need List</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="add-part">Part</Label>
              <Select value={addItemData.part} onValueChange={(value) => setAddItemData({ ...addItemData, part: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select part" />
                </SelectTrigger>
                <SelectContent>
                  {parts.map((part) => (
                    <SelectItem key={part._id} value={part._id}>
                      {part.partNumber} - {part.name} (Stock: {part.currentStock})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="add-quantity">Quantity</Label>
              <Input
                id="add-quantity"
                type="number"
                min="1"
                value={addItemData.quantity}
                onChange={(e) => setAddItemData({ ...addItemData, quantity: parseInt(e.target.value) || 1 })}
              />
            </div>

            <div>
              <Label htmlFor="add-notes">Notes</Label>
              <Textarea
                id="add-notes"
                value={addItemData.notes}
                onChange={(e) => setAddItemData({ ...addItemData, notes: e.target.value })}
                placeholder="Optional notes..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowAddItemDialog(false);
              setAddItemData({ part: '', quantity: 1, notes: '' });
            }}>
              Cancel
            </Button>
            <Button onClick={handleAddItem} disabled={!addItemData.part}>
              Add Item
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Convert to Order Dialog */}
      <Dialog open={showConvertDialog} onOpenChange={setShowConvertDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Convert to EPart Order</DialogTitle>
            <DialogDescription>
              Convert this need list into an actual EPart order
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="convert-supplier">Supplier (Optional)</Label>
              <Select value={convertData.supplier} onValueChange={(value) => setConvertData({ ...convertData, supplier: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Auto-detect from parts" />
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
              <Label htmlFor="convert-notes">Order Notes</Label>
              <Textarea
                id="convert-notes"
                value={convertData.notes}
                onChange={(e) => setConvertData({ ...convertData, notes: e.target.value })}
                placeholder="Optional notes for the order..."
              />
            </div>

            {selectedNeedList && (
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm font-medium mb-2">Order Preview:</p>
                <p className="text-sm">
                  • {selectedNeedList.items.length} items
                </p>
                <p className="text-sm">
                  • Priority: {selectedNeedList.priority}
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowConvertDialog(false);
              setConvertData({ supplier: '', notes: '' });
              setSelectedNeedList(null);
            }}>
              Cancel
            </Button>
            <Button onClick={handleConvertToOrder}>
              Create Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
