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
  type NeedListSupplierShippingConfig,
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
import { de } from 'date-fns/locale';
import { DecimalInput } from '@/components/ui/decimal-input';
import { formatEUR } from '@/lib/utils';

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
  const [referenceDataLoaded, setReferenceDataLoaded] = useState(false);
  const [loadError, setLoadError] = useState('');

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
  const [convertingToOrder, setConvertingToOrder] = useState(false);
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
      toast({ title: 'Gespeichert', description: 'Position aktualisiert.' });
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
      toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
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
    supplierShippingCosts: Record<string, number>;
  }>({
    supplier: '',
    notes: '',
    itemConfigurations: [],
    supplierShippingCosts: {},
  });

  // Load data
  useEffect(() => {
    loadData();
  }, [statusFilter, priorityFilter, searchQuery]);

  const loadData = async (forceReferenceRefresh = false) => {
    setLoading(true);
    setLoadError('');
    try {
      const [needListsData, statsData] = await Promise.all([
        getNeedLists({
          status: statusFilter || undefined,
          priority: priorityFilter || undefined,
          search: searchQuery || undefined,
          page: 1,
          limit: 50,
        }),
        getNeedListStatistics(),
      ]);

      setNeedLists(needListsData.needLists || []);
      setStatistics(statsData);

      if (forceReferenceRefresh || !referenceDataLoaded) {
        const [partsData, suppliersData] = await Promise.all([
          getParts({ page: 1, limit: 200 }),
          getSuppliers({ isActive: true }),
        ]);
        setParts(partsData.parts);
        setSuppliers(suppliersData.suppliers);
        setReferenceDataLoaded(true);
      }
    } catch (error: any) {
      console.error('Error loading need list data:', error);
      setLoadError(error?.message || 'Unbekannter Fehler');
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
          title: 'Fehler',
          description: 'Bitte mindestens eine Position hinzufügen.',
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
        title: 'Gespeichert',
        description: 'Bedarfsliste angelegt.',
      });

      setShowCreateDialog(false);
      resetForm();
      loadData();
    } catch (error: any) {
      console.error('Error creating need list:', error);
      toast({
        title: 'Fehler',
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
        title: 'Gespeichert',
        description: 'Bedarfsliste aktualisiert.',
      });

      setShowEditDialog(false);
      setSelectedNeedList(null);
      resetForm();
      loadData();
    } catch (error: any) {
      console.error('Error updating need list:', error);
      toast({
        title: 'Fehler',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleDeleteNeedList = async (id: string) => {
    if (!confirm('Bedarfsliste wirklich löschen? Dies kann nicht rückgängig gemacht werden.')) return;

    try {
      await deleteNeedList(id);

      toast({
        title: 'Gespeichert',
        description: 'Bedarfsliste gelöscht.',
      });

      loadData();
    } catch (error: any) {
      console.error('Error deleting need list:', error);
      toast({
        title: 'Fehler',
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
        title: 'Gespeichert',
        description: 'Position hinzugefügt.',
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
        title: 'Fehler',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleRemoveItem = async (needListId: string, itemId: string) => {
    if (!confirm('Position aus der Bedarfsliste entfernen?')) return;

    try {
      await removeItemFromNeedList(needListId, itemId);

      toast({
        title: 'Gespeichert',
        description: 'Position entfernt.',
      });

      loadData();
      if (selectedNeedList && selectedNeedList._id === needListId) {
        const updatedList = needLists.find((nl) => nl._id === needListId);
        if (updatedList) setSelectedNeedList(updatedList);
      }
    } catch (error: any) {
      console.error('Error removing item:', error);
      toast({
        title: 'Fehler',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleConvertToOrder = async () => {
    // Doppelklick-Schutz: der Server prueft zusaetzlich atomar (409).
    if (!selectedNeedList || convertingToOrder) return;

    const invalidItem = convertData.itemConfigurations.find((config) => !config.supplier);
    if (invalidItem) {
      toast({
        title: 'Lieferant fehlt',
        description: 'Bitte für jede Position einen Lieferanten auswählen.',
        variant: 'destructive',
      });
      return;
    }

    setConvertingToOrder(true);
    try {
      const result = await convertNeedListToOrder(selectedNeedList._id, {
        supplier: convertData.supplier || undefined,
        notes: convertData.notes,
        itemConfigurations: convertData.itemConfigurations,
        supplierShippingCosts: Object.entries(convertData.supplierShippingCosts)
          .filter(([supplierId]) => supplierId)
          .map(([supplierId, shippingCost]) => ({
            supplierId,
            shippingCost: Math.max(0, Number(shippingCost) || 0),
          })) as NeedListSupplierShippingConfig[],
      });

      toast({
        title: `Bestellung ${result.order.orderNumber} angelegt`,
        description: 'Die Bestellung finden Sie im Reiter „Bestellungen“.',
      });

      setShowConvertDialog(false);
      setConvertData({ supplier: '', notes: '', itemConfigurations: [], supplierShippingCosts: {} });
      setSelectedNeedList(null);
      loadData();

      // Notify parent component to refresh orders
      if (onOrderCreated) {
        onOrderCreated();
      }
    } catch (error: any) {
      console.error('Error converting to order:', error);
      toast({
        title: 'Bestellung konnte nicht angelegt werden',
        description: error.message,
        variant: 'destructive',
      });
      // Bei 409 (bereits umgewandelt) Liste aktualisieren, damit der Status stimmt.
      loadData();
    } finally {
      setConvertingToOrder(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      priority: 'medium',
      tags: '',
    });
    setOrderItems([{ part: '', quantity: 1, notes: '', supplier: '' }]);
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

    const supplierShippingCosts = itemConfigurations.reduce<Record<string, number>>((acc, config) => {
      if (!config.supplier) {
        return acc;
      }
      acc[config.supplier] = (acc[config.supplier] || 0) + Math.max(0, Number(config.shippingCost) || 0);
      return acc;
    }, {});

    setSelectedNeedList(needList);
    setConvertData({
      supplier: '',
      notes: '',
      itemConfigurations,
      supplierShippingCosts,
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

  const roundTo = (value: number, decimals = 2) => {
    const factor = 10 ** decimals;
    return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
  };

  const selectedSuppliersForConvert = Array.from(
    new Set(
      convertData.itemConfigurations
        .map((config) => config.supplier)
        .filter((supplierId) => Boolean(supplierId))
    )
  );

  const allocatedShippingByItem = convertData.itemConfigurations.reduce<Record<string, number>>((acc, itemConfig) => {
    const supplierId = itemConfig.supplier;
    if (!supplierId) {
      acc[itemConfig.needListItemId] = 0;
      return acc;
    }

    const supplierItems = convertData.itemConfigurations.filter((cfg) => cfg.supplier === supplierId);
    const supplierShippingTotal = roundTo(Math.max(0, Number(convertData.supplierShippingCosts[supplierId]) || 0), 2);

    if (supplierItems.length === 0 || supplierShippingTotal <= 0) {
      acc[itemConfig.needListItemId] = 0;
      return acc;
    }

    const supplierSubtotal = roundTo(
      supplierItems.reduce((sum, cfg) => {
        const sourceItem = selectedNeedList?.items.find((it) => (it._id || it.part) === cfg.needListItemId);
        const quantity = Math.max(1, Number(sourceItem?.quantity) || 1);
        const unitPrice = Math.max(0, Number(cfg.price) || 0);
        return sum + (quantity * unitPrice);
      }, 0),
      4
    );

    let supplierAllocated = 0;
    const sharesByItemId: Record<string, number> = {};

    supplierItems.forEach((cfg) => {
      if (supplierSubtotal > 0) {
        const sourceItem = selectedNeedList?.items.find((it) => (it._id || it.part) === cfg.needListItemId);
        const quantity = Math.max(1, Number(sourceItem?.quantity) || 1);
        const unitPrice = Math.max(0, Number(cfg.price) || 0);
        const rawShare = ((quantity * unitPrice) / supplierSubtotal) * supplierShippingTotal;
        const roundedShare = roundTo(rawShare, 2);
        sharesByItemId[cfg.needListItemId] = roundedShare;
        supplierAllocated += roundedShare;
      } else {
        const equalShare = roundTo(supplierShippingTotal / supplierItems.length, 2);
        sharesByItemId[cfg.needListItemId] = equalShare;
        supplierAllocated += equalShare;
      }
    });

    const delta = roundTo(supplierShippingTotal - supplierAllocated, 2);
    if (delta !== 0) {
      const targetItem = supplierItems.reduce((best, cfg) => {
        const current = selectedNeedList?.items.find((it) => (it._id || it.part) === cfg.needListItemId);
        const bestItem = selectedNeedList?.items.find((it) => (it._id || it.part) === best.needListItemId);
        const currentValue = (Math.max(1, Number(current?.quantity) || 1) * Math.max(0, Number(cfg.price) || 0));
        const bestValue = (Math.max(1, Number(bestItem?.quantity) || 1) * Math.max(0, Number(best.price) || 0));
        return currentValue > bestValue ? cfg : best;
      }, supplierItems[0]);

      sharesByItemId[targetItem.needListItemId] = roundTo(
        (sharesByItemId[targetItem.needListItemId] || 0) + delta,
        2
      );
    }

    Object.entries(sharesByItemId).forEach(([itemId, share]) => {
      acc[itemId] = Math.max(0, roundTo(share, 2));
    });

    return acc;
  }, {});

  const convertSummary = convertData.itemConfigurations.reduce(
    (acc, itemConfig) => {
      const sourceItem = selectedNeedList?.items.find((it) => (it._id || it.part) === itemConfig.needListItemId);
      if (!sourceItem) {
        return acc;
      }

      const quantity = Math.max(1, Number(sourceItem.quantity) || 1);
      const lineSubtotal = (sourceItem.quantity * itemConfig.price) + itemConfig.additionalCost;
      const shippingShareLine = allocatedShippingByItem[itemConfig.needListItemId] || 0;
      const shippingSharePerItem = shippingShareLine / quantity;
      const lineTotal = lineSubtotal + (shippingSharePerItem * quantity);

      acc.subtotal += lineSubtotal;
      acc.shipping += shippingSharePerItem * quantity;
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
    const labels: Record<string, string> = { draft: 'Entwurf', ready: 'Bereit', ordered: 'Bestellt', archived: 'Archiviert' };
    return <Badge variant={variants[status] || 'outline'}>{labels[status] || status}</Badge>;
  };

  const getPriorityBadge = (priority: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
      low: 'outline',
      medium: 'secondary',
      high: 'default',
      urgent: 'destructive',
    };
    const labels: Record<string, string> = { low: 'Niedrig', medium: 'Mittel', high: 'Hoch', urgent: 'Dringend' };
    return <Badge variant={variants[priority] || 'secondary'}>{labels[priority] || priority}</Badge>;
  };

  const getPartName = (partId: string) => {
    const part = parts.find((p) => p._id === partId);
    return part ? `${part.partNumber} - ${part.name}` : 'Unbekanntes Teil';
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

  if (loading && needLists.length === 0 && !loadError) {
    return <div className="flex justify-center items-center p-8 text-muted-foreground">Bedarfslisten werden geladen …</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Bedarfslisten</h2>
          <p className="text-muted-foreground">Ersatzteile planen, bevor Bestellungen angelegt werden</p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Bedarfsliste anlegen
        </Button>
      </div>

      {/* Statistics Cards */}
      {statistics && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Bedarfslisten gesamt</CardTitle>
              <ClipboardList className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{statistics.total}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Entwurf</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{statistics.byStatus.draft || 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Bereit</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{statistics.byStatus.ready || 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Dringend</CardTitle>
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
          <CardTitle>Filter</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label>Suche</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Bedarfslisten durchsuchen …"
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
                  <SelectValue placeholder="Alle Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Status</SelectItem>
                  <SelectItem value="draft">Entwurf</SelectItem>
                  <SelectItem value="ready">Bereit</SelectItem>
                  <SelectItem value="ordered">Bestellt</SelectItem>
                  <SelectItem value="archived">Archiviert</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Priorität</Label>
              <Select value={priorityFilter || 'all'} onValueChange={(value) => setPriorityFilter(value === 'all' ? '' : value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Alle Prioritäten" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Prioritäten</SelectItem>
                  <SelectItem value="low">Niedrig</SelectItem>
                  <SelectItem value="medium">Mittel</SelectItem>
                  <SelectItem value="high">Hoch</SelectItem>
                  <SelectItem value="urgent">Dringend</SelectItem>
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
                Filter zurücksetzen
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Need Lists Table */}
      <Card>
        <CardHeader>
          <CardTitle>Bedarfslisten</CardTitle>
          <CardDescription>Alle Bedarfslisten ansehen und bearbeiten</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Positionen</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Priorität</TableHead>
                <TableHead>Erstellt</TableHead>
                <TableHead>Erstellt von</TableHead>
                <TableHead>Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadError ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-20 text-center text-red-700">
                    Bedarfslisten konnten nicht geladen werden ({loadError}).{' '}
                    <Button variant="outline" size="sm" onClick={() => loadData()}>Erneut versuchen</Button>
                  </TableCell>
                </TableRow>
              ) : needLists.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-20 text-center text-muted-foreground">
                    {statusFilter || priorityFilter || searchQuery
                      ? 'Keine Bedarfslisten für diese Filter.'
                      : 'Noch keine Bedarfslisten. Über „Bedarfsliste anlegen“ erstellen.'}
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
                    <TableCell>{format(new Date(needList.createdAt), 'dd.MM.yyyy', { locale: de })}</TableCell>
                    <TableCell>
                      {needList.createdBy
                        ? `${needList.createdBy.firstName} ${needList.createdBy.lastName}`
                        : 'Unbekannt'
                      }
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openViewDialog(needList)}
                        >
                          <Eye className="mr-1 h-4 w-4" aria-hidden="true" />
                          Details
                        </Button>
                        {needList.status !== 'ordered' && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openEditDialog(needList)}
                            >
                              <Edit className="mr-1 h-4 w-4" aria-hidden="true" />
                              Bearbeiten
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openConvertDialog(needList)}
                              disabled={needList.items.length === 0}
                              title={needList.items.length === 0 ? 'Erst Positionen hinzufügen' : undefined}
                            >
                              <ShoppingCart className="mr-1 h-4 w-4" aria-hidden="true" />
                              Bestellen
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteNeedList(needList._id)}
                              aria-label={`Bedarfsliste ${needList.name} löschen`}
                              className="text-red-700"
                            >
                              <Trash2 className="mr-1 h-4 w-4" aria-hidden="true" />
                              Löschen
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
            <DialogTitle>Bedarfsliste anlegen</DialogTitle>
            <DialogDescription>Neue Bedarfsliste zur Planung von Ersatzteilbestellungen</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="z. B. Displays iPhone 12"
              />
            </div>

            <div>
              <Label htmlFor="description">Beschreibung</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optionale Beschreibung …"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="priority">Priorität</Label>
                <Select value={formData.priority} onValueChange={(value) => setFormData({ ...formData, priority: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Niedrig</SelectItem>
                    <SelectItem value="medium">Mittel</SelectItem>
                    <SelectItem value="high">Hoch</SelectItem>
                    <SelectItem value="urgent">Dringend</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="tags">Schlagwörter (durch Komma getrennt)</Label>
                <Input
                  id="tags"
                  value={formData.tags}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                  placeholder="z. B. Displays, Akkus"
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <Label>Positionen *</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setOrderItems([...orderItems, { part: '', quantity: 1, notes: '', supplier: '' }])}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Position hinzufügen
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
                        <SelectValue placeholder="Ersatzteil auswählen" />
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
                      placeholder="Menge"
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
                      placeholder="Notiz"
                    />
                  </div>

                  <div className="col-span-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const newItems = orderItems.filter((_, i) => i !== index);
                        setOrderItems(newItems.length > 0 ? newItems : [{ part: '', quantity: 1, notes: '', supplier: '' }]);
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
              Abbrechen
            </Button>
            <Button onClick={handleCreateNeedList} disabled={!formData.name}>
              Bedarfsliste anlegen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Need List Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bedarfsliste bearbeiten</DialogTitle>
            <DialogDescription>Angaben dieser Bedarfsliste ändern</DialogDescription>
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
              <Label htmlFor="edit-description">Beschreibung</Label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-priority">Priorität</Label>
                <Select value={formData.priority} onValueChange={(value) => setFormData({ ...formData, priority: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Niedrig</SelectItem>
                    <SelectItem value="medium">Mittel</SelectItem>
                    <SelectItem value="high">Hoch</SelectItem>
                    <SelectItem value="urgent">Dringend</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="edit-tags">Schlagwörter (durch Komma getrennt)</Label>
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
              Abbrechen
            </Button>
            <Button onClick={handleUpdateNeedList}>Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Need List Dialog */}
      <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
        <DialogContent className="w-[96vw] max-w-7xl max-h-[88vh] overflow-hidden gap-0 border-slate-200 p-0 shadow-xl">
          <DialogHeader className="space-y-1 border-b border-slate-800 bg-[#1a2a5e] px-4 py-3 text-left">
            <DialogTitle className="text-base font-semibold !text-yellow-300">{selectedNeedList?.name}</DialogTitle>
            <DialogDescription className="text-xs text-slate-200">
              {selectedNeedList?.description || 'Keine Beschreibung'}
            </DialogDescription>
          </DialogHeader>

          {selectedNeedList && (
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
              {/* Info Grid */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600 mb-1">Status</p>
                  {getStatusBadge(selectedNeedList.status)}
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600 mb-1">Priorität</p>
                  {getPriorityBadge(selectedNeedList.priority)}
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600 mb-1">Erstellt von</p>
                  <p className="text-xs">
                    {selectedNeedList.createdBy
                      ? `${selectedNeedList.createdBy.firstName} ${selectedNeedList.createdBy.lastName}`
                      : 'Unbekannt'
                    }
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600 mb-1">Erstellt am</p>
                  <p className="text-xs">
                    {format(new Date(selectedNeedList.createdAt), 'dd.MM.yyyy HH:mm', { locale: de })}
                  </p>
                </div>
              </div>

              {selectedNeedList.tags && selectedNeedList.tags.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600 mb-2">Schlagwörter</p>
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
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600 mb-1">Umgewandelt in Bestellung</p>
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
                      Position hinzufügen
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                  <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Summe netto</p>
                    <p className="text-base font-semibold text-slate-900">{formatEUR(selectedNeedListTotals.net)}</p>
                  </div>
                  <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Summe brutto</p>
                    <p className="text-base font-semibold text-slate-900">{formatEUR(selectedNeedListTotals.gross)}</p>
                  </div>
                </div>

                <div className="border border-slate-200 rounded-md overflow-hidden">
                  <Table className="w-full table-fixed">
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        <TableHead className="w-[10%] h-8 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Teilenr.</TableHead>
                        <TableHead className="w-[13%] h-8 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Ersatzteil</TableHead>
                        <TableHead className="w-[10%] h-8 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Lieferant</TableHead>
                        <TableHead className="w-[5%] h-8 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Menge</TableHead>
                        <TableHead className="w-[6%] h-8 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Bestand</TableHead>
                        <TableHead className="w-[6%] h-8 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Preisart</TableHead>
                        <TableHead className="w-[7%] h-8 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Einzelpreis (€)</TableHead>
                        <TableHead className="w-[7%] h-8 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Versand</TableHead>
                        <TableHead className="w-[7%] h-8 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Zusatz</TableHead>
                        <TableHead className="w-[8%] h-8 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Netto</TableHead>
                        <TableHead className="w-[8%] h-8 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Brutto</TableHead>
                        <TableHead className="w-[8%] h-8 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Notiz</TableHead>
                        {selectedNeedList.status !== 'ordered' && <TableHead className="w-[5%] h-8 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Aktionen</TableHead>}
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
                            <TableCell className="px-2 py-1 text-xs">{formatEUR(unitPrice)}</TableCell>
                            <TableCell className="px-2 py-1 text-xs">{formatEUR(shippingCost)}</TableCell>
                            <TableCell className="px-2 py-1 text-xs">{formatEUR(additionalCost)}</TableCell>
                            <TableCell className="px-2 py-1 text-xs">{formatEUR(lineNet)}</TableCell>
                            <TableCell className="px-2 py-1 text-xs">{formatEUR(lineGross)}</TableCell>
                            <TableCell className="px-2 py-1 text-xs break-words">{renderNotesWithLinks(item.notes)}</TableCell>
                            {selectedNeedList.status !== 'ordered' && (
                              <TableCell className="px-2 py-1 text-xs">
                                <div className="flex gap-1">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-6 w-6 p-0"
                                    onClick={() => handleEditItem(item)}
                                    aria-label={`Position ${item.partName} bearbeiten`}
                                    title="Position bearbeiten"
                                  >
                                    <Edit className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-6 w-6 p-0"
                                    onClick={() => handleRemoveItem(selectedNeedList._id, item._id!)}
                                    aria-label={`Position ${item.partName} entfernen`}
                                    title="Position entfernen"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </TableCell>
                            )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                </div>
              </div>
            </div>
          )}

          <div className="shrink-0 border-t border-slate-200 bg-slate-50 px-4 py-3 flex flex-wrap justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={() => {
                setShowViewDialog(false);
                setSelectedNeedList(null);
              }}
            >
              Schließen
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
                In Bestellung umwandeln
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Item Dialog (einmal gerendert, nicht je Tabellenzeile) */}
      <Dialog open={showEditItemDialog} onOpenChange={setShowEditItemDialog}>
        <DialogContent className="max-h-[88vh] overflow-hidden gap-0 border-slate-200 p-0 shadow-xl">
          <DialogHeader className="space-y-1 border-b border-slate-800 bg-[#1a2a5e] px-4 py-3 text-left">
            <DialogTitle className="text-base font-semibold text-white">Position bearbeiten</DialogTitle>
            <DialogDescription className="text-xs text-slate-200">Menge, Lieferant und Notiz anpassen</DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
            <div>
              <Label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600 mb-2 block">Lieferant</Label>
              <Select value={editItemData.supplier} onValueChange={(value) => setEditItemData({ ...editItemData, supplier: value })}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Lieferant auswählen" />
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
              <Label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600 mb-2 block">Menge</Label>
              <Input
                type="number"
                min="1"
                className="h-8 text-xs"
                value={editItemData.quantity}
                onChange={(e) => setEditItemData({ ...editItemData, quantity: parseInt(e.target.value) || 1 })}
              />
            </div>
            <div>
              <Label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600 mb-2 block">Preisart</Label>
              <Select
                value={editItemData.priceType}
                onValueChange={(value: 'net' | 'gross') => setEditItemData({ ...editItemData, priceType: value })}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="net">Netto</SelectItem>
                  <SelectItem value="gross">Brutto</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600 mb-2 block">Bestellpreis (€)</Label>
              <DecimalInput
                min={0}
                emptyValue={0}
                className="h-8 text-xs"
                value={editItemData.unitPrice}
                onValueChange={(v) => setEditItemData({ ...editItemData, unitPrice: (v ?? 0) })}
                placeholder="0,00"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600 mb-2 block">Versandkosten (€)</Label>
                <DecimalInput
                  min={0}
                  emptyValue={0}
                  className="h-8 text-xs"
                  value={editItemData.shippingCost}
                  onValueChange={(v) => setEditItemData({ ...editItemData, shippingCost: (v ?? 0) })}
                  placeholder="0,00"
                />
              </div>
              <div>
                <Label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600 mb-2 block">Zusatzkosten (€)</Label>
                <DecimalInput
                  min={0}
                  emptyValue={0}
                  className="h-8 text-xs"
                  value={editItemData.additionalCost}
                  onValueChange={(v) => setEditItemData({ ...editItemData, additionalCost: (v ?? 0) })}
                  placeholder="0,00"
                />
              </div>
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Voraussichtliche Positionssumme</p>
              <p className="text-base font-semibold text-slate-900">
                {formatEUR((editItemData.unitPrice * editItemData.quantity) + editItemData.shippingCost + editItemData.additionalCost)}
              </p>
            </div>
            <div>
              <Label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600 mb-2 block">Notiz</Label>
              <Textarea
                className="min-h-[88px] text-xs"
                value={editItemData.notes}
                onChange={(e) => setEditItemData({ ...editItemData, notes: e.target.value })}
                placeholder="Optionale Notiz …"
              />
            </div>
          </div>
          <div className="shrink-0 border-t border-slate-200 bg-slate-50 px-4 py-3 flex flex-wrap justify-end gap-2">
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setShowEditItemDialog(false)}>
              Abbrechen
            </Button>
            <Button size="sm" className="h-8 text-xs" onClick={handleUpdateItem}>
              Speichern
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Item Dialog */}
      <Dialog open={showAddItemDialog} onOpenChange={setShowAddItemDialog}>
        <DialogContent className="max-h-[88vh] overflow-hidden gap-0 border-slate-200 p-0 shadow-xl">
          <DialogHeader className="space-y-1 border-b border-slate-800 bg-[#1a2a5e] px-4 py-3 text-left">
            <DialogTitle className="text-base font-semibold !text-yellow-300">Position zur Bedarfsliste hinzufügen</DialogTitle>
            <DialogDescription className="text-xs text-slate-200">Ersatzteil, Lieferant und Kosten in einem Schritt erfassen.</DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600 mb-2 block" htmlFor="add-part-search">Ersatzteil suchen</Label>
                <div className="relative">
                  <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-slate-400" />
                  <Input
                    id="add-part-search"
                    className="h-8 pl-7 text-xs"
                    value={addItemPartSearch}
                    onChange={(e) => setAddItemPartSearch(e.target.value)}
                    placeholder="Nach Teilenummer oder Name suchen"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="add-part" className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600 mb-2 block">Ersatzteil</Label>
                <Select value={addItemData.part} onValueChange={(value) => setAddItemData({ ...addItemData, part: value })}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Ersatzteil auswählen" />
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
                <Label htmlFor="add-supplier" className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600 mb-2 block">Lieferant</Label>
                <Select value={addItemData.supplier} onValueChange={(value) => setAddItemData({ ...addItemData, supplier: value })}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Lieferant auswählen" />
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
                <Label htmlFor="add-quantity" className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600 mb-2 block">Menge</Label>
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
                <Label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600 mb-2 block">Preisart</Label>
                <Select
                  value={addItemData.priceType}
                  onValueChange={(value: 'net' | 'gross') => setAddItemData({ ...addItemData, priceType: value })}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="net">Netto</SelectItem>
                    <SelectItem value="gross">Brutto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600 mb-2 block">Einzelpreis (€)</Label>
                <DecimalInput
                  min={0}
                  emptyValue={0}
                  className="h-8 text-xs"
                  value={addItemData.unitPrice}
                  onValueChange={(v) => setAddItemData({ ...addItemData, unitPrice: (v ?? 0) })}
                  placeholder="0,00"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600 mb-2 block">Versandkosten (€)</Label>
                <DecimalInput
                  min={0}
                  emptyValue={0}
                  className="h-8 text-xs"
                  value={addItemData.shippingCost}
                  onValueChange={(v) => setAddItemData({ ...addItemData, shippingCost: (v ?? 0) })}
                  placeholder="0,00"
                />
              </div>
              <div>
                <Label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600 mb-2 block">Zusatzkosten (€)</Label>
                <DecimalInput
                  min={0}
                  emptyValue={0}
                  className="h-8 text-xs"
                  value={addItemData.additionalCost}
                  onValueChange={(v) => setAddItemData({ ...addItemData, additionalCost: (v ?? 0) })}
                  placeholder="0,00"
                />
              </div>
            </div>

            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Voraussichtliche Positionssumme</p>
              <p className="text-base font-semibold text-slate-900">
                {formatEUR((addItemData.unitPrice * addItemData.quantity) + addItemData.shippingCost + addItemData.additionalCost)}
              </p>
            </div>

            <div>
              <Label htmlFor="add-notes" className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600 mb-2 block">Notiz</Label>
              <Textarea
                id="add-notes"
                className="min-h-[88px] text-xs"
                value={addItemData.notes}
                onChange={(e) => setAddItemData({ ...addItemData, notes: e.target.value })}
                placeholder="Optionale Notiz …"
              />
            </div>
          </div>

          <div className="shrink-0 border-t border-slate-200 bg-slate-50 px-4 py-3 flex flex-wrap justify-end gap-2">
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
              Abbrechen
            </Button>
            <Button size="sm" className="h-8 text-xs" onClick={handleAddItem} disabled={!addItemData.part}>
              Position hinzufügen
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Convert to Order Dialog */}
      <Dialog open={showConvertDialog} onOpenChange={setShowConvertDialog}>
        <DialogContent className="w-[96vw] max-w-7xl max-h-[90vh] overflow-hidden gap-0 border-slate-200 p-0 shadow-xl">
          <DialogHeader className="space-y-1 border-b border-slate-800 bg-[#1a2a5e] px-4 py-3 text-left">
            <DialogTitle className="text-base font-semibold !text-yellow-300">Bedarfsliste in Bestellung umwandeln</DialogTitle>
            <DialogDescription className="text-xs text-slate-200">
              Lieferant und Kosten je Position festlegen, danach die Versandkosten je Lieferant.
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600 mb-2 block">Standard-Lieferant (optional)</Label>
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
                    <SelectValue placeholder="Für alle Positionen ohne Lieferant übernehmen" />
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
                <Label htmlFor="convert-notes" className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600 mb-2 block">Notiz zur Bestellung</Label>
                <Textarea
                  id="convert-notes"
                  className="min-h-[70px] text-xs"
                  value={convertData.notes}
                  onChange={(e) => setConvertData({ ...convertData, notes: e.target.value })}
                  placeholder="Optionale Notiz zur Lieferantenbestellung …"
                />
              </div>
            </div>

            {selectedSuppliersForConvert.length > 0 && (
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3 space-y-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600">Versandkosten je Lieferant</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {selectedSuppliersForConvert.map((supplierId) => {
                    const supplierName = suppliers.find((supplier) => supplier._id === supplierId)?.name || supplierId;
                    const shippingValue = convertData.supplierShippingCosts[supplierId] || 0;

                    return (
                      <div key={supplierId}>
                        <Label className="text-[11px] font-semibold text-slate-600 mb-1 block">{supplierName}</Label>
                        <DecimalInput
                          min={0}
                          emptyValue={0}
                          className="h-8 text-xs bg-white"
                          value={shippingValue}
                          onValueChange={(v) => {
                            const nextValue = Math.max(0, v ?? 0);
                            setConvertData((prev) => ({
                              ...prev,
                              supplierShippingCosts: {
                                ...prev.supplierShippingCosts,
                                [supplierId]: nextValue,
                              },
                            }));
                          }}
                          placeholder="0,00"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="border border-slate-200 rounded-md overflow-hidden">
              <Table className="w-full table-fixed">
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="w-[18%] h-9 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Position</TableHead>
                    <TableHead className="w-[16%] h-9 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Lieferant</TableHead>
                    <TableHead className="w-[10%] h-9 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Preisart</TableHead>
                    <TableHead className="w-[12%] h-9 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Einzelpreis (€)</TableHead>
                    <TableHead className="w-[12%] h-9 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Versandanteil</TableHead>
                    <TableHead className="w-[12%] h-9 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Zusatz</TableHead>
                    <TableHead className="w-[8%] h-9 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500 text-center">Menge</TableHead>
                    <TableHead className="w-[12%] h-9 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500 text-right">Positionssumme</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedNeedList?.items.map((item) => {
                    const itemId = item._id || item.part;
                    const itemConfig = convertData.itemConfigurations.find((cfg) => cfg.needListItemId === itemId);
                    if (!itemConfig) {
                      return null;
                    }

                      const quantity = Math.max(1, Number(item.quantity) || 1);
                      const shippingShareLine = allocatedShippingByItem[itemId] || 0;
                      const shippingSharePerItem = shippingShareLine / quantity;
                      const lineTotal = (item.quantity * itemConfig.price) + (shippingSharePerItem * quantity) + itemConfig.additionalCost;

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
                              <SelectValue placeholder="Auswählen" />
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
                              <SelectItem value="net">Netto</SelectItem>
                              <SelectItem value="gross">Brutto</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="px-2 py-2 align-top">
                          <DecimalInput
                            min={0}
                            emptyValue={0}
                            className="h-8 text-xs"
                            value={itemConfig.price}
                            onValueChange={(v) => updateConvertItemConfig(itemId, { price: (v ?? 0) })}
                            placeholder="0,00"
                          />
                        </TableCell>
                        <TableCell className="px-2 py-2 align-top">
                          <Input
                            className="h-8 text-xs bg-slate-100"
                            value={formatEUR(shippingSharePerItem)}
                            readOnly
                            aria-label="Versandanteil je Stück"
                          />
                        </TableCell>
                        <TableCell className="px-2 py-2 align-top">
                          <DecimalInput
                            min={0}
                            emptyValue={0}
                            className="h-8 text-xs"
                            value={itemConfig.additionalCost}
                            onValueChange={(v) => updateConvertItemConfig(itemId, { additionalCost: (v ?? 0) })}
                            placeholder="0,00"
                          />
                        </TableCell>
                        <TableCell className="px-2 py-2 text-xs text-center align-top">{item.quantity}</TableCell>
                        <TableCell className="px-2 py-2 text-xs text-right font-semibold align-top">{formatEUR(lineTotal)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Zwischensumme</p>
                <p className="text-lg font-bold text-slate-900">{formatEUR(convertSummary.subtotal)}</p>
              </div>
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Versand</p>
                <p className="text-lg font-bold text-slate-900">{formatEUR(convertSummary.shipping)}</p>
              </div>
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Voraussichtlich gesamt</p>
                <p className="text-lg font-bold text-slate-900">{formatEUR(convertSummary.total)}</p>
              </div>
            </div>
          </div>

          <div className="shrink-0 border-t border-slate-200 bg-slate-50 px-4 py-3 flex flex-wrap justify-end gap-2">
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => {
              setShowConvertDialog(false);
              setConvertData({ supplier: '', notes: '', itemConfigurations: [], supplierShippingCosts: {} });
              setSelectedNeedList(null);
            }}>
              Abbrechen
            </Button>
            <Button size="sm" className="h-8 text-xs" onClick={handleConvertToOrder} disabled={convertingToOrder}>
              {convertingToOrder ? 'Bestellung wird angelegt …' : 'Bestellung anlegen'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
