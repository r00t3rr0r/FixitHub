import React, { useState, useEffect, useRef } from 'react';
import { Search, X, ShoppingCart, Package } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
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
        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
        <Input
          type="text"
          placeholder="Gerät oder Reparatur suchen..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-12 pr-10 w-full bg-white border-2 border-gray-200 rounded-lg text-base placeholder-gray-400 hover:border-blue-500 focus:border-blue-500 focus:outline-none transition-colors"
        />
        {searchTerm && (
          <button
            onClick={handleClearSearch}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Search Results Dropdown - McRepair Card Design */}
      {showResults && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white border-2 border-gray-100 rounded-xl shadow-2xl z-50 overflow-hidden max-h-96">
          {loading ? (
            <div className="px-6 py-12 text-center">
              <div className="inline-flex items-center gap-2 text-blue-600">
                <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin"></div>
                <span className="text-sm font-medium">Suche läuft...</span>
              </div>
            </div>
          ) : results.length > 0 ? (
            <div>
              <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
                <p className="text-xs font-bold text-blue-600 uppercase tracking-wider">
                  🔍 {results.length} {results.length === 1 ? 'Ergebnis' : 'Ergebnisse'} gefunden
                </p>
              </div>
              <div className="grid grid-cols-1 gap-1 p-3 overflow-y-auto max-h-80">
                {results.map((product) => (
                  <Link
                    key={product._id}
                    to={`/shop`}
                    onClick={() => setShowResults(false)}
                    className="block group"
                  >
                    <div className="p-3 rounded-lg hover:bg-blue-50 transition-all duration-200 hover:shadow-md flex items-center gap-3 cursor-pointer border border-transparent hover:border-blue-100">
                      {/* Product Image */}
                      <div className="flex-shrink-0 w-14 h-14 bg-gray-100 rounded-lg overflow-hidden">
                        {product.images && product.images.length > 0 ? (
                          <img
                            src={product.images[0]}
                            alt={product.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Package className="h-7 w-7 text-gray-400" />
                          </div>
                        )}
                      </div>

                      {/* Product Info */}
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-sm text-gray-900 group-hover:text-blue-600 transition-colors truncate">
                          {product.name}
                        </h4>
                        <p className="text-xs text-gray-500 line-clamp-1">
                          {product.brand} • {product.category}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="font-bold text-sm text-yellow-600">
                            €{product.price.toFixed(2)}
                          </span>
                          {!product.inStock && (
                            <Badge variant="destructive" className="text-xs">
                              Nicht verfügbar
                            </Badge>
                          )}
                          {product.inStock && product.stockCount <= 5 && (
                            <Badge variant="outline" className="text-xs border-orange-400 text-orange-600">
                              Nur {product.stockCount}
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
                        className="flex-shrink-0 border-blue-200 hover:border-blue-400 hover:bg-blue-50"
                      >
                        {addingToCart === product._id ? (
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
                        ) : (
                          <ShoppingCart className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </Link>
                ))}
              </div>
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-100">
                <Link
                  to="/shop"
                  onClick={() => setShowResults(false)}
                  className="text-sm text-blue-600 hover:text-blue-700 font-semibold hover:underline inline-flex items-center gap-1"
                >
                  Alle Ergebnisse im Shop anzeigen
                  <span className="text-xs">→</span>
                </Link>
              </div>
            </div>
          ) : (
            <div className="px-6 py-12 text-center">
              <Package className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500 mb-4">
                Keine Produkte gefunden für "{searchTerm}"
              </p>
              <Link
                to="/shop"
                onClick={() => setShowResults(false)}
                className="text-sm text-blue-600 hover:text-blue-700 font-semibold hover:underline inline-flex items-center gap-1"
              >
                Zum Shop
                <span className="text-xs">→</span>
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
