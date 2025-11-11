import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Search, Package, DollarSign } from 'lucide-react';
import { getProducts } from '@/api/shop';
import { useToast } from '@/hooks/useToast';

interface Product {
  _id: string;
  name: string;
  price: number;
  stock: number;
  category: string;
  brand: string;
  images: string[];
}

interface ShopProductSelectionDialogProps {
  open: boolean;
  onClose: () => void;
  onAddProduct: (productId: string, quantity: number) => Promise<void>;
  orderId: string;
}

export function ShopProductSelectionDialog({
  open,
  onClose,
  onAddProduct,
  orderId
}: ShopProductSelectionDialogProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchProducts();
    }
  }, [open]);

  useEffect(() => {
    // Filter products based on search term
    if (searchTerm) {
      const filtered = products.filter(
        (product) =>
          product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          product.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
          product.brand.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredProducts(filtered);
    } else {
      setFilteredProducts(products);
    }
  }, [searchTerm, products]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const response = await getProducts();
      console.log('Fetched products:', response);
      setProducts(response.products || []);
      setFilteredProducts(response.products || []);
    } catch (error) {
      console.error('Error fetching products:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch products',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddProduct = async () => {
    if (!selectedProductId) {
      toast({
        title: 'Error',
        description: 'Please select a product',
        variant: 'destructive'
      });
      return;
    }

    if (quantity <= 0) {
      toast({
        title: 'Error',
        description: 'Quantity must be greater than 0',
        variant: 'destructive'
      });
      return;
    }

    const selectedProduct = products.find((p) => p._id === selectedProductId);
    if (selectedProduct && selectedProduct.stock < quantity) {
      toast({
        title: 'Error',
        description: `Insufficient stock. Available: ${selectedProduct.stock}`,
        variant: 'destructive'
      });
      return;
    }

    setAdding(true);
    try {
      await onAddProduct(selectedProductId, quantity);
      toast({
        title: 'Success',
        description: 'Product added to order successfully'
      });
      handleClose();
    } catch (error) {
      console.error('Error adding product to order:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to add product to order',
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
    onClose();
  };

  const selectedProduct = products.find((p) => p._id === selectedProductId);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Add Shop Product to Order
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search products by name, category, or brand..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Product Selection */}
          <div className="space-y-2">
            <Label htmlFor="product">Select Product</Label>
            <Select
              value={selectedProductId}
              onValueChange={setSelectedProductId}
              disabled={loading}
            >
              <SelectTrigger id="product">
                <SelectValue placeholder={loading ? 'Loading products...' : 'Choose a product...'} />
              </SelectTrigger>
              <SelectContent>
                {filteredProducts.length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    {loading ? 'Loading...' : 'No products found'}
                  </div>
                ) : (
                  filteredProducts.map((product) => (
                    <SelectItem key={product._id} value={product._id}>
                      <div className="flex items-center justify-between w-full gap-4">
                        <span className="flex-1">{product.name}</span>
                        <div className="flex items-center gap-2">
                          <Badge variant={product.stock > 10 ? 'default' : product.stock > 0 ? 'secondary' : 'destructive'}>
                            Stock: {product.stock}
                          </Badge>
                          <span className="text-sm font-medium">${product.price}</span>
                        </div>
                      </div>
                    </SelectItem>
                  ))
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
                    <Badge variant={selectedProduct.stock > 10 ? 'default' : selectedProduct.stock > 0 ? 'secondary' : 'destructive'}>
                      {selectedProduct.stock} in stock
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Quantity */}
          <div className="space-y-2">
            <Label htmlFor="quantity">Quantity</Label>
            <Input
              id="quantity"
              type="number"
              min="1"
              max={selectedProduct?.stock || 999}
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
              disabled={!selectedProductId}
            />
            {selectedProduct && quantity > selectedProduct.stock && (
              <p className="text-sm text-destructive">
                Quantity exceeds available stock ({selectedProduct.stock})
              </p>
            )}
          </div>

          {/* Total Price Preview */}
          {selectedProduct && (
            <div className="flex items-center justify-between p-3 border rounded-lg bg-primary/5">
              <span className="font-medium">Total Price:</span>
              <span className="text-lg font-bold">
                ${(selectedProduct.price * quantity).toFixed(2)}
              </span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={adding}>
            Cancel
          </Button>
          <Button onClick={handleAddProduct} disabled={!selectedProductId || adding || loading}>
            {adding ? 'Adding...' : 'Add Product'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
