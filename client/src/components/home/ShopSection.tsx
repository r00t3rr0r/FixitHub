import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ShoppingCart, Star } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
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
        title: t('common.error'),
        description: t('home.shop.loadError')
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = (product: Product) => {
    showToast({
      title: t('common.success'),
      description: `${product.name} ${t('home.shop.addedToCart')}`,
      className: 'animate-bounce'
    });
  };

  const filteredProducts = products.filter(p =>
    filter === 'all' || p.category === filter
  );

  const categories = ['all', ...new Set(products.map(p => p.category))];

  return (
    <section className="relative py-24 overflow-hidden bg-white">
      {/* Animated particles background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-10 left-10 w-72 h-72 bg-yellow-400/5 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-10 right-10 w-72 h-72 bg-yellow-400/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 relative z-10">
        {/* Section Header */}
        <div className="text-center mb-12 animate-fadeIn">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            {title || t('home.shop.title')}
          </h2>
          <div className="w-24 h-1 bg-gradient-to-r from-yellow-400 to-yellow-500 mx-auto rounded-full mb-4"></div>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            {t('home.shop.subtitle')}
          </p>
        </div>

        {/* Filter Buttons */}
        <div className="flex flex-wrap justify-center gap-3 mb-12 animate-slideIn" style={{ animationDelay: '0.1s' }}>
          {categories.map((category, idx) => (
            <Button
              key={category}
              variant={filter === category ? 'default' : 'outline'}
              onClick={() => setFilter(category)}
              className="capitalize transition-all duration-300 bg-yellow-400 hover:bg-yellow-500 text-gray-900 border-gray-300 hover:border-yellow-500"
              style={{ animationDelay: `${idx * 50}ms` }}
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
            {filteredProducts.map((product, idx) => (
              <div
                key={product._id}
                className="group animate-scaleIn"
                style={{ animationDelay: `${idx * 100}ms` }}
              >
                <Card className="h-full overflow-hidden bg-white border border-gray-200 hover:border-yellow-400/50 shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-2">
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
                    <CardTitle className="line-clamp-2 group-hover:text-yellow-500 transition-colors text-gray-900">
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
                      <span className="text-2xl font-bold text-yellow-600">
                        ${product.price.toFixed(2)}
                      </span>
                      {product.originalPrice && (
                        <span className="text-gray-500 line-through">
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
          <div className="text-center animate-fadeInUp" style={{ animationDelay: '0.6s' }}>
            <Button
              size="lg"
              variant="outline"
              className="border-yellow-400 text-yellow-600 hover:bg-yellow-400 hover:text-gray-900 font-semibold"
              asChild
            >
              <Link to="/shop">{t('home.shop.viewAll')}</Link>
            </Button>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(-20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes scaleIn {
          from {
            opacity: 0;
            transform: scale(0.9);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fadeIn {
          animation: fadeIn 0.6s ease-out;
        }

        .animate-slideIn {
          animation: slideIn 0.5s ease-out forwards;
          opacity: 0;
        }

        .animate-scaleIn {
          animation: scaleIn 0.5s ease-out forwards;
          opacity: 0;
        }

        .animate-fadeInUp {
          animation: fadeInUp 0.6s ease-out;
        }
      `}</style>
    </section>
  );
}
