import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { UnlockPatternInput } from '@/components/inspection/UnlockPatternInput';
import { 
  Wrench, 
  Smartphone, 
  Tablet, 
  Monitor, 
  Gamepad2,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  Check,
  Clock,
  Shield,
  Upload,
  Package,
  AlertCircle,
  FileText,
  Lock,
  Droplets,
  Plus,
  X,
  Info
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
import { addRepairOrderToCart } from '@/api/shop';

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

  // Unlock code/pattern state (NEW)
  const [unlockPattern, setUnlockPattern] = useState<string[]>([]);
  const [unlockCode, setUnlockCode] = useState<string>('');
  const [noDeviceLock, setNoDeviceLock] = useState(true);
  
  // Additional info toggle state
  const [showAdditionalInfo, setShowAdditionalInfo] = useState(false);
  const [showUnlockDetails, setShowUnlockDetails] = useState(true);

  // Photos state (NEW)
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoPreviewUrls, setPhotoPreviewUrls] = useState<string[]>([]);

  // Questionnaire state (NEW)
  const [errorDescription, setErrorDescription] = useState('');
  const [waterDamage, setWaterDamage] = useState<'yes' | 'no' | 'unsure' | ''>('');
  const [previousRepairAttempts, setPreviousRepairAttempts] = useState<'yes' | 'no' | 'unsure' | ''>('');
  const [previousRepairDetails, setPreviousRepairDetails] = useState('');
  const [itemCondition, setItemCondition] = useState<'original' | 'refurbished' | 'unsure' | ''>('');
  const [customerNotes, setCustomerNotes] = useState('');

  // Multiple devices support (NEW)
  const [devices, setDevices] = useState<any[]>([]);
  const [currentDeviceIndex, setCurrentDeviceIndex] = useState(0);

  // Quantity for current device (NEW)
  const [currentDeviceQuantity, setCurrentDeviceQuantity] = useState(1);

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
        const deviceTypesList = (response as any).deviceTypes || [];
        setDeviceTypes(deviceTypesList);

        // Check if device was selected from navigation dropdown
        const navDeviceSelectionJson = sessionStorage.getItem('navDeviceSelection');
        if (navDeviceSelectionJson) {
          try {
            const navDeviceSelection = JSON.parse(navDeviceSelectionJson);
            console.log('Device selected from navigation:', navDeviceSelection);

            // Find the matching device type
            const matchedDeviceType = deviceTypesList.find(
              (dt: DeviceType) => dt.name.toLowerCase() === navDeviceSelection.deviceType.toLowerCase()
            );

            if (matchedDeviceType && navDeviceSelection.searchQuery) {
              // Set device type
              setSelectedDeviceType(matchedDeviceType);
              setCurrentStep(2); // Move to step 2

              // Load manufacturers
              setLoadingManufacturers(true);
              const manufacturersResponse = await getManufacturersByDeviceType(matchedDeviceType._id);
              const manufacturersList = (manufacturersResponse as any).manufacturers || [];
              setManufacturers(manufacturersList);

              // Find the matching manufacturer
              const matchedManufacturer = manufacturersList.find(
                (m: Manufacturer) => m.name.toLowerCase() === navDeviceSelection.manufacturer.toLowerCase()
              );

              if (matchedManufacturer) {
                setSelectedBrand(matchedManufacturer._id);

                // Load models
                setLoadingModels(true);
                const modelsResponse = await getModelsByTypeAndManufacturer(
                  matchedDeviceType._id,
                  matchedManufacturer._id
                );
                const modelsList = (modelsResponse as any).models || [];
                setModels(modelsList);
                setFilteredModels(modelsList);

                // Find the matching model
                const matchedModel = modelsList.find((m: DeviceModel) =>
                  m.name.toLowerCase().includes(navDeviceSelection.modelName?.toLowerCase() || '')
                );

                if (matchedModel) {
                  setSelectedModel(matchedModel);
                  setModelSearchQuery(matchedModel.name);
                  
                  toast({
                    title: t('common.success'),
                    description: `${matchedModel.name} wurde ausgewählt`,
                  });
                } else {
                  // If no exact match, at least show the filtered models
                  setModelSearchQuery(navDeviceSelection.modelName || '');
                  toast({
                    title: 'Modell auswählen',
                    description: `Bitte wählen Sie Ihr ${navDeviceSelection.manufacturer} Modell aus`,
                  });
                }

                setLoadingModels(false);
              }

              setLoadingManufacturers(false);
            } else if (matchedDeviceType && navDeviceSelection.manufacturer && navDeviceSelection.showAllModels) {
              // "Alle Modelle" was clicked - set device type and manufacturer
              setSelectedDeviceType(matchedDeviceType);
              setCurrentStep(2);

              // Load manufacturers
              setLoadingManufacturers(true);
              const manufacturersResponse = await getManufacturersByDeviceType(matchedDeviceType._id);
              const manufacturersList = (manufacturersResponse as any).manufacturers || [];
              setManufacturers(manufacturersList);

              // Find and select the manufacturer
              const matchedManufacturer = manufacturersList.find(
                (m: Manufacturer) => m.name.toLowerCase() === navDeviceSelection.manufacturer.toLowerCase()
              );

              if (matchedManufacturer) {
                setSelectedBrand(matchedManufacturer._id);

                // Load all models for this manufacturer
                setLoadingModels(true);
                const modelsResponse = await getModelsByTypeAndManufacturer(
                  matchedDeviceType._id,
                  matchedManufacturer._id
                );
                const modelsList = (modelsResponse as any).models || [];
                setModels(modelsList);
                setFilteredModels(modelsList);
                setLoadingModels(false);

                toast({
                  title: 'Filter angewendet',
                  description: `${navDeviceSelection.manufacturer} ${navDeviceSelection.deviceType} Modelle`,
                });
              }

              setLoadingManufacturers(false);
            }

            // Clear the session storage
            sessionStorage.removeItem('navDeviceSelection');
          } catch (error) {
            console.error('Error processing nav device selection:', error);
          }
        }
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

  // Listen for navigation device selection events (when already on homepage)
  useEffect(() => {
    const handleNavDeviceSelected = async () => {
      const navDeviceSelectionJson = sessionStorage.getItem('navDeviceSelection');
      if (!navDeviceSelectionJson) return;

      try {
        const navDeviceSelection = JSON.parse(navDeviceSelectionJson);
        console.log('Device selected from navigation (event):', navDeviceSelection);

        // Get current device types or wait for them to load
        let currentDeviceTypes = deviceTypes;
        if (currentDeviceTypes.length === 0) {
          // Device types not loaded yet, fetch them
          const response = await getDeviceTypes();
          currentDeviceTypes = (response as any).deviceTypes || [];
          setDeviceTypes(currentDeviceTypes);
        }

        // Find matching device type
        const deviceTypeName = navDeviceSelection.deviceType.toLowerCase();
        const matchingType = currentDeviceTypes.find(dt => 
          dt.name.toLowerCase() === deviceTypeName
        );

        if (matchingType) {
          setSelectedDeviceType(matchingType);
          setCurrentStep(2);

          // Load manufacturers for this device type
          const manufacturersResponse = await getManufacturersByDeviceType(matchingType._id);
          const manufacturersList = (manufacturersResponse as any).manufacturers || [];
          setManufacturers(manufacturersList);

          // If we have manufacturer and model name, try to auto-select
          if (navDeviceSelection.manufacturer && !navDeviceSelection.showAllModels) {
            const matchingManufacturer = manufacturersList.find((m: any) => 
              m.name.toLowerCase() === navDeviceSelection.manufacturer.toLowerCase()
            );

            if (matchingManufacturer) {
              setSelectedBrand(matchingManufacturer._id);

              // Load models for this manufacturer
              const modelsResponse = await getModelsByTypeAndManufacturer(
                matchingType._id,
                matchingManufacturer._id
              );
              const modelsList = (modelsResponse as any).models || [];
              setModels(modelsList);

              // Auto-select the specific model if provided
              if (navDeviceSelection.modelName) {
                const matchingModel = modelsList.find((m: any) => 
                  m.name.toLowerCase() === navDeviceSelection.modelName.toLowerCase()
                );

                if (matchingModel) {
                  setSelectedModel(matchingModel);
                  setModelSearchQuery(matchingModel.name);
                  toast({
                    title: t('newOrder.deviceSelection.success', 'Gerät ausgewählt'),
                    description: `${matchingManufacturer.name} ${matchingModel.name}`,
                    variant: 'default'
                  });
                }
              }
            }
          } else if (navDeviceSelection.showAllModels && navDeviceSelection.manufacturer) {
            // Show all models for this manufacturer
            const matchingManufacturer = manufacturersList.find((m: any) => 
              m.name.toLowerCase() === navDeviceSelection.manufacturer.toLowerCase()
            );

            if (matchingManufacturer) {
              setSelectedBrand(matchingManufacturer._id);
              
              const modelsResponse = await getModelsByTypeAndManufacturer(
                matchingType._id,
                matchingManufacturer._id
              );
              const modelsList = (modelsResponse as any).models || [];
              setModels(modelsList);
              setFilteredModels(modelsList);

              toast({
                title: t('newOrder.deviceSelection.filterApplied', 'Filter angewendet'),
                description: `${matchingManufacturer.name} Modelle werden angezeigt`,
                variant: 'default'
              });
            }
          }
        }

        // Clear the sessionStorage item after processing
        sessionStorage.removeItem('navDeviceSelection');
      } catch (error) {
        console.error('Error processing navigation device selection:', error);
      }
    };

    window.addEventListener('navDeviceSelected', handleNavDeviceSelected);

    return () => {
      window.removeEventListener('navDeviceSelected', handleNavDeviceSelected);
    };
  }, [deviceTypes, toast, t]);

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
          console.log('Fetching add-on services for deviceType:', selectedDeviceType?.name);
          
          // Fetch all active add-ons (no deviceType filter to show all available options)
          // Add-ons like Express Service, Data Backup, Insurance are typically available for all devices
          const response = await getAddOnServices({ 
            limit: 100,
            sortBy: 'popularity',
            sortOrder: 'desc'
          });
          
          const addOns = (response as any).addOns || [];
          console.log(`Loaded ${addOns.length} add-on services:`, addOns.map((a: any) => a.name));
          
          setAddOnServices(addOns);
        } catch (error) {
          console.error('Error fetching add-on services:', error);
          toast({
            title: t('common.error'),
            description: 'Fehler beim Laden der Zusatzleistungen',
            variant: 'destructive'
          });
          setAddOnServices([]);
        } finally {
          setLoadingAddOns(false);
        }
      };

      fetchAddOnServices();
    }
  }, [currentStep, toast, t]);

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
        description: 'Bitte wählen Sie mindestens eine Reparatur aus oder nutzen Sie "Reparatur anfragen".',
        variant: 'destructive'
      });
      return;
    }
    setCurrentStep(prev => Math.min(prev + 1, 6)); // Max step is now 6
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
    setUnlockPattern([]);
    setUnlockCode('');
    setNoDeviceLock(false);
    setPhotos([]);
    setPhotoPreviewUrls([]);
    setErrorDescription('');
    setWaterDamage('');
    setPreviousRepairAttempts('');
    setPreviousRepairDetails('');
    setItemCondition('');
    setCustomerNotes('');
    setDevices([]);
    setCurrentDeviceIndex(0);
    setCurrentDeviceQuantity(1);
  };

  // Handle photo upload (NEW)
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);

    if (files.length + photos.length > 5) {
      toast({
        title: 'Zu viele Bilder',
        description: 'Sie können maximal 5 Bilder hochladen',
        variant: 'destructive'
      });
      return;
    }

    // Validate file types and sizes
    const validFiles = files.filter(file => {
      if (!file.type.startsWith('image/')) {
        toast({
          title: 'Ungültiger Dateityp',
          description: `${file.name} ist kein Bild`,
          variant: 'destructive'
        });
        return false;
      }
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        toast({
          title: 'Datei zu groß',
          description: `${file.name} überschreitet die 5MB Grenze`,
          variant: 'destructive'
        });
        return false;
      }
      return true;
    });

    setPhotos(prev => [...prev, ...validFiles]);

    // Create preview URLs
    validFiles.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreviewUrls(prev => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  // Remove photo (NEW)
  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
    setPhotoPreviewUrls(prev => prev.filter((_, i) => i !== index));
  };

  // Add current device to devices list and start a new one (NEW)
  const addAnotherDevice = () => {
    if (!selectedModel || selectedRepairs.length === 0) {
      toast({
        title: 'Gerät unvollständig',
        description: 'Bitte wählen Sie zuerst ein Modell und Reparaturen aus.',
        variant: 'destructive'
      });
      return;
    }

    const currentDevice = {
      deviceType: selectedDeviceType,
      brand: manufacturers.find(m => m._id === selectedBrand),
      model: selectedModel,
      repairs: selectedRepairs,
      addOns: selectedAddOns,
      unlockPattern,
      unlockCode,
      noDeviceLock,
      errorDescription,
      waterDamage,
      previousRepairAttempts,
      previousRepairDetails,
      itemCondition,
      customerNotes,
      photos: photoPreviewUrls,
      quantity: currentDeviceQuantity
    };

    setDevices(prev => [...prev, currentDevice]);

    // Reset for next device
    setSelectedDeviceType(null);
    setSelectedBrand('');
    setSelectedModel(null);
    setSelectedRepairs([]);
    setSelectedAddOns([]);
    setUnlockPattern([]);
    setUnlockCode('');
    setNoDeviceLock(false);
    setPhotos([]);
    setPhotoPreviewUrls([]);
    setErrorDescription('');
    setWaterDamage('');
    setPreviousRepairAttempts('');
    setPreviousRepairDetails('');
    setItemCondition('');
    setCustomerNotes('');
    setCurrentDeviceQuantity(1);
    setCurrentStep(1);

    toast({
      title: 'Gerät hinzugefügt',
      description: `Sie haben jetzt ${devices.length + 1} verschiedene Geräte in Ihrer Bestellung`,
    });
  };

  // Navigate to repair request questionnaire (NEW)
  const navigateToRepairRequest = () => {
    if (!selectedModel) {
      toast({
        title: 'Kein Gerät ausgewählt',
        description: 'Bitte wählen Sie zuerst ein Gerät aus.',
        variant: 'destructive'
      });
      return;
    }

    navigate('/repair-request', {
      state: {
        device: {
          _id: selectedModel._id,
          name: selectedModel.name,
          deviceType: selectedDeviceType?.name || '',
          manufacturer: manufacturers.find(m => m._id === selectedBrand)?.name || '',
          manufacturerId: selectedBrand
        }
      }
    });
  };

  // Handle adding repair order to cart
  const handleAddToCart = async () => {
    try {
      // Collect current device if not added yet
      const allDevices = [...devices];
      
      if (selectedModel && selectedRepairs.length > 0) {
        allDevices.push({
          deviceType: selectedDeviceType,
          brand: manufacturers.find(m => m._id === selectedBrand),
          model: selectedModel,
          repairs: selectedRepairs,
          addOns: selectedAddOns,
          unlockPattern,
          unlockCode,
          noDeviceLock,
          errorDescription,
          waterDamage,
          previousRepairAttempts,
          previousRepairDetails,
          itemCondition,
          customerNotes,
          photos: photoPreviewUrls,
          quantity: currentDeviceQuantity
        });
      }

      // Add each device as a separate repair order to the cart
      for (const device of allDevices) {
        const repairOrderData = {
          deviceType: device.deviceType?.name || device.deviceType,
          deviceBrand: device.brand?.name || device.brand,
          deviceModel: device.model?.name || device.model,
          services: device.repairs.map((r: any) => r._id || r),
          addOns: device.addOns.map((a: any) => ({
            name: a.name,
            description: a.description || '',
            price: a.price,
            estimatedTime: a.estimatedTime || ''
          })),
          customerNotes: device.customerNotes || '',
          photos: device.photos || [],
          totalCost: device.repairs.reduce((s: number, r: any) => s + r.price, 0) + 
                     device.addOns.reduce((s: number, a: any) => s + a.price, 0),
          unlockPattern: device.unlockPattern,
          unlockCode: device.unlockCode,
          noLock: device.noDeviceLock,
          errorDescription: device.errorDescription,
          waterDamage: device.waterDamage,
          previousRepairAttempts: device.previousRepairAttempts,
          previousRepairDetails: device.previousRepairDetails,
          itemCondition: device.itemCondition
        };

        // Add to cart (handles multiple quantities)
        const quantity = device.quantity || 1;
        for (let i = 0; i < quantity; i++) {
          await addRepairOrderToCart(repairOrderData);
        }
      }

      // Dispatch cart update event
      window.dispatchEvent(new Event('cartUpdated'));
      window.dispatchEvent(new Event('guestCartUpdate'));

      toast({
        title: 'Erfolgreich hinzugefügt!',
        description: `${allDevices.reduce((sum, d) => sum + (d.quantity || 1), 0)} Reparaturauftrag/Aufträge zum Warenkorb hinzugefügt.`,
        variant: 'default'
      });

      // Reset configurator after successful add
      resetConfigurator();

      // Navigate to cart
      navigate('/cart');

    } catch (error: any) {
      console.error('Error adding to cart:', error);
      toast({
        title: 'Fehler',
        description: error.message || 'Konnte nicht zum Warenkorb hinzugefügt werden.',
        variant: 'destructive'
      });
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
    <div className="configurator-container" id="repair-order-configurator">
      <div className="configurator">
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
              <span className="step-label">Modell</span>
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
              <span className="step-label">Infos</span>
            </div>
            <div className={`config-step-indicator ${currentStep >= 6 ? 'active' : ''}`} data-step="6">
              <span className="step-num">6</span>
              <span className="step-label">Total</span>
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
                      <SelectValue placeholder={loadingManufacturers ? "Lade Marken..." : "Bitte wäh len..."} />
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
              {/* Repair Selection Grid - Now displayed first */}
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

              {/* Divider */}
              <div className="relative my-5">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-gray-200"></span>
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-3 text-gray-400 font-medium">
                    Oder
                  </span>
                </div>
              </div>

              {/* Request Repair Service Option - Now displayed below repairs */}
              <div className="mb-4 p-3 border border-gray-200 bg-gradient-to-br from-gray-50 to-blue-50/30 rounded-lg">
                <div className="flex items-start gap-2.5">
                  <FileText className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="font-semibold text-sm text-gray-800 mb-1">
                      Reparatur anfragen
                    </h4>
                    <p className="text-xs text-gray-600 leading-relaxed mb-2.5">
                      Nicht sicher, welche Reparatur Sie benötigen? Beschreiben Sie das Problem und erhalten Sie eine kostenlose Diagnose.
                    </p>
                    <button
                      type="button"
                      onClick={navigateToRepairRequest}
                      className="w-full px-3 py-2 bg-primary-blue hover:bg-primary-blue-dark text-white text-sm font-semibold rounded-md shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2"
                      style={{ 
                        backgroundColor: '#1a2a5e',
                        fontSize: '0.85rem'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#0f1d45'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#1a2a5e'}
                    >
                      <span>Jetzt Reparatur anfragen</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
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
              <div className="mb-4">
                <p className="text-sm text-gray-600">
                  Erweitern Sie Ihre Reparatur mit optionalen Zusatzleistungen:
                </p>
              </div>
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
                    <AlertCircle className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    <p className="font-medium">Keine Zusatzleistungen verfügbar</p>
                    <p className="text-xs mt-1">Aktuell sind keine Add-On Services in der Datenbank vorhanden.</p>
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

          {/* STEP 5: Unlock Code/Pattern & Additional Info (Combined with old Step 6) */}
          {currentStep === 5 && (
            <div className="config-step-content active" data-step="5">
              <div className="space-y-4">
                {/* Collapsible Unlock Section */}
                <div 
                  style={{
                    border: '2px solid #d8dce6',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    transition: 'all 0.3s ease'
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setShowUnlockDetails(!showUnlockDetails)}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: '#f5f6f8',
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'background 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#e8eaf0'}
                    onMouseLeave={(e) => e.currentTarget.style.background = '#f5f6f8'}
                  >
                    <div className="flex items-center gap-2">
                      <Lock className="w-4 h-4" style={{ color: '#1a2a5e' }} />
                      <h3 className="font-semibold text-sm" style={{ color: '#1a2a5e' }}>Gerätesperre</h3>
                    </div>
                    {showUnlockDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  
                  {showUnlockDetails && (
                    <div style={{ padding: '16px' }}>
                      <p className="text-xs text-gray-600 mb-3">
                        Bitte geben Sie die Entsperrinformationen an, damit unsere Techniker das Gerät testen können.
                      </p>
                      
                      <UnlockPatternInput
                        onPatternChange={setUnlockPattern}
                        onUnlockCodeChange={setUnlockCode}
                        onNoLockChange={setNoDeviceLock}
                        pattern={unlockPattern}
                        unlockCode={unlockCode}
                        noLock={noDeviceLock}
                      />
                    </div>
                  )}
                </div>

                {/* Additional Information Button */}
                <button
                  type="button"
                  onClick={() => {
                    setShowAdditionalInfo(!showAdditionalInfo);
                    if (!showAdditionalInfo) {
                      setShowUnlockDetails(false);
                    }
                  }}
                  style={{
                    width: '100%',
                    padding: '16px',
                    background: showAdditionalInfo ? 'rgba(245, 184, 0, 0.1)' : '#f0f7ff',
                    border: showAdditionalInfo ? '2px solid #f5b800' : '2px solid #d0e4ff',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease'
                  }}
                  onMouseEnter={(e) => {
                    if (!showAdditionalInfo) {
                      e.currentTarget.style.background = '#e0f0ff';
                      e.currentTarget.style.borderColor = '#b0d4ff';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!showAdditionalInfo) {
                      e.currentTarget.style.background = '#f0f7ff';
                      e.currentTarget.style.borderColor = '#d0e4ff';
                    }
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Info className="w-5 h-5" style={{ color: '#1a2a5e', flexShrink: 0 }} />
                    <div style={{ flex: 1, textAlign: 'left' }}>
                      <h4 className="font-semibold text-sm mb-1" style={{ color: '#1a2a5e' }}>
                        Zusätzliche Informationen angeben
                      </h4>
                      <p className="text-xs" style={{ color: '#4a5568' }}>
                        Je mehr Informationen Sie uns zur Verfügung stellen, desto besser können wir Ihre Reparatur durchführen und Ihnen ein genaues Angebot machen.
                      </p>
                    </div>
                    {showAdditionalInfo ? <ChevronUp className="w-5 h-5" style={{ color: '#1a2a5e' }} /> : <ChevronDown className="w-5 h-5" style={{ color: '#1a2a5e' }} />}
                  </div>
                </button>

                {/* Additional Information Content (Previously Step 6) */}
                {showAdditionalInfo && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '20px', background: '#fafbfc', borderRadius: '8px', border: '1px solid #e8eaf0' }}>
                    {/* Error Description */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <label 
                        htmlFor="errorDesc" 
                        style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '8px',
                          fontSize: '0.8rem',
                          fontWeight: '600',
                          color: '#4a5568'
                        }}
                      >
                        <AlertCircle className="w-4 h-4" style={{ color: '#1a2a5e' }} />
                        Fehlerbeschreibung
                      </label>
                      <textarea
                        id="errorDesc"
                        placeholder="Beschreiben Sie das Problem mit Ihrem Gerät..."
                        value={errorDescription}
                        onChange={(e) => setErrorDescription(e.target.value)}
                        rows={4}
                        style={{
                          width: '100%',
                          padding: '12px 16px',
                          border: '2px solid #d8dce6',
                          borderRadius: '6px',
                          fontSize: '0.9rem',
                          fontFamily: 'var(--font-main, Inter, sans-serif)',
                          color: '#2d3748',
                          resize: 'none',
                          transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
                        }}
                        onFocus={(e) => {
                          e.target.style.borderColor = '#f5b800';
                          e.target.style.boxShadow = '0 0 0 3px rgba(245, 184, 0, 0.15)';
                          e.target.style.outline = 'none';
                        }}
                        onBlur={(e) => {
                          e.target.style.borderColor = '#d8dce6';
                          e.target.style.boxShadow = 'none';
                        }}
                      />
                    </div>

                    {/* Water Damage */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <label 
                        style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '8px',
                          fontSize: '0.8rem',
                          fontWeight: '600',
                          color: '#4a5568'
                        }}
                      >
                        <Droplets className="w-4 h-4" style={{ color: '#1a2a5e' }} />
                        Wasserschaden?
                      </label>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        {['no', 'yes', 'unsure'].map((option) => (
                          <button
                            key={option}
                            type="button"
                            onClick={() => setWaterDamage(option as any)}
                            style={{
                              flex: 1,
                              padding: '12px 16px',
                              background: waterDamage === option ? 'rgba(245, 184, 0, 0.06)' : '#f5f6f8',
                              border: waterDamage === option ? '2px solid #f5b800' : '2px solid transparent',
                              borderRadius: '6px',
                              fontSize: '0.85rem',
                              fontWeight: '600',
                              color: '#2d3748',
                              cursor: 'pointer',
                              transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                              textAlign: 'center'
                            }}
                            onMouseEnter={(e) => {
                              if (waterDamage !== option) {
                                e.currentTarget.style.borderColor = '#f5b800';
                                e.currentTarget.style.background = '#ffffff';
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (waterDamage !== option) {
                                e.currentTarget.style.borderColor = 'transparent';
                                e.currentTarget.style.background = '#f5f6f8';
                              }
                            }}
                          >
                            {option === 'no' ? 'Nein' : option === 'yes' ? 'Ja' : 'Nicht sicher'}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Previous Repair Attempts */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <label 
                        style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '8px',
                          fontSize: '0.8rem',
                          fontWeight: '600',
                          color: '#4a5568'
                        }}
                      >
                        <Wrench className="w-4 h-4" style={{ color: '#1a2a5e' }} />
                        Vorherige Reparaturversuche?
                      </label>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        {['no', 'yes', 'unsure'].map((option) => (
                          <button
                            key={option}
                            type="button"
                            onClick={() => setPreviousRepairAttempts(option as any)}
                            style={{
                              flex: 1,
                              padding: '12px 16px',
                              background: previousRepairAttempts === option ? 'rgba(245, 184, 0, 0.06)' : '#f5f6f8',
                              border: previousRepairAttempts === option ? '2px solid #f5b800' : '2px solid transparent',
                              borderRadius: '6px',
                              fontSize: '0.85rem',
                              fontWeight: '600',
                              color: '#2d3748',
                              cursor: 'pointer',
                              transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                              textAlign: 'center'
                            }}
                            onMouseEnter={(e) => {
                              if (previousRepairAttempts !== option) {
                                e.currentTarget.style.borderColor = '#f5b800';
                                e.currentTarget.style.background = '#ffffff';
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (previousRepairAttempts !== option) {
                                e.currentTarget.style.borderColor = 'transparent';
                                e.currentTarget.style.background = '#f5f6f8';
                              }
                            }}
                          >
                            {option === 'no' ? 'Nein' : option === 'yes' ? 'Ja' : 'Nicht sicher'}
                          </button>
                        ))}
                      </div>

                      {previousRepairAttempts === 'yes' && (
                        <textarea
                          placeholder="Details zu vorherigen Reparaturversuchen..."
                          value={previousRepairDetails}
                          onChange={(e) => setPreviousRepairDetails(e.target.value)}
                          rows={3}
                          style={{
                            width: '100%',
                            padding: '12px 16px',
                            border: '2px solid #d8dce6',
                            borderRadius: '6px',
                            fontSize: '0.9rem',
                            fontFamily: 'var(--font-main, Inter, sans-serif)',
                            color: '#2d3748',
                            resize: 'none',
                            marginTop: '8px',
                            transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
                          }}
                          onFocus={(e) => {
                            e.target.style.borderColor = '#f5b800';
                            e.target.style.boxShadow = '0 0 0 3px rgba(245, 184, 0, 0.15)';
                            e.target.style.outline = 'none';
                          }}
                          onBlur={(e) => {
                            e.target.style.borderColor = '#d8dce6';
                            e.target.style.boxShadow = 'none';
                          }}
                        />
                      )}
                    </div>

                    {/* Item Condition */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <label 
                        style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '8px',
                          fontSize: '0.8rem',
                          fontWeight: '600',
                          color: '#4a5568'
                        }}
                      >
                        <Package className="w-4 h-4" style={{ color: '#1a2a5e' }} />
                        Zustand des Geräts
                      </label>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        {['original', 'refurbished', 'unsure'].map((option) => (
                          <button
                            key={option}
                            type="button"
                            onClick={() => setItemCondition(option as any)}
                            style={{
                              flex: 1,
                              padding: '12px 16px',
                              background: itemCondition === option ? 'rgba(245, 184, 0, 0.06)' : '#f5f6f8',
                              border: itemCondition === option ? '2px solid #f5b800' : '2px solid transparent',
                              borderRadius: '6px',
                              fontSize: '0.85rem',
                              fontWeight: '600',
                              color: '#2d3748',
                              cursor: 'pointer',
                              transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                              textAlign: 'center'
                            }}
                            onMouseEnter={(e) => {
                              if (itemCondition !== option) {
                                e.currentTarget.style.borderColor = '#f5b800';
                                e.currentTarget.style.background = '#ffffff';
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (itemCondition !== option) {
                                e.currentTarget.style.borderColor = 'transparent';
                                e.currentTarget.style.background = '#f5f6f8';
                              }
                            }}
                          >
                            {option === 'original' ? 'Original' : option === 'refurbished' ? 'Generalüberholt' : 'Nicht sicher'}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Photo Upload */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <label 
                        htmlFor="photos" 
                        style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '8px',
                          fontSize: '0.8rem',
                          fontWeight: '600',
                          color: '#4a5568'
                        }}
                      >
                        <Upload className="w-4 h-4" style={{ color: '#1a2a5e' }} />
                        Fotos hochladen (optional, max. 5)
                      </label>
                      <Input
                        id="photos"
                        type="file"
                        multiple
                        accept="image/*"
                        onChange={handlePhotoUpload}
                        disabled={photos.length >= 5}
                        style={{
                          padding: '12px 16px',
                          border: '2px solid #d8dce6',
                          borderRadius: '6px',
                          fontSize: '0.9rem',
                          cursor: 'pointer'
                        }}
                      />
                      <p style={{ fontSize: '0.75rem', color: '#8892a8' }}>
                        {photos.length}/5 Bilder hochgeladen
                      </p>

                      {/* Photo Previews */}
                      {photoPreviewUrls.length > 0 && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginTop: '12px' }}>
                          {photoPreviewUrls.map((url, index) => (
                            <div key={index} className="relative group">
                              <img
                                src={url}
                                alt={`Preview ${index + 1}`}
                                style={{ 
                                  width: '100%', 
                                  height: '96px', 
                                  objectFit: 'cover', 
                                  borderRadius: '6px', 
                                  border: '1px solid #d8dce6' 
                                }}
                              />
                              <button
                                type="button"
                                onClick={() => removePhoto(index)}
                                className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="config-nav mt-4">
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

          {/* STEP 6: Order Summary with Quantity & Add Device */}
          {currentStep === 6 && (
            <div className="config-step-content active" data-step="6">
              {/* Order Summary Container */}
              <div className="config-result">
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem', color: '#1a2a5e' }}>
                  Bestellzusammenfassung
                </h3>

                {/* All Devices Summary */}
                <div style={{ marginBottom: '1.5rem' }}>
                  {(() => {
                    const allDevices = [...devices];
                    const isCurrentDeviceAdded = selectedModel && selectedRepairs.length > 0;
                    if (isCurrentDeviceAdded) {
                      allDevices.push({
                        deviceType: selectedDeviceType,
                        brand: manufacturers.find(m => m._id === selectedBrand),
                        model: selectedModel,
                        repairs: selectedRepairs,
                        addOns: selectedAddOns,
                        unlockPattern,
                        unlockCode,
                        noDeviceLock,
                        errorDescription,
                        waterDamage,
                        previousRepairAttempts,
                        previousRepairDetails,
                        itemCondition,
                        customerNotes,
                        photos: photoPreviewUrls
                      });
                    }

                    return allDevices.map((device, idx) => {
                      const singleDeviceTotal = 
                        device.repairs.reduce((s: number, r: any) => s + r.price, 0) +
                        device.addOns.reduce((s: number, a: any) => s + a.price, 0);
                      const isCurrentDevice = isCurrentDeviceAdded && idx === allDevices.length - 1;
                      const quantity = isCurrentDevice ? currentDeviceQuantity : (device.quantity || 1);
                      const deviceTotal = singleDeviceTotal * quantity;

                      return (
                        <div 
                          key={idx} 
                          style={{
                            padding: '1rem',
                            backgroundColor: '#ffffff',
                            borderRadius: '10px',
                            border: '1px solid rgba(245, 184, 0, 0.3)',
                            marginBottom: '0.75rem'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                            <h4 style={{ fontSize: '1rem', fontWeight: 700, color: '#1a2a5e' }}>
                              Gerät {idx + 1}: {device.model?.name}
                            </h4>
                            {quantity > 1 && !isCurrentDevice && (
                              <span style={{
                                padding: '0.25rem 0.75rem',
                                backgroundColor: '#f5b800',
                                color: '#1a2a5e',
                                fontSize: '0.875rem',
                                borderRadius: '999px',
                                fontWeight: 700
                              }}>
                                {quantity}x
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '0.8rem', color: '#4a5568' }}>
                            <p style={{ marginBottom: '0.25rem' }}><strong>Typ:</strong> {device.deviceType?.name}</p>
                            <p style={{ marginBottom: '0.25rem' }}><strong>Marke:</strong> {device.brand?.name}</p>
                            
                            {/* Repair Services List */}
                            {device.repairs.length > 0 && (
                              <div style={{ marginTop: '0.5rem', marginBottom: '0.5rem' }}>
                                <p style={{ marginBottom: '0.35rem', color: '#f5b800', fontWeight: 600 }}>Reparaturen:</p>
                                {device.repairs.map((repair: any, repairIdx: number) => (
                                  <div key={repairIdx} style={{ 
                                    marginLeft: '0.5rem', 
                                    marginBottom: '0.25rem',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center'
                                  }}>
                                    <span>• {repair.name}</span>
                                    <span style={{ color: '#f5b800', fontWeight: 600 }}>{repair.price.toFixed(2)} €</span>
                                  </div>
                                ))}
                              </div>
                            )}
                            
                            {/* Add-ons List */}
                            {device.addOns.length > 0 && (
                              <div style={{ marginTop: '0.5rem', marginBottom: '0.5rem' }}>
                                <p style={{ marginBottom: '0.35rem', color: '#f5b800', fontWeight: 600 }}>Extras:</p>
                                {device.addOns.map((addon: any, addonIdx: number) => (
                                  <div key={addonIdx} style={{ 
                                    marginLeft: '0.5rem', 
                                    marginBottom: '0.25rem',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center'
                                  }}>
                                    <span>• {addon.name}</span>
                                    <span style={{ color: '#f5b800', fontWeight: 600 }}>{addon.price.toFixed(2)} €</span>
                                  </div>
                                ))}
                              </div>
                            )}
                            
                            {(device.unlockPattern?.length > 0 || device.unlockCode || device.noDeviceLock) && (
                              <p style={{ marginBottom: '0.25rem' }}><strong>Entsperrung:</strong> ✓</p>
                            )}
                            {device.photos?.length > 0 && (
                              <p style={{ marginBottom: '0.25rem' }}><strong>Fotos:</strong> {device.photos.length}</p>
                            )}
                            
                            {/* Quantity Control for Current Device */}
                            {isCurrentDevice && (
                              <div style={{
                                marginTop: '0.75rem',
                                padding: '0.75rem',
                                backgroundColor: '#fffbeb',
                                borderRadius: '6px',
                                border: '1px solid rgba(245, 184, 0, 0.3)'
                              }}>
                                <p style={{ fontSize: '0.8rem', fontWeight: 600, color: '#f5b800', marginBottom: '0.5rem' }}>
                                  <Package className="w-3 h-3" style={{ display: 'inline', marginRight: '0.3rem' }} />
                                  Anzahl für diese Konfiguration:
                                </p>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    onClick={() => setCurrentDeviceQuantity(Math.max(1, currentDeviceQuantity - 1))}
                                    disabled={currentDeviceQuantity <= 1}
                                    style={{
                                      height: '2.25rem',
                                      width: '2.25rem',
                                      border: '2px solid #f5b800',
                                      borderRadius: '6px',
                                      backgroundColor: '#ffffff',
                                      color: '#f5b800'
                                    }}
                                  >
                                    <span style={{ fontSize: '1rem', fontWeight: 700 }}>−</span>
                                  </Button>
                                  <div style={{ flex: 1, textAlign: 'center' }}>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f5b800' }}>
                                      {currentDeviceQuantity}
                                    </div>
                                    <div style={{ fontSize: '0.65rem', color: '#718096', marginTop: '0.1rem' }}>
                                      {currentDeviceQuantity === 1 ? 'Gerät' : 'Geräte'}
                                    </div>
                                  </div>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    onClick={() => setCurrentDeviceQuantity(Math.min(99, currentDeviceQuantity + 1))}
                                    disabled={currentDeviceQuantity >= 99}
                                    style={{
                                      height: '2.25rem',
                                      width: '2.25rem',
                                      border: '2px solid #f5b800',
                                      borderRadius: '6px',
                                      backgroundColor: '#ffffff',
                                      color: '#f5b800'
                                    }}
                                  >
                                    <span style={{ fontSize: '1rem', fontWeight: 700 }}>+</span>
                                  </Button>
                                </div>
                                {currentDeviceQuantity > 1 && (
                                  <div style={{
                                    marginTop: '0.65rem',
                                    padding: '0.5rem',
                                    backgroundColor: '#f7fafc',
                                    borderRadius: '4px'
                                  }}>
                                    <p style={{ fontSize: '0.75rem', fontWeight: 600, color: '#1a2a5e' }}>
                                      💡 Sie bestellen {currentDeviceQuantity}x identische Reparaturen
                                    </p>
                                    <p style={{ fontSize: '0.7rem', color: '#718096', marginTop: '0.15rem' }}>
                                      Jedes Gerät wird mit den gleichen {device.repairs.length} Reparatur{device.repairs.length !== 1 ? 'en' : ''} bearbeitet
                                    </p>
                                  </div>
                                )}
                              </div>
                            )}
                            
                            <div style={{ paddingTop: '0.5rem', borderTop: '1px solid #e2e8f0', marginTop: '0.5rem' }}>
                              {quantity > 1 && (
                                <p style={{ marginBottom: '0.25rem', color: '#718096' }}>
                                  Preis pro Gerät: {singleDeviceTotal.toFixed(2)} €
                                </p>
                              )}
                              <p style={{ fontSize: '1.125rem', fontWeight: 700, color: '#1a2a5e' }}>
                                {quantity > 1 ? 'Gesamt' : 'Preis'}: {deviceTotal.toFixed(2)} €
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>

                {/* Total Summary Grid */}
                <div className="config-result-grid">
                  <div className="config-result-item">
                    <div className="label">Geräte gesamt</div>
                    <div className="value">{(() => {
                      let count = devices.reduce((sum, d) => sum + (d.quantity || 1), 0);
                      if (selectedModel && selectedRepairs.length > 0) count += currentDeviceQuantity;
                      return count;
                    })()}</div>
                  </div>
                  <div className="config-result-item">
                    <div className="label">Gerätetypen</div>
                    <div className="value small">{(() => {
                      let count = devices.length;
                      if (selectedModel && selectedRepairs.length > 0) count++;
                      return count;
                    })()}</div>
                  </div>
                  <div className="config-result-item">
                    <div className="label">Preis gesamt</div>
                    <div className="value">{(() => {
                      const allDevices = [...devices];
                      if (selectedModel && selectedRepairs.length > 0) {
                        allDevices.push({
                          repairs: selectedRepairs,
                          addOns: selectedAddOns,
                          quantity: currentDeviceQuantity
                        } as any);
                      }
                      const total = allDevices.reduce((sum, device) => {
                        const repairTotal = device.repairs.reduce((s: number, r: any) => s + r.price, 0);
                        const addonTotal = device.addOns.reduce((s: number, a: any) => s + a.price, 0);
                        const deviceTotal = (repairTotal + addonTotal) * (device.quantity || 1);
                        return sum + deviceTotal;
                      }, 0);
                      return total.toFixed(2);
                    })()} €</div>
                  </div>
                  <div className="config-result-item">
                    <div className="label">Versand</div>
                    <div className="value small">Gratis</div>
                  </div>
                </div>
              </div>

              {/* Add Another Device Option */}
              <div style={{
                marginTop: '1rem',
                padding: '1rem',
                background: '#ffffff',
                borderRadius: '8px',
                border: '2px solid rgba(245, 184, 0, 0.3)'
              }}>
                <h4 style={{
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  marginBottom: '0.4rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  color: '#1a2a5e'
                }}>
                  <Plus className="w-4 h-4" style={{ color: '#f5b800' }} />
                  Anderes Gerät zur Bestellung hinzufügen?
                </h4>
                <p style={{ fontSize: '0.8rem', color: '#4a5568', marginBottom: '0.65rem' }}>
                  Möchten Sie ein <strong>anderes Gerät-Modell</strong> oder eine <strong>andere Reparatur-Konfiguration</strong> hinzufügen?
                </p>
                <button
                  type="button"
                  onClick={addAnotherDevice}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.9rem',
                    backgroundColor: '#f5b800',
                    color: '#1a2a5e',
                    fontWeight: 700,
                    borderRadius: '6px',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.4rem',
                    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                    fontSize: '0.875rem'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e5ab00'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f5b800'}
                >
                  <Plus className="w-4 h-4" />
                  Weiteres Gerät-Modell hinzufügen
                </button>
                <p style={{ fontSize: '0.7rem', color: '#718096', marginTop: '0.4rem', textAlign: 'center' }}>
                  (Für gleiche Geräte verwenden Sie bitte den Anzahl-Zähler oben)
                </p>
              </div>

              {/* CTA Button */}
              <button className="config-result-cta" onClick={handleAddToCart} style={{ marginTop: '1.5rem' }}>
                Reparatur zum Warenkorb hinzufügen
                <ChevronRight className="w-5 h-5 ml-2" />
              </button>
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
    </div>
  );
}
