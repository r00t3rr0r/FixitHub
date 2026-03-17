import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Wrench, 
  Smartphone, 
  Tablet, 
  Monitor, 
  Gamepad2,
  ChevronRight,
  ChevronLeft,
  Check,
  Clock,
  Shield,
  Upload,
  Package,
  AlertCircle
} from 'lucide-react';
import {
  getDeviceTypes,
  getManufacturersByDeviceType,
  getModelsByTypeAndManufacturer,
  DeviceType,
  Manufacturer,
  DeviceModel
} from '@/api/devices';
import { getServices, getAddOnServices, RepairService, AddOnService } from '@/api/services';
import { useToast } from '@/hooks/useToast';

interface RepairOrderConfiguratorProps {
  onComplete?: (orderData: any) => void;
}

const getDeviceIcon = (deviceType: string) => {
  const type = deviceType.toLowerCase();
  if (type.includes('smartphone') || type.includes('phone')) return Smartphone;
  if (type.includes('tablet')) return Tablet;
  if (type.includes('laptop') || type.includes('notebook')) return Monitor;
  if (type.includes('konsole') || type.includes('console') || type.includes('gaming')) return Gamepad2;
  return Package;
};

// Device images based on device type
const deviceImages: Record<string, string> = {
  smartphone: '/images/smartphone_mu.png',
  tablet: '/images/tablet_mu.png',
  notebook: '/images/notebook_mu.png',
  laptop: '/images/notebook_mu.png',
  konsole: '/images/console_mu.png',
  'gaming-console': '/images/console_mu.png',
};

// Common problems per device type
const deviceProblems: Record<string, string[]> = {
  smartphone: [
    'Akku verliert schnell an Leistung',
    'Display reagiert verzögert',
    'Ladebuchse wackelt',
    'Kamera fokussiert unscharf',
  ],
  tablet: [
    'Touchscreen reagiert ungenau',
    'Akku entlädt sich schnell',
    'Display-Helligkeit schwankt',
    'WLAN-Verbindung instabil',
  ],
  notebook: [
    'Lüfter läuft dauerhaft laut',
    'Akku hält nur kurz',
    'Gerät überhitzt schnell',
    'Tastatur reagiert verzögert',
  ],
  laptop: [
    'Lüfter läuft dauerhaft laut',
    'Akku hält nur kurz',
    'Gerät überhitzt schnell',
    'Tastatur reagiert verzögert',
  ],
  konsole: [
    'HDMI-Ausgang ohne Signal',
    'Konsole wird sehr laut',
    'Laufwerk liest Discs nicht',
    'Gerät startet nicht zuverlässig',
  ],
  'gaming-console': [
    'HDMI-Ausgang ohne Signal',
    'Konsole wird sehr laut',
    'Laufwerk liest Discs nicht',
    'Gerät startet nicht zuverlässig',
  ],
};

export function RepairOrderConfigurator({ onComplete }: RepairOrderConfiguratorProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const navigate = useNavigate();

  // Configurator state
  const [currentStep, setCurrentStep] = useState(1);

  // Data states
  const [deviceTypes, setDeviceTypes] = useState<DeviceType[]>([]);
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([]);
  const [models, setModels] = useState<DeviceModel[]>([]);
  const [repairServices, setRepairServices] = useState<RepairService[]>([]);
  const [addOnServices, setAddOnServices] = useState<AddOnService[]>([]);

  // Selection states
  const [selectedDeviceType, setSelectedDeviceType] = useState<DeviceType | null>(null);
  const [selectedBrand, setSelectedBrand] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<DeviceModel | null>(null);
  const [selectedRepairs, setSelectedRepairs] = useState<RepairService[]>([]);
  const [selectedAddOns, setSelectedAddOns] = useState<AddOnService[]>([]);

  // Loading states
  const [loadingDeviceTypes, setLoadingDeviceTypes] = useState(false);
  const [loadingManufacturers, setLoadingManufacturers] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);
  const [loadingRepairs, setLoadingRepairs] = useState(false);
  const [loadingAddOns, setLoadingAddOns] = useState(false);

  // Model search/filter
  const [modelSearchQuery, setModelSearchQuery] = useState('');
  const [filteredModels, setFilteredModels] = useState<DeviceModel[]>([]);
  const [showModelDropdown, setShowModelDropdown] = useState(false);

  // Fetch device types on mount
  useEffect(() => {
    const fetchDeviceTypes = async () => {
      try {
        setLoadingDeviceTypes(true);
        const response = await getDeviceTypes();
        setDeviceTypes((response as any).deviceTypes || []);
      } catch (error) {
        console.error('Error fetching device types:', error);
        toast({
          title: t('common.error'),
          description: 'Fehler beim Laden der Gerätetypen',
          variant: 'destructive'
        });
      } finally {
        setLoadingDeviceTypes(false);
      }
    };

    fetchDeviceTypes();
  }, [toast, t]);

  // Handle device type selection
  const handleDeviceTypeSelect = async (deviceType: DeviceType) => {
    setSelectedDeviceType(deviceType);
    setSelectedBrand('');
    setSelectedModel(null);
    setManufacturers([]);
    setModels([]);

    try {
      setLoadingManufacturers(true);
      const response = await getManufacturersByDeviceType(deviceType._id);
      setManufacturers((response as any).manufacturers || []);
    } catch (error) {
      console.error('Error fetching manufacturers:', error);
      toast({
        title: t('common.error'),
        description: 'Fehler beim Laden der Marken',
        variant: 'destructive'
      });
    } finally {
      setLoadingManufacturers(false);
    }
  };

  // Handle brand selection
  const handleBrandSelect = async (brandId: string) => {
    setSelectedBrand(brandId);
    setSelectedModel(null);
    setModels([]);
    setModelSearchQuery('');

    if (!selectedDeviceType) return;

    try {
      setLoadingModels(true);
      const response = await getModelsByTypeAndManufacturer(selectedDeviceType._id, brandId);
      const modelsList = (response as any).models || [];
      setModels(modelsList);
      setFilteredModels(modelsList);
    } catch (error) {
      console.error('Error fetching models:', error);
      toast({
        title: t('common.error'),
        description: 'Fehler beim Laden der Modelle',
        variant: 'destructive'
      });
    } finally {
      setLoadingModels(false);
    }
  };

  // Handle model search/filter
  useEffect(() => {
    if (modelSearchQuery.length < 1) {
      setFilteredModels(models);
      return;
    }

    const filtered = models.filter(model =>
      model.name.toLowerCase().includes(modelSearchQuery.toLowerCase())
    );
    setFilteredModels(filtered);
  }, [modelSearchQuery, models]);

  // Handle model selection
  const handleModelSelect = (model: DeviceModel) => {
    setSelectedModel(model);
    setModelSearchQuery(model.name);
    setShowModelDropdown(false);
  };

  // Load repair services when moving to step 3
  useEffect(() => {
    if (currentStep === 3 && selectedModel && selectedDeviceType) {
      const fetchRepairServices = async () => {
        try {
          setLoadingRepairs(true);
          const response = await getServices({ 
            deviceType: selectedDeviceType.name,
            limit: 100 
          });
          setRepairServices((response as any).services || []);
        } catch (error) {
          console.error('Error fetching repair services:', error);
          toast({
            title: t('common.error'),
            description: 'Fehler beim Laden der Reparaturen',
            variant: 'destructive'
          });
        } finally {
          setLoadingRepairs(false);
        }
      };

      fetchRepairServices();
    }
  }, [currentStep, selectedModel, selectedDeviceType, toast, t]);

  // Load add-on services when moving to step 4
  useEffect(() => {
    if (currentStep === 4) {
      const fetchAddOnServices = async () => {
        try {
          setLoadingAddOns(true);
          const response = await getAddOnServices({ 
            deviceType: selectedDeviceType?.name,
            limit: 100 
          });
          setAddOnServices((response as any).addOns || []);
        } catch (error) {
          console.error('Error fetching add-on services:', error);
          toast({
            title: t('common.error'),
            description: 'Fehler beim Laden der Zusatzleistungen',
            variant: 'destructive'
          });
        } finally {
          setLoadingAddOns(false);
        }
      };

      fetchAddOnServices();
    }
  }, [currentStep, selectedDeviceType, toast, t]);

  // Handle repair selection
  const toggleRepairSelection = (service: RepairService) => {
    setSelectedRepairs(prev => {
      const isSelected = prev.find(s => s._id === service._id);
      if (isSelected) {
        return prev.filter(s => s._id !== service._id);
      } else {
        return [...prev, service];
      }
    });
  };

  // Handle add-on selection
  const toggleAddOnSelection = (addon: AddOnService) => {
    setSelectedAddOns(prev => {
      const isSelected = prev.find(s => s._id === addon._id);
      if (isSelected) {
        return prev.filter(s => s._id !== addon._id);
      } else {
        return [...prev, addon];
      }
    });
  };

  // Calculate totals
  const calculateTotals = () => {
    const repairTotal = selectedRepairs.reduce((sum, service) => sum + service.price, 0);
    const addOnTotal = selectedAddOns.reduce((sum, addon) => sum + addon.price, 0);
    const total = repairTotal + addOnTotal;

    // Calculate estimated duration (simplified - take max)
    const allServices = [...selectedRepairs, ...selectedAddOns];
    const durations = allServices.map(s => {
      const match = s.estimatedTime.match(/\d+/);
      return match ? parseInt(match[0]) : 0;
    });
    const maxDays = Math.max(...durations, 0);
    const duration = maxDays > 0 ? `${maxDays} ${maxDays === 1 ? 'Tag' : 'Tage'}` : '1-3 Werktage';

    return { repairTotal, addOnTotal, total, duration };
  };

  // Navigate to next step
  const goToNextStep = () => {
    if (currentStep === 2 && !selectedModel) {
      toast({
        title: 'Modell wählen',
        description: 'Bitte wählen Sie ein Modell aus.',
        variant: 'destructive'
      });
      return;
    }
    if (currentStep === 3 && selectedRepairs.length === 0) {
      toast({
        title: 'Reparatur wählen',
        description: 'Bitte wählen Sie mindestens eine Reparatur aus.',
        variant: 'destructive'
      });
      return;
    }
    setCurrentStep(prev => Math.min(prev + 1, 5));
  };

  // Navigate to previous step
  const goToPreviousStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  // Reset configurator
  const resetConfigurator = () => {
    setCurrentStep(1);
    setSelectedDeviceType(null);
    setSelectedBrand('');
    setSelectedModel(null);
    setSelectedRepairs([]);
    setSelectedAddOns([]);
    setManufacturers([]);
    setModels([]);
    setRepairServices([]);
    setAddOnServices([]);
    setModelSearchQuery('');
  };

  // Handle final order submission
  const handleSubmitOrder = () => {
    const orderData = {
      device: {
        type: selectedDeviceType,
        brand: manufacturers.find(m => m._id === selectedBrand),
        model: selectedModel
      },
      repairs: selectedRepairs,
      addOns: selectedAddOns,
      totals: calculateTotals()
    };

    // Store in session storage
    sessionStorage.setItem('pendingOrder', JSON.stringify(orderData));

    // Navigate to new order page
    navigate('/new-order', { state: { orderData } });

    if (onComplete) {
      onComplete(orderData);
    }
  };

  const { total, duration } = calculateTotals();

  // Get device preview data
  const getDevicePreviewData = () => {
    if (!selectedDeviceType || !selectedModel) return null;
    
    const deviceTypeKey = selectedDeviceType.name.toLowerCase();
    const image = deviceImages[deviceTypeKey] || deviceImages.smartphone;
    const problems = deviceProblems[deviceTypeKey] || deviceProblems.smartphone;
    
    return {
      image,
      modelName: selectedModel.name,
      problems
    };
  };

  const previewData = getDevicePreviewData();

  return (
    <>
      <div className="configurator" id="configurator">
        {/* Configurator Header */}
        <div className="configurator-header">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
          </svg>
          <h3>Reparatur-Konfigurator</h3>
        </div>

      <div className="configurator-body">
        {/* Step Indicators */}
        <div className="config-steps">
          <div className={`config-step-indicator ${currentStep >= 1 ? 'active' : ''}`} data-step="1">
            <span className="step-num">1</span>
            <span className="step-label">Gerätetyp</span>
          </div>
          <div className={`config-step-indicator ${currentStep >= 2 ? 'active' : ''}`} data-step="2">
            <span className="step-num">2</span>
            <span className="step-label">Marke & Modell</span>
          </div>
          <div className={`config-step-indicator ${currentStep >= 3 ? 'active' : ''}`} data-step="3">
            <span className="step-num">3</span>
            <span className="step-label">Reparatur</span>
          </div>
          <div className={`config-step-indicator ${currentStep >= 4 ? 'active' : ''}`} data-step="4">
            <span className="step-num">4</span>
            <span className="step-label">Extras</span>
          </div>
          <div className={`config-step-indicator ${currentStep >= 5 ? 'active' : ''}`} data-step="5">
            <span className="step-num">5</span>
            <span className="step-label">Ergebnis</span>
          </div>
        </div>

        {/* STEP 1: Device Type */}
        {currentStep === 1 && (
          <div className="config-step-content active" data-step="1">
            <div className="device-grid">
              {loadingDeviceTypes ? (
                <div className="col-span-full text-center py-8 text-muted-foreground">
                  Lade Gerätetypen...
                </div>
              ) : deviceTypes.length > 0 ? (
                deviceTypes.map((deviceType) => {
                  const Icon = getDeviceIcon(deviceType.name);
                  return (
                    <div
                      key={deviceType._id}
                      className={`device-card ${selectedDeviceType?._id === deviceType._id ? 'selected' : ''}`}
                      onClick={() => {
                        handleDeviceTypeSelect(deviceType);
                        goToNextStep();
                      }}
                    >
                      <Icon className="w-8 h-8" />
                      <span>{deviceType.name}</span>
                    </div>
                  );
                })
              ) : (
                <div className="col-span-full text-center py-8 text-muted-foreground">
                  Keine Gerätetypen verfügbar
                </div>
              )}
            </div>
          </div>
        )}

        {/* STEP 2: Brand & Model */}
        {currentStep === 2 && (
          <div className="config-step-content active" data-step="2">
            <div className="config-select-group">
              <div className="config-select-wrapper">
                <label htmlFor="brandSelect">Marke auswählen</label>
                <Select value={selectedBrand} onValueChange={handleBrandSelect} disabled={loadingManufacturers}>
                  <SelectTrigger className="config-select">
                    <SelectValue placeholder={loadingManufacturers ? "Lade Marken..." : "Bitte wählen..."} />
                  </SelectTrigger>
                  <SelectContent>
                    {manufacturers.map((manufacturer) => (
                      <SelectItem key={manufacturer._id} value={manufacturer._id}>
                        {manufacturer.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="config-select-wrapper autocomplete-wrapper">
                <label htmlFor="modelInput">Modell suchen</label>
                <Input
                  type="text"
                  className="config-input"
                  id="modelInput"
                  placeholder={loadingModels ? "Lade Modelle..." : "z.B. iPhone 15 Pro..."}
                  value={modelSearchQuery}
                  onChange={(e) => setModelSearchQuery(e.target.value)}
                  onFocus={() => setShowModelDropdown(true)}
                  autoComplete="off"
                  disabled={!selectedBrand || loadingModels}
                />
                {showModelDropdown && filteredModels.length > 0 && (
                  <div className="autocomplete-dropdown open">
                    {filteredModels.map((model) => (
                      <div
                        key={model._id}
                        className="autocomplete-item"
                        onClick={() => handleModelSelect(model)}
                      >
                        {model.name}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="config-nav">
              <button className="config-nav-btn back" onClick={goToPreviousStep}>
                <ChevronLeft className="w-4 h-4" />
                Zurück
              </button>
              <button 
                className="config-nav-btn next" 
                onClick={goToNextStep}
                disabled={!selectedModel}
              >
                Weiter
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Repair Type */}
        {currentStep === 3 && (
          <div className="config-step-content active" data-step="3">
            <div className="repair-grid">
              {loadingRepairs ? (
                <div className="col-span-full text-center py-8 text-muted-foreground">
                  Lade Reparaturen...
                </div>
              ) : repairServices.length > 0 ? (
                repairServices.map((service) => (
                  <div
                    key={service._id}
                    className={`repair-card ${selectedRepairs.find(s => s._id === service._id) ? 'selected' : ''}`}
                    onClick={() => toggleRepairSelection(service)}
                  >
                    <Wrench className="w-6 h-6" />
                    <div className="repair-info">
                      <div className="repair-name">{service.name}</div>
                      <div className="repair-price">ab {service.price.toFixed(2)} €</div>
                    </div>
                    {selectedRepairs.find(s => s._id === service._id) && (
                      <div className="absolute top-2 right-2">
                        <Check className="w-5 h-5 text-green-600" />
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="col-span-full text-center py-8 text-muted-foreground">
                  Keine Reparaturen verfügbar für dieses Gerät
                </div>
              )}
            </div>
            <div className="config-nav">
              <button className="config-nav-btn back" onClick={goToPreviousStep}>
                <ChevronLeft className="w-4 h-4" />
                Zurück
              </button>
              <button 
                className="config-nav-btn next" 
                onClick={goToNextStep}
                disabled={selectedRepairs.length === 0}
              >
                Weiter
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: Add-ons/Extras */}
        {currentStep === 4 && (
          <div className="config-step-content active" data-step="4">
            <div className="extras-grid">
              {loadingAddOns ? (
                <div className="text-center py-8 text-muted-foreground">
                  Lade Zusatzleistungen...
                </div>
              ) : addOnServices.length > 0 ? (
                addOnServices.map((addon) => (
                  <label key={addon._id} className="extras-option">
                    <input
                      type="checkbox"
                      checked={!!selectedAddOns.find(a => a._id === addon._id)}
                      onChange={() => toggleAddOnSelection(addon)}
                    />
                    <div className="extras-card">
                      <div className="extras-icon">
                        {addon.name.toLowerCase().includes('express') ? (
                          <Clock className="w-6 h-6" />
                        ) : addon.name.toLowerCase().includes('schutz') || addon.name.toLowerCase().includes('versicherung') ? (
                          <Shield className="w-6 h-6" />
                        ) : addon.name.toLowerCase().includes('daten') ? (
                          <Upload className="w-6 h-6" />
                        ) : (
                          <Package className="w-6 h-6" />
                        )}
                      </div>
                      <div className="extras-info">
                        <div className="extras-name">{addon.name}</div>
                        <div className="extras-desc">{addon.description}</div>
                      </div>
                      <div className="extras-price">+{addon.price.toFixed(2)} €</div>
                    </div>
                  </label>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Keine Zusatzleistungen verfügbar
                </div>
              )}
            </div>
            <div className="config-nav">
              <button className="config-nav-btn back" onClick={goToPreviousStep}>
                <ChevronLeft className="w-4 h-4" />
                Zurück
              </button>
              <button className="config-nav-btn next" onClick={goToNextStep}>
                Weiter
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 5: Result */}
        {currentStep === 5 && (
          <div className="config-step-content active" data-step="5">
            <div className="config-result">
              <div className="config-result-grid">
                <div className="config-result-item">
                  <div className="label">Preis gesamt</div>
                  <div className="value">{total.toFixed(2)} €</div>
                </div>
                <div className="config-result-item">
                  <div className="label">Reparaturdauer</div>
                  <div className="value small">{duration}</div>
                </div>
                <div className="config-result-item">
                  <div className="label">Versand</div>
                  <div className="value small">Gratis</div>
                </div>
              </div>
              <button className="config-result-cta" onClick={handleSubmitOrder}>
                Reparatur beauftragen
                <ChevronRight className="w-5 h-5 ml-2" />
              </button>
            </div>
            <div className="config-nav" style={{ marginTop: '16px' }}>
              <button className="config-nav-btn back" onClick={goToPreviousStep}>
                <ChevronLeft className="w-4 h-4" />
                Zurück
              </button>
              <button className="config-nav-btn back" onClick={resetConfigurator}>
                Neu starten
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Device Preview Panel (floats left on desktop, below on mobile) */}
      <div className={`device-preview-panel ${previewData ? 'visible' : ''}`} id="devicePreview">
        <div className="device-preview-panel-inner">
          <div className="device-preview-panel-img" id="devicePreviewImage">
            {previewData?.image && (
              <img 
                src={previewData.image} 
                alt={previewData.modelName} 
                onError={(e) => {
                  // Fallback to a default icon if image fails to load
                  e.currentTarget.style.display = 'none';
                }}
              />
            )}
          </div>
          <div className="device-preview-panel-body">
            <div className="device-preview-panel-model" id="devicePreviewModel">
              {previewData?.modelName || ''}
            </div>
            <div className="device-preview-panel-problems">
              <div className="device-preview-panel-problems-title">
                <AlertCircle className="w-3 h-3" />
                Häufige Probleme
              </div>
              <ul className="device-preview-panel-list" id="devicePreviewList">
                {previewData?.problems.map((problem, index) => (
                  <li key={index}>{problem}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
