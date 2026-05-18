import React, { useState, useEffect, useRef } from 'react';
import { Search, X, ShoppingCart, Package, Wrench } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { getProducts, Product, addToCart } from '@/api/shop';
import { getRepairServices, RepairService } from '@/api/services';
import { getDeviceTypes, getManufacturersByDeviceType, getModelsByTypeAndManufacturer, DeviceType, Manufacturer, DeviceModel } from '@/api/devices';
import { useToast } from '@/hooks/useToast';
import { useTranslation } from 'react-i18next';

interface ServiceWithDeviceInfo extends RepairService {
  resultType: 'service';
  deviceType?: string;
  manufacturer?: string;
  modelName?: string;
  modelImage?: string;
}

type SearchResultItem = (Product & { resultType: 'product' }) | ServiceWithDeviceInfo;

// Cache für Device-Daten
let deviceDataCache: {
  deviceTypes: DeviceType[];
  models: Map<string, { deviceTypeId: string; deviceTypeName: string; manufacturer: Manufacturer; models: DeviceModel[] }>;
} | null = null;

const loadDeviceDataCache = async () => {
  if (deviceDataCache) return deviceDataCache;

  try {
    console.log('[Cache] Starting device data cache load...');
    const deviceTypesRes = await getDeviceTypes();
    const deviceTypes = (deviceTypesRes as any).deviceTypes || [];
    console.log('[Cache] Device types loaded:', deviceTypes.length);

    const modelsMap = new Map<string, { deviceTypeId: string; deviceTypeName: string; manufacturer: Manufacturer; models: DeviceModel[] }>();

    for (const deviceType of deviceTypes) {
      try {
        const manufacturersRes = await getManufacturersByDeviceType(deviceType._id);
        const manufacturers = (manufacturersRes as any).manufacturers || [];
        console.log(`[Cache] Manufacturers for ${deviceType.name}:`, manufacturers.length);

        for (const manufacturer of manufacturers) {
          try {
            const modelsRes = await getModelsByTypeAndManufacturer(deviceType._id, manufacturer._id);
            const models = (modelsRes as any).models || [];

            const key = `${deviceType._id}-${manufacturer._id}`;
            modelsMap.set(key, { deviceTypeId: deviceType._id, deviceTypeName: deviceType.name, manufacturer, models });
            console.log(`[Cache] Added ${models.length} models for ${manufacturer.name} (${deviceType.name})`);
          } catch (error) {
            console.error(`[Cache] Error loading models for ${deviceType.name}/${manufacturer.name}:`, error);
          }
        }
      } catch (error) {
        console.error(`[Cache] Error loading manufacturers for ${deviceType.name}:`, error);
      }
    }

    console.log('[Cache] Cache load complete. Total entries:', modelsMap.size);
    deviceDataCache = { deviceTypes, models: modelsMap };
    return deviceDataCache;
  } catch (error) {
    console.error('[Cache] Error loading device data:', error);
    return null;
  }
};

export function NavbarSearch() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [addingToCart, setAddingToCart] = useState<string | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number; width: number } | null>(null);

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

  // Update dropdown position when results are shown
  useEffect(() => {
    if (showResults && inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 8,
        left: rect.left,
        width: rect.width
      });
    }
  }, [showResults]);

  // Search products and services
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
        // Search for products
        const productsRes = await getProducts({ search: searchTerm }).catch(() => ({ products: [] }));
        const products: SearchResultItem[] = ((productsRes as any).products || []).map((p: Product) => ({
          ...p,
          resultType: 'product' as const
        }));

        // Load all services
        const servicesRes = await getRepairServices({ limit: 500 }).catch(() => ({ services: [] }));
        const allServices: RepairService[] = ((servicesRes as any).services || []);
        console.log('[Search] Total services loaded:', allServices.length);
        console.log('[Search] Sample services:', allServices.slice(0, 3).map(s => ({
          name: s.name,
          description: s.description?.substring(0, 50),
          manufacturer: s.manufacturer,
          model: s.model
        })));

        // Load device data
        const deviceData = await loadDeviceDataCache();

        // Filter services by search term
        const searchLower = searchTerm.toLowerCase();
        const matchedServices: ServiceWithDeviceInfo[] = [];

        for (const service of allServices) {
          // Check if service matches search term
          const serviceMatches =
            service.name?.toLowerCase().includes(searchLower) ||
            service.description?.toLowerCase().includes(searchLower) ||
            service.shortDescription?.toLowerCase().includes(searchLower) ||
            service.searchKeywords?.toLowerCase().includes(searchLower) ||
            service.manufacturer?.toLowerCase().includes(searchLower) ||
            service.model?.toLowerCase().includes(searchLower);

          if (!serviceMatches) continue;

          console.log('[Search] Service matched:', service.name, '- manufacturer:', service.manufacturer, '- model:', service.model);


          // Try to find device info
          if (deviceData) {
            let foundMatch = false;

            for (const [key, deviceInfo] of deviceData.models) {
              if (foundMatch) break;

              const manufacturer = deviceInfo.manufacturer;
              const models = deviceInfo.models;

              // Check if service manufacturer matches
              if (service.manufacturer?.toLowerCase() === manufacturer.name.toLowerCase()) {
                // Find matching model
                let matchedModel = models.find(m =>
                  m.name?.toLowerCase() === service.model?.toLowerCase()
                );

                if (!matchedModel && models.length > 0) {
                  matchedModel = models[0];
                }

                if (matchedModel) {
                  let modelImage = undefined;
                  if (matchedModel.image) {
                    modelImage = matchedModel.image;
                  } else if (Array.isArray(matchedModel.images) && matchedModel.images.length > 0) {
                    const img = matchedModel.images[0];
                    modelImage = img?.url || img?.base64;
                  }

                  matchedServices.push({
                    ...service,
                    resultType: 'service' as const,
                    deviceType: deviceInfo.deviceTypeName,
                    manufacturer: manufacturer.name,
                    modelName: matchedModel.name,
                    modelImage: modelImage
                  });

                  foundMatch = true;
                }
              }
            }

            // If not found by manufacturer, at least add the service
            if (!foundMatch) {
              matchedServices.push({
                ...service,
                resultType: 'service' as const,
                deviceType: '',
                manufacturer: service.manufacturer || '',
                modelName: service.model || ''
              });
            }
          } else {
            // No device data, just add the service
            matchedServices.push({
              ...service,
              resultType: 'service' as const,
              deviceType: '',
              manufacturer: service.manufacturer || '',
              modelName: service.model || ''
            });
          }
        }

        // Also search in model names, synonyms, and descriptions
        if (deviceData) {
          for (const [key, deviceInfo] of deviceData.models) {
            const models = deviceInfo.models;
            const manufacturer = deviceInfo.manufacturer;

            // Check each model
            for (const model of models) {
              const modelMatches =
                model.name?.toLowerCase().includes(searchLower) ||
                model.series?.toLowerCase().includes(searchLower) ||
                model.synonyms?.some(syn => syn?.toLowerCase().includes(searchLower)) ||
                model.modelNumbers?.some(num => num?.toLowerCase().includes(searchLower));

              if (!modelMatches) continue;

              // Find services for this model
              const servicesForModel = allServices.filter(s =>
                s.manufacturer?.toLowerCase() === manufacturer.name.toLowerCase() &&
                (s.model?.toLowerCase() === model.name.toLowerCase() ||
                 s.model?.toLowerCase().includes(model.name.toLowerCase()))
              );

              for (const service of servicesForModel) {
                // Check if already added
                if (!matchedServices.find(s => s._id === service._id)) {
                  let modelImage = undefined;
                  if (model.image) {
                    modelImage = model.image;
                  } else if (Array.isArray(model.images) && model.images.length > 0) {
                    const img = model.images[0];
                    modelImage = img?.url || img?.base64;
                  }

                  matchedServices.push({
                    ...service,
                    resultType: 'service' as const,
                    deviceType: deviceInfo.deviceTypeName,
                    manufacturer: manufacturer.name,
                    modelName: model.name,
                    modelImage: modelImage
                  });
                }
              }
            }
          }
        }

        // Remove duplicates and limit results
        const uniqueServices = Array.from(
          new Map(matchedServices.map(s => [s._id, s])).values()
        ).slice(0, 8);

        // Combine results: products first, then services
        const combinedResults = [
          ...products.slice(0, 5),
          ...uniqueServices
        ].slice(0, 12);

        console.log('[Search] Final results:', {
          searchTerm,
          productsFound: products.length,
          servicesMatched: matchedServices.length,
          uniqueServices: uniqueServices.length,
          combinedResults: combinedResults.length
        });

        setResults(combinedResults);
        setShowResults(combinedResults.length > 0);
      } catch (error) {
        console.error('Error searching:', error);
        toast({
          variant: 'destructive',
          title: t('common.error'),
          description: 'Fehler beim Suchen'
        });
      } finally {
        setLoading(false);
      }
    }, 400);

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

  const handleServiceClick = (service: ServiceWithDeviceInfo, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (service.deviceType && service.manufacturer && service.modelName) {
      // Set session storage with device info for configurator
      const navDeviceSelection = {
        deviceType: service.deviceType,
        manufacturer: service.manufacturer,
        modelName: service.modelName,
        searchQuery: `${service.manufacturer} ${service.modelName}`,
        selectedServiceId: service._id,
        selectedServiceName: service.name
      };

      sessionStorage.setItem('navDeviceSelection', JSON.stringify(navDeviceSelection));
      sessionStorage.setItem('navConfiguratorStep', '3');

      // Navigate to home and dispatch event
      window.dispatchEvent(new CustomEvent('navDeviceSelected'));
      navigate('/');

      // Close search
      setShowResults(false);
    }
  };

  return (
    <div ref={searchRef} className="w-full">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none z-10" />
        <Input
          ref={inputRef}
          type="text"
          placeholder="Gerät oder Reparatur suchen..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onFocus={() => searchTerm.trim().length >= 2 && setShowResults(true)}
          className="pl-10 pr-10 w-full bg-white border-2 border-gray-200 rounded-lg text-base placeholder-gray-400 hover:border-blue-500 focus:border-blue-500 focus:outline-none transition-colors"
          style={{ paddingLeft: '40px' }}
        />
        {searchTerm && (
          <button
            onClick={handleClearSearch}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors z-10"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Search Results Dropdown - Rendered as Portal */}
      {showResults && dropdownPosition && createPortal(
        <div
          className="bg-white border-2 border-gray-100 rounded-xl shadow-2xl z-50 overflow-y-auto max-h-96"
          style={{
            position: 'fixed',
            top: `${dropdownPosition.top}px`,
            left: `${dropdownPosition.left}px`,
            width: `${dropdownPosition.width}px`,
            minWidth: '300px',
            maxWidth: '450px'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {loading ? (
            <div className="px-6 py-12 text-center">
              <div className="inline-flex items-center gap-2 text-blue-600">
                <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin"></div>
                <span className="text-sm font-medium">Suche läuft...</span>
              </div>
            </div>
          ) : results.length > 0 ? (
            <div className="divide-y divide-gray-100">
              <div className="px-6 py-3 bg-gray-50 sticky top-0">
                <p className="text-xs font-bold text-blue-600 uppercase tracking-wider">
                  🔍 {results.length} {results.length === 1 ? 'Ergebnis' : 'Ergebnisse'} gefunden
                </p>
              </div>
              <div className="divide-y divide-gray-50">
                {results.map((result) => {
                  const isProduct = result.resultType === 'product';
                  const isService = result.resultType === 'service';

                  if (isProduct) {
                    const product = result as Product;
                    return (
                      <Link
                        key={`${result.resultType}-${result._id}`}
                        to="/shop"
                        onClick={() => setShowResults(false)}
                        className="block group"
                      >
                        <div className="p-3 hover:bg-blue-50 transition-all duration-200 flex items-center gap-3 cursor-pointer border-l-4 border-transparent hover:border-blue-400">
                          <div className="flex-shrink-0 w-12 h-12 bg-gray-100 rounded flex items-center justify-center overflow-hidden">
                            {product.images?.[0] ? (
                              <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" />
                            ) : (
                              <Package className="h-6 w-6 text-gray-400" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-sm text-gray-900 group-hover:text-blue-600 truncate">
                              {product.name}
                            </h4>
                            <p className="text-xs text-gray-500 line-clamp-1">
                              {product.brand} • {product.category}
                            </p>
                            <span className="text-sm text-yellow-600 font-bold">
                              €{product.price.toFixed(2)}
                            </span>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={!product.inStock || addingToCart === product._id}
                            onClick={(e) => handleAddToCart(product, e)}
                            className="flex-shrink-0 border-blue-200 hover:border-blue-400"
                          >
                            {addingToCart === product._id ? (
                              <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
                            ) : (
                              <ShoppingCart className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </Link>
                    );
                  } else if (isService) {
                    const service = result as ServiceWithDeviceInfo;
                    return (
                      <div
                        key={`${result.resultType}-${result._id}`}
                        onClick={(e) => handleServiceClick(service, e)}
                        className="block group"
                      >
                        <div className="p-3 hover:bg-orange-50 transition-all duration-200 flex items-center gap-3 cursor-pointer border-l-4 border-transparent hover:border-orange-400">
                          <div className="flex-shrink-0 w-12 h-12 bg-orange-100 rounded flex items-center justify-center overflow-hidden">
                            {service.modelImage ? (
                              <img src={service.modelImage} alt={service.modelName} className="w-full h-full object-cover" />
                            ) : (
                              <Wrench className="h-6 w-6 text-orange-600" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-sm text-gray-900 group-hover:text-orange-600 truncate">
                              {service.name}
                            </h4>
                            <p className="text-xs text-gray-500 line-clamp-1">
                              {service.manufacturer} • {service.modelName}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-sm text-orange-600 font-bold">
                                €{service.price.toFixed(2)}
                              </span>
                              <Badge variant="outline" className="text-xs border-orange-300 text-orange-700">
                                Reparatur
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  }
                })}
              </div>
            </div>
          ) : (
            <div className="px-6 py-12 text-center">
              <Package className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">
                Keine Ergebnisse für "{searchTerm}"
              </p>
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}
