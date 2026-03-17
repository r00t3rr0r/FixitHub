import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getProducts, Product, addToCart } from '@/api/shop';
import { ShoppingCart, Package, Eye, Plus, Star } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/useToast";

export function ShopSection() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quickViewOpen, setQuickViewOpen] = useState(false);
  const [addingToCart, setAddingToCart] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const response = await getProducts({ limit: 8, sortBy: 'createdAt', sortOrder: 'desc' });
      const productsData = (response as any).products || [];
      // Filter only active and in-stock products
      const activeProducts = productsData.filter((p: Product) => p.isActive && p.inStock);
      setProducts(activeProducts.slice(0, 8));
    } catch (error) {
      console.error('Error fetching products:', error);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR'
    }).format(price);
  };

  const handleAddToCart = async (productId: string, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    
    try {
      setAddingToCart(productId);
      const product = products.find(p => p._id === productId);
      await addToCart({ productId, quantity: 1, product });
      
      // Dispatch cart update event
      window.dispatchEvent(new Event('cartUpdated'));
      
      toast({
        title: "Erfolgreich!",
        description: "Produkt zum Warenkorb hinzugefügt",
      });
    } catch (error) {
      console.error("Error adding to cart:", error);
      toast({
        title: "Fehler",
        description: error.message || "Produkt konnte nicht hinzugefügt werden",
        variant: "destructive"
      });
    } finally {
      setAddingToCart(null);
    }
  };

  const handleQuickView = (product: Product, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setSelectedProduct(product);
    setQuickViewOpen(true);
  };

  return (
    <div className="container">
      <div className="section-title">
        <h2>Passendes Zubehör zu deinem Gerät</h2>
        <p>Schütze dein Gerät nach der Reparatur</p>
        <div className="accent-line"></div>
      </div>

      {loading ? (
        <div className="shop-grid">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="shop-card">
              <div className="shop-card-image" style={{ background: 'var(--gray-50)' }}>
                <Package className="w-14 h-14 text-gray-300 animate-pulse" />
              </div>
              <div className="shop-card-body">
                <div className="h-4 bg-gray-200 rounded animate-pulse mb-2"></div>
                <div className="h-6 bg-gray-200 rounded animate-pulse w-20"></div>
              </div>
            </div>
          ))}
        </div>
      ) : products.length > 0 ? (
        <>
          <div className="shop-grid">
            {products.map((product) => (
              <div 
                key={product._id} 
                className="shop-card"
              >
                <Link to={`/shop?product=${product._id}`} className="shop-card-image-link">
                  <div className="shop-card-image">
                    {product.images && product.images.length > 0 ? (
                      <img 
                        src={product.images[0]} 
                        alt={product.name}
                        style={{ 
                          width: '100%', 
                          height: '100%', 
                          objectFit: 'cover' 
                        }}
                      />
                    ) : (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <rect x="5" y="2" width="14" height="20" rx="2"></rect>
                        <path d="M5 6h14M5 18h14"></path>
                      </svg>
                    )}
                    {product.originalPrice && product.originalPrice > product.price && (
                      <span className="shop-badge">Sale</span>
                    )}
                    {!product.originalPrice && product.stockCount < 10 && (
                      <span className="shop-badge">Neu</span>
                    )}
                  </div>
                </Link>
                <div className="shop-card-body">
                  <Link to={`/shop?product=${product._id}`}>
                    <h4>{product.name}</h4>
                  </Link>
                  <div style={{ marginBottom: '12px' }}>
                    <span className="shop-price">{formatPrice(product.price)}</span>
                    {product.originalPrice && product.originalPrice > product.price && (
                      <span className="shop-price-old">{formatPrice(product.originalPrice)}</span>
                    )}
                  </div>
                  <div className="shop-card-actions">
                    <button
                      onClick={(e) => handleAddToCart(product._id, e)}
                      disabled={!product.inStock || addingToCart === product._id}
                      className="btn-add-to-cart"
                      title="In den Warenkorb"
                    >
                      {addingToCart === product._id ? (
                        <div className="btn-spinner"></div>
                      ) : (
                        <>
                          <ShoppingCart size={16} />
                          <span>In den Warenkorb</span>
                        </>
                      )}
                    </button>
                    <button
                      onClick={(e) => handleQuickView(product, e)}
                      className="btn-quick-view"
                      title="Details ansehen"
                    >
                      <Eye size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ textAlign: 'center', marginTop: '32px' }}>
            <Link 
              to="/shop" 
              className="btn btn-primary"
              style={{ 
                display: 'inline-flex', 
                alignItems: 'center', 
                gap: '8px' 
              }}
            >
              <ShoppingCart size={18} />
              Alle Produkte ansehen
            </Link>
          </div>
        </>
      ) : (
        <div style={{ textAlign: 'center', padding: '48px 0' }}>
          <Package className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <p style={{ color: 'var(--gray-500)' }}>
            Derzeit sind keine Produkte verfügbar.
          </p>
        </div>
      )}

      {/* Quick View Dialog */}
      <Dialog open={quickViewOpen} onOpenChange={setQuickViewOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {selectedProduct && (
            <>
              <DialogHeader>
                <DialogTitle className="text-lg font-bold" style={{ color: 'var(--gray-900)' }}>
                  {selectedProduct.name}
                </DialogTitle>
                <DialogDescription className="text-sm font-semibold" style={{ color: 'var(--gray-700)' }}>
                  {selectedProduct.brand}
                </DialogDescription>
              </DialogHeader>

              <div className="grid md:grid-cols-2 gap-4 pt-3">
                {/* Product Image */}
                <div className="space-y-3">
                  <div className="relative overflow-hidden rounded-lg border" style={{ borderColor: 'var(--gray-200)' }}>
                    <img
                      src={selectedProduct.images[0]}
                      alt={selectedProduct.name}
                      className="w-full h-72 object-cover"
                    />
                    {selectedProduct.originalPrice && selectedProduct.originalPrice > selectedProduct.price && (
                      <Badge className="absolute top-3 left-3 bg-red-500 border-0 text-xs px-3 py-1">
                        Sale - {formatPrice(selectedProduct.originalPrice - selectedProduct.price)} sparen
                      </Badge>
                    )}
                  </div>

                  {/* Additional Product Images */}
                  {selectedProduct.images.length > 1 && (
                    <div className="grid grid-cols-4 gap-2">
                      {selectedProduct.images.slice(0, 4).map((image, index) => (
                        <img
                          key={index}
                          src={image}
                          alt={`${selectedProduct.name} Ansicht ${index + 1}`}
                          className="w-full h-16 object-cover rounded border cursor-pointer hover:border-yellow-500 transition-colors"
                          style={{ borderColor: 'var(--gray-200)' }}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Product Details */}
                <div className="space-y-4">
                  {/* Rating */}
                  <div className="flex items-center gap-2">
                    <div className="flex items-center">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={`h-4 w-4 ${
                            i < Math.floor(selectedProduct.rating)
                              ? "text-yellow-500 fill-current"
                              : "text-gray-300"
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-sm font-medium" style={{ color: 'var(--gray-700)' }}>
                      {selectedProduct.rating.toFixed(1)} ({selectedProduct.reviewCount} Bewertungen)
                    </span>
                  </div>

                  {/* Price */}
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold" style={{ color: 'var(--gray-900)' }}>
                      {formatPrice(selectedProduct.price)}
                    </span>
                    {selectedProduct.originalPrice && selectedProduct.originalPrice > selectedProduct.price && (
                      <span className="text-base line-through" style={{ color: 'var(--gray-500)' }}>
                        {formatPrice(selectedProduct.originalPrice)}
                      </span>
                    )}
                  </div>

                  {/* Stock Status */}
                  <div>
                    {selectedProduct.inStock ? (
                      <Badge className="bg-green-500 text-white text-xs px-3 py-1">
                        Auf Lager ({selectedProduct.stockCount} verfügbar)
                      </Badge>
                    ) : (
                      <Badge variant="destructive" className="text-xs px-3 py-1">
                        Nicht auf Lager
                      </Badge>
                    )}
                  </div>

                  {/* Description */}
                  <div>
                    <h3 className="font-bold text-sm mb-1.5" style={{ color: 'var(--gray-900)' }}>Beschreibung</h3>
                    <p className="text-xs leading-relaxed" style={{ color: 'var(--gray-700)' }}>
                      {selectedProduct.description}
                    </p>
                  </div>

                  {/* Features */}
                  {selectedProduct.features && selectedProduct.features.length > 0 && (
                    <div>
                      <h3 className="font-bold text-sm mb-2" style={{ color: 'var(--gray-900)' }}>Hauptmerkmale</h3>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedProduct.features.map((feature, index) => (
                          <Badge
                            key={index}
                            variant="outline"
                            className="text-xs px-2 py-0.5"
                            style={{ 
                              borderColor: 'var(--accent-yellow)', 
                              color: '#854d0e',
                              background: '#fef9c3'
                            }}
                          >
                            {feature}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Category and Brand */}
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div>
                      <p className="text-xs mb-0.5" style={{ color: 'var(--gray-600)' }}>Kategorie</p>
                      <p className="font-semibold text-sm" style={{ color: 'var(--gray-900)' }}>{selectedProduct.category}</p>
                    </div>
                    <div>
                      <p className="text-xs mb-0.5" style={{ color: 'var(--gray-600)' }}>Marke</p>
                      <p className="font-semibold text-sm" style={{ color: 'var(--gray-900)' }}>{selectedProduct.brand}</p>
                    </div>
                  </div>

                  {/* Add to Cart Button */}
                  <button
                    onClick={(e) => {
                      handleAddToCart(selectedProduct._id, e);
                      setQuickViewOpen(false);
                    }}
                    disabled={!selectedProduct.inStock || addingToCart === selectedProduct._id}
                    className="btn-dialog-add-to-cart"
                  >
                    {addingToCart === selectedProduct._id ? (
                      <span className="flex items-center gap-2">
                        <div className="btn-spinner-dialog"></div>
                        Wird hinzugefügt...
                      </span>
                    ) : (
                      <>
                        <ShoppingCart className="h-4 w-4" />
                        In den Warenkorb
                      </>
                    )}
                  </button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
