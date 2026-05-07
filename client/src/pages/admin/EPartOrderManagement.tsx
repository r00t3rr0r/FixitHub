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
  uploadInvoice,
  downloadInvoice,
  requestReturnExchange,
  updateReturnExchange,
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
  ClipboardList,
  Upload,
  Download,
  FileText,
  RefreshCw,
  RotateCcw,
} from 'lucide-react';
import { format } from 'date-fns';
import NeedListManagement from '@/components/admin/NeedListManagement';
import { cn } from '@/lib/utils';

export default function EPartOrderManagement() {
  const { toast } = useToast();
  const fallbackVatRate = 0.19;
  const pageSectionCardClass = 'border-slate-200 shadow-sm';
  const compactCardHeaderClass = 'space-y-1 px-4 py-3';
  const compactCardContentClass = 'px-4 pb-4';
  const compactLabelClass = 'text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600';
  const compactInputClass = 'h-8 text-xs';
  const compactSelectClass = 'h-8 text-xs';
  const compactTextareaClass = 'min-h-[88px] text-xs';
  const compactButtonClass = 'h-8 text-xs';
  const compactGhostButtonClass = 'h-8 w-8 p-0';
  const compactTableHeadClass = 'h-9 px-2 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500';
  const compactTableCellClass = 'px-2 py-2 text-xs align-middle';
  const compactDialogContentClass = 'max-h-[88vh] overflow-hidden gap-0 border-slate-200 p-0 shadow-xl';
  const compactDialogHeaderClass = 'space-y-1 border-b border-slate-800 bg-[#1a2a5e] px-4 py-3 text-left';
  const compactDialogTitleClass = 'text-base font-semibold text-white';
  const compactDialogDescriptionClass = 'text-xs text-slate-200';
  const compactDialogBodyClass = 'space-y-4 p-4 pt-3';
  const compactDialogFooterClass = 'border-t border-slate-200 bg-slate-50 px-4 py-3';

  const getOrderTaxRate = (order: EPartOrder) => {
    const netBase =
      Math.max(0, Number(order.subtotal) || 0) + Math.max(0, Number(order.shippingCost) || 0);

    if (netBase <= 0) {
      return fallbackVatRate;
    }

    const derivedRate = (Math.max(0, Number(order.tax) || 0) / netBase);
    if (!Number.isFinite(derivedRate) || derivedRate <= 0) {
      return fallbackVatRate;
    }

    return derivedRate;
  };

  const convertByPriceType = (amount: number, priceType: 'net' | 'gross', taxRate: number) => {
    const normalized = Math.max(0, Number(amount) || 0);
    if (priceType === 'gross') {
      const net = normalized / (1 + taxRate);
      return { net, gross: normalized };
    }

    const gross = normalized * (1 + taxRate);
    return { net: normalized, gross };
  };

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
  const [showInvoiceUploadDialog, setShowInvoiceUploadDialog] = useState(false);
  const [showReturnExchangeDialog, setShowReturnExchangeDialog] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<EPartOrder | null>(null);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [uploadingInvoice, setUploadingInvoice] = useState(false);

  // Return/Exchange form
  const [returnExchangeForm, setReturnExchangeForm] = useState<{
    type: 'return' | 'exchange';
    reason: string;
    description: string;
    affectedItems: Array<{ itemId: string; quantity: number; issueDescription: string }>;
  }>({
    type: 'return',
    reason: '',
    description: '',
    affectedItems: [],
  });

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

  const handleUploadInvoice = async () => {
    if (!selectedOrder || !invoiceFile) return;

    setUploadingInvoice(true);
    try {
      await uploadInvoice(selectedOrder._id, invoiceFile);
      toast({
        title: 'Success',
        description: 'Invoice uploaded successfully',
      });
      setShowInvoiceUploadDialog(false);
      setInvoiceFile(null);
      const { order } = await getEPartOrderById(selectedOrder._id);
      setSelectedOrder(order);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setUploadingInvoice(false);
    }
  };

  const handleDownloadInvoice = async (orderId: string) => {
    try {
      const blob = await downloadInvoice(orderId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice-${orderId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleRequestReturnExchange = async () => {
    if (!selectedOrder || returnExchangeForm.affectedItems.length === 0) {
      toast({
        title: 'Validation Error',
        description: 'Please select at least one item',
        variant: 'destructive',
      });
      return;
    }

    if (!returnExchangeForm.reason || !returnExchangeForm.description) {
      toast({
        title: 'Validation Error',
        description: 'Please provide reason and description',
        variant: 'destructive',
      });
      return;
    }

    try {
      await requestReturnExchange(selectedOrder._id, returnExchangeForm);
      toast({
        title: 'Success',
        description: `${returnExchangeForm.type === 'return' ? 'Return' : 'Exchange'} request submitted`,
      });
      setShowReturnExchangeDialog(false);
      setReturnExchangeForm({
        type: 'return',
        reason: '',
        description: '',
        affectedItems: [],
      });
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

  const handleUpdateReturnExchange = async (status: 'approved' | 'in_transit' | 'completed' | 'rejected', notes?: string) => {
    if (!selectedOrder) return;

    try {
      await updateReturnExchange(selectedOrder._id, { status, notes });
      toast({
        title: 'Success',
        description: `Return/Exchange ${status}`,
      });
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

  const addAffectedItem = () => {
    if (!selectedOrder) return;
    const firstItem = selectedOrder.items.find(item => item.receivedQuantity > 0);
    if (firstItem) {
      setReturnExchangeForm({
        ...returnExchangeForm,
        affectedItems: [
          ...returnExchangeForm.affectedItems,
          { itemId: firstItem._id!, quantity: 1, issueDescription: '' },
        ],
      });
    }
  };

  const removeAffectedItem = (index: number) => {
    setReturnExchangeForm({
      ...returnExchangeForm,
      affectedItems: returnExchangeForm.affectedItems.filter((_, i) => i !== index),
    });
  };

  const updateAffectedItem = (index: number, field: string, value: any) => {
    const updated = [...returnExchangeForm.affectedItems];
    updated[index] = { ...updated[index], [field]: value };
    setReturnExchangeForm({ ...returnExchangeForm, affectedItems: updated });
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
    if (typeof supplierId === 'object' && supplierId !== null) return supplierId.name;
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
    <div className="container mx-auto max-w-[1600px] space-y-4 px-4 py-4 lg:px-5">
      {/* Header */}
      <div className="rounded-lg border border-slate-200 bg-gradient-to-r from-[#1a2a5e] via-[#243976] to-[#2b4a92] px-4 py-4 text-white shadow-sm">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">EPart Order Management</h1>
          <p className="mt-1 text-sm text-slate-200">Manage supplier orders, need lists, and inventory replenishment</p>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="need-lists" className="space-y-4">
        <TabsList className="grid h-auto w-full grid-cols-3 gap-1 rounded-lg border border-slate-200 bg-slate-100 p-1">
          <TabsTrigger value="need-lists" className="h-9 text-xs font-semibold">
            <ClipboardList className="mr-2 h-3.5 w-3.5" />
            Need Lists
          </TabsTrigger>
          <TabsTrigger value="orders" className="h-9 text-xs font-semibold">
            <ShoppingCart className="mr-2 h-3.5 w-3.5" />
            Orders
          </TabsTrigger>
          <TabsTrigger value="suppliers" className="h-9 text-xs font-semibold">
            <Package className="mr-2 h-3.5 w-3.5" />
            Suppliers
          </TabsTrigger>
        </TabsList>

        <TabsContent value="orders" className="space-y-4">
          {/* Orders Content */}
          <div className="flex justify-end gap-2">
            <Button onClick={() => setShowCreateOrderDialog(true)} className={cn(compactButtonClass, 'px-3')}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Create Order
            </Button>
          </div>

      {/* Statistics Cards */}
      {statistics && (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Card className={pageSectionCardClass}>
            <CardHeader className={cn(compactCardHeaderClass, 'flex-row items-center justify-between space-y-0 pb-2')}>
              <CardTitle className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Total Orders</CardTitle>
              <ShoppingCart className="h-4 w-4 text-slate-400" />
            </CardHeader>
            <CardContent className={compactCardContentClass}>
              <div className="text-xl font-bold text-slate-900">{statistics.totalOrders}</div>
            </CardContent>
          </Card>

          <Card className={pageSectionCardClass}>
            <CardHeader className={cn(compactCardHeaderClass, 'flex-row items-center justify-between space-y-0 pb-2')}>
              <CardTitle className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Total Spent</CardTitle>
              <DollarSign className="h-4 w-4 text-slate-400" />
            </CardHeader>
            <CardContent className={compactCardContentClass}>
              <div className="text-xl font-bold text-slate-900">${statistics.totalSpent.toFixed(2)}</div>
            </CardContent>
          </Card>

          <Card className={pageSectionCardClass}>
            <CardHeader className={cn(compactCardHeaderClass, 'flex-row items-center justify-between space-y-0 pb-2')}>
              <CardTitle className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Pending Orders</CardTitle>
              <Package className="h-4 w-4 text-slate-400" />
            </CardHeader>
            <CardContent className={compactCardContentClass}>
              <div className="text-xl font-bold text-slate-900">
                {(statistics.ordersByStatus.pending || 0) + (statistics.ordersByStatus.confirmed || 0)}
              </div>
            </CardContent>
          </Card>

          <Card className={pageSectionCardClass}>
            <CardHeader className={cn(compactCardHeaderClass, 'flex-row items-center justify-between space-y-0 pb-2')}>
              <CardTitle className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">In Transit</CardTitle>
              <Truck className="h-4 w-4 text-slate-400" />
            </CardHeader>
            <CardContent className={compactCardContentClass}>
              <div className="text-xl font-bold text-slate-900">{statistics.ordersByStatus.shipped || 0}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card className={pageSectionCardClass}>
        <CardHeader className={compactCardHeaderClass}>
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent className={compactCardContentClass}>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <div>
              <Label className={compactLabelClass}>Search</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Order number..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={cn(compactInputClass, 'pl-7')}
                />
              </div>
            </div>

            <div>
              <Label className={compactLabelClass}>Status</Label>
              <Select value={statusFilter || undefined} onValueChange={(value) => setStatusFilter(value || '')}>
                <SelectTrigger className={compactSelectClass}>
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
              <Label className={compactLabelClass}>Supplier</Label>
              <Select value={supplierFilter || undefined} onValueChange={(value) => setSupplierFilter(value || '')}>
                <SelectTrigger className={compactSelectClass}>
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
                className={cn(compactButtonClass, 'w-full md:w-auto')}
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
      <Card className={pageSectionCardClass}>
        <CardHeader className={compactCardHeaderClass}>
          <CardTitle className="text-base">Orders</CardTitle>
          <CardDescription className="text-xs">View and manage all epart orders</CardDescription>
        </CardHeader>
        <CardContent className={cn(compactCardContentClass, 'pt-0')}>
          <div className="overflow-x-auto">
            <Table>
            <TableHeader>
              <TableRow>
                <TableHead className={compactTableHeadClass}>Order #</TableHead>
                <TableHead className={compactTableHeadClass}>Supplier</TableHead>
                <TableHead className={compactTableHeadClass}>Items</TableHead>
                <TableHead className={compactTableHeadClass}>Total</TableHead>
                <TableHead className={compactTableHeadClass}>Status</TableHead>
                <TableHead className={compactTableHeadClass}>Payment</TableHead>
                <TableHead className={compactTableHeadClass}>Order Date</TableHead>
                <TableHead className={compactTableHeadClass}>Expected</TableHead>
                <TableHead className={cn(compactTableHeadClass, 'text-right')}>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-20 text-center text-sm text-muted-foreground">
                    No orders found
                  </TableCell>
                </TableRow>
              ) : (
                orders.map((order) => (
                  <TableRow key={order._id}>
                    <TableCell className={cn(compactTableCellClass, 'font-semibold text-slate-900')}>{order.orderNumber}</TableCell>
                    <TableCell className={compactTableCellClass}>{getSupplierName(order.supplierId)}</TableCell>
                    <TableCell className={compactTableCellClass}>{order.items.length}</TableCell>
                    <TableCell className={compactTableCellClass}>${order.totalCost.toFixed(2)}</TableCell>
                    <TableCell className={compactTableCellClass}>{getStatusBadge(order.status)}</TableCell>
                    <TableCell className={compactTableCellClass}>
                      <Badge variant={order.paymentStatus === 'paid' ? 'default' : 'outline'}>
                        {order.paymentStatus}
                      </Badge>
                    </TableCell>
                    <TableCell className={compactTableCellClass}>{format(new Date(order.orderDate), 'MMM dd, yyyy')}</TableCell>
                    <TableCell className={compactTableCellClass}>
                      {order.expectedDeliveryDate
                        ? format(new Date(order.expectedDeliveryDate), 'MMM dd, yyyy')
                        : '-'}
                    </TableCell>
                    <TableCell className={cn(compactTableCellClass, 'text-right')}>
                      <Button
                        variant="ghost"
                        size="sm"
                        className={compactGhostButtonClass}
                        onClick={() => handleViewOrder(order._id)}
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
        </TabsContent>

        <TabsContent value="need-lists">
          <NeedListManagement onOrderCreated={loadData} />
        </TabsContent>

        <TabsContent value="suppliers" className="space-y-4">
          {/* Suppliers Content */}
          <div className="flex justify-end gap-2">
            <Button onClick={() => setShowCreateSupplierDialog(true)} className={cn(compactButtonClass, 'px-3')}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Add Supplier
            </Button>
          </div>

      {/* Suppliers Table */}
      <Card className={pageSectionCardClass}>
        <CardHeader className={compactCardHeaderClass}>
          <CardTitle className="text-base">Suppliers</CardTitle>
          <CardDescription className="text-xs">View and manage all suppliers</CardDescription>
        </CardHeader>
        <CardContent className={cn(compactCardContentClass, 'pt-0')}>
          <div className="overflow-x-auto">
            <Table>
            <TableHeader>
              <TableRow>
                <TableHead className={compactTableHeadClass}>Name</TableHead>
                <TableHead className={compactTableHeadClass}>Email</TableHead>
                <TableHead className={compactTableHeadClass}>Contact Person</TableHead>
                <TableHead className={compactTableHeadClass}>Phone</TableHead>
                <TableHead className={compactTableHeadClass}>Website</TableHead>
                <TableHead className={compactTableHeadClass}>Ust.ID</TableHead>
                <TableHead className={compactTableHeadClass}>Payment Terms</TableHead>
                <TableHead className={compactTableHeadClass}>Status</TableHead>
                <TableHead className={cn(compactTableHeadClass, 'text-right')}>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {suppliers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-20 text-center text-sm text-muted-foreground">
                    No suppliers found
                  </TableCell>
                </TableRow>
              ) : (
                suppliers.map((supplier) => (
                  <TableRow key={supplier._id}>
                    <TableCell className={cn(compactTableCellClass, 'font-semibold text-slate-900')}>{supplier.name}</TableCell>
                    <TableCell className={compactTableCellClass}>{supplier.email}</TableCell>
                    <TableCell className={compactTableCellClass}>{supplier.contactPerson || '-'}</TableCell>
                    <TableCell className={compactTableCellClass}>{supplier.phone || '-'}</TableCell>
                    <TableCell className={compactTableCellClass}>
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
                    <TableCell className={compactTableCellClass}>{supplier.ustId || '-'}</TableCell>
                    <TableCell className={compactTableCellClass}>{supplier.paymentTerms || '-'}</TableCell>
                    <TableCell className={compactTableCellClass}>
                      <Badge variant={supplier.isActive ? 'default' : 'secondary'}>
                        {supplier.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className={cn(compactTableCellClass, 'text-right')}>
                      <Button
                        variant="ghost"
                        size="sm"
                        className={compactGhostButtonClass}
                        onClick={() => handleEditSupplier(supplier)}
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
        </TabsContent>
      </Tabs>

      {/* Create Order Dialog */}
      <Dialog open={showCreateOrderDialog} onOpenChange={setShowCreateOrderDialog}>
        <DialogContent className={cn(compactDialogContentClass, 'max-w-4xl')}>
          <DialogHeader className={compactDialogHeaderClass}>
            <DialogTitle className={compactDialogTitleClass}>Create New EPart Order</DialogTitle>
            <DialogDescription className={compactDialogDescriptionClass}>
              Create a new order to replenish inventory from a supplier
            </DialogDescription>
          </DialogHeader>

          <div className={compactDialogBodyClass}>
            <div>
              <Label className={compactLabelClass}>Supplier *</Label>
              <Select
                value={newOrder.supplierId}
                onValueChange={(value) => setNewOrder({ ...newOrder, supplierId: value })}
              >
                <SelectTrigger className={compactSelectClass}>
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
              <div className="mb-2 flex items-center justify-between">
                <Label className={compactLabelClass}>Order Items *</Label>
                <Button type="button" variant="outline" size="sm" className={compactButtonClass} onClick={addItemToOrder}>
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  Add Item
                </Button>
              </div>

              {newOrder.items.map((item, index) => (
                <div key={index} className="mb-2 flex flex-col gap-2 rounded-md border border-slate-200 bg-slate-50 p-2 md:flex-row">
                  <Select
                    value={item.partId}
                    onValueChange={(value) => updateOrderItem(index, 'partId', value)}
                  >
                    <SelectTrigger className={cn(compactSelectClass, 'flex-1')}>
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
                    className={cn(compactInputClass, 'w-full md:w-20')}
                  />
                  <Input
                    type="number"
                    placeholder="Price"
                    value={item.unitPrice}
                    onChange={(e) =>
                      updateOrderItem(index, 'unitPrice', parseFloat(e.target.value) || 0)
                    }
                    className={cn(compactInputClass, 'w-full md:w-28')}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className={cn(compactGhostButtonClass, 'self-end md:self-center')}
                    onClick={() => removeItemFromOrder(index)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <Label className={compactLabelClass}>Expected Delivery Date</Label>
                <Input
                  type="date"
                  value={newOrder.expectedDeliveryDate}
                  onChange={(e) =>
                    setNewOrder({ ...newOrder, expectedDeliveryDate: e.target.value })
                  }
                  className={compactInputClass}
                />
              </div>

              <div>
                <Label className={compactLabelClass}>Payment Method</Label>
                <Select
                  value={newOrder.paymentMethod}
                  onValueChange={(value) => setNewOrder({ ...newOrder, paymentMethod: value })}
                >
                  <SelectTrigger className={compactSelectClass}>
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
                <Label className={compactLabelClass}>Tax</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={newOrder.tax}
                  onChange={(e) =>
                    setNewOrder({ ...newOrder, tax: parseFloat(e.target.value) || 0 })
                  }
                  className={compactInputClass}
                />
              </div>

              <div>
                <Label className={compactLabelClass}>Shipping Cost</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={newOrder.shippingCost}
                  onChange={(e) =>
                    setNewOrder({ ...newOrder, shippingCost: parseFloat(e.target.value) || 0 })
                  }
                  className={compactInputClass}
                />
              </div>
            </div>

            <div>
              <Label className={compactLabelClass}>Notes</Label>
              <Textarea
                value={newOrder.notes}
                onChange={(e) => setNewOrder({ ...newOrder, notes: e.target.value })}
                placeholder="Additional notes..."
                className={compactTextareaClass}
              />
            </div>
          </div>

          <DialogFooter className={compactDialogFooterClass}>
            <Button variant="outline" className={compactButtonClass} onClick={() => setShowCreateOrderDialog(false)}>
              Cancel
            </Button>
            <Button className={compactButtonClass} onClick={handleCreateOrder}>Create Order</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Supplier Dialog */}
      <Dialog open={showCreateSupplierDialog} onOpenChange={setShowCreateSupplierDialog}>
        <DialogContent className={cn(compactDialogContentClass, 'max-w-4xl')}>
          <DialogHeader className={compactDialogHeaderClass}>
            <DialogTitle className={compactDialogTitleClass}>Add New Supplier</DialogTitle>
            <DialogDescription className={compactDialogDescriptionClass}>Create a new supplier for epart orders</DialogDescription>
          </DialogHeader>

          <div className={compactDialogBodyClass}>
            {/* Basic Information Section */}
            <div className="space-y-3">
              <h3 className="border-b border-slate-200 pb-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                Basic Information
              </h3>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <Label className={compactLabelClass}>Name *</Label>
                  <Input
                    value={newSupplier.name}
                    onChange={(e) => setNewSupplier({ ...newSupplier, name: e.target.value })}
                    placeholder="Supplier name"
                    className={compactInputClass}
                  />
                </div>

                <div>
                  <Label className={compactLabelClass}>Email *</Label>
                  <Input
                    type="email"
                    value={newSupplier.email}
                    onChange={(e) => setNewSupplier({ ...newSupplier, email: e.target.value })}
                    placeholder="supplier@example.com"
                    className={compactInputClass}
                  />
                </div>

                <div>
                  <Label className={compactLabelClass}>Contact Person</Label>
                  <Input
                    value={newSupplier.contactPerson}
                    onChange={(e) =>
                      setNewSupplier({ ...newSupplier, contactPerson: e.target.value })
                    }
                    placeholder="John Doe"
                    className={compactInputClass}
                  />
                </div>

                <div>
                  <Label className={compactLabelClass}>Phone</Label>
                  <Input
                    value={newSupplier.phone}
                    onChange={(e) => setNewSupplier({ ...newSupplier, phone: e.target.value })}
                    placeholder="+49 123 456789"
                    className={compactInputClass}
                  />
                </div>

                <div>
                  <Label className={compactLabelClass}>Website</Label>
                  <Input
                    type="url"
                    placeholder="https://example.com"
                    value={newSupplier.website}
                    onChange={(e) => setNewSupplier({ ...newSupplier, website: e.target.value })}
                    className={compactInputClass}
                  />
                </div>

                <div>
                  <Label className={compactLabelClass}>Ust.ID (VAT ID)</Label>
                  <Input
                    placeholder="DE123456789"
                    value={newSupplier.ustId}
                    onChange={(e) => setNewSupplier({ ...newSupplier, ustId: e.target.value })}
                    className={compactInputClass}
                  />
                </div>
              </div>
            </div>

            {/* Address Section */}
            <div className="space-y-3">
              <h3 className="border-b border-slate-200 pb-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                Address
              </h3>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="col-span-3">
                  <Label className={compactLabelClass}>Street</Label>
                  <Input
                    value={newSupplier.address?.street}
                    onChange={(e) =>
                      setNewSupplier({
                        ...newSupplier,
                        address: { ...newSupplier.address, street: e.target.value },
                      })
                    }
                    placeholder="123 Main Street"
                    className={compactInputClass}
                  />
                </div>
                <div>
                  <Label className={compactLabelClass}>City</Label>
                  <Input
                    value={newSupplier.address?.city}
                    onChange={(e) =>
                      setNewSupplier({
                        ...newSupplier,
                        address: { ...newSupplier.address, city: e.target.value },
                      })
                    }
                    placeholder="Berlin"
                    className={compactInputClass}
                  />
                </div>
                <div>
                  <Label className={compactLabelClass}>State/Region</Label>
                  <Input
                    value={newSupplier.address?.state}
                    onChange={(e) =>
                      setNewSupplier({
                        ...newSupplier,
                        address: { ...newSupplier.address, state: e.target.value },
                      })
                    }
                    placeholder="Berlin"
                    className={compactInputClass}
                  />
                </div>
                <div>
                  <Label className={compactLabelClass}>Zip Code</Label>
                  <Input
                    value={newSupplier.address?.zipCode}
                    onChange={(e) =>
                      setNewSupplier({
                        ...newSupplier,
                        address: { ...newSupplier.address, zipCode: e.target.value },
                      })
                    }
                    placeholder="10115"
                    className={compactInputClass}
                  />
                </div>
                <div className="col-span-3">
                  <Label className={compactLabelClass}>Country</Label>
                  <Input
                    value={newSupplier.address?.country}
                    onChange={(e) =>
                      setNewSupplier({
                        ...newSupplier,
                        address: { ...newSupplier.address, country: e.target.value },
                      })
                    }
                    placeholder="Germany"
                    className={compactInputClass}
                  />
                </div>
              </div>
            </div>

            {/* Payment Information Section */}
            <div className="space-y-3">
              <h3 className="border-b border-slate-200 pb-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                Payment Information
              </h3>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <Label className={compactLabelClass}>IBAN</Label>
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
                    className={compactInputClass}
                  />
                </div>
                <div>
                  <Label className={compactLabelClass}>BIC/SWIFT</Label>
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
                    className={compactInputClass}
                  />
                </div>
                <div>
                  <Label className={compactLabelClass}>Bank Name</Label>
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
                    className={compactInputClass}
                  />
                </div>
                <div>
                  <Label className={compactLabelClass}>Account Holder</Label>
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
                    className={compactInputClass}
                  />
                </div>
              </div>
            </div>

            {/* Terms Section */}
            <div className="space-y-3">
              <h3 className="border-b border-slate-200 pb-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                Terms & Conditions
              </h3>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <Label className={compactLabelClass}>Payment Terms</Label>
                  <Input
                    value={newSupplier.paymentTerms}
                    onChange={(e) =>
                      setNewSupplier({ ...newSupplier, paymentTerms: e.target.value })
                    }
                    placeholder="Net 30"
                    className={compactInputClass}
                  />
                </div>

                <div>
                  <Label className={compactLabelClass}>Lead Time (days)</Label>
                  <Input
                    type="number"
                    value={newSupplier.leadTime}
                    onChange={(e) =>
                      setNewSupplier({ ...newSupplier, leadTime: parseInt(e.target.value) || 0 })
                    }
                    placeholder="7"
                    className={compactInputClass}
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className={compactDialogFooterClass}>
            <Button variant="outline" className={compactButtonClass} onClick={() => setShowCreateSupplierDialog(false)}>
              Cancel
            </Button>
            <Button className={compactButtonClass} onClick={handleCreateSupplier}>Create Supplier</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Supplier Dialog */}
      {selectedSupplier && (
        <Dialog open={showEditSupplierDialog} onOpenChange={setShowEditSupplierDialog}>
          <DialogContent className={cn(compactDialogContentClass, 'max-w-4xl')}>
            <DialogHeader className={compactDialogHeaderClass}>
              <DialogTitle className={compactDialogTitleClass}>Edit Supplier</DialogTitle>
              <DialogDescription className={compactDialogDescriptionClass}>Update supplier information</DialogDescription>
            </DialogHeader>

            <div className={compactDialogBodyClass}>
              {/* Basic Information Section */}
              <div className="space-y-3">
                <h3 className="border-b border-slate-200 pb-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                  Basic Information
                </h3>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <Label className={compactLabelClass}>Name *</Label>
                    <Input
                      value={selectedSupplier.name}
                      onChange={(e) =>
                        setSelectedSupplier({ ...selectedSupplier, name: e.target.value })
                      }
                      placeholder="Supplier name"
                      className={compactInputClass}
                    />
                  </div>

                  <div>
                    <Label className={compactLabelClass}>Email *</Label>
                    <Input
                      type="email"
                      value={selectedSupplier.email}
                      onChange={(e) =>
                        setSelectedSupplier({ ...selectedSupplier, email: e.target.value })
                      }
                      placeholder="supplier@example.com"
                      className={compactInputClass}
                    />
                  </div>

                  <div>
                    <Label className={compactLabelClass}>Contact Person</Label>
                    <Input
                      value={selectedSupplier.contactPerson}
                      onChange={(e) =>
                        setSelectedSupplier({ ...selectedSupplier, contactPerson: e.target.value })
                      }
                      placeholder="John Doe"
                      className={compactInputClass}
                    />
                  </div>

                  <div>
                    <Label className={compactLabelClass}>Phone</Label>
                    <Input
                      value={selectedSupplier.phone}
                      onChange={(e) =>
                        setSelectedSupplier({ ...selectedSupplier, phone: e.target.value })
                      }
                      placeholder="+49 123 456789"
                      className={compactInputClass}
                    />
                  </div>

                  <div>
                    <Label className={compactLabelClass}>Website</Label>
                    <Input
                      type="url"
                      placeholder="https://example.com"
                      value={selectedSupplier.website}
                      onChange={(e) =>
                        setSelectedSupplier({ ...selectedSupplier, website: e.target.value })
                      }
                      className={compactInputClass}
                    />
                  </div>

                  <div>
                    <Label className={compactLabelClass}>Ust.ID (VAT ID)</Label>
                    <Input
                      placeholder="DE123456789"
                      value={selectedSupplier.ustId}
                      onChange={(e) =>
                        setSelectedSupplier({ ...selectedSupplier, ustId: e.target.value })
                      }
                      className={compactInputClass}
                    />
                  </div>
                </div>
              </div>

              {/* Address Section */}
              <div className="space-y-3">
                <h3 className="border-b border-slate-200 pb-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                  Address
                </h3>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div className="col-span-3">
                    <Label className={compactLabelClass}>Street</Label>
                    <Input
                      value={selectedSupplier.address?.street}
                      onChange={(e) =>
                        setSelectedSupplier({
                          ...selectedSupplier,
                          address: { ...selectedSupplier.address, street: e.target.value },
                        })
                      }
                      placeholder="123 Main Street"
                      className={compactInputClass}
                    />
                  </div>
                  <div>
                    <Label className={compactLabelClass}>City</Label>
                    <Input
                      value={selectedSupplier.address?.city}
                      onChange={(e) =>
                        setSelectedSupplier({
                          ...selectedSupplier,
                          address: { ...selectedSupplier.address, city: e.target.value },
                        })
                      }
                      placeholder="Berlin"
                      className={compactInputClass}
                    />
                  </div>
                  <div>
                    <Label className={compactLabelClass}>State/Region</Label>
                    <Input
                      value={selectedSupplier.address?.state}
                      onChange={(e) =>
                        setSelectedSupplier({
                          ...selectedSupplier,
                          address: { ...selectedSupplier.address, state: e.target.value },
                        })
                      }
                      placeholder="Berlin"
                      className={compactInputClass}
                    />
                  </div>
                  <div>
                    <Label className={compactLabelClass}>Zip Code</Label>
                    <Input
                      value={selectedSupplier.address?.zipCode}
                      onChange={(e) =>
                        setSelectedSupplier({
                          ...selectedSupplier,
                          address: { ...selectedSupplier.address, zipCode: e.target.value },
                        })
                      }
                      placeholder="10115"
                      className={compactInputClass}
                    />
                  </div>
                  <div className="col-span-3">
                    <Label className={compactLabelClass}>Country</Label>
                    <Input
                      value={selectedSupplier.address?.country}
                      onChange={(e) =>
                        setSelectedSupplier({
                          ...selectedSupplier,
                          address: { ...selectedSupplier.address, country: e.target.value },
                        })
                      }
                      placeholder="Germany"
                      className={compactInputClass}
                    />
                  </div>
                </div>
              </div>

              {/* Payment Information Section */}
              <div className="space-y-3">
                <h3 className="border-b border-slate-200 pb-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                  Payment Information
                </h3>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <Label className={compactLabelClass}>IBAN</Label>
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
                      className={compactInputClass}
                    />
                  </div>
                  <div>
                    <Label className={compactLabelClass}>BIC/SWIFT</Label>
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
                      className={compactInputClass}
                    />
                  </div>
                  <div>
                    <Label className={compactLabelClass}>Bank Name</Label>
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
                      className={compactInputClass}
                    />
                  </div>
                  <div>
                    <Label className={compactLabelClass}>Account Holder</Label>
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
                      className={compactInputClass}
                    />
                  </div>
                </div>
              </div>

              {/* Terms & Status Section */}
              <div className="space-y-3">
                <h3 className="border-b border-slate-200 pb-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                  Terms & Status
                </h3>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div>
                    <Label className={compactLabelClass}>Payment Terms</Label>
                    <Input
                      value={selectedSupplier.paymentTerms}
                      onChange={(e) =>
                        setSelectedSupplier({ ...selectedSupplier, paymentTerms: e.target.value })
                      }
                      placeholder="Net 30"
                      className={compactInputClass}
                    />
                  </div>

                  <div>
                    <Label className={compactLabelClass}>Lead Time (days)</Label>
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
                      className={compactInputClass}
                    />
                  </div>

                  <div>
                    <Label className={compactLabelClass}>Status</Label>
                    <Select
                      value={selectedSupplier.isActive ? 'active' : 'inactive'}
                      onValueChange={(value) =>
                        setSelectedSupplier({ ...selectedSupplier, isActive: value === 'active' })
                      }
                    >
                      <SelectTrigger className={compactSelectClass}>
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

            <DialogFooter className={compactDialogFooterClass}>
              <Button
                variant="outline"
                className={compactButtonClass}
                onClick={() => {
                  setShowEditSupplierDialog(false);
                  setSelectedSupplier(null);
                }}
              >
                Cancel
              </Button>
              <Button className={compactButtonClass} onClick={handleUpdateSupplier}>Update Supplier</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Order Details Dialog */}
      {selectedOrder && (
        <Dialog open={showOrderDetailsDialog} onOpenChange={setShowOrderDetailsDialog}>
          <DialogContent className={cn(compactDialogContentClass, 'max-w-4xl')}>
            <DialogHeader className={compactDialogHeaderClass}>
              <DialogTitle className={compactDialogTitleClass}>Order Details - {selectedOrder.orderNumber}</DialogTitle>
              <DialogDescription className={compactDialogDescriptionClass}>
                Manage order status, receive items, and view order history
              </DialogDescription>
            </DialogHeader>

            <div className={compactDialogBodyClass}>
            <Tabs defaultValue="details" className="space-y-4">
              <TabsList className="grid h-auto w-full grid-cols-3 gap-1 rounded-md border border-slate-200 bg-slate-100 p-1">
                <TabsTrigger value="details" className="h-8 text-xs font-semibold">Details</TabsTrigger>
                <TabsTrigger value="items" className="h-8 text-xs font-semibold">Items</TabsTrigger>
                <TabsTrigger value="timeline" className="h-8 text-xs font-semibold">Timeline</TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="space-y-4">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <Label className={compactLabelClass}>Supplier</Label>
                    <p className="text-sm">{getSupplierName(selectedOrder.supplierId)}</p>
                  </div>

                  <div>
                    <Label className={compactLabelClass}>Status</Label>
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
                            <SelectTrigger className={cn(compactSelectClass, 'mt-2')}>
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
                    <Label className={compactLabelClass}>Order Date</Label>
                    <p className="text-sm">
                      {format(new Date(selectedOrder.orderDate), 'MMM dd, yyyy')}
                    </p>
                  </div>

                  <div>
                    <Label className={compactLabelClass}>Expected Delivery</Label>
                    <p className="text-sm">
                      {selectedOrder.expectedDeliveryDate
                        ? format(new Date(selectedOrder.expectedDeliveryDate), 'MMM dd, yyyy')
                        : '-'}
                    </p>
                  </div>

                  <div>
                    <Label className={compactLabelClass}>Subtotal</Label>
                    <p className="text-sm">${selectedOrder.subtotal.toFixed(2)}</p>
                  </div>

                  <div>
                    <Label className={compactLabelClass}>Tax</Label>
                    <p className="text-sm">${selectedOrder.tax.toFixed(2)}</p>
                  </div>

                  <div>
                    <Label className={compactLabelClass}>Shipping</Label>
                    <p className="text-sm">${selectedOrder.shippingCost.toFixed(2)}</p>
                  </div>

                  <div>
                    <Label className={compactLabelClass}>Total</Label>
                    <p className="text-sm font-bold">${selectedOrder.totalCost.toFixed(2)}</p>
                  </div>

                  <div>
                    <Label className={compactLabelClass}>Total Net</Label>
                    <p className="text-sm font-semibold">
                      ${(
                        Math.max(0, Number(selectedOrder.subtotal) || 0) +
                        Math.max(0, Number(selectedOrder.shippingCost) || 0)
                      ).toFixed(2)}
                    </p>
                  </div>

                  <div>
                    <Label className={compactLabelClass}>Total Gross</Label>
                    <p className="text-sm font-semibold">
                      ${(
                        Math.max(0, Number(selectedOrder.subtotal) || 0) +
                        Math.max(0, Number(selectedOrder.shippingCost) || 0) +
                        Math.max(0, Number(selectedOrder.tax) || 0)
                      ).toFixed(2)}
                    </p>
                  </div>

                  <div>
                    <Label className={compactLabelClass}>Payment Status</Label>
                    <div className="mt-1">
                      <Badge
                        variant={selectedOrder.paymentStatus === 'paid' ? 'default' : 'outline'}
                      >
                        {selectedOrder.paymentStatus}
                      </Badge>
                      {selectedOrder.status !== 'cancelled' && (
                        <Select
                          value={selectedOrder.paymentStatus}
                          onValueChange={(value) =>
                            updateEPartOrder(selectedOrder._id, { paymentStatus: value }).then(() => {
                              toast({ title: 'Success', description: 'Payment status updated' });
                              getEPartOrderById(selectedOrder._id).then(({ order }) => setSelectedOrder(order));
                            })
                          }
                        >
                          <SelectTrigger className={cn(compactSelectClass, 'mt-2')}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="unpaid">Unpaid</SelectItem>
                            <SelectItem value="partial">Partial</SelectItem>
                            <SelectItem value="paid">Paid</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  </div>

                  <div>
                    <Label className={compactLabelClass}>Tracking Number</Label>
                    <p className="text-sm">{selectedOrder.trackingNumber || '-'}</p>
                  </div>

                  <div>
                    <Label className={compactLabelClass}>Invoice</Label>
                    <div className="flex gap-2 mt-1">
                      {selectedOrder.invoiceFile ? (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            className={compactButtonClass}
                            onClick={() => handleDownloadInvoice(selectedOrder._id)}
                          >
                            <Download className="mr-1.5 h-3.5 w-3.5" />
                            Download
                          </Button>
                          <p className="text-xs text-muted-foreground self-center">
                            {selectedOrder.invoiceFile.originalName}
                          </p>
                        </>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className={compactButtonClass}
                          onClick={() => setShowInvoiceUploadDialog(true)}
                        >
                          <Upload className="mr-1.5 h-3.5 w-3.5" />
                          Upload Invoice
                        </Button>
                      )}
                    </div>
                  </div>

                  <div>
                    <Label className={compactLabelClass}>Return/Exchange</Label>
                    <div className="mt-1">
                      {selectedOrder.returnExchange && selectedOrder.returnExchange.status !== 'none' ? (
                        <div className="space-y-2">
                          <Badge variant={
                            selectedOrder.returnExchange.status === 'completed' ? 'default' :
                            selectedOrder.returnExchange.status === 'rejected' ? 'destructive' : 'secondary'
                          }>
                            {selectedOrder.returnExchange.status.toUpperCase()}
                          </Badge>
                          <p className="text-xs">Type: {selectedOrder.returnExchange.type}</p>
                          <p className="text-xs">Reason: {selectedOrder.returnExchange.reason}</p>
                          {selectedOrder.returnExchange.status === 'requested' && (
                            <div className="flex gap-2 mt-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className={compactButtonClass}
                                onClick={() => handleUpdateReturnExchange('approved')}
                              >
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                className={compactButtonClass}
                                onClick={() => handleUpdateReturnExchange('rejected', 'Rejected by admin')}
                              >
                                Reject
                              </Button>
                            </div>
                          )}
                          {selectedOrder.returnExchange.status === 'approved' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className={compactButtonClass}
                              onClick={() => handleUpdateReturnExchange('in_transit')}
                            >
                              Mark In Transit
                            </Button>
                          )}
                          {selectedOrder.returnExchange.status === 'in_transit' && (
                            <Button
                              size="sm"
                              className={compactButtonClass}
                              onClick={() => handleUpdateReturnExchange('completed')}
                            >
                              Mark Completed
                            </Button>
                          )}
                        </div>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className={compactButtonClass}
                          onClick={() => {
                            setReturnExchangeForm({
                              type: 'return',
                              reason: '',
                              description: '',
                              affectedItems: [],
                            });
                            setShowReturnExchangeDialog(true);
                          }}
                          disabled={!selectedOrder.items.some(item => item.receivedQuantity > 0)}
                        >
                          <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                          Request Return/Exchange
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                {selectedOrder.notes && (
                  <div>
                    <Label className={compactLabelClass}>Notes</Label>
                    <p className="text-sm text-muted-foreground">{selectedOrder.notes}</p>
                  </div>
                )}

                <div className="flex gap-2">
                  {selectedOrder.status === 'shipped' && (
                    <Button
                      className={compactButtonClass}
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
                      <CheckCircle className="mr-1.5 h-3.5 w-3.5" />
                      Receive Items
                    </Button>
                  )}
                  {selectedOrder.status !== 'cancelled' &&
                    selectedOrder.status !== 'received' && (
                      <Button
                        variant="destructive"
                        className={compactButtonClass}
                        onClick={() => handleCancelOrder(selectedOrder._id)}
                      >
                        <X className="mr-1.5 h-3.5 w-3.5" />
                        Cancel Order
                      </Button>
                    )}
                </div>
              </TabsContent>

              <TabsContent value="items">
                <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className={compactTableHeadClass}>Part</TableHead>
                      <TableHead className={compactTableHeadClass}>SKU</TableHead>
                      <TableHead className={compactTableHeadClass}>Supplier</TableHead>
                      <TableHead className={compactTableHeadClass}>Ordered</TableHead>
                      <TableHead className={compactTableHeadClass}>Received</TableHead>
                      <TableHead className={compactTableHeadClass}>Price Type</TableHead>
                      <TableHead className={compactTableHeadClass}>Unit Price</TableHead>
                      <TableHead className={compactTableHeadClass}>Shipping Cost</TableHead>
                      <TableHead className={compactTableHeadClass}>Additional Cost</TableHead>
                      <TableHead className={compactTableHeadClass}>Line Net</TableHead>
                      <TableHead className={compactTableHeadClass}>Line Gross</TableHead>
                      <TableHead className={compactTableHeadClass}>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedOrder.items.map((item) => {
                      const taxRate = getOrderTaxRate(selectedOrder);
                      const priceType = item.priceType === 'gross' ? 'gross' : 'net';
                      let supplierName = '-';
                      if (item.supplier && Array.isArray(suppliers)) {
                        const supplierObj = suppliers.find((s) => s._id === item.supplier);
                        if (supplierObj) supplierName = supplierObj.name;
                        else supplierName = item.supplier;
                      }

                      const quantity = Math.max(1, Number(item.quantity) || 1);
                      const unitPrice = Math.max(0, Number(item.unitPrice) || 0);
                      const shippingCost = Math.max(
                        0,
                        Number(item.shippingShare ?? item.shippingCost) || 0
                      );
                      const additionalCost = Math.max(0, Number(item.additionalCost) || 0);

                      const unitConverted = convertByPriceType(unitPrice, priceType, taxRate);
                      const shippingConverted = convertByPriceType(shippingCost, priceType, taxRate);
                      const additionalConverted = convertByPriceType(additionalCost, priceType, taxRate);

                      const lineNet =
                        unitConverted.net * quantity +
                        shippingConverted.net +
                        additionalConverted.net;
                      const lineGross =
                        unitConverted.gross * quantity +
                        shippingConverted.gross +
                        additionalConverted.gross;

                      return (
                        <TableRow key={item._id}>
                          <TableCell className={compactTableCellClass}>{item.partName}</TableCell>
                          <TableCell className={compactTableCellClass}>{item.sku}</TableCell>
                          <TableCell className={compactTableCellClass}>{supplierName}</TableCell>
                          <TableCell className={compactTableCellClass}>{item.quantity}</TableCell>
                          <TableCell className={compactTableCellClass}>{item.receivedQuantity}</TableCell>
                          <TableCell className={compactTableCellClass}>{priceType.toUpperCase()}</TableCell>
                          <TableCell className={compactTableCellClass}>${unitPrice.toFixed(2)}</TableCell>
                          <TableCell className={compactTableCellClass}>${shippingCost.toFixed(2)}</TableCell>
                          <TableCell className={compactTableCellClass}>${additionalCost.toFixed(2)}</TableCell>
                          <TableCell className={compactTableCellClass}>${lineNet.toFixed(2)}</TableCell>
                          <TableCell className={compactTableCellClass}>${lineGross.toFixed(2)}</TableCell>
                          <TableCell className={compactTableCellClass}>{getStatusBadge(item.status)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                </div>
              </TabsContent>

              <TabsContent value="timeline">
                <div className="space-y-3">
                  {selectedOrder.timeline.map((entry, index) => (
                    <div key={index} className="flex gap-3 rounded-md border border-slate-200 bg-slate-50 p-3">
                      <div className="w-24 flex-shrink-0 text-xs text-muted-foreground">
                        {format(new Date(entry.completedAt), 'MMM dd, HH:mm')}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{entry.status}</p>
                        <p className="text-xs text-muted-foreground">{entry.description}</p>
                        {entry.notes && (
                          <p className="text-xs italic text-muted-foreground">{entry.notes}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Invoice Upload Dialog */}
      <Dialog open={showInvoiceUploadDialog} onOpenChange={setShowInvoiceUploadDialog}>
        <DialogContent className={cn(compactDialogContentClass, 'max-w-lg')}>
          <DialogHeader className={compactDialogHeaderClass}>
            <DialogTitle className={compactDialogTitleClass}>Upload Invoice</DialogTitle>
            <DialogDescription className={compactDialogDescriptionClass}>
              Upload an invoice file for this order (PDF, images, or office documents)
            </DialogDescription>
          </DialogHeader>

          <div className={compactDialogBodyClass}>
            <div>
              <Label className={compactLabelClass}>Invoice File</Label>
              <Input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
                onChange={(e) => setInvoiceFile(e.target.files?.[0] || null)}
                className={cn(compactInputClass, 'h-10 file:mr-3 file:text-xs')}
              />
              {invoiceFile && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Selected: {invoiceFile.name} ({(invoiceFile.size / 1024).toFixed(2)} KB)
                </p>
              )}
            </div>
          </div>

          <DialogFooter className={compactDialogFooterClass}>
            <Button variant="outline" className={compactButtonClass} onClick={() => setShowInvoiceUploadDialog(false)}>
              Cancel
            </Button>
            <Button className={compactButtonClass} onClick={handleUploadInvoice} disabled={!invoiceFile || uploadingInvoice}>
              {uploadingInvoice ? 'Uploading...' : 'Upload'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Return/Exchange Dialog */}
      {selectedOrder && (
        <Dialog open={showReturnExchangeDialog} onOpenChange={setShowReturnExchangeDialog}>
          <DialogContent className={cn(compactDialogContentClass, 'max-w-3xl')}>
            <DialogHeader className={compactDialogHeaderClass}>
              <DialogTitle className={compactDialogTitleClass}>Request Return/Exchange</DialogTitle>
              <DialogDescription className={compactDialogDescriptionClass}>
                Submit a return or exchange request for broken or defective parts
              </DialogDescription>
            </DialogHeader>

            <div className={compactDialogBodyClass}>
              <div>
                <Label className={compactLabelClass}>Type *</Label>
                <Select
                  value={returnExchangeForm.type}
                  onValueChange={(value: 'return' | 'exchange') =>
                    setReturnExchangeForm({ ...returnExchangeForm, type: value })
                  }
                >
                  <SelectTrigger className={compactSelectClass}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="return">Return</SelectItem>
                    <SelectItem value="exchange">Exchange</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className={compactLabelClass}>Reason *</Label>
                <Input
                  value={returnExchangeForm.reason}
                  onChange={(e) =>
                    setReturnExchangeForm({ ...returnExchangeForm, reason: e.target.value })
                  }
                  placeholder="e.g., Broken parts, Wrong items, Quality issues"
                  className={compactInputClass}
                />
              </div>

              <div>
                <Label className={compactLabelClass}>Description *</Label>
                <Textarea
                  value={returnExchangeForm.description}
                  onChange={(e) =>
                    setReturnExchangeForm({ ...returnExchangeForm, description: e.target.value })
                  }
                  placeholder="Provide detailed description of the issue..."
                  rows={3}
                  className={compactTextareaClass}
                />
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <Label className={compactLabelClass}>Affected Items *</Label>
                  <Button type="button" variant="outline" size="sm" className={compactButtonClass} onClick={addAffectedItem}>
                    <Plus className="mr-1 h-3.5 w-3.5" />
                    Add Item
                  </Button>
                </div>

                {returnExchangeForm.affectedItems.map((item, index) => (
                  <div key={index} className="mb-2 flex flex-col gap-2 rounded-md border border-slate-200 bg-slate-50 p-2 md:flex-row">
                    <Select
                      value={item.itemId}
                      onValueChange={(value) => updateAffectedItem(index, 'itemId', value)}
                    >
                      <SelectTrigger className={cn(compactSelectClass, 'flex-1')}>
                        <SelectValue placeholder="Select item" />
                      </SelectTrigger>
                      <SelectContent>
                        {selectedOrder.items
                          .filter((orderItem) => orderItem.receivedQuantity > 0)
                          .map((orderItem) => (
                            <SelectItem key={orderItem._id} value={orderItem._id!}>
                              {orderItem.partName} (Received: {orderItem.receivedQuantity})
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      placeholder="Qty"
                      value={item.quantity}
                      onChange={(e) =>
                        updateAffectedItem(index, 'quantity', parseInt(e.target.value) || 0)
                      }
                      className={cn(compactInputClass, 'w-full md:w-20')}
                      min="1"
                      max={
                        selectedOrder.items.find((i) => i._id === item.itemId)?.receivedQuantity || 1
                      }
                    />
                    <Input
                      placeholder="Issue description"
                      value={item.issueDescription}
                      onChange={(e) =>
                        updateAffectedItem(index, 'issueDescription', e.target.value)
                      }
                      className={cn(compactInputClass, 'flex-1')}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className={cn(compactGhostButtonClass, 'self-end md:self-center')}
                      onClick={() => removeAffectedItem(index)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <DialogFooter className={compactDialogFooterClass}>
              <Button variant="outline" className={compactButtonClass} onClick={() => setShowReturnExchangeDialog(false)}>
                Cancel
              </Button>
              <Button className={compactButtonClass} onClick={handleRequestReturnExchange}>Submit Request</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Receive Items Dialog */}
      {selectedOrder && (
        <Dialog open={showReceiveDialog} onOpenChange={setShowReceiveDialog}>
          <DialogContent className={cn(compactDialogContentClass, 'max-w-xl')}>
            <DialogHeader className={compactDialogHeaderClass}>
              <DialogTitle className={compactDialogTitleClass}>Receive Items</DialogTitle>
              <DialogDescription className={compactDialogDescriptionClass}>
                Mark items as received and update inventory
              </DialogDescription>
            </DialogHeader>

            <div className={compactDialogBodyClass}>
              {selectedOrder.items.map((item, index) => {
                const remainingQty = item.quantity - item.receivedQuantity;
                if (remainingQty <= 0) return null;

                return (
                  <div key={item._id} className="flex items-center gap-3 rounded-md border border-slate-200 bg-slate-50 p-2.5">
                    <div className="flex-1">
                      <p className="text-sm font-medium">{item.partName}</p>
                      <p className="text-xs text-muted-foreground">
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
                      className={cn(compactInputClass, 'w-20')}
                    />
                  </div>
                );
              })}
            </div>

            <DialogFooter className={compactDialogFooterClass}>
              <Button variant="outline" className={compactButtonClass} onClick={() => setShowReceiveDialog(false)}>
                Cancel
              </Button>
              <Button className={compactButtonClass} onClick={handleReceiveItems}>Receive Items</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
