import React, { useState, useEffect, useRef } from 'react';
import { Search, X, ShoppingCart, Package } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { getProducts, Product, addToCart } from '@/api/shop';
import { useToast } from '@/hooks/useToast';
import { useTranslation } from 'react-i18next';

export function NavbarSearch() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [addingToCart, setAddingToCart] = useState<string | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>();

  // Close results when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Search products with debouncing
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (searchTerm.trim().length < 2) {
      setResults([]);
      setShowResults(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await getProducts({ search: searchTerm });
        const productsData = (response as any).products || [];
        setResults(productsData);
        setShowResults(true);
      } catch (error) {
        console.error('Error searching products:', error);
        toast({
          variant: 'destructive',
          title: t('common.error'),
          description: 'Fehler beim Suchen von Produkten'
        });
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [searchTerm, toast, t]);

  const handleClearSearch = () => {
    setSearchTerm('');
    setResults([]);
    setShowResults(false);
  };

  const handleAddToCart = async (product: Product, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!product.inStock) {
      toast({
        variant: 'destructive',
        title: 'Nicht verfügbar',
        description: 'Dieses Produkt ist derzeit nicht auf Lager'
      });
      return;
    }

    setAddingToCart(product._id);
    try {
      await addToCart({ productId: product._id, quantity: 1, product });
      toast({
        title: 'Zum Warenkorb hinzugefügt',
        description: `${product.name} wurde zu Ihrem Warenkorb hinzugefügt`
      });
    } catch (error) {
      console.error('Error adding to cart:', error);
      toast({
        variant: 'destructive',
        title: t('common.error'),
        description: 'Fehler beim Hinzufügen zum Warenkorb'
      });
    } finally {
      setAddingToCart(null);
    }
  };

  return (
    <div ref={searchRef} className="w-full">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          type="text"
          placeholder="Shopartikel suchen..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 pr-10 w-full bg-gray-50 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
        />
        {searchTerm && (
          <button
            onClick={handleClearSearch}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Search Results Dropdown */}
      {showResults && (
        <Card className="absolute top-full mt-1 w-full max-h-96 overflow-y-auto z-50 shadow-lg border border-gray-200 rounded-lg bg-white"
        >
          {loading ? (
            <div className="p-4 text-center text-gray-500">
              Suche läuft...
            </div>
          ) : results.length > 0 ? (
            <div className="divide-y divide-gray-100">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  {results.length} {results.length === 1 ? 'Ergebnis' : 'Ergebnisse'} gefunden
                </p>
              </div>
              {results.map((product) => (
                <Link
                  key={product._id}
                  to={`/shop`}
                  onClick={() => setShowResults(false)}
                  className="block hover:bg-blue-50 transition-colors duration-150"
                >
                  <div className="px-4 py-3 flex items-center gap-3">
                    {/* Product Image */}
                    <div className="flex-shrink-0 w-16 h-16 bg-gray-100 rounded-md overflow-hidden">
                      {product.images && product.images.length > 0 ? (
                        <img
                          src={product.images[0]}
                          alt={product.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="h-8 w-8 text-gray-400" />
                        </div>
                      )}
                    </div>

                    {/* Product Info */}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm text-gray-900 truncate">
                        {product.name}
                      </h4>
                      <p className="text-xs text-gray-500 line-clamp-1">
                        {product.brand} • {product.category}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="font-semibold text-sm text-yellow-600">
                          €{product.price.toFixed(2)}
                        </span>
                        {!product.inStock && (
                          <Badge variant="destructive" className="text-xs">
                            Nicht verfügbar
                          </Badge>
                        )}
                        {product.inStock && product.stockCount <= 5 && (
                          <Badge variant="outline" className="text-xs border-orange-400 text-orange-600">
                            Nur noch {product.stockCount}
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Add to Cart Button */}
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!product.inStock || addingToCart === product._id}
                      onClick={(e) => handleAddToCart(product, e)}
                      className="flex-shrink-0"
                    >
                      {addingToCart === product._id ? (
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-900" />
                      ) : (
                        <ShoppingCart className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </Link>
              ))}
              <div className="px-4 py-3 bg-gray-50 border-t border-gray-100">
                <Link
                  to="/shop"
                  onClick={() => setShowResults(false)}
                  className="text-sm text-yellow-600 hover:text-yellow-700 font-semibold hover:underline inline-flex items-center gap-1"
                >
                  Alle Ergebnisse im Shop anzeigen
                  <span className="text-xs">→</span>
                </Link>
              </div>
            </div>
          ) : (
            <div className="px-4 py-8 text-center">
              <Package className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500 mb-3">
                Keine Produkte gefunden für "{searchTerm}"
              </p>
              <Link
                to="/shop"
                onClick={() => setShowResults(false)}
                className="text-sm text-yellow-600 hover:text-yellow-700 font-semibold hover:underline inline-flex items-center gap-1"
              >
                Alle Produkte durchsuchen
                <span className="text-xs">→</span>
              </Link>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
