import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Textarea } from '../../components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Separator } from '../../components/ui/separator';
import { ScrollArea } from '../../components/ui/scroll-area';
import { Checkbox } from '../../components/ui/checkbox';
import { Plus, Search, Edit, Trash2, Package, AlertTriangle, Eye, DollarSign, MapPin, Calendar, Info, ListPlus, ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight, Upload, Boxes, Tag, Wrench, ClipboardList, Layers, ShieldCheck, Filter, X } from 'lucide-react';
import { getParts, createInventoryItem, updatePart, deletePart, deleteAllParts, Part, PartVersion } from '../../api/parts';
import { getNeedLists, createNeedList, addItemToNeedList, NeedList } from '../../api/needLists';
import { PartsCSVImportDialog } from '../../components/admin/PartsCSVImportDialog';
import DeleteAllConfirmButton from '../../components/admin/DeleteAllConfirmButton';
import { useToast } from '../../hooks/useToast';
import './PartsManagement.css';

const compactFieldClassName = "h-9 text-sm";
const compactLabelClassName = "parts-detail-tile__label";

// ── Column Filter Menu ──────────────────────────────────────────────────────
interface ColumnFilterMenuProps {
  column: string;
  label: string;
  allValues: string[];
  excludedValues: Set<string>;
  onExcludedChange: (col: string, excluded: Set<string>) => void;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  onSortAsc: () => void;
  onSortDesc: () => void;
}

function ColumnFilterMenu({
  column,
  label,
  allValues,
  excludedValues,
  onExcludedChange,
  sortBy,
  sortOrder,
  onSortAsc,
  onSortDesc,
}: ColumnFilterMenuProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const isActive = sortBy === column || excludedValues.size > 0;

  const filtered = allValues.filter(v =>
    v.toLowerCase().includes(search.toLowerCase())
  );

  const toggleValue = (val: string) => {
    const next = new Set(excludedValues);
    if (next.has(val)) next.delete(val); else next.add(val);
    onExcludedChange(column, next);
  };

  const selectAll = () => {
    const next = new Set(excludedValues);
    filtered.forEach(v => next.delete(v));
    onExcludedChange(column, next);
  };

  const deselectAll = () => {
    const next = new Set(excludedValues);
    filtered.forEach(v => next.add(v));
    onExcludedChange(column, next);
  };

  const clearFilter = (e: React.MouseEvent) => {
    e.stopPropagation();
    onExcludedChange(column, new Set());
  };

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        menuRef.current && !menuRef.current.contains(e.target as Node) &&
        btnRef.current && !btnRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const sortIcon = sortBy === column
    ? (sortOrder === 'asc' ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />)
    : <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" />;

  return (
    <div className="col-filter-root">
      <button
        ref={btnRef}
        type="button"
        className={`col-filter-trigger${isActive ? ' col-filter-trigger--active' : ''}`}
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
        title={`Filter / Sort: ${label}`}
      >
        <span className="col-filter-label">{label}</span>
        {excludedValues.size > 0
          ? <Filter className="h-3.5 w-3.5 col-filter-icon--filtered" />
          : sortIcon
        }
        {excludedValues.size > 0 && (
          <span className="col-filter-badge">{excludedValues.size}</span>
        )}
      </button>

      {open && (
        <div ref={menuRef} className="col-filter-menu" onClick={e => e.stopPropagation()}>
          {/* Sort actions */}
          <div className="col-filter-sort-row">
            <button
              type="button"
              className={`col-filter-sort-btn${sortBy === column && sortOrder === 'asc' ? ' col-filter-sort-btn--active' : ''}`}
              onClick={() => { onSortAsc(); setOpen(false); }}
            >
              <ChevronUp className="h-3.5 w-3.5" /> Aufsteigend
            </button>
            <button
              type="button"
              className={`col-filter-sort-btn${sortBy === column && sortOrder === 'desc' ? ' col-filter-sort-btn--active' : ''}`}
              onClick={() => { onSortDesc(); setOpen(false); }}
            >
              <ChevronDown className="h-3.5 w-3.5" /> Absteigend
            </button>
          </div>

          <div className="col-filter-divider" />

          {/* Search */}
          <div className="col-filter-search-wrap">
            <Search className="col-filter-search-icon h-3.5 w-3.5" />
            <input
              className="col-filter-search-input"
              placeholder="Suchen…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              autoFocus
            />
            {search && (
              <button type="button" className="col-filter-search-clear" onClick={() => setSearch('')}>
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          {/* Select all / deselect all */}
          <div className="col-filter-actions-row">
            <button type="button" className="col-filter-link" onClick={selectAll}>Alle wählen</button>
            <button type="button" className="col-filter-link" onClick={deselectAll}>Keine</button>
            {excludedValues.size > 0 && (
              <button type="button" className="col-filter-link col-filter-link--danger" onClick={clearFilter}>
                <X className="h-3 w-3" /> Filter löschen
              </button>
            )}
          </div>

          {/* Value list */}
          <div className="col-filter-list">
            {filtered.length === 0 ? (
              <span className="col-filter-empty">Keine Einträge gefunden</span>
            ) : (
              filtered.map(val => (
                <label key={val} className="col-filter-item">
                  <input
                    type="checkbox"
                    className="col-filter-checkbox"
                    checked={!excludedValues.has(val)}
                    onChange={() => toggleValue(val)}
                  />
                  <span className="col-filter-item-label" title={val}>{val || '—'}</span>
                </label>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

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

  // Column-level quick filters (excluded values per column key)
  const [columnFilters, setColumnFilters] = useState<Record<string, Set<string>>>({});
  // Full unpaginated parts list used to populate column filter menus and to
  // filter results across all pages once any column filter is active.
  const [allPartsForFilterMenus, setAllPartsForFilterMenus] = useState<Part[]>([]);

  const handleColumnFilterChange = (col: string, excluded: Set<string>) => {
    setColumnFilters(prev => ({ ...prev, [col]: excluded }));
  };
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

  // Fetch ALL parts (paginated) for filter menu population. This allows the
  // column filter dropdowns to show every available value across all pages,
  // and lets filtering apply across the entire dataset (not just current page).
  const fetchAllPartsForFilterMenus = async () => {
    try {
      const maxLimitPerPage = 200;
      let page = 1;
      let totalPagesLocal = 1;
      const collected: Part[] = [];

      do {
        const response = await getParts({
          page,
          limit: maxLimitPerPage,
          sortBy: 'lastUpdated',
          sortOrder: 'desc'
        });
        const batch: Part[] = response.parts || [];
        collected.push(...batch);
        totalPagesLocal = response.totalPages || 1;
        page += 1;
      } while (page <= totalPagesLocal);

      const uniqueById = Array.from(
        new Map(collected.map((p) => [p._id, p])).values()
      );

      setAllPartsForFilterMenus(uniqueById);
    } catch (error) {
      console.error('PartsManagement: Failed to fetch full parts list for filter menus:', error);
      setAllPartsForFilterMenus([]);
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
        fetchAllPartsForFilterMenus();
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
      fetchAllPartsForFilterMenus();
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
      fetchAllPartsForFilterMenus();
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

  const makeSortAsc = (col: string) => () => {
    setSortBy(col);
    setSortOrder('asc');
    setCurrentPage(1);
  };

  const makeSortDesc = (col: string) => () => {
    setSortBy(col);
    setSortOrder('desc');
    setCurrentPage(1);
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
      return <span className="parts-stock-badge parts-stock-badge--out">{t('partsManagement.outOfStock')}</span>;
    } else if (totalStock <= minStock) {
      return <span className="parts-stock-badge parts-stock-badge--low">{t('partsManagement.lowStock')}</span>;
    } else {
      return <span className="parts-stock-badge parts-stock-badge--in-stock">{t('partsManagement.inStock')}</span>;
    }
  };

  // Toggle body class so the CSS file's dialog-scoped overrides apply
  useEffect(() => {
    document.body.classList.add('parts-management-page');
    return () => {
      document.body.classList.remove('parts-management-page');
    };
  }, []);

  // Fetch full parts list once on mount (and whenever data may have changed)
  // for the column filter dropdowns and cross-page filtering.
  useEffect(() => {
    fetchAllPartsForFilterMenus();
  }, []);

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
      <div className="parts-page-container">
        <div className="parts-page-header animate-pulse" style={{ minHeight: 96 }} />
        <div className="parts-stats-grid">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="parts-stat-card animate-pulse" style={{ minHeight: 92 }} />
          ))}
        </div>
        <div className="parts-section-card animate-pulse" style={{ minHeight: 280 }} />
      </div>
    );
  }

  const totalUniqueModels = new Set(parts.map(p => p.model).filter(Boolean)).size;

  // Source for filter menus & cross-page filtering. Fall back to current page
  // until the full list is loaded.
  const filterSource = allPartsForFilterMenus.length ? allPartsForFilterMenus : parts;
  const hasAnyColumnFilter = Object.values(columnFilters).some(s => s && s.size > 0);

  // Build value sets for each filterable column from the FULL dataset so that
  // every possible value is always selectable in the dropdowns.
  const colValues = {
    partNumber: Array.from(new Set(filterSource.map(p => p.partNumber || '').filter(Boolean))).sort(),
    itemName:   Array.from(new Set(filterSource.map(p => p.name || p.itemName || '').filter(Boolean))).sort(),
    category:   Array.from(new Set(filterSource.map(p => p.category || '').filter(Boolean))).sort(),
    model:      Array.from(new Set(filterSource.map(p => p.model || '').filter(Boolean))).sort(),
    location:   Array.from(new Set(filterSource.map(p => p.location || '').filter(Boolean))).sort(),
    status:     Array.from(new Set(filterSource.map(p => {
      const s = p.stockQuantity || 0; const m = p.minStockLevel || 0;
      return s === 0 ? 'Out of Stock' : s <= m ? 'Low Stock' : 'In Stock';
    }))).sort(),
  };

  const getPartStockLabel = (p: Part) => {
    const s = p.stockQuantity || 0; const m = p.minStockLevel || 0;
    return s === 0 ? 'Out of Stock' : s <= m ? 'Low Stock' : 'In Stock';
  };

  // Apply column filters. When any filter is active, filter the FULL dataset
  // so values living on other pages remain reachable (e.g. after clicking
  // "None" and re-selecting individual values). Otherwise show the current
  // server-paginated page unchanged.
  const filterPredicate = (p: Part) => {
    const cf = columnFilters;
    if (cf.partNumber?.size && cf.partNumber.has(p.partNumber || '')) return false;
    if (cf.itemName?.size && cf.itemName.has(p.name || p.itemName || '')) return false;
    if (cf.category?.size && cf.category.has(p.category || '')) return false;
    if (cf.model?.size && cf.model.has(p.model || '')) return false;
    if (cf.location?.size && cf.location.has(p.location || '')) return false;
    if (cf.status?.size && cf.status.has(getPartStockLabel(p))) return false;
    return true;
  };

  const displayedParts = hasAnyColumnFilter
    ? filterSource.filter(filterPredicate)
    : parts.filter(filterPredicate);

  const activeFilterCount = Object.values(columnFilters).filter(s => s.size > 0).length;

  return (
    <div className="parts-page-container">
      {/* Page Header */}
      <header className="parts-page-header">
        <div className="parts-page-header__title-block">
          <h1 className="parts-page-header__title">
            <Package />
            {t('partsManagement.title')}
          </h1>
          <p className="parts-page-header__subtitle">
            {t('partsManagement.description')}
          </p>
        </div>
        <div className="parts-page-header__actions">
          <button
            type="button"
            className="parts-header-btn parts-header-btn--ghost"
            onClick={() => {
              console.log('PartsManagement: CSV Import button clicked');
              setShowCSVImportDialog(true);
            }}
          >
            <Upload className="h-4 w-4" />
            Import CSV
          </button>
          <DeleteAllConfirmButton
            resourceLabel="parts / inventory items"
            onConfirmDelete={(password) => deleteAllParts(password)}
            onDeleted={() => { fetchParts(); fetchAllPartsForFilterMenus(); }}
          />
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <button
                type="button"
                className="parts-header-btn parts-header-btn--solid"
                onClick={() => {
                  console.log('PartsManagement: Add Part button clicked');
                  resetForm();
                  setShowAddDialog(true);
                }}
              >
                <Plus className="h-4 w-4" />
                {t('partsManagement.createNewPart')}
              </button>
            </DialogTrigger>
            <DialogContent className="max-h-[88vh] max-w-4xl">
              <DialogHeader>
                <DialogTitle>
                  <Plus className="h-4 w-4" />
                  {t('partsManagement.createNewPart')}
                </DialogTitle>
                <DialogDescription>
                  Create a new inventory item with compact stock and version details.
                </DialogDescription>
              </DialogHeader>
              <div className="parts-dialog-scroll">
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
      </header>

      {/* Stats Grid */}
      <div className="parts-stats-grid">
        <div className="parts-stat-card parts-stat-card--blue">
          <div className="parts-stat-card__header">
            <span className="parts-stat-card__label">Total Parts</span>
            <span className="parts-stat-card__icon"><Package /></span>
          </div>
          <div className="parts-stat-card__value">{totalItems || parts.length}</div>
          <p className="parts-stat-card__hint">
            {totalUniqueModels} {totalUniqueModels === 1 ? 'unique model' : 'unique models'}
          </p>
        </div>

        <div className="parts-stat-card parts-stat-card--green">
          <div className="parts-stat-card__header">
            <span className="parts-stat-card__label">Inventory Value</span>
            <span className="parts-stat-card__icon"><DollarSign /></span>
          </div>
          <div className="parts-stat-card__value">
            ${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="parts-stat-card__hint">Total selling value in stock</p>
        </div>

        <div className="parts-stat-card parts-stat-card--orange">
          <div className="parts-stat-card__header">
            <span className="parts-stat-card__label">Low Stock</span>
            <span className="parts-stat-card__icon"><AlertTriangle /></span>
          </div>
          <div className="parts-stat-card__value">{lowStockCount}</div>
          <p className="parts-stat-card__hint">Items at or below threshold</p>
        </div>

        <div className="parts-stat-card parts-stat-card--purple">
          <div className="parts-stat-card__header">
            <span className="parts-stat-card__label">Categories</span>
            <span className="parts-stat-card__icon"><Layers /></span>
          </div>
          <div className="parts-stat-card__value">{categories.length}</div>
          <p className="parts-stat-card__hint">Tracked part categories</p>
        </div>
      </div>

      {/* Inventory Section */}
      <section className="parts-section-card">
        <header className="parts-section-header">
          <div className="parts-section-title-block">
            <h2 className="parts-section-title">
              <Boxes />
              Parts Inventory
            </h2>
            <p className="parts-section-description">
              Search, filter and manage all inventory items in one place.
            </p>
          </div>
        </header>

        <div className="parts-section-body">
          <div className="parts-filters-row">
            <div className="parts-filter-search">
              <Search />
              <Input
                placeholder={t('partsManagement.searchParts')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="h-9 w-full text-sm md:w-[200px]">
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
              <SelectTrigger className="h-9 w-full text-sm md:w-[200px]">
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

          {/* Bulk-Action bar */}
          {selectedParts.size > 0 && (
            <div className="parts-bulk-bar mt-3">
              <span className="parts-bulk-bar__count">
                <Checkbox checked readOnly />
                {selectedParts.size} {selectedParts.size === 1 ? 'part selected' : 'parts selected'}
              </span>
              <Button
                onClick={handleOpenAddToNeedList}
                size="sm"
                className="parts-dialog-btn-primary h-8 text-xs"
              >
                <ListPlus className="mr-2 h-4 w-4" />
                Add to Need List
              </Button>
            </div>
          )}

          {/* Active column-filter badge */}
          {activeFilterCount > 0 && (
            <div className="parts-active-filters-bar mt-2">
              <Filter className="h-3.5 w-3.5" />
              <span>{activeFilterCount} Spaltenfilter aktiv — {displayedParts.length} von {filterSource.length} Einträgen sichtbar</span>
              <button
                type="button"
                className="col-filter-link col-filter-link--danger"
                onClick={() => setColumnFilters({})}
              >
                <X className="h-3 w-3" /> Alle löschen
              </button>
            </div>
          )}
        </div>

        {/* Parts Table */}
        <div className="parts-table-wrap">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={selectedParts.size === displayedParts.length && displayedParts.length > 0}
                    onCheckedChange={handleSelectAllParts}
                  />
                </TableHead>
                <TableHead className="select-none">
                  <ColumnFilterMenu
                    column="partNumber"
                    label={t('partsManagement.partNumber')}
                    allValues={colValues.partNumber}
                    excludedValues={columnFilters.partNumber || new Set()}
                    onExcludedChange={handleColumnFilterChange}
                    sortBy={sortBy}
                    sortOrder={sortOrder}
                    onSortAsc={makeSortAsc('partNumber')}
                    onSortDesc={makeSortDesc('partNumber')}
                  />
                </TableHead>
                <TableHead className="select-none">
                  <ColumnFilterMenu
                    column="itemName"
                    label={t('partsManagement.partName')}
                    allValues={colValues.itemName}
                    excludedValues={columnFilters.itemName || new Set()}
                    onExcludedChange={handleColumnFilterChange}
                    sortBy={sortBy}
                    sortOrder={sortOrder}
                    onSortAsc={makeSortAsc('itemName')}
                    onSortDesc={makeSortDesc('itemName')}
                  />
                </TableHead>
                <TableHead className="select-none">
                  <ColumnFilterMenu
                    column="category"
                    label={t('partsManagement.category')}
                    allValues={colValues.category}
                    excludedValues={columnFilters.category || new Set()}
                    onExcludedChange={handleColumnFilterChange}
                    sortBy={sortBy}
                    sortOrder={sortOrder}
                    onSortAsc={makeSortAsc('category')}
                    onSortDesc={makeSortDesc('category')}
                  />
                </TableHead>
                <TableHead className="select-none">
                  <ColumnFilterMenu
                    column="model"
                    label="Model"
                    allValues={colValues.model}
                    excludedValues={columnFilters.model || new Set()}
                    onExcludedChange={handleColumnFilterChange}
                    sortBy={sortBy}
                    sortOrder={sortOrder}
                    onSortAsc={makeSortAsc('model')}
                    onSortDesc={makeSortDesc('model')}
                  />
                </TableHead>
                <TableHead>Stock</TableHead>
                <TableHead className="select-none">
                  <ColumnFilterMenu
                    column="status"
                    label={t('partsManagement.status')}
                    allValues={colValues.status}
                    excludedValues={columnFilters.status || new Set()}
                    onExcludedChange={handleColumnFilterChange}
                    sortBy={sortBy}
                    sortOrder={sortOrder}
                    onSortAsc={makeSortAsc('status')}
                    onSortDesc={makeSortDesc('status')}
                  />
                </TableHead>
                <TableHead className="select-none">
                  <ColumnFilterMenu
                    column="location"
                    label="Location"
                    allValues={colValues.location}
                    excludedValues={columnFilters.location || new Set()}
                    onExcludedChange={handleColumnFilterChange}
                    sortBy={sortBy}
                    sortOrder={sortOrder}
                    onSortAsc={makeSortAsc('location')}
                    onSortDesc={makeSortDesc('location')}
                  />
                </TableHead>
                <TableHead className="text-right">{t('common.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayedParts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9}>
                    <div className="parts-empty-state">
                      <Package />
                      <p className="parts-empty-state__title">{t('partsManagement.noPartsFound')}</p>
                      <p className="parts-empty-state__hint">Try adjusting your search or filters.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                displayedParts.map((part) => (
                  <TableRow
                    key={part._id}
                    className="cursor-pointer"
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedParts.has(part._id)}
                        onCheckedChange={(checked) => handleSelectPart(part._id, checked as boolean)}
                      />
                    </TableCell>
                    <TableCell onClick={() => handleRowClick(part)}>
                      <span className="parts-table-partnum">{part.partNumber}</span>
                    </TableCell>
                    <TableCell onClick={() => handleRowClick(part)}>
                      <div className="flex flex-col gap-0.5">
                        <span className="parts-table-name">{part.name}</span>
                        {part.supplier && (
                          <span className="parts-table-meta">{part.supplier}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell onClick={() => handleRowClick(part)}>
                      <span className="parts-category-pill">{part.category}</span>
                    </TableCell>
                    <TableCell onClick={() => handleRowClick(part)}>
                      <span className="parts-table-meta">{part.model || '—'}</span>
                    </TableCell>
                    <TableCell onClick={() => handleRowClick(part)}>
                      <span className="text-sm font-semibold text-[#1a2a5e]">{part.stockQuantity}</span>
                    </TableCell>
                    <TableCell onClick={() => handleRowClick(part)}>{getStockStatus(part)}</TableCell>
                    <TableCell onClick={() => handleRowClick(part)}>
                      <span className="parts-table-meta inline-flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {part.location || '—'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          className="parts-action-btn"
                          onClick={() => handleRowClick(part)}
                          title="View details"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          className="parts-action-btn"
                          onClick={(e) => handleEditClick(e, part)}
                          title="Edit part"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          className="parts-action-btn parts-action-btn--danger"
                          onClick={(e) => handleDeleteClick(e, part._id)}
                          title="Delete part"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        <div className="parts-pagination">
          <div className="parts-pagination__info">
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
            <span className="text-xs">
              Showing {parts.length === 0 ? 0 : ((currentPage - 1) * itemsPerPage) + 1} to{' '}
              {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems} parts
            </span>
          </div>

          <div className="parts-pagination__controls">
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
                    className={`h-8 w-8 text-xs ${currentPage === pageNum ? 'parts-dialog-btn-primary' : ''}`}
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
      </section>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-h-[88vh] max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              <Edit className="h-4 w-4" />
              {t('partsManagement.editPart')}
            </DialogTitle>
            <DialogDescription>
              Update inventory metadata, device compatibility and version stock levels.
            </DialogDescription>
          </DialogHeader>
          <div className="parts-dialog-scroll">
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
        <DialogContent className="max-h-[90vh] max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              <Eye className="h-4 w-4" />
              Part Details
            </DialogTitle>
            <DialogDescription>
              Complete inventory, pricing, specifications and version overview.
            </DialogDescription>
          </DialogHeader>
          <div className="parts-dialog-scroll">
            {selectedPart && <PartDetailView part={selectedPart} />}
          </div>
        </DialogContent>
      </Dialog>

      {/* Add to Need List Dialog */}
      <Dialog open={showAddToNeedListDialog} onOpenChange={setShowAddToNeedListDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              <ListPlus className="h-4 w-4" />
              {t('partsManagement.bulkAddToNeedList')}
            </DialogTitle>
            <DialogDescription>
              Assign selected parts to an existing draft list or create a new one.
            </DialogDescription>
          </DialogHeader>
          <div className="parts-dialog-scroll space-y-4">
            <div className="parts-bulk-bar">
              <span className="parts-bulk-bar__count">
                <ListPlus className="h-4 w-4" />
                Adding {selectedParts.size} {selectedParts.size === 1 ? 'part' : 'parts'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="createNew"
                checked={createNewNeedList}
                onCheckedChange={(checked) => setCreateNewNeedList(checked as boolean)}
              />
              <Label htmlFor="createNew" className="text-sm font-medium normal-case tracking-normal">
                Create new need list
              </Label>
            </div>

            {createNewNeedList ? (
              <div className="space-y-3 rounded-lg border border-dashed border-[#c7d2fe] bg-[#f8faff] p-4">
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

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              className="parts-dialog-btn-outline"
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
              className="parts-dialog-btn-primary"
            >
              {addingToNeedList ? t('common.loading') : t('partsManagement.addToNeedList')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CSV Import Dialog */}
      <PartsCSVImportDialog
        open={showCSVImportDialog}
        onOpenChange={setShowCSVImportDialog}
        onImportSuccess={() => {
          console.log('PartsManagement: CSV import successful, refreshing parts list');
          fetchParts();
          fetchAllPartsForFilterMenus();
        }}
      />
    </div>
  );
}

// Part Detail View Component – aligned with OrderDetails design system
function PartDetailView({ part }: { part: Part }) {
  const { t } = useTranslation();

  const sellingPrice = part.sellingPrice ?? 0;
  const costPrice = part.cost ?? 0;
  const margin = sellingPrice && costPrice ? ((sellingPrice - costPrice) / sellingPrice) * 100 : null;

  const stockStatus = (() => {
    const total = part.stockQuantity || 0;
    const min = part.minStockLevel || 0;
    if (total === 0) return { label: t('partsManagement.outOfStock'), cls: 'parts-stock-badge--out' };
    if (total <= min) return { label: t('partsManagement.lowStock'), cls: 'parts-stock-badge--low' };
    return { label: t('partsManagement.inStock'), cls: 'parts-stock-badge--in-stock' };
  })();

  return (
    <div className="pd-layout">
      {/* Identity strip */}
      <div className="pd-identity">
        <div className="pd-identity__left">
          <div className="pd-partnum">#{part.partNumber}</div>
          <div className="pd-name">{part.name}</div>
          <div className="pd-meta">
            {part.manufacturer && <span>{part.manufacturer}</span>}
            {part.manufacturer && (part.model || part.category) && <span className="pd-dot">·</span>}
            {part.model && <span>{part.model}</span>}
            {part.model && part.category && <span className="pd-dot">·</span>}
            <span className="parts-category-pill">{part.category}</span>
          </div>
        </div>
        <div className="pd-price-block">
          <div className="pd-price">${sellingPrice.toFixed(2)}</div>
          <div className="pd-price-label">{t('partsManagement.sellingPrice')}</div>
          <span className={`parts-stock-badge ${stockStatus.cls}`}>{stockStatus.label}</span>
        </div>
      </div>

      {/* Two-column body: left = Basic + Pricing, right = Stock */}
      <div className="pd-body-grid">

        {/* LEFT COLUMN */}
        <div className="pd-col">

          {/* Basic Information */}
          <div className="pd-section">
            <div className="pd-section-title"><Info size={12} /> Basic Information</div>
            <div className="pd-kv-grid">
              <span className="pd-kv-label">{t('partsManagement.partNumber')}</span>
              <span className="pd-kv-value pd-mono">{part.partNumber}</span>

              <span className="pd-kv-label">Manufacturer</span>
              <span className="pd-kv-value">{part.manufacturer || '—'}</span>

              <span className="pd-kv-label">Model</span>
              <span className="pd-kv-value">{part.model || '—'}</span>

              <span className="pd-kv-label">{t('partsManagement.supplier')}</span>
              <span className="pd-kv-value">{part.supplier || '—'}</span>
            </div>
            {(part.description || part.itemDescription) && (
              <div className="pd-desc">
                <span className="pd-kv-label">Description</span>
                <p>{part.description || part.itemDescription}</p>
              </div>
            )}
          </div>

          {/* Pricing */}
          <div className="pd-section">
            <div className="pd-section-title"><DollarSign size={12} /> Pricing</div>
            <div className="pd-kv-grid">
              <span className="pd-kv-label">{t('partsManagement.costPrice')}</span>
              <span className="pd-kv-value pd-money">${costPrice.toFixed(2)}</span>

              <span className="pd-kv-label">{t('partsManagement.sellingPrice')}</span>
              <span className="pd-kv-value pd-money">${sellingPrice.toFixed(2)}</span>

              {margin !== null && (
                <>
                  <span className="pd-kv-label">Margin</span>
                  <span className="pd-kv-value pd-big">{margin.toFixed(1)}%</span>
                </>
              )}
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN */}
        <div className="pd-col">

          {/* Stock Information */}
          <div className="pd-section">
            <div className="pd-section-title"><Boxes size={12} /> Stock &amp; Condition</div>
            <div className="pd-kv-grid">
              <span className="pd-kv-label">Current Stock</span>
              <span className="pd-kv-value pd-big">{part.stockQuantity ?? 0}</span>

              <span className="pd-kv-label">Minimum Level</span>
              <span className="pd-kv-value">{part.minStockLevel ?? 0}</span>

              <span className="pd-kv-label">{t('partsManagement.status')}</span>
              <span className="pd-kv-value">
                <span className={`parts-stock-badge ${stockStatus.cls}`}>{stockStatus.label}</span>
              </span>

              <span className="pd-kv-label">Warranty</span>
              <span className="pd-kv-value">{part.warranty ? `${part.warranty} days` : '—'}</span>

              <span className="pd-kv-label">Condition</span>
              <span className="pd-kv-value">
                {part.condition
                  ? <span className="pd-inline-icon"><ShieldCheck size={12} />{part.condition}</span>
                  : '—'}
              </span>

              <span className="pd-kv-label">Location</span>
              <span className="pd-kv-value">
                {part.location
                  ? <span className="pd-inline-icon"><MapPin size={12} />{part.location}</span>
                  : '—'}
              </span>
            </div>
          </div>

        </div>
      </div>

      {/* Full-width: Compatible Devices */}
      {part.compatibleDevices && part.compatibleDevices.length > 0 && (
        <div className="pd-section">
          <div className="pd-section-title"><Wrench size={12} /> Compatible Devices</div>
          <div className="parts-chip-list" style={{ paddingTop: 4 }}>
            {part.compatibleDevices.map((device, index) => (
              <span key={index} className="parts-chip">{device}</span>
            ))}
          </div>
        </div>
      )}

      {/* Full-width: Specifications */}
      {part.specifications && Object.keys(part.specifications).length > 0 && (
        <div className="pd-section">
          <div className="pd-section-title"><ClipboardList size={12} /> Specifications</div>
          <div className="pd-kv-grid pd-kv-grid--2col">
            {Object.entries(part.specifications).map(([key, value]) => (
              <React.Fragment key={key}>
                <span className="pd-kv-label">{key.charAt(0).toUpperCase() + key.slice(1)}</span>
                <span className="pd-kv-value">{value as string}</span>
              </React.Fragment>
            ))}
          </div>
        </div>
      )}

      {/* Full-width: Versions */}
      {part.versions && part.versions.length > 0 && (
        <div className="pd-section">
          <div className="pd-section-title"><Layers size={12} /> Versions ({part.versions.length})</div>
          <div className="pd-versions">
            {part.versions.map((version, index) => (
              <div key={version._id || index} className="pd-version-row">
                <div className="pd-version-row-header">
                  <span className="pd-version-title">
                    <Tag size={13} />
                    {version.versionType?.charAt(0).toUpperCase() + version.versionType?.slice(1)} Version
                  </span>
                  <span className={`parts-version-status-badge ${version.status === 'active' ? 'parts-version-status-badge--active' : 'parts-version-status-badge--inactive'}`}>
                    {version.status}
                  </span>
                </div>
                <div className="pd-kv-grid pd-kv-grid--4col">
                  <span className="pd-kv-label">{t('partsManagement.quantity')}</span>
                  <span className="pd-kv-value pd-big">{version.quantity ?? 0}</span>

                  <span className="pd-kv-label">Unit Cost</span>
                  <span className="pd-kv-value pd-money">${(version.unitCost ?? 0).toFixed(2)}</span>

                  <span className="pd-kv-label">{t('partsManagement.sellingPrice')}</span>
                  <span className="pd-kv-value pd-money">${(version.sellingPrice ?? 0).toFixed(2)}</span>

                  <span className="pd-kv-label">Location</span>
                  <span className="pd-kv-value">
                    {version.storageLocation
                      ? <span className="pd-inline-icon"><MapPin size={12} />{version.storageLocation}</span>
                      : '—'}
                  </span>
                </div>
                {version.notes && (
                  <div className="pd-notes">{version.notes}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Meta footer */}
      <div className="pd-meta-footer">
        <Calendar size={12} />
        <span>{t('partsManagement.lastUpdated')}:</span>
        <span>{part.lastUpdated ? new Date(part.lastUpdated).toLocaleString() : 'Unknown'}</span>
      </div>
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

      <Separator className="my-4" />

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} size="sm" className="parts-dialog-btn-outline">
          {t('common.cancel')}
        </Button>
        <Button type="button" onClick={onSubmit} size="sm" className="parts-dialog-btn-primary">
          {isEdit ? t('partsManagement.editPart') : t('partsManagement.createNewPart')}
        </Button>
      </div>
    </div>
  );
}