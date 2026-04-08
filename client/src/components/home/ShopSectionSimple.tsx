import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getProducts, Product, addToCart } from '@/api/shop';
import { ShoppingCart, Package, Eye, Plus, Star, Sparkles, Shield, Tag, Layers3, CheckCircle2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/useToast";

export function ShopSection() {
  const { t, i18n } = useTranslation();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedQuickViewImage, setSelectedQuickViewImage] = useState<string | null>(null);
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
    const locale = i18n.language?.startsWith('de') ? 'de-DE' : 'en-GB';

    return new Intl.NumberFormat(locale, {
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
        title: t('home.shop.addedToCartTitle'),
        description: t('home.shop.addedToCartDescription'),
      });
    } catch (error) {
      console.error("Error adding to cart:", error);
      toast({
        title: t('home.shop.addToCartErrorTitle'),
        description: error.message || t('home.shop.addToCartErrorDescription'),
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
    setSelectedQuickViewImage(null);
    setQuickViewOpen(true);
  };

  const quickViewImages = selectedProduct?.images?.filter(Boolean) || [];
  const quickViewPrimaryImage = selectedQuickViewImage || quickViewImages[0] || "/placeholder-product.png";
  const quickViewSavings = selectedProduct?.originalPrice ? selectedProduct.originalPrice - selectedProduct.price : 0;

  return (
    <div className="container">
      <div className="section-title">
        <h2>{t('home.shop.title')}</h2>
        <p>{t('home.shop.subtitle')}</p>
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
                <button 
                  onClick={(e) => handleQuickView(product, e)}
                  className="shop-card-image-link"
                  style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                >
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
                      <span className="shop-badge">{t('home.shop.saleBadge')}</span>
                    )}
                    {!product.originalPrice && product.stockCount < 10 && (
                      <span className="shop-badge">{t('home.shop.newBadge')}</span>
                    )}
                  </div>
                </button>
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
                      title={t('home.shop.cartButtonTitle')}
                    >
                      {addingToCart === product._id ? (
                        <div className="btn-spinner"></div>
                      ) : (
                        <>
                          <ShoppingCart size={16} />
                          <span>{t('home.shop.addToCart')}</span>
                        </>
                      )}
                    </button>
                    <button
                      onClick={(e) => handleQuickView(product, e)}
                      className="btn-quick-view"
                      title={t('home.shop.quickViewTitle')}
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
              {t('home.shop.viewAllButton')}
            </Link>
          </div>
        </>
      ) : (
        <div style={{ textAlign: 'center', padding: '48px 0' }}>
          <Package className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <p style={{ color: 'var(--gray-500)' }}>{t('home.shop.noProducts')}</p>
        </div>
      )}

      {/* Quick View Dialog */}
      <Dialog open={quickViewOpen} onOpenChange={setQuickViewOpen}>
        <DialogContent className="w-[calc(100vw-16px)] sm:max-w-5xl max-h-[92dvh] overflow-hidden border-0 bg-white p-0 gap-0 rounded-[20px] sm:rounded-[28px] shadow-[0_24px_80px_rgba(26,42,94,0.32)] [&>button]:top-4 [&>button]:right-4 [&>button]:text-white/80 [&>button]:opacity-100 [&>button:hover]:text-white [&>button]:focus:ring-white/50 [&>button]:ring-offset-transparent">
          {selectedProduct && (
            <>
              <DialogHeader className="gap-4 bg-gradient-to-r from-[#1a2a5e] via-[#22366f] to-[#2d4a8f] px-4 py-4 text-left sm:px-6 sm:py-5">
                <div className="flex flex-wrap items-start justify-between gap-3 pr-8">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className="border-0 bg-white/14 px-2.5 py-1 text-[11px] font-semibold text-white shadow-none">
                        <Eye className="mr-1 h-3.5 w-3.5" />
                        Produktdetails
                      </Badge>
                      <Badge className="border-0 bg-[#f5b800] px-2.5 py-1 text-[11px] font-bold text-[#1a2a5e] shadow-none">
                        <Sparkles className="mr-1 h-3.5 w-3.5" />
                        Shop Quick View
                      </Badge>
                      {selectedProduct.inStock ? (
                        <Badge className="border-0 bg-[#38a169] px-2.5 py-1 text-[11px] font-semibold text-white shadow-none">
                          Sofort verfuegbar
                        </Badge>
                      ) : (
                        <Badge className="border-0 bg-[#c53030] px-2.5 py-1 text-[11px] font-semibold text-white shadow-none">
                          Nicht verfuegbar
                        </Badge>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <DialogTitle className="text-xl font-bold tracking-tight !text-[#f5b800] sm:text-[1.65rem]">
                        {selectedProduct.name}
                      </DialogTitle>
                      <DialogDescription className="max-w-2xl text-sm leading-6 text-blue-100/90">
                        {selectedProduct.brand} • {selectedProduct.category}
                        {selectedProduct.sku ? ` • SKU ${selectedProduct.sku}` : ""}
                      </DialogDescription>
                    </div>
                  </div>
                </div>
              </DialogHeader>

              <div className="max-h-[calc(92dvh-136px)] overflow-y-auto bg-[linear-gradient(180deg,#f7f9fd_0%,#ffffff_42%)]">
                <div className="grid gap-5 p-3 sm:p-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
                  <div className="space-y-4">
                    <section className="overflow-hidden rounded-[24px] border border-[#d9dfeb] bg-white shadow-[0_14px_36px_rgba(26,42,94,0.08)]">
                      <div className="flex items-center justify-between border-b border-[#e4e8f0] bg-[#f8f9fc] px-4 py-3">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#63708a]">Produktfoto</p>
                          <p className="mt-1 text-sm font-semibold text-[#1a2a5e]">Hauptansicht</p>
                        </div>
                        {quickViewSavings > 0 && (
                          <Badge className="border-0 bg-[#fff4cc] px-3 py-1 text-[11px] font-semibold text-[#8b5e00] shadow-none">
                            <Sparkles className="mr-1 h-3.5 w-3.5" />
                            {quickViewSavings.toFixed(2)} € sparen
                          </Badge>
                        )}
                      </div>

                      <div className="bg-[radial-gradient(circle_at_top,#eef4ff_0%,#f8f9fc_48%,#ffffff_100%)] p-4 sm:p-6">
                        <div className="overflow-hidden rounded-[20px] border border-[#dfe4ee] bg-white shadow-sm">
                          <img
                            src={quickViewPrimaryImage}
                            alt={selectedProduct.name}
                            className="h-[260px] w-full object-contain p-4 sm:h-[420px] sm:p-6"
                            onError={(event) => {
                              event.currentTarget.src = "/placeholder-product.png"
                            }}
                          />
                        </div>
                      </div>
                    </section>

                    {quickViewImages.length > 1 && (
                      <section className="rounded-[24px] border border-[#d9dfeb] bg-white p-3 shadow-[0_14px_36px_rgba(26,42,94,0.08)] sm:p-4">
                        <div className="mb-3 flex items-center justify-between">
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#63708a]">Galerie</p>
                            <p className="mt-1 text-sm font-semibold text-[#1a2a5e]">Weitere Ansichten</p>
                          </div>
                          <span className="text-xs font-medium text-[#63708a]">{quickViewImages.length} Bilder</span>
                        </div>

                        <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
                          {quickViewImages.slice(0, 5).map((image, index) => {
                            const isActive = quickViewPrimaryImage === image

                            return (
                              <button
                                key={`${image}-${index}`}
                                type="button"
                                onClick={() => setSelectedQuickViewImage(image)}
                                className={`overflow-hidden rounded-2xl border p-1.5 transition-all ${
                                  isActive
                                    ? "border-[#f5b800] bg-[#fff9e6] shadow-[0_10px_24px_rgba(245,184,0,0.18)]"
                                    : "border-[#d9dfeb] bg-[#f8f9fc] hover:border-[#1a2a5e]/30 hover:bg-white"
                                }`}
                              >
                                <img
                                  src={image}
                                  alt={`${selectedProduct.name} Ansicht ${index + 1}`}
                                  className="h-16 w-full rounded-xl object-cover sm:h-20"
                                  onError={(event) => {
                                    event.currentTarget.src = "/placeholder-product.png"
                                  }}
                                />
                              </button>
                            )
                          })}
                        </div>
                      </section>
                    )}
                  </div>

                  <div className="space-y-4">
                    <section className="rounded-[24px] border border-[#d9dfeb] bg-white shadow-[0_14px_36px_rgba(26,42,94,0.08)]">
                      <div className="border-b border-[#e4e8f0] bg-[#f8f9fc] px-4 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#63708a]">Preis & Status</p>
                        <p className="mt-1 text-sm font-semibold text-[#1a2a5e]">Schneller Ueberblick</p>
                      </div>

                      <div className="space-y-4 px-4 py-4 sm:px-5">
                        <div className="flex flex-wrap items-end justify-between gap-3">
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#63708a]">Aktueller Preis</p>
                            <div className="mt-1 flex items-end gap-2">
                              <span className="text-3xl font-bold tracking-tight text-[#1a2a5e]">
                                {selectedProduct.price.toFixed(2)} €
                              </span>
                              {selectedProduct.originalPrice && (
                                <span className="pb-1 text-sm font-medium text-[#8a94a6] line-through">
                                  {selectedProduct.originalPrice.toFixed(2)} €
                                </span>
                              )}
                            </div>
                          </div>

                          <Badge className={`border-0 px-3 py-1 text-xs font-semibold shadow-none ${
                            selectedProduct.inStock
                              ? "bg-[#e8f6ee] text-[#2f855a]"
                              : "bg-[#fdecec] text-[#c53030]"
                          }`}>
                            <Shield className="mr-1 h-3.5 w-3.5" />
                            {selectedProduct.inStock ? `${selectedProduct.stockCount} verfuegbar` : "Aktuell ausverkauft"}
                          </Badge>
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1">
                            {[...Array(5)].map((_, i) => (
                              <Star
                                key={i}
                                className={`h-4 w-4 ${
                                  i < Math.floor(selectedProduct.rating)
                                    ? "fill-[#f5b800] text-[#f5b800]"
                                    : "text-[#d2d8e4]"
                                }`}
                              />
                            ))}
                          </div>
                          <span className="text-sm font-medium text-[#43506a]">
                            {selectedProduct.rating.toFixed(1)} von 5 ({selectedProduct.reviewCount} Bewertungen)
                          </span>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-3">
                          <div className="rounded-2xl bg-[#f8f9fc] px-3 py-3">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#63708a]">Kategorie</p>
                            <p className="mt-1 text-sm font-semibold text-[#1a2a5e]">{selectedProduct.category}</p>
                          </div>
                          <div className="rounded-2xl bg-[#f8f9fc] px-3 py-3">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#63708a]">Marke</p>
                            <p className="mt-1 text-sm font-semibold text-[#1a2a5e]">{selectedProduct.brand}</p>
                          </div>
                          <div className="rounded-2xl bg-[#f8f9fc] px-3 py-3">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#63708a]">Lieferstatus</p>
                            <p className="mt-1 text-sm font-semibold text-[#1a2a5e]">
                              {selectedProduct.inStock ? "Sofort lieferbar" : "Nicht verfuegbar"}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Badge className="border-0 bg-[#eef3fb] px-2.5 py-1 text-[11px] font-semibold text-[#1a2a5e] shadow-none">
                            <Tag className="mr-1 h-3.5 w-3.5" />
                            {selectedProduct.category}
                          </Badge>
                          <Badge className="border-0 bg-[#fff7db] px-2.5 py-1 text-[11px] font-semibold text-[#a16207] shadow-none">
                            <Layers3 className="mr-1 h-3.5 w-3.5" />
                            {selectedProduct.brand}
                          </Badge>
                          {selectedProduct.sku && (
                            <Badge className="border-0 bg-[#edf2f7] px-2.5 py-1 text-[11px] font-semibold text-[#43506a] shadow-none">
                              SKU {selectedProduct.sku}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </section>

                    <section className="rounded-[24px] border border-[#d9dfeb] bg-white shadow-[0_14px_36px_rgba(26,42,94,0.08)]">
                      <div className="border-b border-[#e4e8f0] bg-[#f8f9fc] px-4 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#63708a]">Beschreibung</p>
                        <p className="mt-1 text-sm font-semibold text-[#1a2a5e]">Produktinformation</p>
                      </div>

                      <div className="px-4 py-4 sm:px-5">
                        <p className="text-sm leading-7 text-[#43506a]">
                          {selectedProduct.description}
                        </p>
                      </div>
                    </section>

                    {selectedProduct.features && selectedProduct.features.length > 0 && (
                      <section className="rounded-[24px] border border-[#d9dfeb] bg-white shadow-[0_14px_36px_rgba(26,42,94,0.08)]">
                        <div className="border-b border-[#e4e8f0] bg-[#f8f9fc] px-4 py-3">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#63708a]">Highlights</p>
                          <p className="mt-1 text-sm font-semibold text-[#1a2a5e]">Wichtige Merkmale</p>
                        </div>

                        <div className="grid gap-2 px-4 py-4 sm:px-5">
                          {selectedProduct.features.map((feature, index) => (
                            <div
                              key={index}
                              className="flex items-start gap-2 rounded-2xl bg-[#f8f9fc] px-3 py-3"
                            >
                              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#38a169]" />
                              <span className="text-sm leading-6 text-[#1a2a5e]">{feature}</span>
                            </div>
                          ))}
                        </div>
                      </section>
                    )}

                    <div className="rounded-[24px] border border-[#d9dfeb] bg-white p-4 shadow-[0_14px_36px_rgba(26,42,94,0.08)] sm:p-5">
                      <Button
                        onClick={async () => {
                          try {
                            setAddingToCart(selectedProduct._id);
                            await addToCart({ productId: selectedProduct._id, quantity: 1, product: selectedProduct });
                            
                            // Dispatch cart update event
                            window.dispatchEvent(new Event('cartUpdated'));
                            
                            toast({
                              title: t('home.shop.addedToCartTitle'),
                              description: t('home.shop.addedToCartDescription'),
                            });
                            
                            setQuickViewOpen(false);
                          } catch (error) {
                            console.error("Error adding to cart:", error);
                            toast({
                              title: t('home.shop.addToCartErrorTitle'),
                              description: (error as Error).message || t('home.shop.addToCartErrorDescription'),
                              variant: "destructive"
                            });
                          } finally {
                            setAddingToCart(null);
                          }
                        }}
                        disabled={!selectedProduct.inStock || addingToCart === selectedProduct._id}
                        className="h-12 w-full bg-gradient-to-r from-[#f5b800] to-[#f0c419] text-[#1a2a5e] font-bold text-sm shadow-[0_14px_28px_rgba(245,184,0,0.28)] transition-all duration-300 hover:from-[#f0c419] hover:to-[#e0b000] hover:shadow-[0_18px_34px_rgba(245,184,0,0.34)] disabled:opacity-50"
                      >
                        {addingToCart === selectedProduct._id ? (
                          <span className="flex items-center gap-2">
                            <div className="h-4 w-4 border-2 border-[#1a2a5e] border-t-transparent rounded-full animate-spin"></div>
                            Wird hinzugefuegt...
                          </span>
                        ) : (
                          <>
                            <ShoppingCart className="mr-2 h-4 w-4" />
                            In den Warenkorb
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
