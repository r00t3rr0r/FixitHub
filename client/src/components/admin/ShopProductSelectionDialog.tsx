import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Search, Package, DollarSign, SlidersHorizontal, Boxes } from 'lucide-react';
import { getProducts } from '@/api/shop';
import { useToast } from '@/hooks/useToast';
import { Checkbox } from '@/components/ui/checkbox';

interface Product {
  _id: string;
  name: string;
  description?: string;
  price: number;
  stock?: number;
  stockCount?: number;
  inStock?: boolean;
  category?: string;
  brand?: string;
  sku?: string;
  seoName?: string;
  searchKeywords?: string;
  images: string[];
}

interface ShopProductSelectionDialogProps {
  open: boolean;
  onClose: () => void;
  onAddProduct: (productId: string, quantity: number) => Promise<void>;
  orderId: string;
  currentOrderTotal?: number;
}

export function ShopProductSelectionDialog({
  open,
  onClose,
  onAddProduct,
  orderId: _orderId,
  currentOrderTotal = 0,
}: ShopProductSelectionDialogProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [productSelectOpen, setProductSelectOpen] = useState(false);
  const [quantity, setQuantity] = useState<number>(1);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [sortBy, setSortBy] = useState<'relevance' | 'name' | 'price-asc' | 'price-desc' | 'stock-desc'>('relevance');
  const { toast } = useToast();

  const quickQuantityOptions = [1, 2, 3, 5];

  const normalizeText = (value: unknown) => String(value ?? '').toLowerCase().trim();

  const getProductStock = (product?: Product | null) => {
    if (!product) return 0;
    const raw = product.stockCount ?? product.stock ?? 0;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
  };

  const isProductInStock = (product?: Product | null) => {
    if (!product) return false;
    if (typeof product.inStock === 'boolean') {
      return product.inStock;
    }
    return getProductStock(product) > 0;
  };

  useEffect(() => {
    if (open) {
      fetchProducts();
    }
  }, [open]);

  useEffect(() => {
    let filtered = [...products];

    const search = normalizeText(searchTerm);
    if (search) {
      filtered = filtered.filter(
        (product) => {
          const haystack = [
            product.name,
            product.category,
            product.brand,
            product.description,
            product.sku,
            product.seoName,
            product.searchKeywords,
          ]
            .map(normalizeText)
            .join(' ');

          return haystack.includes(search);
        }
      );
    }

    if (inStockOnly) {
      filtered = filtered.filter((product) => isProductInStock(product));
    }

    if (sortBy === 'name') {
      filtered.sort((a, b) => a.name.localeCompare(b.name));
    }
    if (sortBy === 'price-asc') {
      filtered.sort((a, b) => a.price - b.price);
    }
    if (sortBy === 'price-desc') {
      filtered.sort((a, b) => b.price - a.price);
    }
    if (sortBy === 'stock-desc') {
      filtered.sort((a, b) => getProductStock(b) - getProductStock(a));
    }

    setFilteredProducts(filtered);
  }, [searchTerm, products, inStockOnly, sortBy]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      // Load a larger page so local dialog search works across the catalog.
      const response = await getProducts({ page: 1, limit: 500, sortBy: 'name', sortOrder: 'asc' });
      console.log('Fetched products:', response);
      setProducts(response.products || []);
      setFilteredProducts(response.products || []);
    } catch (error) {
      console.error('Error fetching products:', error);
      toast({
        title: 'Fehler',
        description: 'Produkte konnten nicht geladen werden.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddProduct = async (closeAfterAdd: boolean = true) => {
    if (!selectedProductId) {
      toast({
        title: 'Fehler',
        description: 'Bitte waehlen Sie ein Produkt aus.',
        variant: 'destructive'
      });
      return;
    }

    if (quantity <= 0) {
      toast({
        title: 'Fehler',
        description: 'Die Menge muss groesser als 0 sein.',
        variant: 'destructive'
      });
      return;
    }

    const selectedProduct = products.find((p) => p._id === selectedProductId);
    if (selectedProduct && getProductStock(selectedProduct) < quantity) {
      toast({
        title: 'Fehler',
        description: `Nicht genuegend Bestand. Verfuegbar: ${getProductStock(selectedProduct)}`,
        variant: 'destructive'
      });
      return;
    }

    setAdding(true);
    try {
      await onAddProduct(selectedProductId, quantity);
      toast({
        title: 'Erfolg',
        description: 'Produkt wurde erfolgreich zum Auftrag hinzugefuegt.'
      });
      if (closeAfterAdd) {
        handleClose();
      } else {
        setSelectedProductId('');
        setQuantity(1);
      }
    } catch (error: unknown) {
      console.error('Error adding product to order:', error);
      const errorMessage = error instanceof Error ? error.message : 'Produkt konnte nicht zum Auftrag hinzugefuegt werden.';
      toast({
        title: 'Fehler',
        description: errorMessage,
        variant: 'destructive'
      });
    } finally {
      setAdding(false);
    }
  };

  const handleClose = () => {
    setSelectedProductId('');
    setQuantity(1);
    setSearchTerm('');
    setProductSelectOpen(false);
    setInStockOnly(false);
    setSortBy('relevance');
    onClose();
  };

  const handleSelectProduct = (productId: string) => {
    setSelectedProductId(productId);
    setProductSelectOpen(false);
    setQuantity(1);
  };

  const selectedProduct = products.find((p) => p._id === selectedProductId);
  const hasSearch = normalizeText(searchTerm).length > 0;
  const quickSearchResults = hasSearch ? filteredProducts.slice(0, 6) : [];

  const subtotal = selectedProduct ? selectedProduct.price * quantity : 0;
  const projectedOrderTotal = currentOrderTotal + subtotal;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="order-dialog-content order-shop-product-dialog w-[96vw] max-w-[860px] max-h-[88vh] overflow-y-auto">
        <DialogHeader className="order-dialog-header">
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Shop-Produkt zum Auftrag hinzufuegen
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Produkte nach Name, Kategorie oder Marke suchen..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return;
                e.preventDefault();
                const firstMatch = filteredProducts.find((product) => isProductInStock(product));
                if (firstMatch) {
                  handleSelectProduct(firstMatch._id);
                }
              }}
              className="pl-10"
            />
          </div>

          {hasSearch && (
            <div className="rounded-lg border border-slate-200 bg-white">
              <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
                <p className="text-xs text-muted-foreground">
                  {filteredProducts.length} Treffer fuer "{searchTerm.trim()}"
                </p>
              </div>
              {quickSearchResults.length === 0 ? (
                <div className="px-3 py-4 text-sm text-muted-foreground">Keine passenden Produkte gefunden.</div>
              ) : (
                <div className="max-h-56 overflow-auto">
                  {quickSearchResults.map((product) => {
                    const productStock = getProductStock(product);
                    const productIsInStock = isProductInStock(product);

                    return (
                      <div key={`quick-${product._id}`} className="flex items-center justify-between gap-3 border-b border-slate-100 px-3 py-2 last:border-b-0">
                        <div className="min-w-0">
                          <p className={`truncate text-sm font-medium ${!productIsInStock ? 'text-muted-foreground line-through' : ''}`}>
                            {product.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            ${product.price} • {productIsInStock ? `${productStock} verfuegbar` : 'Nicht verfuegbar'}
                          </p>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={!productIsInStock}
                          onClick={() => handleSelectProduct(product._id)}
                        >
                          Auswaehlen
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-slate-50/70 p-3 sm:grid-cols-2">
            <div className="flex items-center gap-2">
              <Checkbox
                id="stock-only"
                checked={inStockOnly}
                onCheckedChange={(checked) => setInStockOnly(Boolean(checked))}
              />
              <Label htmlFor="stock-only" className="text-sm cursor-pointer">Nur verfuegbare Produkte anzeigen</Label>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Sortierung
              </Label>
              <Select value={sortBy} onValueChange={(value: 'relevance' | 'name' | 'price-asc' | 'price-desc' | 'stock-desc') => setSortBy(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Sort" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="relevance">Relevanz</SelectItem>
                  <SelectItem value="name">Name (A-Z)</SelectItem>
                  <SelectItem value="price-asc">Preis (niedrig nach hoch)</SelectItem>
                  <SelectItem value="price-desc">Preis (hoch nach niedrig)</SelectItem>
                  <SelectItem value="stock-desc">Bestand (hoch nach niedrig)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Product Selection */}
          <div className="space-y-2">
            <Label htmlFor="product">Produkt auswaehlen</Label>
            <Select
              value={selectedProductId}
              onValueChange={handleSelectProduct}
              open={productSelectOpen}
              onOpenChange={setProductSelectOpen}
              disabled={loading}
            >
              <SelectTrigger id="product">
                <SelectValue placeholder={loading ? 'Produkte werden geladen...' : 'Produkt auswaehlen...'} />
              </SelectTrigger>
              <SelectContent>
                {filteredProducts.length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    {loading ? 'Laedt...' : 'Keine Produkte gefunden'}
                  </div>
                ) : (
                  filteredProducts.map((product) => {
                    const productStock = getProductStock(product);
                    const productIsInStock = isProductInStock(product);

                    return (
                    <SelectItem key={product._id} value={product._id} disabled={!productIsInStock}>
                      <div className="flex items-center justify-between w-full gap-4">
                        <span className={`flex-1 ${!productIsInStock ? 'text-muted-foreground line-through' : ''}`}>
                          {product.name}
                        </span>
                        <div className="flex items-center gap-2">
                          <Badge variant={productStock > 10 ? 'default' : productIsInStock ? 'secondary' : 'destructive'}>
                            {productIsInStock ? `Bestand: ${productStock}` : 'Nicht verfuegbar'}
                          </Badge>
                          <span className="text-sm font-medium">${product.price}</span>
                        </div>
                      </div>
                    </SelectItem>
                  )})
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Selected Product Details */}
          {selectedProduct && (
            <div className="p-4 border rounded-lg bg-muted/50 space-y-3">
              <div className="flex items-start gap-4">
                {selectedProduct.images && selectedProduct.images.length > 0 && (
                  <img
                    src={selectedProduct.images[0]}
                    alt={selectedProduct.name}
                    className="w-20 h-20 object-cover rounded-md"
                  />
                )}
                <div className="flex-1 space-y-1">
                  <h4 className="font-semibold">{selectedProduct.name}</h4>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>{selectedProduct.category}</span>
                    <span>•</span>
                    <span>{selectedProduct.brand}</span>
                  </div>
                  <div className="flex items-center gap-4 mt-2">
                    <div className="flex items-center gap-1 text-sm font-medium">
                      <DollarSign className="h-4 w-4" />
                      {selectedProduct.price}
                    </div>
                    <Badge variant={getProductStock(selectedProduct) > 10 ? 'default' : isProductInStock(selectedProduct) ? 'secondary' : 'destructive'}>
                      {getProductStock(selectedProduct)} verfuegbar
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Quantity */}
          <div className="space-y-2">
            <Label htmlFor="quantity">Menge</Label>
            <Input
              id="quantity"
              type="number"
              min="1"
              max={getProductStock(selectedProduct) || 999}
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
              disabled={!selectedProductId}
            />
            <div className="flex flex-wrap gap-2">
              {quickQuantityOptions.map((value) => (
                <Button
                  key={value}
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!selectedProductId}
                  onClick={() => setQuantity(value)}
                >
                  {value}
                </Button>
              ))}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={!selectedProductId || !selectedProduct}
                onClick={() => setQuantity(Math.max(1, getProductStock(selectedProduct) || 1))}
              >
                <Boxes className="mr-1 h-3.5 w-3.5" />
                Max. Bestand
              </Button>
            </div>
            {selectedProduct && quantity > getProductStock(selectedProduct) && (
              <p className="text-sm text-destructive">
                Menge uebersteigt verfuegbaren Bestand ({getProductStock(selectedProduct)})
              </p>
            )}
          </div>

          {/* Total Price Preview */}
          {selectedProduct && (
            <div className="space-y-2 p-3 border rounded-lg bg-primary/5">
              <div className="flex items-center justify-between">
                <span className="font-medium">Zwischensumme:</span>
                <span className="text-lg font-bold">${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>Auftragsgesamt nach Hinzufuegen:</span>
                <span className="font-semibold text-foreground">${projectedOrderTotal.toFixed(2)}</span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <Button variant="outline" onClick={handleClose} disabled={adding}>
            Abbrechen
          </Button>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              variant="secondary"
              onClick={() => handleAddProduct(false)}
              disabled={!selectedProductId || adding || loading}
            >
              {adding ? 'Fuegt hinzu...' : 'Hinzufuegen & weiter'}
            </Button>
            <Button onClick={() => handleAddProduct(true)} disabled={!selectedProductId || adding || loading}>
              {adding ? 'Fuegt hinzu...' : 'Produkt hinzufuegen'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
