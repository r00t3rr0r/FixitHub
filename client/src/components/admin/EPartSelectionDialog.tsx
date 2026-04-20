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
import { assignEPartToOrder, recordEPartNeedListEntry } from '@/api/adminOrders';
import {
  addItemToNeedList,
  createNeedList,
  getNeedLists,
  type NeedList,
} from '@/api/needLists';
import { getSuppliers, Supplier } from '@/api/epartOrders';
import { useToast } from '@/hooks/useToast';

type NeedListTargetOption = 'existing' | 'new' | 'today';

interface EPartSelectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  orderNumber?: string;
  onSuccess: () => void;
}

const EPartSelectionDialog: React.FC<EPartSelectionDialogProps> = ({
  open,
  onOpenChange,
  orderId,
  orderNumber,
  onSuccess,
}) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [addingToNeedList, setAddingToNeedList] = useState(false);
  const [needListDialogOpen, setNeedListDialogOpen] = useState(false);
  const [loadingNeedLists, setLoadingNeedLists] = useState(false);
  const [needListOptions, setNeedListOptions] = useState<NeedList[]>([]);
  const [needListTargetOption, setNeedListTargetOption] = useState<NeedListTargetOption>('existing');
  const [selectedNeedListId, setSelectedNeedListId] = useState('');
  const [newNeedListName, setNewNeedListName] = useState('');
  const [parts, setParts] = useState<Part[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [selectedPart, setSelectedPart] = useState<Part | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<PartVersion | null>(null);
  const [quantity, setQuantity] = useState<number>(1);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');

  // Load parts on mount
  useEffect(() => {
    if (open) {
      loadParts();
      loadSuppliers();
    } else {
      setNeedListDialogOpen(false);
    }
  }, [open]);

  const loadSuppliers = async () => {
    try {
      const res = await getSuppliers({ isActive: true });
      setSuppliers(res.suppliers || []);
    } catch (error) {
      setSuppliers([]);
    }
  };

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
        title: 'Fehler',
        description: error.message || 'Teile konnten nicht geladen werden',
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
        title: 'Fehler',
        description: 'Bitte waehle ein Teil und eine Version aus',
        variant: 'destructive',
      });
      return;
    }

    if (quantity <= 0) {
      toast({
        title: 'Fehler',
        description: 'Die Menge muss groesser als 0 sein',
        variant: 'destructive',
      });
      return;
    }

    if (quantity > selectedVersion.quantity) {
      toast({
        title: 'Fehler',
        description: `Nicht genug Bestand. Verfuegbar: ${selectedVersion.quantity}`,
        variant: 'destructive',
      });
      return;
    }

    try {
      setAssigning(true);
      await assignEPartToOrder(orderId, selectedPart._id, selectedVersion._id, quantity);

      toast({
        title: 'Erfolg',
        description: 'Ersatzteil wurde erfolgreich zugewiesen',
      });

      // Reset form
      setSelectedPart(null);
      setSelectedVersion(null);
      setQuantity(1);

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: 'Fehler',
        description: error.message || 'Ersatzteil konnte nicht zugewiesen werden',
        variant: 'destructive',
      });
    } finally {
      setAssigning(false);
    }
  };

  const getDateKey = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const handleOpenNeedListSelection = async () => {
    if (!selectedPart) {
      toast({
        title: 'Fehler',
        description: 'Bitte waehle zuerst ein Teil aus',
        variant: 'destructive',
      });
      return;
    }

    if (quantity <= 0) {
      toast({
        title: 'Fehler',
        description: 'Die Menge muss groesser als 0 sein',
        variant: 'destructive',
      });
      return;
    }

    const orderIdentifier = orderNumber || orderId;

    try {
      setLoadingNeedLists(true);

      const allNeedLists = await getNeedLists();
      const openNeedLists = allNeedLists.filter(
        (needList) => needList.status !== 'ordered' && needList.status !== 'archived'
      );

      setNeedListOptions(openNeedLists);
      setSelectedNeedListId(openNeedLists[0]?._id || '');
      setNeedListTargetOption(openNeedLists.length > 0 ? 'existing' : 'new');
      setNewNeedListName(`Auftrag ${orderIdentifier} - Ersatzteil Bedarfsliste`);
      setNeedListDialogOpen(true);
    } catch (error: any) {
      toast({
        title: 'Fehler',
        description: error.message || 'Bedarfslisten konnten nicht geladen werden',
        variant: 'destructive',
      });
    } finally {
      setLoadingNeedLists(false);
    }
  };

  const handleAddMissingPartToNeedList = async () => {
    if (!selectedPart) {
      toast({
        title: 'Fehler',
        description: 'Bitte waehle zuerst ein Teil aus',
        variant: 'destructive',
      });
      return;
    }

    if (quantity <= 0) {
      toast({
        title: 'Fehler',
        description: 'Die Menge muss groesser als 0 sein',
        variant: 'destructive',
      });
      return;
    }

    const orderTag = `order-${orderId}`;
    const orderIdentifier = orderNumber || orderId;
    const orderPath = `${window.location.origin}${window.location.pathname}`;
    const itemNote = `Auftrag ${orderIdentifier}: ${orderPath}`;
    const dateKey = getDateKey();
    const todayTag = `daily-${dateKey}`;


    try {
      setAddingToNeedList(true);

      let recordedNeedList: NeedList | null = null;
      let successDescription = '';

      if (!selectedSupplierId) {
        toast({
          title: 'Fehler',
          description: 'Bitte wähle einen Lieferanten aus',
          variant: 'destructive',
        });
        return;
      }

      if (needListTargetOption === 'existing') {
        if (!selectedNeedListId) {
          toast({
            title: 'Fehler',
            description: 'Bitte waehle eine Bedarfsliste aus',
            variant: 'destructive',
          });
          return;
        }

        recordedNeedList = await addItemToNeedList(selectedNeedListId, {
          part: selectedPart._id,
          quantity,
          notes: itemNote,
          supplier: selectedSupplierId,
        });

        successDescription = `Teil wurde zur Bedarfsliste "${recordedNeedList.name}" hinzugefuegt`;
      }

      if (needListTargetOption === 'new') {
        if (!newNeedListName.trim()) {
          toast({
            title: 'Fehler',
            description: 'Bitte gib einen Namen fuer die neue Bedarfsliste ein',
            variant: 'destructive',
          });
          return;
        }

        recordedNeedList = await createNeedList({
          name: newNeedListName.trim(),
          description: `Aus Auftrag ${orderIdentifier} erstellt, weil das Teil nicht verfuegbar ist.`,
          priority: 'high',
          tags: [orderTag, 'order-linked', 'manual-creation'],
          items: [
            {
              part: selectedPart._id,
              quantity,
              notes: itemNote,
              supplier: selectedSupplierId,
            },
          ],
        });

        successDescription = `Bedarfsliste "${recordedNeedList.name}" wurde erstellt und das Teil hinzugefuegt`;
      }

      if (needListTargetOption === 'today') {
        const todayNeedList = needListOptions.find(
          (needList) => needList.tags?.includes(todayTag)
        );

        if (todayNeedList) {
          recordedNeedList = await addItemToNeedList(todayNeedList._id, {
            part: selectedPart._id,
            quantity,
            notes: itemNote,
            supplier: selectedSupplierId,
          });

          successDescription = `Teil wurde zur heutigen Bedarfsliste "${recordedNeedList.name}" hinzugefuegt`;
        } else {
          recordedNeedList = await createNeedList({
            name: `Tages-Bedarfsliste ${dateKey}`,
            description: `Automatisch erstellte Tages-Bedarfsliste fuer ${dateKey}.`,
            priority: 'medium',
            tags: [todayTag, 'daily', orderTag],
            items: [
              {
                part: selectedPart._id,
                quantity,
                notes: itemNote,
                supplier: selectedSupplierId,
              },
            ],
          });

          successDescription = `Heutige Bedarfsliste "${recordedNeedList.name}" wurde erstellt und das Teil hinzugefuegt`;
        }
      }

      if (recordedNeedList) {
        await recordEPartNeedListEntry(orderId, {
          partId: selectedPart._id,
          quantity,
          needListId: recordedNeedList._id,
          needListName: recordedNeedList.name,
          needListStatus: recordedNeedList.status,
          targetType: needListTargetOption,
          notes: itemNote,
        });
      }

      toast({
        title: 'Erfolg',
        description: successDescription,
      });

      setNeedListDialogOpen(false);
      setSelectedPart(null);
      setSelectedVersion(null);
      setQuantity(1);
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: 'Fehler',
        description: error.message || 'Teil konnte nicht zur Bedarfsliste hinzugefuegt werden',
        variant: 'destructive',
      });
    } finally {
      setAddingToNeedList(false);
    }
  };

  const selectedPartTotalStock = selectedPart
    ? selectedPart.versions?.reduce((sum, version) => sum + (version.quantity || 0), 0) ?? selectedPart.stockQuantity ?? 0
    : 0;
  const selectedPartOutOfStock = !!selectedPart && selectedPartTotalStock <= 0;

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

  const categoryLabels: Record<string, string> = {
    all: 'Alle Kategorien',
    display: 'Display',
    battery: 'Akku',
    camera: 'Kamera',
    speaker: 'Lautsprecher',
    microphone: 'Mikrofon',
    'charging-port': 'Ladebuchse',
    button: 'Taste',
    sensor: 'Sensor',
    tool: 'Werkzeug',
    adhesive: 'Kleber',
    screw: 'Schraube',
    other: 'Sonstiges',
  };

  const getCategoryLabel = (category?: string) => {
    if (!category) return 'Sonstiges';
    const normalized = category.toLowerCase();
    return categoryLabels[normalized] || category;
  };

  const getVersionBadgeColor = (versionType: string) => {
    switch (versionType) {
      case 'original':
        return 'bg-[#1a2a5e] text-white';
      case 'cheap':
        return 'bg-[#38a169] text-white';
      case 'efficient':
        return 'bg-[#f5b800] text-[#1a2a5e]';
      default:
        return 'bg-slate-500 text-white';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="order-dialog-content order-e-part-dialog w-[96vw] max-w-[980px] max-h-[88vh] overflow-y-auto">
        <DialogHeader className="order-dialog-header order-e-part-dialog-header">
          <DialogTitle>Ersatzteil dem Auftrag zuweisen</DialogTitle>
          <DialogDescription>
            Suche ein passendes Teil und waehle die passende Version fuer diesen Auftrag aus.
          </DialogDescription>
        </DialogHeader>

        <div className="order-e-part-body space-y-4 py-3">
          <div className="order-e-part-search-grid grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <Label htmlFor="search">Teile suchen</Label>
              <div className="order-e-part-search-input mt-1 flex gap-2">
                <Input
                  id="search"
                  placeholder="Nach Name, SKU oder Marke suchen..."
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
              <Label htmlFor="category">Kategorie</Label>
              <Select value={categoryFilter} onValueChange={(value) => {
                setCategoryFilter(value);
                setTimeout(loadParts, 100);
              }}>
                <SelectTrigger id="category" className="mt-1">
                  <SelectValue placeholder="Kategorie auswaehlen" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {categoryLabels[cat] || cat.charAt(0).toUpperCase() + cat.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="order-e-part-main-grid grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-3">
            <div className="order-e-part-panel border rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label>Verfuegbare Teile</Label>
                <p className="text-xs text-muted-foreground">{parts.length} Treffer</p>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : parts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <Package className="h-12 w-12 mb-2" />
                  <p>Keine Teile gefunden</p>
                </div>
              ) : (
                <div className="order-e-part-parts-list space-y-2 max-h-[320px] overflow-y-auto pr-1">
                  {parts.map((part) => (
                    <div
                      key={part._id}
                      className={`order-e-part-part-card border rounded-lg p-3 cursor-pointer transition-colors ${
                        selectedPart?._id === part._id
                          ? 'is-selected'
                          : ''
                      }`}
                      onClick={() => {
                        setSelectedPart(part);
                        setSelectedVersion(null);
                      }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium truncate">{part.itemName || part.name}</h4>
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {part.description || part.itemDescription}
                          </p>
                          <div className="flex flex-wrap gap-2 mt-2">
                            <Badge variant="outline">{getCategoryLabel(part.category)}</Badge>
                            <Badge variant="outline">{part.brand}</Badge>
                            {part.partNumber && (
                              <Badge variant="secondary">{part.partNumber}</Badge>
                            )}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-medium">
                            Bestand: {part.stockQuantity || 0}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {part.versions?.length || 0} Version(en)
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="order-e-part-panel border rounded-lg p-3 space-y-3">
              <div>
                <Label>Ausgewaehltes Teil</Label>
                {selectedPart ? (
                  <div className="order-e-part-selected mt-1 rounded-lg border p-3">
                    <p className="font-semibold text-sm">{selectedPart.itemName || selectedPart.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Gesamtbestand: {selectedPartTotalStock}
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground mt-1">Waehle links ein Teil aus, um fortzufahren.</p>
                )}
              </div>

              {selectedPart && selectedPart.versions && selectedPart.versions.length > 0 && (
                <div className="space-y-2">
                  <Label>Version auswaehlen</Label>
                  <div className="order-e-part-versions-list space-y-2 max-h-[280px] overflow-y-auto pr-1">
                    {selectedPart.versions.map((version) => (
                      <div
                        key={version._id}
                        className={`order-e-part-version-card border rounded-lg p-3 transition-colors ${
                          selectedVersion?._id === version._id
                            ? 'is-selected'
                            : ''
                        } ${version.quantity === 0 ? 'is-disabled' : 'cursor-pointer'}`}
                        onClick={() => {
                          if (version.quantity > 0) {
                            setSelectedVersion(version);
                          }
                        }}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <Badge className={getVersionBadgeColor(version.versionType)}>
                              {version.versionType.toUpperCase()}
                            </Badge>
                            <div className="min-w-0">
                              <p className="text-sm font-medium">
                                ${version.sellingPrice?.toFixed(2) || '0.00'}
                              </p>
                              <p className="text-xs text-muted-foreground truncate">
                                Lagerort: {version.storageLocation}
                              </p>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className={`text-sm font-medium ${version.quantity === 0 ? 'text-red-500' : ''}`}>
                              {version.quantity}
                            </p>
                            {version.quantity <= version.minStockLevel && version.quantity > 0 && (
                              <div className="flex items-center gap-1 text-yellow-600 justify-end">
                                <AlertCircle className="h-3 w-3" />
                                <span className="text-xs">Niedrig</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedVersion && (
                <div>
                  <Label htmlFor="quantity">Menge</Label>
                  <Input
                    id="quantity"
                    type="number"
                    min="1"
                    max={selectedVersion.quantity}
                    value={quantity}
                    onChange={(e) => setQuantity(parseInt(e.target.value, 10) || 1)}
                    className="mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Verfuegbar: {selectedVersion.quantity}
                  </p>
                </div>
              )}

              {selectedPartOutOfStock && (
                <div className="order-e-part-warning rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                  Dieses Teil ist aktuell nicht auf Lager. Fuege es einer Bedarfsliste hinzu, damit der Auftrag weiterbearbeitet werden kann.
                </div>
              )}

              {selectedPartOutOfStock && !selectedVersion && (
                <div>
                  <Label htmlFor="missing-quantity">Benoetigte Menge</Label>
                  <Input
                    id="missing-quantity"
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(parseInt(e.target.value, 10) || 1)}
                    className="mt-1"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="order-e-part-footer">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button
            variant="secondary"
            onClick={handleOpenNeedListSelection}
            disabled={!selectedPartOutOfStock || addingToNeedList || assigning || loadingNeedLists}
          >
            {loadingNeedLists ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Bedarfslisten werden geladen...
              </>
            ) : (
              'Fehlendes Teil zur Bedarfsliste hinzufuegen'
            )}
          </Button>
          <Button
            onClick={handleAssignEPart}
            disabled={!selectedPart || !selectedVersion || assigning || addingToNeedList}
          >
            {assigning ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Wird zugewiesen...
              </>
            ) : (
              'Ersatzteil zuweisen'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>

      <Dialog open={needListDialogOpen} onOpenChange={setNeedListDialogOpen}>
        <DialogContent className="order-dialog-content order-e-part-need-list-dialog w-[94vw] sm:max-w-[560px]">
          <DialogHeader className="order-dialog-header">
            <DialogTitle>Fehlendes Teil zur Bedarfsliste hinzufuegen</DialogTitle>
            <DialogDescription>
              Waehle aus, in welche Bedarfsliste dieses fehlende Teil eingetragen wird.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="supplier-select">Lieferant</Label>
              <Select
                id="supplier-select"
                value={selectedSupplierId}
                onValueChange={setSelectedSupplierId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Lieferant auswählen" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.length === 0 ? (
                    <SelectItem value="" disabled>
                      Keine Lieferanten gefunden
                    </SelectItem>
                  ) : (
                    suppliers.map((supplier) => (
                      <SelectItem key={supplier._id} value={supplier._id}>
                        {supplier.name} {supplier.email ? `(${supplier.email})` : ''}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="need-list-target">Ziel</Label>
              <Select
                value={needListTargetOption}
                onValueChange={(value: NeedListTargetOption) => setNeedListTargetOption(value)}
              >
                <SelectTrigger id="need-list-target">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="existing">Bestehende Bedarfsliste</SelectItem>
                  <SelectItem value="new">Neue Bedarfsliste erstellen</SelectItem>
                  <SelectItem value="today">Heutige Bedarfsliste verwenden</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {needListTargetOption === 'existing' && (
              <div>
                <Label htmlFor="existing-need-list">Bedarfsliste auswaehlen</Label>
                <Select value={selectedNeedListId} onValueChange={setSelectedNeedListId}>
                  <SelectTrigger id="existing-need-list">
                    <SelectValue placeholder="Bedarfsliste auswaehlen" />
                  </SelectTrigger>
                  <SelectContent>
                    {needListOptions.length === 0 ? (
                      <SelectItem value="none" disabled>
                        Keine offene Bedarfsliste gefunden
                      </SelectItem>
                    ) : (
                      needListOptions.map((needList) => (
                        <SelectItem key={needList._id} value={needList._id}>
                          {needList.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                {needListOptions.length === 0 && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Keine offene Bedarfsliste verfuegbar. Waehle stattdessen "Neue Bedarfsliste erstellen".
                  </p>
                )}
              </div>
            )}

            {needListTargetOption === 'new' && (
              <div>
                <Label htmlFor="new-need-list-name">Name der Bedarfsliste</Label>
                <Input
                  id="new-need-list-name"
                  value={newNeedListName}
                  onChange={(e) => setNewNeedListName(e.target.value)}
                  placeholder="Namen fuer neue Bedarfsliste eingeben"
                />
              </div>
            )}

            {needListTargetOption === 'today' && (
              <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
                Das Teil wird zur heutigen Bedarfsliste hinzugefuegt. Falls noch keine existiert, wird sie automatisch erstellt.
              </div>
            )}
          </div>

          <DialogFooter className="order-e-part-footer">
            <Button
              variant="outline"
              onClick={() => setNeedListDialogOpen(false)}
              disabled={addingToNeedList}
            >
              Abbrechen
            </Button>
            <Button
              onClick={handleAddMissingPartToNeedList}
              disabled={addingToNeedList || (needListTargetOption === 'existing' && !selectedNeedListId)}
            >
              {addingToNeedList ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Wird gespeichert...
                </>
              ) : (
                'Bestaetigen'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
};

export default EPartSelectionDialog;
