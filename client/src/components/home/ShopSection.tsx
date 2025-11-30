import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ShoppingCart, Star } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getProducts } from '@/api/shop';
import { useToast } from '@/hooks/useToast';

interface Product {
  _id: string;
  name: string;
  description?: string;
  price: number;
  originalPrice?: number;
  category: string;
  rating?: number;
  reviews?: number;
  stock?: number;
  image?: string;
  featured?: boolean;
}

interface ShopSectionProps {
  title?: string;
  maxItems?: number;
  products?: Product[];
}

export function ShopSection({ title, maxItems = 6, products: initialProducts }: ShopSectionProps) {
  const { t } = useTranslation();
  const [products, setProducts] = useState<Product[]>(initialProducts || []);
  const [loading, setLoading] = useState(!initialProducts);
  const [filter, setFilter] = useState('all');
  const { toast: showToast } = useToast();

  useEffect(() => {
    if (!initialProducts) {
      fetchProducts();
    }
  }, [initialProducts]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const response = await getProducts({ limit: maxItems });
      setProducts(response.products || []);
    } catch (error) {
      console.error('Error fetching products:', error);
      showToast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load products'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = (product: Product) => {
    showToast({
      title: 'Success',
      description: `${product.name} added to cart`,
      className: 'animate-bounce'
    });
  };

  const filteredProducts = products.filter(p =>
    filter === 'all' || p.category === filter
  );

  const categories = ['all', ...new Set(products.map(p => p.category))];

  return (
    <section className="py-20 bg-gradient-to-b from-gray-50 to-white">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            {title || t('home.shop.title')}
          </h2>
          <p className="text-gray-600 text-lg max-w-2xl mx-auto">
            {t('home.shop.subtitle')}
          </p>
        </div>

        {/* Filter Buttons */}
        <div className="flex flex-wrap justify-center gap-3 mb-12">
          {categories.map(category => (
            <Button
              key={category}
              variant={filter === category ? 'default' : 'outline'}
              onClick={() => setFilter(category)}
              className="capitalize transition-all duration-300"
            >
              {category === 'all' ? t('home.shop.allProducts') : category}
            </Button>
          ))}
        </div>

        {/* Loading State */}
        {loading && (
          <div className="text-center py-12">
            <div className="animate-spin inline-block w-12 h-12 border-4 border-yellow-400 border-t-gray-900 rounded-full"></div>
            <p className="text-gray-600 mt-4">{t('common.loading')}</p>
          </div>
        )}

        {/* Products Grid */}
        {!loading && filteredProducts.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
            {filteredProducts.map(product => (
              <div
                key={product._id}
                className="group"
              >
                <Card className="h-full overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-2">
                  {/* Product Image */}
                  <div className="relative h-48 bg-gray-200 overflow-hidden">
                    {product.image ? (
                      <img
                        src={product.image}
                        alt={product.name}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gray-300">
                        <ShoppingCart className="w-12 h-12 text-gray-500" />
                      </div>
                    )}

                    {/* Featured Badge */}
                    {product.featured && (
                      <Badge className="absolute top-4 right-4 bg-yellow-400 text-gray-900">
                        {t('home.shop.featured')}
                      </Badge>
                    )}

                    {/* Stock Status */}
                    {product.stock !== undefined && (
                      <div className="absolute bottom-4 left-4">
                        <Badge
                          variant={product.stock > 0 ? 'default' : 'destructive'}
                          className="bg-green-500"
                        >
                          {product.stock > 0
                            ? `${t('home.shop.inStock')} (${product.stock})`
                            : t('home.shop.outOfStock')}
                        </Badge>
                      </div>
                    )}
                  </div>

                  <CardHeader>
                    {/* Product Title */}
                    <CardTitle className="line-clamp-2 group-hover:text-yellow-400 transition-colors">
                      {product.name}
                    </CardTitle>

                    {/* Rating */}
                    {product.rating !== undefined && (
                      <div className="flex items-center gap-2 mt-2">
                        <div className="flex gap-1">
                          {[...Array(Math.round(product.rating))].map((_, i) => (
                            <Star
                              key={i}
                              className="w-4 h-4 fill-yellow-400 text-yellow-400"
                            />
                          ))}
                        </div>
                        {product.reviews && (
                          <span className="text-sm text-gray-600">
                            ({product.reviews} {t('home.shop.reviews')})
                          </span>
                        )}
                      </div>
                    )}
                  </CardHeader>

                  <CardContent>
                    {/* Description */}
                    {product.description && (
                      <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                        {product.description}
                      </p>
                    )}

                    {/* Pricing */}
                    <div className="flex items-baseline gap-2 mb-4">
                      <span className="text-2xl font-bold text-yellow-400">
                        ${product.price.toFixed(2)}
                      </span>
                      {product.originalPrice && (
                        <span className="text-gray-400 line-through">
                          ${product.originalPrice.toFixed(2)}
                        </span>
                      )}
                    </div>

                    {/* Add to Cart Button */}
                    <Button
                      className="w-full bg-yellow-400 text-gray-900 hover:bg-yellow-500 font-semibold transition-all duration-300 transform hover:scale-105"
                      onClick={() => handleAddToCart(product)}
                      disabled={product.stock === 0}
                    >
                      <ShoppingCart className="w-4 h-4 mr-2" />
                      {t('home.shop.addToCart')}
                    </Button>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && filteredProducts.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-600 text-lg">{t('home.shop.noProducts')}</p>
          </div>
        )}

        {/* View All Button */}
        {filteredProducts.length > 0 && (
          <div className="text-center">
            <Button
              size="lg"
              variant="outline"
              className="border-yellow-400 text-yellow-400 hover:bg-yellow-400 hover:text-gray-900 font-semibold"
            >
              {t('home.shop.viewAll')}
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
