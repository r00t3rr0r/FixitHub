import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Smartphone,
  Tablet,
  Monitor,
  Watch,
  Gamepad2,
  Package,
  Search,
  X,
  ChevronRight,
  ArrowRight,
  Sparkles,
  Filter,
  Zap,
  Cpu,
  Camera,
  Check,
  Info
} from 'lucide-react';
import {
  getDeviceTypes,
  getManufacturersByDeviceType,
  getModelsByTypeAndManufacturer,
  searchDevices,
  getModelById,
  DeviceType,
  Manufacturer,
  DeviceModel,
  SearchResult
} from '@/api/devices';
import { useToast } from '@/hooks/useToast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface DeviceSelectionHeroProps {
  backgroundImage?: string;
  title?: string;
  subtitle?: string;
}

interface SelectedDeviceWithDetails extends SelectedDevice {
  details?: any;
}

const getDeviceTypeIcon = (deviceType: string) => {
  switch (deviceType.toLowerCase()) {
    case 'smartphone':
      return <Smartphone className="h-5 w-5" />;
    case 'tablet':
      return <Tablet className="h-5 w-5" />;
    case 'laptop':
      return <Monitor className="h-5 w-5" />;
    case 'smartwatch':
      return <Watch className="h-5 w-5" />;
    case 'gaming-console':
      return <Gamepad2 className="h-5 w-5" />;
    default:
      return <Package className="h-5 w-5" />;
  }
};

export function DeviceSelectionHero({
  backgroundImage = 'https://www.mcrepair.de/bilder/home/banner/home_banner.jpg',
  title,
  subtitle
}: DeviceSelectionHeroProps) {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  // Selection method state
  const [selectionMethod, setSelectionMethod] = useState<'search' | 'dropdown' | 'filter'>('search');

  // Device data state
  const [deviceTypes, setDeviceTypes] = useState<DeviceType[]>([]);
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([]);
  const [models, setModels] = useState<DeviceModel[]>([]);

  // Selection state
  const [selectedDeviceType, setSelectedDeviceType] = useState<string>('');
  const [selectedManufacturer, setSelectedManufacturer] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<string>('');

  // Search state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);

  // Loading states
  const [loadingDeviceTypes, setLoadingDeviceTypes] = useState(false);
  const [loadingManufacturers, setLoadingManufacturers] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);

  // Selected device for display
  const [selectedDevice, setSelectedDevice] = useState<{
    _id: string;
    name: string;
    deviceType: string;
    manufacturer: string;
    manufacturerId: string;
  } | null>(null);

  // Device details modal state
  const [showDeviceDetailsModal, setShowDeviceDetailsModal] = useState(false);
  const [selectedDeviceDetails, setSelectedDeviceDetails] = useState<DeviceModel | null>(null);
  const [loadingDeviceDetails, setLoadingDeviceDetails] = useState(false);

  // Track broken device images
  const [brokenImages, setBrokenImages] = useState<Set<string>>(new Set());

  const defaultTitle = t('home.hero.title');
  const defaultSubtitle = t('home.hero.subtitle');

  // Fetch device types on mount
  useEffect(() => {
    const fetchDeviceTypes = async () => {
      try {
        setLoadingDeviceTypes(true);
        console.log('Fetching device types...');
        const response = await getDeviceTypes();
        setDeviceTypes((response as any).deviceTypes || []);
      } catch (error) {
        console.error('Error fetching device types:', error);
        toast({
          title: t('common.error'),
          description: t('home.deviceSelection.failedToLoadDeviceTypes'),
          variant: 'destructive'
        });
      } finally {
        setLoadingDeviceTypes(false);
      }
    };

    fetchDeviceTypes();
  }, [toast, t]);

  // Handle device search
  const handleDeviceSearch = useCallback(async (query: string) => {
    setSearchQuery(query);

    if (query.length < 2) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    try {
      setSearching(true);
      setShowSearchResults(true);
      console.log('Searching devices with query:', query);

      const response = await searchDevices(query);
      setSearchResults((response as any).devices || []);
    } catch (error) {
      console.error('Error searching devices:', error);
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  // Handle device selection from search
  const handleSelectDeviceFromSearch = useCallback((device: SearchResult) => {
    console.log('Device selected from search:', device);

    setSelectedDevice({
      _id: device._id,
      name: device.name,
      deviceType: device.deviceType,
      manufacturer: device.manufacturer,
      manufacturerId: device.manufacturerId
    });

    setSearchQuery(device.displayName);
    setShowSearchResults(false);
    setSearchResults([]);
  }, []);

  // Handle device type selection (dropdown/filter method)
  const handleDeviceTypeSelect = useCallback(async (deviceTypeId: string) => {
    setSelectedDeviceType(deviceTypeId);
    setSelectedManufacturer('');
    setSelectedModel('');
    setManufacturers([]);
    setModels([]);
    setSelectedDevice(null);

    try {
      setLoadingManufacturers(true);
      console.log('Fetching manufacturers for device type:', deviceTypeId);
      const response = await getManufacturersByDeviceType(deviceTypeId);
      setManufacturers((response as any).manufacturers || []);
    } catch (error) {
      console.error('Error fetching manufacturers:', error);
      toast({
        title: t('common.error'),
        description: t('home.deviceSelection.failedToLoadManufacturers'),
        variant: 'destructive'
      });
    } finally {
      setLoadingManufacturers(false);
    }
  }, [toast, t]);

  // Handle manufacturer selection
  const handleManufacturerSelect = useCallback(async (manufacturerId: string) => {
    setSelectedManufacturer(manufacturerId);
    setSelectedModel('');
    setModels([]);
    setSelectedDevice(null);

    try {
      setLoadingModels(true);
      console.log('Fetching models for device type and manufacturer:', selectedDeviceType, manufacturerId);
      const response = await getModelsByTypeAndManufacturer(selectedDeviceType, manufacturerId);
      setModels((response as any).models || []);
    } catch (error) {
      console.error('Error fetching models:', error);
      toast({
        title: t('common.error'),
        description: t('home.deviceSelection.failedToLoadModels'),
        variant: 'destructive'
      });
    } finally {
      setLoadingModels(false);
    }
  }, [selectedDeviceType, toast, t]);

  // Handle model selection
  const handleModelSelect = useCallback((modelId: string) => {
    setSelectedModel(modelId);

    // Find the selected model details
    const model = models.find(m => m._id === modelId);
    const manufacturer = manufacturers.find(m => m._id === selectedManufacturer);
    const deviceType = deviceTypes.find(dt => dt._id === selectedDeviceType);

    if (model && manufacturer && deviceType) {
      setSelectedDevice({
        _id: model._id,
        name: model.name,
        deviceType: deviceType.name,
        manufacturer: manufacturer.name,
        manufacturerId: manufacturer._id
      });
    }
  }, [models, manufacturers, deviceTypes, selectedManufacturer, selectedDeviceType]);

  // Handle clear selection
  const handleClearSelection = () => {
    setSelectedDevice(null);
    setSearchQuery('');
    setSelectedDeviceType('');
    setSelectedManufacturer('');
    setSelectedModel('');
    setManufacturers([]);
    setModels([]);
    setSearchResults([]);
    setShowDeviceDetailsModal(false);
    setSelectedDeviceDetails(null);
  };

  // Handle view device details
  const handleViewDeviceDetails = useCallback(async () => {
    if (!selectedDevice) return;

    try {
      setLoadingDeviceDetails(true);
      console.log('Fetching device details for:', selectedDevice._id);
      const response = await getModelById(selectedDevice._id);
      const details = (response as any).model || response;
      setSelectedDeviceDetails(details);
      setShowDeviceDetailsModal(true);
    } catch (error) {
      console.error('Error fetching device details:', error);
      toast({
        title: t('common.error'),
        description: t('home.deviceSelection.failedToLoadDeviceDetails'),
        variant: 'destructive'
      });
    } finally {
      setLoadingDeviceDetails(false);
    }
  }, [selectedDevice, toast, t]);

  // Handle start repair order
  const handleStartRepair = () => {
    if (!selectedDevice) {
      toast({
        title: t('home.deviceSelection.noDeviceSelected'),
        description: t('home.deviceSelection.pleaseSelectDevice'),
        variant: 'destructive'
      });
      return;
    }

    // Store selected device in session storage to pre-fill the new order form
    sessionStorage.setItem('selectedDevice', JSON.stringify(selectedDevice));

    // Navigate to new order page
    navigate('/new-order');
  };

  return (
    <section
      className="relative py-20 px-4 text-white overflow-hidden"
      style={{
        backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.6), rgba(0, 0, 0, 0.7)), url('${backgroundImage}')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed'
      }}
    >
      <div className="container mx-auto max-w-6xl">
        {/* Main Headline */}
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4 leading-tight drop-shadow-lg">
            {title || defaultTitle}
          </h1>
          <p className="text-base md:text-lg lg:text-xl text-gray-100 drop-shadow-md leading-relaxed max-w-2xl mx-auto">
            {subtitle || defaultSubtitle}
          </p>
        </div>

        {/* Device Selection Card */}
        <Card className="bg-white/95 backdrop-blur shadow-2xl border-none">
          <CardContent className="p-6 md:p-8">
            {/* Selection Method Tabs */}
            <div className="flex flex-wrap gap-2 mb-6">
              <Button
                variant={selectionMethod === 'search' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectionMethod('search')}
                className="flex items-center gap-2"
              >
                <Search className="h-4 w-4" />
                {t('home.deviceSelection.quickSearch')}
              </Button>
              <Button
                variant={selectionMethod === 'dropdown' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectionMethod('dropdown')}
                className="flex items-center gap-2"
              >
                <Package className="h-4 w-4" />
                {t('home.deviceSelection.browseByCategory')}
              </Button>
              <Button
                variant={selectionMethod === 'filter' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectionMethod('filter')}
                className="flex items-center gap-2"
              >
                <Filter className="h-4 w-4" />
                {t('home.deviceSelection.advancedFilter')}
              </Button>
            </div>

            {/* Search Method */}
            {selectionMethod === 'search' && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="deviceSearch" className="text-base font-semibold mb-2 flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-yellow-500" />
                    {t('home.deviceSelection.searchYourDevice')}
                  </Label>
                  <div className="relative">
                    <div className="flex items-center gap-2 relative">
                      <div className="absolute left-3 text-muted-foreground">
                        <Search className="h-5 w-5" />
                      </div>
                      <Input
                        id="deviceSearch"
                        type="text"
                        placeholder={t('home.deviceSelection.searchPlaceholder')}
                        value={searchQuery}
                        onChange={(e) => handleDeviceSearch(e.target.value)}
                        onFocus={() => searchResults.length > 0 && setShowSearchResults(true)}
                        className="pl-11 pr-10 h-12 text-base"
                        autoComplete="off"
                      />
                      {selectedDevice && (
                        <button
                          type="button"
                          onClick={handleClearSelection}
                          className="absolute right-3 text-muted-foreground hover:text-foreground"
                        >
                          <X className="h-5 w-5" />
                        </button>
                      )}
                    </div>

                    {/* Search Results Dropdown */}
                    {showSearchResults && searchQuery.length >= 2 && (
                      <div className="absolute top-full left-0 right-0 mt-2 bg-white border rounded-lg shadow-xl z-50 max-h-80 overflow-y-auto">
                        {searching ? (
                          <div className="p-6 text-center text-muted-foreground">
                            <div className="animate-pulse flex items-center justify-center gap-2">
                              <Search className="h-5 w-5 animate-spin" />
                              {t('home.deviceSelection.searchingDevices')}
                            </div>
                          </div>
                        ) : searchResults.length > 0 ? (
                          <div className="py-2">
                            {searchResults.map((device) => (
                              <button
                                key={device._id}
                                type="button"
                                onClick={() => handleSelectDeviceFromSearch(device)}
                                className="w-full text-left px-4 py-3 hover:bg-accent transition-colors flex items-center justify-between group"
                              >
                                <div className="flex items-center gap-3">
                                  {device.image && !brokenImages.has(device._id) ? (
                                    <div className="w-10 h-10 rounded-lg overflow-hidden bg-yellow-100 dark:bg-yellow-900/30 flex-shrink-0 group-hover:scale-110 transition-transform border border-yellow-200 dark:border-yellow-800 flex items-center justify-center">
                                      <img
                                        src={device.image}
                                        alt={device.name}
                                        className="w-full h-full object-cover"
                                        onError={() => {
                                          console.log(`Device image failed to load for: ${device.name}`);
                                          setBrokenImages(prev => new Set([...prev, device._id]));
                                        }}
                                      />
                                    </div>
                                  ) : (
                                    <div className="p-2 bg-gradient-to-br from-yellow-100 to-yellow-200 dark:from-yellow-900/30 dark:to-yellow-800/30 rounded-lg group-hover:scale-110 transition-transform">
                                      {getDeviceTypeIcon(device.deviceType)}
                                    </div>
                                  )}
                                  <div>
                                    <div className="font-medium text-sm">{device.name}</div>
                                    <div className="text-xs text-muted-foreground">
                                      {device.displayName}
                                    </div>
                                  </div>
                                </div>
                                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                              </button>
                            ))}
                          </div>
                        ) : (
                          <div className="p-6 text-center text-muted-foreground text-sm">
                            {t('home.deviceSelection.noDevicesFound')}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    {t('home.deviceSelection.searchMinChars')}
                  </p>
                </div>
              </div>
            )}

            {/* Dropdown Method */}
            {selectionMethod === 'dropdown' && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="deviceType" className="text-base font-semibold mb-2">
                    {t('home.deviceSelection.selectDeviceType')}
                  </Label>
                  <Select value={selectedDeviceType} onValueChange={handleDeviceTypeSelect}>
                    <SelectTrigger className="h-12 text-base">
                      <SelectValue placeholder={t('home.deviceSelection.chooseDeviceType')} />
                    </SelectTrigger>
                    <SelectContent>
                      {deviceTypes.map((type) => (
                        <SelectItem key={type._id} value={type._id}>
                          <div className="flex items-center gap-2">
                            {getDeviceTypeIcon(type.name)}
                            <span>{type.name}</span>
                            <Badge variant="secondary" className="ml-2 text-xs">
                              {type.count}
                            </Badge>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedDeviceType && (
                  <div>
                    <Label htmlFor="manufacturer" className="text-base font-semibold mb-2">
                      {t('home.deviceSelection.selectBrand')}
                    </Label>
                    <Select
                      value={selectedManufacturer}
                      onValueChange={handleManufacturerSelect}
                      disabled={loadingManufacturers}
                    >
                      <SelectTrigger className="h-12 text-base">
                        <SelectValue placeholder={loadingManufacturers ? t('home.deviceSelection.loadingBrands') : t('home.deviceSelection.chooseBrand')} />
                      </SelectTrigger>
                      <SelectContent>
                        {manufacturers.map((manufacturer) => (
                          <SelectItem key={manufacturer._id} value={manufacturer._id}>
                            <div className="flex items-center gap-2">
                              <span>{manufacturer.name}</span>
                              <Badge variant="secondary" className="ml-2 text-xs">
                                {manufacturer.count} {t('home.deviceSelection.models')}
                              </Badge>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {selectedManufacturer && (
                  <div>
                    <Label htmlFor="model" className="text-base font-semibold mb-2">
                      {t('home.deviceSelection.selectModel')}
                    </Label>
                    <Select
                      value={selectedModel}
                      onValueChange={handleModelSelect}
                      disabled={loadingModels}
                    >
                      <SelectTrigger className="h-12 text-base">
                        <SelectValue placeholder={loadingModels ? t('home.deviceSelection.loadingModels') : t('home.deviceSelection.chooseModel')} />
                      </SelectTrigger>
                      <SelectContent>
                        {models.map((model) => (
                          <SelectItem key={model._id} value={model._id}>
                            {model.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            )}

            {/* Filter Method */}
            {selectionMethod === 'filter' && (
              <div className="space-y-4">
                {/* Device Type Filter Chips */}
                <div>
                  <Label className="text-base font-semibold mb-3 block">
                    {t('home.deviceSelection.filterByDeviceType')}
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    {deviceTypes.map((type) => (
                      <Badge
                        key={type._id}
                        variant={selectedDeviceType === type._id ? 'default' : 'outline'}
                        className="cursor-pointer px-4 py-2 text-sm hover:bg-primary/90 transition-colors"
                        onClick={() => handleDeviceTypeSelect(type._id)}
                      >
                        <div className="flex items-center gap-2">
                          {getDeviceTypeIcon(type.name)}
                          <span>{type.name}</span>
                          <span className="ml-1 text-xs opacity-70">({type.count})</span>
                        </div>
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Manufacturer Filter Chips */}
                {selectedDeviceType && manufacturers.length > 0 && (
                  <div>
                    <Label className="text-base font-semibold mb-3 block">
                      {t('home.deviceSelection.filterByBrand')}
                    </Label>
                    <div className="flex flex-wrap gap-2">
                      {manufacturers.map((manufacturer) => (
                        <Badge
                          key={manufacturer._id}
                          variant={selectedManufacturer === manufacturer._id ? 'default' : 'outline'}
                          className="cursor-pointer px-4 py-2 text-sm hover:bg-primary/90 transition-colors"
                          onClick={() => handleManufacturerSelect(manufacturer._id)}
                        >
                          {manufacturer.name} ({manufacturer.count})
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Model Selection Grid */}
                {selectedManufacturer && models.length > 0 && (
                  <div>
                    <Label className="text-base font-semibold mb-3 block">
                      {t('home.deviceSelection.selectModel')}
                    </Label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-60 overflow-y-auto">
                      {models.map((model) => (
                        <Button
                          key={model._id}
                          variant={selectedModel === model._id ? 'default' : 'outline'}
                          className="h-auto py-3 text-left justify-start"
                          onClick={() => handleModelSelect(model._id)}
                        >
                          {model.name}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Selected Device Display */}
            {selectedDevice && (
              <div className="mt-6 p-4 bg-gradient-to-br from-primary/10 to-secondary/10 rounded-lg border-2 border-primary/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="text-primary bg-white p-2 rounded-full">
                      {getDeviceTypeIcon(selectedDevice.deviceType)}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-base">{selectedDevice.name}</h4>
                      <p className="text-sm text-muted-foreground">
                        {selectedDevice.deviceType} • {selectedDevice.manufacturer}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleViewDeviceDetails}
                      disabled={loadingDeviceDetails}
                      className="flex items-center gap-2"
                    >
                      <Info className="h-4 w-4" />
                      {t('home.deviceSelection.viewDetails')}
                    </Button>
                    <button
                      type="button"
                      onClick={handleClearSelection}
                      className="text-muted-foreground hover:text-foreground transition-colors p-1"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <Button
                size="lg"
                className="flex-1 h-12 text-base font-semibold bg-yellow-400 hover:bg-yellow-500 text-gray-900"
                onClick={handleStartRepair}
                disabled={!selectedDevice}
              >
                <Zap className="h-5 w-5 mr-2" />
                {t('home.deviceSelection.startRepairOrder')}
                <ArrowRight className="h-5 w-5 ml-2" />
              </Button>
              {!isAuthenticated && (
                <Button
                  size="lg"
                  variant="outline"
                  className="h-12 text-base font-semibold"
                  asChild
                >
                  <Link to="/login">{t('home.deviceSelection.signIn')}</Link>
                </Button>
              )}
            </div>

            {/* Help Text */}
            <p className="text-xs text-center text-muted-foreground mt-4">
              {t('home.deviceSelection.cantFindDevice')} <Link to="/new-order" className="underline hover:text-primary">{t('home.deviceSelection.browseAllDevices')}</Link> {t('home.deviceSelection.orText')} <Link to="/contact" className="underline hover:text-primary">{t('home.deviceSelection.contactUsForHelp')}</Link>.
            </p>
          </CardContent>
        </Card>

        {/* Trust Indicators */}
        <div className="mt-8 flex flex-wrap justify-center gap-6 text-sm text-white/90">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
              <span className="text-white font-bold">✓</span>
            </div>
            <span>{t('home.deviceSelection.freeDiagnostics')}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
              <span className="text-white font-bold">✓</span>
            </div>
            <span>{t('home.deviceSelection.warranty90Days')}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
              <span className="text-white font-bold">✓</span>
            </div>
            <span>{t('home.deviceSelection.sameDayService')}</span>
          </div>
        </div>
      </div>

      {/* Device Details Modal */}
      <Dialog open={showDeviceDetailsModal} onOpenChange={setShowDeviceDetailsModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <div className="text-primary bg-primary/10 p-2 rounded-lg">
                {selectedDevice && getDeviceTypeIcon(selectedDevice.deviceType)}
              </div>
              {selectedDevice?.name}
            </DialogTitle>
            <DialogDescription>
              {selectedDevice?.manufacturer} • {selectedDevice?.deviceType}
            </DialogDescription>
          </DialogHeader>

          {loadingDeviceDetails ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin">
                <Package className="h-8 w-8 text-primary" />
              </div>
              <span className="ml-3 text-muted-foreground">{t('common.loading')}</span>
            </div>
          ) : selectedDeviceDetails ? (
            <div className="space-y-6 mt-4">
              {/* Device Image */}
              {selectedDeviceDetails.image && (
                <div className="flex justify-center mb-6">
                  <div className="w-56 h-56 rounded-xl overflow-hidden border-2 border-gray-200 dark:border-gray-700 shadow-md flex items-center justify-center bg-gray-100 dark:bg-gray-900">
                    <img
                      src={selectedDeviceDetails.image}
                      alt={selectedDeviceDetails.name}
                      className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none'
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Basic Information */}
              {(selectedDeviceDetails.other?.releaseDate || selectedDeviceDetails.other?.price || selectedDeviceDetails.other?.colors) && (
                <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-600"></div>
                    {t('home.deviceSelection.basicInformation')}
                  </h3>
                  <div className="space-y-2 text-sm">
                    {selectedDeviceDetails.other?.releaseDate && (
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">{t('home.deviceSelection.releaseDate')}:</span>
                        <span className="font-medium">{selectedDeviceDetails.other.releaseDate}</span>
                      </div>
                    )}
                    {selectedDeviceDetails.other?.price && (
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">{t('home.deviceSelection.price')}:</span>
                        <span className="font-medium">{selectedDeviceDetails.other.price}</span>
                      </div>
                    )}
                    {selectedDeviceDetails.other?.colors && selectedDeviceDetails.other.colors.length > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">{t('home.deviceSelection.availableColors')}:</span>
                        <div className="flex gap-1">
                          {selectedDeviceDetails.other.colors.map((color, idx) => (
                            <Badge key={idx} variant="secondary" className="text-xs">
                              {color}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Display Information */}
              {selectedDeviceDetails.display && Object.values(selectedDeviceDetails.display).some(v => v) && (
                <div className="p-4 bg-purple-50 dark:bg-purple-950/20 rounded-lg border border-purple-200 dark:border-purple-800">
                  <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
                    <Monitor className="h-4 w-4 text-purple-600" />
                    {t('home.deviceSelection.display')}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                    {selectedDeviceDetails.display.type && <div><span className="text-gray-600 dark:text-gray-400">{t('home.deviceSelection.type')}:</span> <span className="font-medium">{selectedDeviceDetails.display.type}</span></div>}
                    {selectedDeviceDetails.display.size && <div><span className="text-gray-600 dark:text-gray-400">{t('home.deviceSelection.size')}:</span> <span className="font-medium">{selectedDeviceDetails.display.size}</span></div>}
                    {selectedDeviceDetails.display.resolution && <div><span className="text-gray-600 dark:text-gray-400">{t('home.deviceSelection.resolution')}:</span> <span className="font-medium">{selectedDeviceDetails.display.resolution}</span></div>}
                    {selectedDeviceDetails.display.protection && <div><span className="text-gray-600 dark:text-gray-400">{t('home.deviceSelection.protection')}:</span> <span className="font-medium">{selectedDeviceDetails.display.protection}</span></div>}
                  </div>
                </div>
              )}

              {/* Device Type & Platform */}
              {selectedDeviceDetails.physical && Object.values(selectedDeviceDetails.physical).some(v => v) && (
                <div className="p-4 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                  <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
                    <Package className="h-4 w-4 text-yellow-600" />
                    {t('home.deviceSelection.deviceType')}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                    {selectedDeviceDetails.physical.dimensions && <div><span className="text-gray-600 dark:text-gray-400">{t('home.deviceSelection.dimensions')}:</span> <span className="font-medium">{selectedDeviceDetails.physical.dimensions}</span></div>}
                    {selectedDeviceDetails.physical.weight && <div><span className="text-gray-600 dark:text-gray-400">{t('home.deviceSelection.weight')}:</span> <span className="font-medium">{selectedDeviceDetails.physical.weight}</span></div>}
                    {selectedDeviceDetails.physical.build && <div><span className="text-gray-600 dark:text-gray-400">{t('home.deviceSelection.build')}:</span> <span className="font-medium">{selectedDeviceDetails.physical.build}</span></div>}
                  </div>
                </div>
              )}

              {/* Platform & Performance */}
              {selectedDeviceDetails.platform && Object.values(selectedDeviceDetails.platform).some(v => v) && (
                <div className="p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                  <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
                    <Cpu className="h-4 w-4 text-green-600" />
                    {t('home.deviceSelection.platformPerformance')}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                    {selectedDeviceDetails.platform.os && <div><span className="text-gray-600 dark:text-gray-400">OS:</span> <span className="font-medium">{selectedDeviceDetails.platform.os}</span></div>}
                    {selectedDeviceDetails.platform.chipset && <div><span className="text-gray-600 dark:text-gray-400">{t('home.deviceSelection.chipset')}:</span> <span className="font-medium">{selectedDeviceDetails.platform.chipset}</span></div>}
                    {selectedDeviceDetails.platform.cpu && <div><span className="text-gray-600 dark:text-gray-400">CPU:</span> <span className="font-medium">{selectedDeviceDetails.platform.cpu}</span></div>}
                    {selectedDeviceDetails.platform.gpu && <div><span className="text-gray-600 dark:text-gray-400">GPU:</span> <span className="font-medium">{selectedDeviceDetails.platform.gpu}</span></div>}
                  </div>
                </div>
              )}

              {/* Camera */}
              {(selectedDeviceDetails.rearCamera || selectedDeviceDetails.frontCamera) && (Object.values(selectedDeviceDetails.rearCamera || {}).some(v => v) || Object.values(selectedDeviceDetails.frontCamera || {}).some(v => v)) && (
                <div className="p-4 bg-indigo-50 dark:bg-indigo-950/20 rounded-lg border border-indigo-200 dark:border-indigo-800">
                  <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
                    <Camera className="h-4 w-4 text-indigo-600" />
                    {t('home.deviceSelection.camera')}
                  </h3>
                  <div className="space-y-3">
                    {selectedDeviceDetails.rearCamera && Object.values(selectedDeviceDetails.rearCamera).some(v => v) && (
                      <div>
                        <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">{t('home.deviceSelection.rearCamera')}:</p>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          {selectedDeviceDetails.rearCamera.modules && <p>{selectedDeviceDetails.rearCamera.modules}</p>}
                          {selectedDeviceDetails.rearCamera.features && <p>{selectedDeviceDetails.rearCamera.features}</p>}
                        </div>
                      </div>
                    )}
                    {selectedDeviceDetails.frontCamera && Object.values(selectedDeviceDetails.frontCamera).some(v => v) && (
                      <div>
                        <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">{t('home.deviceSelection.frontCamera')}:</p>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          {selectedDeviceDetails.frontCamera.modules && <p>{selectedDeviceDetails.frontCamera.modules}</p>}
                          {selectedDeviceDetails.frontCamera.features && <p>{selectedDeviceDetails.frontCamera.features}</p>}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Features & Additional Info */}
              {selectedDeviceDetails.features && (Object.values(selectedDeviceDetails.features).some(v => v)) && (
                <div className="p-4 bg-violet-50 dark:bg-violet-950/20 rounded-lg border border-violet-200 dark:border-violet-800">
                  <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
                    <Check className="h-4 w-4 text-violet-600" />
                    {t('home.deviceSelection.features')}
                  </h3>
                  <div className="space-y-2 text-sm">
                    {selectedDeviceDetails.features.sensors && <p><span className="text-gray-600 dark:text-gray-400">{t('home.deviceSelection.sensors')}:</span> {selectedDeviceDetails.features.sensors}</p>}
                    {selectedDeviceDetails.features.special && selectedDeviceDetails.features.special.length > 0 && (
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">{t('home.deviceSelection.specialFeatures')}:</span>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {selectedDeviceDetails.features.special.map((feature, idx) => (
                            <Badge key={idx} variant="secondary" className="text-xs">{feature}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 mt-6">
                <Button
                  size="lg"
                  className="flex-1 bg-yellow-400 hover:bg-yellow-500 text-gray-900"
                  onClick={() => {
                    setShowDeviceDetailsModal(false);
                    handleStartRepair();
                  }}
                >
                  <Zap className="h-5 w-5 mr-2" />
                  {t('home.deviceSelection.startRepairOrder')}
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => setShowDeviceDetailsModal(false)}
                >
                  {t('common.close')}
                </Button>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground">
              {t('home.deviceSelection.failedToLoadDeviceDetails')}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
