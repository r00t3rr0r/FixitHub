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
  Zap
} from 'lucide-react';
import {
  getDeviceTypes,
  getManufacturersByDeviceType,
  getModelsByTypeAndManufacturer,
  searchDevices,
  DeviceType,
  Manufacturer,
  DeviceModel,
  SearchResult
} from '@/api/devices';
import { useToast } from '@/hooks/useToast';

interface DeviceSelectionHeroProps {
  backgroundImage?: string;
  title?: string;
  subtitle?: string;
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
          title: 'Error',
          description: 'Failed to load device types',
          variant: 'destructive'
        });
      } finally {
        setLoadingDeviceTypes(false);
      }
    };

    fetchDeviceTypes();
  }, [toast]);

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
        title: 'Error',
        description: 'Failed to load manufacturers',
        variant: 'destructive'
      });
    } finally {
      setLoadingManufacturers(false);
    }
  }, [toast]);

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
        title: 'Error',
        description: 'Failed to load models',
        variant: 'destructive'
      });
    } finally {
      setLoadingModels(false);
    }
  }, [selectedDeviceType, toast]);

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
  };

  // Handle start repair order
  const handleStartRepair = () => {
    if (!selectedDevice) {
      toast({
        title: 'No device selected',
        description: 'Please select your device first',
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
                Quick Search
              </Button>
              <Button
                variant={selectionMethod === 'dropdown' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectionMethod('dropdown')}
                className="flex items-center gap-2"
              >
                <Package className="h-4 w-4" />
                Browse by Category
              </Button>
              <Button
                variant={selectionMethod === 'filter' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectionMethod('filter')}
                className="flex items-center gap-2"
              >
                <Filter className="h-4 w-4" />
                Advanced Filter
              </Button>
            </div>

            {/* Search Method */}
            {selectionMethod === 'search' && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="deviceSearch" className="text-base font-semibold mb-2 flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-yellow-500" />
                    Search Your Device
                  </Label>
                  <div className="relative">
                    <div className="flex items-center gap-2 relative">
                      <div className="absolute left-3 text-muted-foreground">
                        <Search className="h-5 w-5" />
                      </div>
                      <Input
                        id="deviceSearch"
                        type="text"
                        placeholder="Search by device name, brand, or model (e.g., iPhone 13, Samsung Galaxy)"
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
                              Searching devices...
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
                                  <div className="text-primary">
                                    {getDeviceTypeIcon(device.deviceType)}
                                  </div>
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
                            No devices found. Try a different search term.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Type at least 2 characters to search
                  </p>
                </div>
              </div>
            )}

            {/* Dropdown Method */}
            {selectionMethod === 'dropdown' && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="deviceType" className="text-base font-semibold mb-2">
                    Select Device Type
                  </Label>
                  <Select value={selectedDeviceType} onValueChange={handleDeviceTypeSelect}>
                    <SelectTrigger className="h-12 text-base">
                      <SelectValue placeholder="Choose device type" />
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
                      Select Brand
                    </Label>
                    <Select
                      value={selectedManufacturer}
                      onValueChange={handleManufacturerSelect}
                      disabled={loadingManufacturers}
                    >
                      <SelectTrigger className="h-12 text-base">
                        <SelectValue placeholder={loadingManufacturers ? "Loading brands..." : "Choose brand"} />
                      </SelectTrigger>
                      <SelectContent>
                        {manufacturers.map((manufacturer) => (
                          <SelectItem key={manufacturer._id} value={manufacturer._id}>
                            <div className="flex items-center gap-2">
                              <span>{manufacturer.name}</span>
                              <Badge variant="secondary" className="ml-2 text-xs">
                                {manufacturer.count} models
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
                      Select Model
                    </Label>
                    <Select
                      value={selectedModel}
                      onValueChange={handleModelSelect}
                      disabled={loadingModels}
                    >
                      <SelectTrigger className="h-12 text-base">
                        <SelectValue placeholder={loadingModels ? "Loading models..." : "Choose model"} />
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
                    Filter by Device Type
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
                      Filter by Brand
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
                      Select Model
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
                  <div className="flex items-center gap-3">
                    <div className="text-primary bg-white p-2 rounded-full">
                      {getDeviceTypeIcon(selectedDevice.deviceType)}
                    </div>
                    <div>
                      <h4 className="font-semibold text-base">{selectedDevice.name}</h4>
                      <p className="text-sm text-muted-foreground">
                        {selectedDevice.deviceType} • {selectedDevice.manufacturer}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleClearSelection}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X className="h-5 w-5" />
                  </button>
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
                Start Repair Order
                <ArrowRight className="h-5 w-5 ml-2" />
              </Button>
              {!isAuthenticated && (
                <Button
                  size="lg"
                  variant="outline"
                  className="h-12 text-base font-semibold"
                  asChild
                >
                  <Link to="/login">Sign In</Link>
                </Button>
              )}
            </div>

            {/* Help Text */}
            <p className="text-xs text-center text-muted-foreground mt-4">
              Can't find your device? <Link to="/new-order" className="underline hover:text-primary">Browse all devices</Link> or <Link to="/contact" className="underline hover:text-primary">contact us</Link> for help.
            </p>
          </CardContent>
        </Card>

        {/* Trust Indicators */}
        <div className="mt-8 flex flex-wrap justify-center gap-6 text-sm text-white/90">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
              <span className="text-white font-bold">✓</span>
            </div>
            <span>Free Diagnostics</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
              <span className="text-white font-bold">✓</span>
            </div>
            <span>90-Day Warranty</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
              <span className="text-white font-bold">✓</span>
            </div>
            <span>Same-Day Service Available</span>
          </div>
        </div>
      </div>
    </section>
  );
}
