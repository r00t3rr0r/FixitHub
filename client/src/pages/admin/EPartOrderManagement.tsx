import { useEffect, useState } from 'react';
import {
  getEPartOrders,
  getSuppliers,
  createEPartOrder,
  updateEPartOrder,
  receiveOrderItems,
  cancelEPartOrder,
  getEPartOrderById,
  getOrderStatistics,
  createSupplier,
  updateSupplier,
  type EPartOrder,
  type Supplier,
  type OrderItem,
  type OrderStatistics,
} from '@/api/epartOrders';
import { getParts, type Part } from '@/api/parts';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/useToast';
import {
  Plus,
  Search,
  Package,
  TrendingUp,
  DollarSign,
  ShoppingCart,
  Eye,
  Edit,
  X,
  CheckCircle,
  Truck,
  AlertCircle,
  Trash2,
} from 'lucide-react';
import { format } from 'date-fns';

export default function EPartOrderManagement() {
  const { toast } = useToast();

  // State
  const [orders, setOrders] = useState<EPartOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [parts, setParts] = useState<Part[]>([]);
  const [statistics, setStatistics] = useState<OrderStatistics | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Dialogs
  const [showCreateOrderDialog, setShowCreateOrderDialog] = useState(false);
  const [showCreateSupplierDialog, setShowCreateSupplierDialog] = useState(false);
  const [showEditSupplierDialog, setShowEditSupplierDialog] = useState(false);
  const [showOrderDetailsDialog, setShowOrderDetailsDialog] = useState(false);
  const [showReceiveDialog, setShowReceiveDialog] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<EPartOrder | null>(null);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);

  // Form data
  const [newOrder, setNewOrder] = useState<{
    supplierId: string;
    items: Array<{ partId: string; quantity: number; unitPrice: number }>;
    expectedDeliveryDate: string;
    tax: number;
    shippingCost: number;
    paymentMethod: string;
    notes: string;
  }>({
    supplierId: '',
    items: [],
    expectedDeliveryDate: '',
    tax: 0,
    shippingCost: 0,
    paymentMethod: 'account',
    notes: '',
  });

  const [newSupplier, setNewSupplier] = useState<Partial<Supplier>>({
    name: '',
    email: '',
    contactPerson: '',
    phone: '',
    paymentTerms: 'Net 30',
    leadTime: 7,
  });

  const [receiveData, setReceiveData] = useState<Array<{ itemId: string; quantity: number }>>([]);

  // Load data
  useEffect(() => {
    loadData();
  }, [statusFilter, supplierFilter, searchQuery]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [ordersData, suppliersData, partsData, statsData] = await Promise.all([
        getEPartOrders({
          status: statusFilter || undefined,
          supplierId: supplierFilter || undefined,
          search: searchQuery || undefined,
        }),
        getSuppliers({ isActive: true }),
        getParts({ limit: 1000 }),
        getOrderStatistics(),
      ]);

      setOrders(ordersData.orders);
      setSuppliers(suppliersData.suppliers);
      setParts(partsData.parts);
      setStatistics(statsData);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Handlers
  const handleCreateOrder = async () => {
    if (!newOrder.supplierId || newOrder.items.length === 0) {
      toast({
        title: 'Validation Error',
        description: 'Please select a supplier and add at least one item',
        variant: 'destructive',
      });
      return;
    }

    try {
      await createEPartOrder(newOrder);
      toast({
        title: 'Success',
        description: 'EPart order created successfully',
      });
      setShowCreateOrderDialog(false);
      resetNewOrderForm();
      loadData();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleCreateSupplier = async () => {
    if (!newSupplier.name || !newSupplier.email) {
      toast({
        title: 'Validation Error',
        description: 'Name and email are required',
        variant: 'destructive',
      });
      return;
    }

    try {
      await createSupplier(newSupplier);
      toast({
        title: 'Success',
        description: 'Supplier created successfully',
      });
      setShowCreateSupplierDialog(false);
      setNewSupplier({
        name: '',
        email: '',
        contactPerson: '',
        phone: '',
        paymentTerms: 'Net 30',
        leadTime: 7,
      });
      loadData();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleEditSupplier = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setShowEditSupplierDialog(true);
  };

  const handleUpdateSupplier = async () => {
    if (!selectedSupplier || !selectedSupplier.name || !selectedSupplier.email) {
      toast({
        title: 'Validation Error',
        description: 'Name and email are required',
        variant: 'destructive',
      });
      return;
    }

    try {
      await updateSupplier(selectedSupplier._id, selectedSupplier);
      toast({
        title: 'Success',
        description: 'Supplier updated successfully',
      });
      setShowEditSupplierDialog(false);
      setSelectedSupplier(null);
      loadData();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleViewOrder = async (orderId: string) => {
    try {
      const { order } = await getEPartOrderById(orderId);
      setSelectedOrder(order);
      setShowOrderDetailsDialog(true);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleUpdateOrderStatus = async (orderId: string, status: string) => {
    try {
      await updateEPartOrder(orderId, { status });
      toast({
        title: 'Success',
        description: 'Order status updated',
      });
      loadData();
      if (selectedOrder?._id === orderId) {
        const { order } = await getEPartOrderById(orderId);
        setSelectedOrder(order);
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleReceiveItems = async () => {
    if (!selectedOrder || receiveData.length === 0) return;

    try {
      await receiveOrderItems(selectedOrder._id, receiveData);
      toast({
        title: 'Success',
        description: 'Items received successfully',
      });
      setShowReceiveDialog(false);
      setReceiveData([]);
      loadData();
      const { order } = await getEPartOrderById(selectedOrder._id);
      setSelectedOrder(order);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    if (!confirm('Are you sure you want to cancel this order?')) return;

    try {
      await cancelEPartOrder(orderId, 'Cancelled by admin');
      toast({
        title: 'Success',
        description: 'Order cancelled',
      });
      loadData();
      setShowOrderDetailsDialog(false);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const addItemToOrder = () => {
    setNewOrder({
      ...newOrder,
      items: [...newOrder.items, { partId: '', quantity: 1, unitPrice: 0 }],
    });
  };

  const removeItemFromOrder = (index: number) => {
    setNewOrder({
      ...newOrder,
      items: newOrder.items.filter((_, i) => i !== index),
    });
  };

  const updateOrderItem = (index: number, field: string, value: any) => {
    const updatedItems = [...newOrder.items];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    setNewOrder({ ...newOrder, items: updatedItems });
  };

  const resetNewOrderForm = () => {
    setNewOrder({
      supplierId: '',
      items: [],
      expectedDeliveryDate: '',
      tax: 0,
      shippingCost: 0,
      paymentMethod: 'account',
      notes: '',
    });
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      draft: 'outline',
      pending: 'secondary',
      confirmed: 'default',
      shipped: 'default',
      partial: 'secondary',
      received: 'default',
      cancelled: 'destructive',
    };

    return <Badge variant={variants[status] || 'default'}>{status.toUpperCase()}</Badge>;
  };

  const getSupplierName = (supplierId: string | Supplier) => {
    if (typeof supplierId === 'object') return supplierId.name;
    const supplier = suppliers.find((s) => s._id === supplierId);
    return supplier?.name || 'Unknown';
  };

  if (loading && orders.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">Loading...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">EPart Order Management</h1>
          <p className="text-muted-foreground">Manage supplier orders and inventory replenishment</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowCreateSupplierDialog(true)} variant="outline">
            <Plus className="mr-2 h-4 w-4" />
            Add Supplier
          </Button>
          <Button onClick={() => setShowCreateOrderDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create Order
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      {statistics && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{statistics.totalOrders}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Spent</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${statistics.totalSpent.toFixed(2)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Orders</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {(statistics.ordersByStatus.pending || 0) + (statistics.ordersByStatus.confirmed || 0)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">In Transit</CardTitle>
              <Truck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{statistics.ordersByStatus.shipped || 0}</div>
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
                  placeholder="Order number..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>

            <div>
              <Label>Status</Label>
              <Select value={statusFilter || undefined} onValueChange={(value) => setStatusFilter(value || '')}>
                <SelectTrigger>
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="shipped">Shipped</SelectItem>
                  <SelectItem value="partial">Partial</SelectItem>
                  <SelectItem value="received">Received</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Supplier</Label>
              <Select value={supplierFilter || undefined} onValueChange={(value) => setSupplierFilter(value || '')}>
                <SelectTrigger>
                  <SelectValue placeholder="All Suppliers" />
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

            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={() => {
                  setStatusFilter('');
                  setSupplierFilter('');
                  setSearchQuery('');
                }}
              >
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Orders Table */}
      <Card>
        <CardHeader>
          <CardTitle>Orders</CardTitle>
          <CardDescription>View and manage all epart orders</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order #</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Order Date</TableHead>
                <TableHead>Expected</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground">
                    No orders found
                  </TableCell>
                </TableRow>
              ) : (
                orders.map((order) => (
                  <TableRow key={order._id}>
                    <TableCell className="font-medium">{order.orderNumber}</TableCell>
                    <TableCell>{getSupplierName(order.supplierId)}</TableCell>
                    <TableCell>{order.items.length}</TableCell>
                    <TableCell>${order.totalCost.toFixed(2)}</TableCell>
                    <TableCell>{getStatusBadge(order.status)}</TableCell>
                    <TableCell>
                      <Badge variant={order.paymentStatus === 'paid' ? 'default' : 'outline'}>
                        {order.paymentStatus}
                      </Badge>
                    </TableCell>
                    <TableCell>{format(new Date(order.orderDate), 'MMM dd, yyyy')}</TableCell>
                    <TableCell>
                      {order.expectedDeliveryDate
                        ? format(new Date(order.expectedDeliveryDate), 'MMM dd, yyyy')
                        : '-'}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewOrder(order._id)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Suppliers Table */}
      <Card>
        <CardHeader>
          <CardTitle>Suppliers</CardTitle>
          <CardDescription>View and manage all suppliers</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Contact Person</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Website</TableHead>
                <TableHead>Ust.ID</TableHead>
                <TableHead>Payment Terms</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {suppliers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground">
                    No suppliers found
                  </TableCell>
                </TableRow>
              ) : (
                suppliers.map((supplier) => (
                  <TableRow key={supplier._id}>
                    <TableCell className="font-medium">{supplier.name}</TableCell>
                    <TableCell>{supplier.email}</TableCell>
                    <TableCell>{supplier.contactPerson || '-'}</TableCell>
                    <TableCell>{supplier.phone || '-'}</TableCell>
                    <TableCell>
                      {supplier.website ? (
                        <a
                          href={supplier.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          Link
                        </a>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell>{supplier.ustId || '-'}</TableCell>
                    <TableCell>{supplier.paymentTerms || '-'}</TableCell>
                    <TableCell>
                      <Badge variant={supplier.isActive ? 'default' : 'secondary'}>
                        {supplier.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditSupplier(supplier)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create Order Dialog */}
      <Dialog open={showCreateOrderDialog} onOpenChange={setShowCreateOrderDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New EPart Order</DialogTitle>
            <DialogDescription>
              Create a new order to replenish inventory from a supplier
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Supplier *</Label>
              <Select
                value={newOrder.supplierId}
                onValueChange={(value) => setNewOrder({ ...newOrder, supplierId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select supplier" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((supplier) => (
                    <SelectItem key={supplier._id} value={supplier._id}>
                      {supplier.name} - {supplier.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <Label>Order Items *</Label>
                <Button type="button" variant="outline" size="sm" onClick={addItemToOrder}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Item
                </Button>
              </div>

              {newOrder.items.map((item, index) => (
                <div key={index} className="flex gap-2 mb-2">
                  <Select
                    value={item.partId}
                    onValueChange={(value) => updateOrderItem(index, 'partId', value)}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select part" />
                    </SelectTrigger>
                    <SelectContent>
                      {parts.map((part) => (
                        <SelectItem key={part._id} value={part._id}>
                          {part.name} ({part.sku})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    placeholder="Qty"
                    value={item.quantity}
                    onChange={(e) =>
                      updateOrderItem(index, 'quantity', parseInt(e.target.value) || 0)
                    }
                    className="w-24"
                  />
                  <Input
                    type="number"
                    placeholder="Price"
                    value={item.unitPrice}
                    onChange={(e) =>
                      updateOrderItem(index, 'unitPrice', parseFloat(e.target.value) || 0)
                    }
                    className="w-32"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeItemFromOrder(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Expected Delivery Date</Label>
                <Input
                  type="date"
                  value={newOrder.expectedDeliveryDate}
                  onChange={(e) =>
                    setNewOrder({ ...newOrder, expectedDeliveryDate: e.target.value })
                  }
                />
              </div>

              <div>
                <Label>Payment Method</Label>
                <Select
                  value={newOrder.paymentMethod}
                  onValueChange={(value) => setNewOrder({ ...newOrder, paymentMethod: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="account">Account</SelectItem>
                    <SelectItem value="credit_card">Credit Card</SelectItem>
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                    <SelectItem value="check">Check</SelectItem>
                    <SelectItem value="cash">Cash</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Tax</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={newOrder.tax}
                  onChange={(e) =>
                    setNewOrder({ ...newOrder, tax: parseFloat(e.target.value) || 0 })
                  }
                />
              </div>

              <div>
                <Label>Shipping Cost</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={newOrder.shippingCost}
                  onChange={(e) =>
                    setNewOrder({ ...newOrder, shippingCost: parseFloat(e.target.value) || 0 })
                  }
                />
              </div>
            </div>

            <div>
              <Label>Notes</Label>
              <Textarea
                value={newOrder.notes}
                onChange={(e) => setNewOrder({ ...newOrder, notes: e.target.value })}
                placeholder="Additional notes..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateOrderDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateOrder}>Create Order</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Supplier Dialog */}
      <Dialog open={showCreateSupplierDialog} onOpenChange={setShowCreateSupplierDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Supplier</DialogTitle>
            <DialogDescription>Create a new supplier for epart orders</DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Basic Information Section */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground border-b pb-2">
                Basic Information
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Name *</Label>
                  <Input
                    value={newSupplier.name}
                    onChange={(e) => setNewSupplier({ ...newSupplier, name: e.target.value })}
                    placeholder="Supplier name"
                  />
                </div>

                <div>
                  <Label>Email *</Label>
                  <Input
                    type="email"
                    value={newSupplier.email}
                    onChange={(e) => setNewSupplier({ ...newSupplier, email: e.target.value })}
                    placeholder="supplier@example.com"
                  />
                </div>

                <div>
                  <Label>Contact Person</Label>
                  <Input
                    value={newSupplier.contactPerson}
                    onChange={(e) =>
                      setNewSupplier({ ...newSupplier, contactPerson: e.target.value })
                    }
                    placeholder="John Doe"
                  />
                </div>

                <div>
                  <Label>Phone</Label>
                  <Input
                    value={newSupplier.phone}
                    onChange={(e) => setNewSupplier({ ...newSupplier, phone: e.target.value })}
                    placeholder="+49 123 456789"
                  />
                </div>

                <div>
                  <Label>Website</Label>
                  <Input
                    type="url"
                    placeholder="https://example.com"
                    value={newSupplier.website}
                    onChange={(e) => setNewSupplier({ ...newSupplier, website: e.target.value })}
                  />
                </div>

                <div>
                  <Label>Ust.ID (VAT ID)</Label>
                  <Input
                    placeholder="DE123456789"
                    value={newSupplier.ustId}
                    onChange={(e) => setNewSupplier({ ...newSupplier, ustId: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {/* Address Section */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground border-b pb-2">
                Address
              </h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-3">
                  <Label>Street</Label>
                  <Input
                    value={newSupplier.address?.street}
                    onChange={(e) =>
                      setNewSupplier({
                        ...newSupplier,
                        address: { ...newSupplier.address, street: e.target.value },
                      })
                    }
                    placeholder="123 Main Street"
                  />
                </div>
                <div>
                  <Label>City</Label>
                  <Input
                    value={newSupplier.address?.city}
                    onChange={(e) =>
                      setNewSupplier({
                        ...newSupplier,
                        address: { ...newSupplier.address, city: e.target.value },
                      })
                    }
                    placeholder="Berlin"
                  />
                </div>
                <div>
                  <Label>State/Region</Label>
                  <Input
                    value={newSupplier.address?.state}
                    onChange={(e) =>
                      setNewSupplier({
                        ...newSupplier,
                        address: { ...newSupplier.address, state: e.target.value },
                      })
                    }
                    placeholder="Berlin"
                  />
                </div>
                <div>
                  <Label>Zip Code</Label>
                  <Input
                    value={newSupplier.address?.zipCode}
                    onChange={(e) =>
                      setNewSupplier({
                        ...newSupplier,
                        address: { ...newSupplier.address, zipCode: e.target.value },
                      })
                    }
                    placeholder="10115"
                  />
                </div>
                <div className="col-span-3">
                  <Label>Country</Label>
                  <Input
                    value={newSupplier.address?.country}
                    onChange={(e) =>
                      setNewSupplier({
                        ...newSupplier,
                        address: { ...newSupplier.address, country: e.target.value },
                      })
                    }
                    placeholder="Germany"
                  />
                </div>
              </div>
            </div>

            {/* Payment Information Section */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground border-b pb-2">
                Payment Information
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>IBAN</Label>
                  <Input
                    placeholder="DE89 3704 0044 0532 0130 00"
                    value={newSupplier.paymentInformation?.iban}
                    onChange={(e) =>
                      setNewSupplier({
                        ...newSupplier,
                        paymentInformation: {
                          ...newSupplier.paymentInformation,
                          iban: e.target.value,
                        },
                      })
                    }
                  />
                </div>
                <div>
                  <Label>BIC/SWIFT</Label>
                  <Input
                    placeholder="COBADEFFXXX"
                    value={newSupplier.paymentInformation?.bic}
                    onChange={(e) =>
                      setNewSupplier({
                        ...newSupplier,
                        paymentInformation: {
                          ...newSupplier.paymentInformation,
                          bic: e.target.value,
                        },
                      })
                    }
                  />
                </div>
                <div>
                  <Label>Bank Name</Label>
                  <Input
                    placeholder="Commerzbank"
                    value={newSupplier.paymentInformation?.bankName}
                    onChange={(e) =>
                      setNewSupplier({
                        ...newSupplier,
                        paymentInformation: {
                          ...newSupplier.paymentInformation,
                          bankName: e.target.value,
                        },
                      })
                    }
                  />
                </div>
                <div>
                  <Label>Account Holder</Label>
                  <Input
                    value={newSupplier.paymentInformation?.accountHolder}
                    onChange={(e) =>
                      setNewSupplier({
                        ...newSupplier,
                        paymentInformation: {
                          ...newSupplier.paymentInformation,
                          accountHolder: e.target.value,
                        },
                      })
                    }
                    placeholder="Account holder name"
                  />
                </div>
              </div>
            </div>

            {/* Terms Section */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground border-b pb-2">
                Terms & Conditions
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Payment Terms</Label>
                  <Input
                    value={newSupplier.paymentTerms}
                    onChange={(e) =>
                      setNewSupplier({ ...newSupplier, paymentTerms: e.target.value })
                    }
                    placeholder="Net 30"
                  />
                </div>

                <div>
                  <Label>Lead Time (days)</Label>
                  <Input
                    type="number"
                    value={newSupplier.leadTime}
                    onChange={(e) =>
                      setNewSupplier({ ...newSupplier, leadTime: parseInt(e.target.value) || 0 })
                    }
                    placeholder="7"
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setShowCreateSupplierDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateSupplier}>Create Supplier</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Supplier Dialog */}
      {selectedSupplier && (
        <Dialog open={showEditSupplierDialog} onOpenChange={setShowEditSupplierDialog}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Supplier</DialogTitle>
              <DialogDescription>Update supplier information</DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              {/* Basic Information Section */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground border-b pb-2">
                  Basic Information
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Name *</Label>
                    <Input
                      value={selectedSupplier.name}
                      onChange={(e) =>
                        setSelectedSupplier({ ...selectedSupplier, name: e.target.value })
                      }
                      placeholder="Supplier name"
                    />
                  </div>

                  <div>
                    <Label>Email *</Label>
                    <Input
                      type="email"
                      value={selectedSupplier.email}
                      onChange={(e) =>
                        setSelectedSupplier({ ...selectedSupplier, email: e.target.value })
                      }
                      placeholder="supplier@example.com"
                    />
                  </div>

                  <div>
                    <Label>Contact Person</Label>
                    <Input
                      value={selectedSupplier.contactPerson}
                      onChange={(e) =>
                        setSelectedSupplier({ ...selectedSupplier, contactPerson: e.target.value })
                      }
                      placeholder="John Doe"
                    />
                  </div>

                  <div>
                    <Label>Phone</Label>
                    <Input
                      value={selectedSupplier.phone}
                      onChange={(e) =>
                        setSelectedSupplier({ ...selectedSupplier, phone: e.target.value })
                      }
                      placeholder="+49 123 456789"
                    />
                  </div>

                  <div>
                    <Label>Website</Label>
                    <Input
                      type="url"
                      placeholder="https://example.com"
                      value={selectedSupplier.website}
                      onChange={(e) =>
                        setSelectedSupplier({ ...selectedSupplier, website: e.target.value })
                      }
                    />
                  </div>

                  <div>
                    <Label>Ust.ID (VAT ID)</Label>
                    <Input
                      placeholder="DE123456789"
                      value={selectedSupplier.ustId}
                      onChange={(e) =>
                        setSelectedSupplier({ ...selectedSupplier, ustId: e.target.value })
                      }
                    />
                  </div>
                </div>
              </div>

              {/* Address Section */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground border-b pb-2">
                  Address
                </h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-3">
                    <Label>Street</Label>
                    <Input
                      value={selectedSupplier.address?.street}
                      onChange={(e) =>
                        setSelectedSupplier({
                          ...selectedSupplier,
                          address: { ...selectedSupplier.address, street: e.target.value },
                        })
                      }
                      placeholder="123 Main Street"
                    />
                  </div>
                  <div>
                    <Label>City</Label>
                    <Input
                      value={selectedSupplier.address?.city}
                      onChange={(e) =>
                        setSelectedSupplier({
                          ...selectedSupplier,
                          address: { ...selectedSupplier.address, city: e.target.value },
                        })
                      }
                      placeholder="Berlin"
                    />
                  </div>
                  <div>
                    <Label>State/Region</Label>
                    <Input
                      value={selectedSupplier.address?.state}
                      onChange={(e) =>
                        setSelectedSupplier({
                          ...selectedSupplier,
                          address: { ...selectedSupplier.address, state: e.target.value },
                        })
                      }
                      placeholder="Berlin"
                    />
                  </div>
                  <div>
                    <Label>Zip Code</Label>
                    <Input
                      value={selectedSupplier.address?.zipCode}
                      onChange={(e) =>
                        setSelectedSupplier({
                          ...selectedSupplier,
                          address: { ...selectedSupplier.address, zipCode: e.target.value },
                        })
                      }
                      placeholder="10115"
                    />
                  </div>
                  <div className="col-span-3">
                    <Label>Country</Label>
                    <Input
                      value={selectedSupplier.address?.country}
                      onChange={(e) =>
                        setSelectedSupplier({
                          ...selectedSupplier,
                          address: { ...selectedSupplier.address, country: e.target.value },
                        })
                      }
                      placeholder="Germany"
                    />
                  </div>
                </div>
              </div>

              {/* Payment Information Section */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground border-b pb-2">
                  Payment Information
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>IBAN</Label>
                    <Input
                      placeholder="DE89 3704 0044 0532 0130 00"
                      value={selectedSupplier.paymentInformation?.iban}
                      onChange={(e) =>
                        setSelectedSupplier({
                          ...selectedSupplier,
                          paymentInformation: {
                            ...selectedSupplier.paymentInformation,
                            iban: e.target.value,
                          },
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label>BIC/SWIFT</Label>
                    <Input
                      placeholder="COBADEFFXXX"
                      value={selectedSupplier.paymentInformation?.bic}
                      onChange={(e) =>
                        setSelectedSupplier({
                          ...selectedSupplier,
                          paymentInformation: {
                            ...selectedSupplier.paymentInformation,
                            bic: e.target.value,
                          },
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label>Bank Name</Label>
                    <Input
                      placeholder="Commerzbank"
                      value={selectedSupplier.paymentInformation?.bankName}
                      onChange={(e) =>
                        setSelectedSupplier({
                          ...selectedSupplier,
                          paymentInformation: {
                            ...selectedSupplier.paymentInformation,
                            bankName: e.target.value,
                          },
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label>Account Holder</Label>
                    <Input
                      value={selectedSupplier.paymentInformation?.accountHolder}
                      onChange={(e) =>
                        setSelectedSupplier({
                          ...selectedSupplier,
                          paymentInformation: {
                            ...selectedSupplier.paymentInformation,
                            accountHolder: e.target.value,
                          },
                        })
                      }
                      placeholder="Account holder name"
                    />
                  </div>
                </div>
              </div>

              {/* Terms & Status Section */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground border-b pb-2">
                  Terms & Status
                </h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label>Payment Terms</Label>
                    <Input
                      value={selectedSupplier.paymentTerms}
                      onChange={(e) =>
                        setSelectedSupplier({ ...selectedSupplier, paymentTerms: e.target.value })
                      }
                      placeholder="Net 30"
                    />
                  </div>

                  <div>
                    <Label>Lead Time (days)</Label>
                    <Input
                      type="number"
                      value={selectedSupplier.leadTime}
                      onChange={(e) =>
                        setSelectedSupplier({
                          ...selectedSupplier,
                          leadTime: parseInt(e.target.value) || 0,
                        })
                      }
                      placeholder="7"
                    />
                  </div>

                  <div>
                    <Label>Status</Label>
                    <Select
                      value={selectedSupplier.isActive ? 'active' : 'inactive'}
                      onValueChange={(value) =>
                        setSelectedSupplier({ ...selectedSupplier, isActive: value === 'active' })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter className="mt-6">
              <Button
                variant="outline"
                onClick={() => {
                  setShowEditSupplierDialog(false);
                  setSelectedSupplier(null);
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleUpdateSupplier}>Update Supplier</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Order Details Dialog */}
      {selectedOrder && (
        <Dialog open={showOrderDetailsDialog} onOpenChange={setShowOrderDetailsDialog}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Order Details - {selectedOrder.orderNumber}</DialogTitle>
              <DialogDescription>
                Manage order status, receive items, and view order history
              </DialogDescription>
            </DialogHeader>

            <Tabs defaultValue="details">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="items">Items</TabsTrigger>
                <TabsTrigger value="timeline">Timeline</TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Supplier</Label>
                    <p className="text-sm">{getSupplierName(selectedOrder.supplierId)}</p>
                  </div>

                  <div>
                    <Label>Status</Label>
                    <div className="mt-1">
                      {getStatusBadge(selectedOrder.status)}
                      {selectedOrder.status !== 'cancelled' &&
                        selectedOrder.status !== 'received' && (
                          <Select
                            value={selectedOrder.status}
                            onValueChange={(value) =>
                              handleUpdateOrderStatus(selectedOrder._id, value)
                            }
                          >
                            <SelectTrigger className="mt-2">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="draft">Draft</SelectItem>
                              <SelectItem value="pending">Pending</SelectItem>
                              <SelectItem value="confirmed">Confirmed</SelectItem>
                              <SelectItem value="shipped">Shipped</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                    </div>
                  </div>

                  <div>
                    <Label>Order Date</Label>
                    <p className="text-sm">
                      {format(new Date(selectedOrder.orderDate), 'MMM dd, yyyy')}
                    </p>
                  </div>

                  <div>
                    <Label>Expected Delivery</Label>
                    <p className="text-sm">
                      {selectedOrder.expectedDeliveryDate
                        ? format(new Date(selectedOrder.expectedDeliveryDate), 'MMM dd, yyyy')
                        : '-'}
                    </p>
                  </div>

                  <div>
                    <Label>Subtotal</Label>
                    <p className="text-sm">${selectedOrder.subtotal.toFixed(2)}</p>
                  </div>

                  <div>
                    <Label>Tax</Label>
                    <p className="text-sm">${selectedOrder.tax.toFixed(2)}</p>
                  </div>

                  <div>
                    <Label>Shipping</Label>
                    <p className="text-sm">${selectedOrder.shippingCost.toFixed(2)}</p>
                  </div>

                  <div>
                    <Label>Total</Label>
                    <p className="text-sm font-bold">${selectedOrder.totalCost.toFixed(2)}</p>
                  </div>

                  <div>
                    <Label>Payment Status</Label>
                    <p className="text-sm">
                      <Badge
                        variant={selectedOrder.paymentStatus === 'paid' ? 'default' : 'outline'}
                      >
                        {selectedOrder.paymentStatus}
                      </Badge>
                    </p>
                  </div>

                  <div>
                    <Label>Tracking Number</Label>
                    <p className="text-sm">{selectedOrder.trackingNumber || '-'}</p>
                  </div>
                </div>

                {selectedOrder.notes && (
                  <div>
                    <Label>Notes</Label>
                    <p className="text-sm text-muted-foreground">{selectedOrder.notes}</p>
                  </div>
                )}

                <div className="flex gap-2">
                  {selectedOrder.status === 'shipped' && (
                    <Button
                      onClick={() => {
                        setShowReceiveDialog(true);
                        setReceiveData(
                          selectedOrder.items.map((item) => ({
                            itemId: item._id!,
                            quantity: item.quantity - item.receivedQuantity,
                          }))
                        );
                      }}
                    >
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Receive Items
                    </Button>
                  )}
                  {selectedOrder.status !== 'cancelled' &&
                    selectedOrder.status !== 'received' && (
                      <Button
                        variant="destructive"
                        onClick={() => handleCancelOrder(selectedOrder._id)}
                      >
                        <X className="mr-2 h-4 w-4" />
                        Cancel Order
                      </Button>
                    )}
                </div>
              </TabsContent>

              <TabsContent value="items">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Part</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>Ordered</TableHead>
                      <TableHead>Received</TableHead>
                      <TableHead>Unit Price</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedOrder.items.map((item) => (
                      <TableRow key={item._id}>
                        <TableCell>{item.partName}</TableCell>
                        <TableCell>{item.sku}</TableCell>
                        <TableCell>{item.quantity}</TableCell>
                        <TableCell>{item.receivedQuantity}</TableCell>
                        <TableCell>${item.unitPrice.toFixed(2)}</TableCell>
                        <TableCell>${item.totalPrice.toFixed(2)}</TableCell>
                        <TableCell>{getStatusBadge(item.status)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TabsContent>

              <TabsContent value="timeline">
                <div className="space-y-4">
                  {selectedOrder.timeline.map((entry, index) => (
                    <div key={index} className="flex gap-4">
                      <div className="flex-shrink-0 w-24 text-sm text-muted-foreground">
                        {format(new Date(entry.completedAt), 'MMM dd, HH:mm')}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{entry.status}</p>
                        <p className="text-sm text-muted-foreground">{entry.description}</p>
                        {entry.notes && (
                          <p className="text-sm text-muted-foreground italic">{entry.notes}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
      )}

      {/* Receive Items Dialog */}
      {selectedOrder && (
        <Dialog open={showReceiveDialog} onOpenChange={setShowReceiveDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Receive Items</DialogTitle>
              <DialogDescription>
                Mark items as received and update inventory
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {selectedOrder.items.map((item, index) => {
                const remainingQty = item.quantity - item.receivedQuantity;
                if (remainingQty <= 0) return null;

                return (
                  <div key={item._id} className="flex items-center gap-4">
                    <div className="flex-1">
                      <p className="font-medium">{item.partName}</p>
                      <p className="text-sm text-muted-foreground">
                        Remaining: {remainingQty} / {item.quantity}
                      </p>
                    </div>
                    <Input
                      type="number"
                      min="0"
                      max={remainingQty}
                      value={receiveData.find((d) => d.itemId === item._id)?.quantity || 0}
                      onChange={(e) => {
                        const qty = parseInt(e.target.value) || 0;
                        setReceiveData((prev) => {
                          const existing = prev.find((d) => d.itemId === item._id);
                          if (existing) {
                            return prev.map((d) =>
                              d.itemId === item._id ? { ...d, quantity: qty } : d
                            );
                          }
                          return [...prev, { itemId: item._id!, quantity: qty }];
                        });
                      }}
                      className="w-24"
                    />
                  </div>
                );
              })}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowReceiveDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleReceiveItems}>Receive Items</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
