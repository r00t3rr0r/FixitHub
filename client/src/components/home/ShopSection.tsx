import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import {
  ShoppingCart,
  Star,
  Search,
  Filter,
  Plus,
  Heart,
  X,
  Eye,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  Grid3X3,
  List
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { getProducts, addToCart, Product } from '@/api/shop';
import { useToast } from '@/hooks/useToast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface ShopSectionProps {
  title?: string;
  maxItems?: number;
  products?: Product[];
}

export function ShopSection({ title, maxItems = 12, products: initialProducts }: ShopSectionProps) {
  const { t } = useTranslation();
  const [products, setProducts] = useState<Product[]>(initialProducts || []);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [paginatedProducts, setPaginatedProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(!initialProducts);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [brandFilter, setBrandFilter] = useState("all");
  const [stockFilter, setStockFilter] = useState("all");
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 1000]);
  const [maxPrice, setMaxPrice] = useState(1000);
  const [sortBy, setSortBy] = useState("name");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [addingToCart, setAddingToCart] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(maxItems);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quickViewOpen, setQuickViewOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!initialProducts) {
      fetchProducts();
    }
  }, [initialProducts]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const response = await getProducts();
      const productsData = (response as any).products || [];
      setProducts(productsData);
      setFilteredProducts(productsData);

      // Calculate max price from products
      if (productsData.length > 0) {
        const prices = productsData.map((p: Product) => p.price);
        const maxPriceValue = Math.ceil(Math.max(...prices));
        setMaxPrice(maxPriceValue);
        setPriceRange([0, maxPriceValue]);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
      toast({
        variant: 'destructive',
        title: t('common.error'),
        description: t('home.shop.loadError')
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let filtered = products;

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(product =>
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.brand.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by category
    if (categoryFilter !== "all") {
      filtered = filtered.filter(product => product.category === categoryFilter);
    }

    // Filter by brand
    if (brandFilter !== "all") {
      filtered = filtered.filter(product => product.brand === brandFilter);
    }

    // Filter by stock availability
    if (stockFilter === "inStock") {
      filtered = filtered.filter(product => product.inStock);
    } else if (stockFilter === "lowStock") {
      filtered = filtered.filter(product => product.inStock && product.stockCount <= 5);
    }

    // Filter by price range
    filtered = filtered.filter(product =>
      product.price >= priceRange[0] && product.price <= priceRange[1]
    );

    // Sort products
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "price-low":
          return a.price - b.price;
        case "price-high":
          return b.price - a.price;
        case "rating":
          return b.rating - a.rating;
        case "name":
        default:
          return a.name.localeCompare(b.name);
      }
    });

    setFilteredProducts(filtered);
    setCurrentPage(1); // Reset to first page when filters change
  }, [products, searchTerm, categoryFilter, brandFilter, stockFilter, priceRange, sortBy]);

  // Pagination logic
  useEffect(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    setPaginatedProducts(filteredProducts.slice(startIndex, endIndex));
  }, [filteredProducts, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);

  const handleAddToCart = async (productId: string) => {
    try {
      setAddingToCart(productId);
      console.log("Adding product to cart:", productId);

      // Find the product to pass its data for guest cart
      const product = products.find(p => p._id === productId);
      await addToCart({ productId, quantity: 1, product });

      // Dispatch cart update event
      window.dispatchEvent(new Event('cartUpdated'));

      toast({
        title: "Success!",
        description: "Product added to cart",
      });
    } catch (error: any) {
      console.error("Error adding to cart:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to add product to cart",
        variant: "destructive"
      });
    } finally {
      setAddingToCart(null);
    }
  };

  const handleQuickView = (product: Product) => {
    setSelectedProduct(product);
    setQuickViewOpen(true);
  };

  const resetFilters = () => {
    setSearchTerm("");
    setCategoryFilter("all");
    setBrandFilter("all");
    setStockFilter("all");
    setPriceRange([0, maxPrice]);
    setSortBy("name");
  };

  const categories = [...new Set(products.map(p => p.category))];
  const brands = [...new Set(products.map(p => p.brand))];

  return (
    <section className="relative py-16 overflow-hidden bg-white">
      {/* Animated particles background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-10 left-10 w-64 h-64 bg-yellow-400/5 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-10 right-10 w-64 h-64 bg-yellow-400/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 relative z-10">
        {/* Section Header */}
        <div className="text-center mb-8 animate-fadeIn">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
            {title || t('home.shop.title')}
          </h2>
          <div className="w-20 h-1 bg-gradient-to-r from-yellow-400 to-yellow-500 mx-auto rounded-full mb-3"></div>
          <p className="text-base text-gray-600 max-w-2xl mx-auto">
            {t('home.shop.subtitle')}
          </p>
        </div>

        {/* Enhanced Filters and Search */}
        <Card className="border-0 shadow-lg bg-white/95 backdrop-blur-md hover:shadow-yellow-500/20 transition-all duration-300 overflow-hidden mb-6">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-400"></div>
          <CardContent className="pt-4 pb-4">
            {/* Search and Quick Actions */}
            <div className="flex flex-col lg:flex-row gap-3">
              <div className="flex-1">
                <div className="relative group">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500 group-hover:text-yellow-600 transition-colors duration-200" />
                  <Input
                    placeholder="Search products..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 h-9 text-sm border-gray-300 focus:border-yellow-500 focus:ring-yellow-500 transition-all duration-200 bg-white"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowFilters(!showFilters)}
                  className="h-9 border-gray-300 hover:border-yellow-500 hover:bg-yellow-50 transition-colors duration-200 text-sm"
                >
                  <Filter className="h-3.5 w-3.5 mr-1.5 text-yellow-600" />
                  {showFilters ? 'Hide' : 'Filters'}
                </Button>

                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-36 h-9 text-sm border-gray-300 hover:border-yellow-500 transition-colors duration-200 bg-white">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name">Name</SelectItem>
                    <SelectItem value="price-low">Price: Low to High</SelectItem>
                    <SelectItem value="price-high">Price: High to Low</SelectItem>
                    <SelectItem value="rating">Rating</SelectItem>
                  </SelectContent>
                </Select>

                <div className="flex border rounded-md border-gray-300 bg-white">
                  <Button
                    variant={viewMode === "grid" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("grid")}
                    className={`h-9 rounded-r-none ${viewMode === "grid" ? "bg-yellow-500 hover:bg-yellow-600 text-white" : ""}`}
                  >
                    <Grid3X3 className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant={viewMode === "list" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("list")}
                    className={`h-9 rounded-l-none ${viewMode === "list" ? "bg-yellow-500 hover:bg-yellow-600 text-white" : ""}`}
                  >
                    <List className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Advanced Filters Panel */}
            {showFilters && (
              <div className="pt-3 mt-3 border-t border-gray-200 space-y-4 animate-slideDown">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                  {/* Category Filter */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-gray-700">Category</Label>
                    <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                      <SelectTrigger className="h-9 text-sm border-gray-300 hover:border-yellow-500 transition-colors duration-200 bg-white">
                        <SelectValue placeholder="Category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Categories</SelectItem>
                        {categories.map(category => (
                          <SelectItem key={category} value={category}>
                            {category}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Brand Filter */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-gray-700">Brand</Label>
                    <Select value={brandFilter} onValueChange={setBrandFilter}>
                      <SelectTrigger className="h-9 text-sm border-gray-300 hover:border-yellow-500 transition-colors duration-200 bg-white">
                        <SelectValue placeholder="Brand" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Brands</SelectItem>
                        {brands.map(brand => (
                          <SelectItem key={brand} value={brand}>
                            {brand}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Stock Filter */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-gray-700">Availability</Label>
                    <Select value={stockFilter} onValueChange={setStockFilter}>
                      <SelectTrigger className="h-9 text-sm border-gray-300 hover:border-yellow-500 transition-colors duration-200 bg-white">
                        <SelectValue placeholder="Stock Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Products</SelectItem>
                        <SelectItem value="inStock">In Stock</SelectItem>
                        <SelectItem value="lowStock">Low Stock</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Price Range Filter */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                      <DollarSign className="h-3.5 w-3.5 text-yellow-600" />
                      Price Range
                    </Label>
                    <div className="pt-1">
                      <Slider
                        min={0}
                        max={maxPrice}
                        step={10}
                        value={priceRange}
                        onValueChange={(value) => setPriceRange(value as [number, number])}
                        className="mb-1.5"
                      />
                      <div className="flex justify-between text-xs text-gray-600 font-medium">
                        <span>${priceRange[0]}</span>
                        <span>${priceRange[1]}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Active Filters and Reset */}
                <div className="flex items-center justify-between pt-1">
                  <div className="flex flex-wrap gap-1.5">
                    {categoryFilter !== "all" && (
                      <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border-yellow-300 text-xs px-2 py-0.5">
                        {categoryFilter}
                        <X className="h-3 w-3 ml-1 cursor-pointer" onClick={() => setCategoryFilter("all")} />
                      </Badge>
                    )}
                    {brandFilter !== "all" && (
                      <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border-yellow-300 text-xs px-2 py-0.5">
                        {brandFilter}
                        <X className="h-3 w-3 ml-1 cursor-pointer" onClick={() => setBrandFilter("all")} />
                      </Badge>
                    )}
                    {stockFilter !== "all" && (
                      <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border-yellow-300 text-xs px-2 py-0.5">
                        {stockFilter === "inStock" ? "In Stock" : "Low Stock"}
                        <X className="h-3 w-3 ml-1 cursor-pointer" onClick={() => setStockFilter("all")} />
                      </Badge>
                    )}
                    {(priceRange[0] !== 0 || priceRange[1] !== maxPrice) && (
                      <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border-yellow-300 text-xs px-2 py-0.5">
                        ${priceRange[0]} - ${priceRange[1]}
                        <X className="h-3 w-3 ml-1 cursor-pointer" onClick={() => setPriceRange([0, maxPrice])} />
                      </Badge>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={resetFilters}
                    className="h-7 text-xs text-gray-600 hover:text-yellow-600 hover:bg-yellow-50"
                  >
                    Reset All
                  </Button>
                </div>

                {/* Results Count */}
                <div className="text-xs text-gray-600 font-medium">
                  Showing {paginatedProducts.length} of {filteredProducts.length} products
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Loading State */}
        {loading && (
          <div className="text-center py-8">
            <div className="animate-spin inline-block w-10 h-10 border-3 border-yellow-400 border-t-gray-900 rounded-full"></div>
            <p className="text-gray-600 text-sm mt-3">{t('common.loading')}</p>
          </div>
        )}

        {/* Products Grid/List */}
        {!loading && (
          <div className={viewMode === "grid"
            ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-8"
            : "space-y-3 mb-8"
          }>
            {paginatedProducts.length === 0 ? (
              <div className="col-span-full text-center py-12">
                <p className="text-gray-600 text-lg">{t('home.shop.noProducts')}</p>
                <Button
                  onClick={resetFilters}
                  className="mt-4 bg-yellow-500 hover:bg-yellow-600 text-white"
                >
                  Clear All Filters
                </Button>
              </div>
            ) : (
              paginatedProducts.map((product, idx) => (
                <Card
                  key={product._id}
                  className={`group border-0 shadow-md bg-white hover:shadow-lg hover:shadow-yellow-500/20 hover:-translate-y-1 transition-all duration-300 overflow-hidden ${
                    viewMode === "list" ? "flex flex-row" : ""
                  }`}
                  style={{ animation: `scaleIn 0.4s ease-out ${idx * 0.04}s both` }}
                >
                  {/* Compact gradient top border */}
                  <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-400"></div>

                  <div className={viewMode === "list" ? "w-40 flex-shrink-0" : ""}>
                    <div className="relative overflow-hidden">
                      <img
                        src={product.images[0]}
                        alt={product.name}
                        className={`object-cover transition-transform duration-500 group-hover:scale-110 ${
                          viewMode === "list" ? "w-40 h-40" : "w-full h-40"
                        }`}
                      />
                      {product.originalPrice && (
                        <Badge className="absolute top-2 left-2 bg-red-500 border-0 text-xs px-2 py-0.5">
                          Sale
                        </Badge>
                      )}
                      {!product.inStock && (
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center">
                          <Badge variant="destructive" className="text-xs px-3 py-1">
                            Out of Stock
                          </Badge>
                        </div>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-2 right-2 h-7 w-7 bg-white/90 hover:bg-white backdrop-blur-sm shadow-md hover:scale-110 transition-all duration-300"
                      >
                        <Heart className="h-3.5 w-3.5 text-gray-700 group-hover:text-red-500 transition-colors duration-300" />
                      </Button>

                      {/* Quick View Button */}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleQuickView(product)}
                        className="absolute bottom-2 right-2 h-7 w-7 bg-yellow-400/90 hover:bg-yellow-500 backdrop-blur-sm shadow-md hover:scale-110 transition-all duration-300 opacity-0 group-hover:opacity-100"
                      >
                        <Eye className="h-3.5 w-3.5 text-gray-900" />
                      </Button>
                    </div>
                  </div>

                  <div className="flex-1">
                    <CardHeader className={`pb-2 ${viewMode === "list" ? "pt-3" : "pt-3"}`}>
                      <CardTitle className="text-sm leading-tight group-hover:text-yellow-600 transition-colors duration-300 font-bold line-clamp-2">
                        {product.name}
                      </CardTitle>
                      <CardDescription className="text-xs font-medium mt-0.5 text-gray-600">
                        {product.brand}
                      </CardDescription>

                      <div className="flex items-center gap-1.5 mt-1.5">
                        <div className="flex items-center">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              className={`h-3 w-3 ${
                                i < Math.floor(product.rating)
                                  ? "text-yellow-500 fill-current"
                                  : "text-gray-300"
                              }`}
                            />
                          ))}
                        </div>
                        <span className="text-xs text-gray-600 font-medium">
                          ({product.reviewCount})
                        </span>
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-2 pt-0">
                      <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed">
                        {product.description}
                      </p>

                      <div className="flex items-center justify-between pt-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-lg font-bold text-gray-900">
                            ${product.price.toFixed(2)}
                          </span>
                          {product.originalPrice && (
                            <span className="text-xs text-gray-500 line-through font-medium">
                              ${product.originalPrice.toFixed(2)}
                            </span>
                          )}
                        </div>

                        <Button
                          onClick={() => handleAddToCart(product._id)}
                          disabled={!product.inStock || addingToCart === product._id}
                          size="sm"
                          className="h-8 text-xs bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 text-gray-900 font-semibold shadow-md hover:shadow-lg transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                        >
                          {addingToCart === product._id ? (
                            <span className="flex items-center gap-1.5">
                              <div className="h-3 w-3 border-2 border-gray-900 border-t-transparent rounded-full animate-spin"></div>
                              <span className="hidden sm:inline">Adding...</span>
                            </span>
                          ) : (
                            <>
                              <Plus className="h-3.5 w-3.5 mr-1" />
                              <span className="hidden sm:inline">Add</span>
                              <ShoppingCart className="h-3.5 w-3.5 sm:hidden" />
                            </>
                          )}
                        </Button>
                      </div>

                      {product.stockCount <= 5 && product.inStock && (
                        <div className="flex items-center gap-1.5 pt-0.5">
                          <div className="h-1.5 w-1.5 bg-orange-500 rounded-full animate-pulse"></div>
                          <p className="text-xs text-orange-600 font-semibold">
                            Only {product.stockCount} left
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </div>
                </Card>
              ))
            )}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-1.5 mb-6">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="h-8 text-xs border-gray-300 hover:border-yellow-500 hover:bg-yellow-50 disabled:opacity-50"
            >
              <ChevronLeft className="h-3.5 w-3.5 mr-1" />
              <span className="hidden sm:inline">Previous</span>
            </Button>

            <div className="flex gap-1">
              {[...Array(totalPages)].map((_, index) => {
                const pageNumber = index + 1;
                if (
                  pageNumber === 1 ||
                  pageNumber === totalPages ||
                  (pageNumber >= currentPage - 1 && pageNumber <= currentPage + 1)
                ) {
                  return (
                    <Button
                      key={pageNumber}
                      variant={currentPage === pageNumber ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCurrentPage(pageNumber)}
                      className={`h-8 min-w-8 text-xs ${currentPage === pageNumber
                        ? "bg-yellow-500 hover:bg-yellow-600 text-white border-yellow-500"
                        : "border-gray-300 hover:border-yellow-500 hover:bg-yellow-50"
                      }`}
                    >
                      {pageNumber}
                    </Button>
                  );
                } else if (
                  pageNumber === currentPage - 2 ||
                  pageNumber === currentPage + 2
                ) {
                  return <span key={pageNumber} className="px-1 text-gray-400 text-xs">...</span>;
                }
                return null;
              })}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="h-8 text-xs border-gray-300 hover:border-yellow-500 hover:bg-yellow-50 disabled:opacity-50"
            >
              <span className="hidden sm:inline">Next</span>
              <ChevronRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </div>
        )}

        {/* Quick View Modal */}
        <Dialog open={quickViewOpen} onOpenChange={setQuickViewOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            {selectedProduct && (
              <>
                <DialogHeader>
                  <DialogTitle className="text-2xl font-bold text-gray-900">
                    {selectedProduct.name}
                  </DialogTitle>
                  <DialogDescription className="text-lg font-semibold text-gray-700">
                    {selectedProduct.brand}
                  </DialogDescription>
                </DialogHeader>

                <div className="grid md:grid-cols-2 gap-6 pt-4">
                  {/* Product Image */}
                  <div className="space-y-4">
                    <div className="relative overflow-hidden rounded-lg border-2 border-gray-200">
                      <img
                        src={selectedProduct.images[0]}
                        alt={selectedProduct.name}
                        className="w-full h-96 object-cover"
                      />
                      {selectedProduct.originalPrice && (
                        <Badge className="absolute top-4 left-4 bg-gradient-to-r from-red-500 to-red-600 border-0 shadow-xl text-base px-4 py-2">
                          Sale - Save ${(selectedProduct.originalPrice - selectedProduct.price).toFixed(2)}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Product Details */}
                  <div className="space-y-6">
                    {/* Rating */}
                    <div className="flex items-center gap-3">
                      <div className="flex items-center">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className={`h-6 w-6 ${
                              i < Math.floor(selectedProduct.rating)
                                ? "text-yellow-500 fill-current"
                                : "text-gray-300"
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-lg text-gray-700 font-medium">
                        {selectedProduct.rating.toFixed(1)} ({selectedProduct.reviewCount} reviews)
                      </span>
                    </div>

                    {/* Price */}
                    <div className="flex items-center gap-3">
                      <span className="text-4xl font-bold text-gray-900">
                        ${selectedProduct.price.toFixed(2)}
                      </span>
                      {selectedProduct.originalPrice && (
                        <span className="text-xl text-gray-500 line-through">
                          ${selectedProduct.originalPrice.toFixed(2)}
                        </span>
                      )}
                    </div>

                    {/* Stock Status */}
                    <div>
                      {selectedProduct.inStock ? (
                        <Badge className="bg-green-500 text-white text-base px-4 py-2">
                          In Stock ({selectedProduct.stockCount} available)
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="text-base px-4 py-2">
                          Out of Stock
                        </Badge>
                      )}
                    </div>

                    {/* Description */}
                    <div>
                      <h3 className="font-bold text-lg mb-2 text-gray-900">Description</h3>
                      <p className="text-gray-700 leading-relaxed">
                        {selectedProduct.description}
                      </p>
                    </div>

                    {/* Features */}
                    {selectedProduct.features && selectedProduct.features.length > 0 && (
                      <div>
                        <h3 className="font-bold text-lg mb-3 text-gray-900">Key Features</h3>
                        <div className="flex flex-wrap gap-2">
                          {selectedProduct.features.map((feature, index) => (
                            <Badge
                              key={index}
                              variant="outline"
                              className="text-sm border-yellow-400 text-yellow-800 bg-yellow-50 px-3 py-1"
                            >
                              {feature}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Add to Cart Button */}
                    <Button
                      onClick={() => {
                        handleAddToCart(selectedProduct._id);
                        setQuickViewOpen(false);
                      }}
                      disabled={!selectedProduct.inStock || addingToCart === selectedProduct._id}
                      className="w-full bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 text-gray-900 font-bold text-lg py-6 shadow-xl hover:shadow-2xl transition-all duration-300 disabled:opacity-50"
                    >
                      {addingToCart === selectedProduct._id ? (
                        <span className="flex items-center gap-2">
                          <div className="h-5 w-5 border-2 border-gray-900 border-t-transparent rounded-full animate-spin"></div>
                          Adding to Cart...
                        </span>
                      ) : (
                        <>
                          <ShoppingCart className="h-5 w-5 mr-2" />
                          Add to Cart
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* View All Products Link */}
        {filteredProducts.length > 0 && (
          <div className="text-center animate-fadeInUp" style={{ animationDelay: '0.4s' }}>
            <Button
              size="default"
              variant="outline"
              className="border-yellow-400 text-yellow-600 hover:bg-yellow-400 hover:text-gray-900 font-semibold text-sm"
              asChild
            >
              <Link to="/shop">View Full Shop Page</Link>
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

        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fadeIn {
          animation: fadeIn 0.6s ease-out;
        }

        .animate-fadeInUp {
          animation: fadeInUp 0.6s ease-out;
        }

        .animate-slideDown {
          animation: slideDown 0.3s ease-out;
        }
      `}</style>
    </section>
  );
}
