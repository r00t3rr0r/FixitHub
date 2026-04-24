import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { UnlockPatternInput } from '@/components/inspection/UnlockPatternInput';
import { VorabdiagnoseModal } from '@/components/VorabdiagnoseModal';
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
  updateDeviceModel,
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

const getModelImage = (model: any, fallbackImage?: string) => {
  if (model?.image) return model.image;
  if (Array.isArray(model?.images) && model.images.length > 0) {
    return model.images[0]?.url || model.images[0]?.base64 || fallbackImage || '';
  }
  return fallbackImage || '';
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
  const configuratorHeaderRef = useRef<HTMLDivElement | null>(null);
  const previousStepRef = useRef(1);

  // Configurator state
  const [currentStep, setCurrentStep] = useState(1);
  const [showDiagnoseModal, setShowDiagnoseModal] = useState(false);

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

  useEffect(() => {
    if (previousStepRef.current === currentStep) {
      return;
    }

    previousStepRef.current = currentStep;

    if (typeof window === 'undefined') {
      return;
    }

    const isVerySmallViewport = window.matchMedia('(max-height: 720px), (max-width: 380px)').matches;
    if (!isVerySmallViewport) {
      return;
    }

    configuratorHeaderRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  }, [currentStep]);

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
                    description: `${matchedModel.name} ${t('home.configurator.toasts.deviceSelectedTitle').toLowerCase()}`,
                  });
                } else {
                  // If no exact match, at least show the filtered models
                  setModelSearchQuery(navDeviceSelection.modelName || '');
                  toast({
                    title: t('home.configurator.toasts.selectModelTitle'),
                    description: t('home.configurator.toasts.selectModelDescription', {
                      brand: navDeviceSelection.manufacturer,
                    }),
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
                  title: t('home.configurator.toasts.filterAppliedTitle'),
                  description: t('home.configurator.toasts.filterAppliedDescription', {
                    manufacturer: navDeviceSelection.manufacturer,
                    deviceType: navDeviceSelection.deviceType,
                  }),
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
          description: t('home.configurator.toasts.loadDeviceTypesError'),
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
                    title: t('home.configurator.toasts.deviceSelectedTitle'),
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
                title: t('home.configurator.toasts.filterAppliedTitle'),
                description: t('home.configurator.toasts.showingModels', {
                  manufacturer: matchingManufacturer.name,
                }),
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
        description: t('home.configurator.toasts.loadBrandsError'),
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
        description: t('home.configurator.toasts.loadModelsError'),
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
  // Erweiterte Model-Auswahl mit Bild- und Specs-Check
  const handleModelSelect = async (model: DeviceModel) => {
    // Nur wenn kein Bild und keine Images vorhanden sind, hole Daten von mobileapi.dev
    if (model.image && model.image.trim() !== '' && Array.isArray(model.images) && model.images.length > 0) {
      setSelectedModel(model);
      setShowModelDropdown(false);
      return;
    }
    try {
      setModelSearchQuery(model.name);
      setShowModelDropdown(false);
      // Proxy-URL nutzen, damit kein CORS-Problem entsteht
      const searchUrl = `/api/proxy/mobileapi?name=${encodeURIComponent(model.name)}&page=1`;
      const response = await fetch(searchUrl, { headers: { 'Content-Type': 'application/json' } });
      const data = await response.json();
      if (!data.devices || !Array.isArray(data.devices) || data.devices.length === 0) {
        toast({ title: 'Kein Gerätebild gefunden', description: 'Für dieses Modell konnte kein Bild gefunden werden.', variant: 'destructive' });
        setSelectedModel(model);
        return;
      }
      // Bestes Match wählen
      const best = data.devices.reduce((prev, curr) => {
        const prevCert = parseFloat((prev.match_certainty || '0').replace('%',''));
        const currCert = parseFloat((curr.match_certainty || '0').replace('%',''));
        return currCert > prevCert ? curr : prev;
      }, data.devices[0]);

      // Vollständiges Mapping auf DeviceModel-Schema
      const update: Partial<DeviceModel> = {
        // Metadaten (Pflichtfelder immer aus dem Modell übernehmen, falls leer)
        name: best.name && best.name.trim() ? best.name : model.name,
        brandId: model.brandId,
        manufacturer: best.brand && best.brand.trim() ? best.brand : model.manufacturer,
        deviceType: best.device_type && best.device_type.trim() ? best.device_type : model.deviceType,
        // Bild
        image: best.image_b64 ? `data:image/jpeg;base64,${best.image_b64}` : model.image,
        images: best.image_b64 ? [{ base64: `data:image/jpeg;base64,${best.image_b64}` }] : model.images || [],
        // Common Problems
        commonProblems: best.common_problems ? best.common_problems.split(',').map((s:string) => s.trim()) : model.commonProblems || [],
        // Legacy
        specifications: {
          ...(model.specifications || {}),
          ...(best.description ? { description: best.description } : {}),
        },
        // Netzwerk
        network: {
          technology2G: best.technology_2g,
          bands2G: best.bands_2g,
          technology3G: best.technology_3g,
          bands3G: best.bands_3g,
          technology4G: best.technology_4g,
          bands4G: best.bands_4g,
          technology5G: best.technology_5g,
          bands5G: best.bands_5g,
          speed: best.network_speed,
        },
        // Physisch
        physical: {
          dimensions: best.thickness,
          weight: best.weight,
          build: best.body_material,
          simType: best.sim_type,
          simCount: best.sim_count,
        },
        // Display
        display: {
          type: best.display_type,
          size: best.screen_size,
          resolution: best.screen_resolution,
          protection: best.display_protection,
          features: best.display_features,
        },
        // Plattform
        platform: {
          os: best.os,
          chipset: best.hardware,
          cpu: best.cpu,
          gpu: best.gpu,
        },
        // Speicher
        memory: {
          // Kombiniere memory_internal und storage zu einem Array von Objekten
          internal: [
            ...(best.memory_internal
              ? best.memory_internal.split(',').map((s:string) => {
                  const [ram, storage] = s.split('/').map((x:string) => x.trim());
                  return { ram, storage };
                })
              : []),
            ...(best.storage
              ? best.storage.split(',').map((storage:string) => ({ storage: storage.trim() }))
              : []),
          ],
          cardSlot: best.memory_card_slot,
        },
        // Hauptkamera
        rearCamera: {
          modules: best.main_camera,
          features: best.main_camera_features,
          video: best.main_camera_video,
        },
        // Frontkamera
        frontCamera: {
          modules: best.selfie_camera,
          features: best.selfie_camera_features,
          video: best.selfie_camera_video,
        },
        // Audio
        audio: {
          loudspeaker: best.loudspeaker,
          jack3_5mm: best.jack,
        },
        // Konnektivität
        connectivity: {
          wlan: best.wlan,
          bluetooth: best.bluetooth,
          positioning: best.gps,
          nfc: best.nfc,
          radio: best.radio,
          usb: best.usb,
          infrared: best.infrared,
          other: best.connectivity_other,
        },
        // Features
        features: {
          sensors: best.sensors,
          special: best.special_features ? best.special_features.split(',').map((s:string) => s.trim()) : [],
        },
        // Akku
        battery: {
          type: best.battery_type,
          charging: best.charging,
          standbyTime: best.stand_by,
          talkTime: best.talk_time,
          musicPlay: best.music_play,
        },
        // Sonstiges
        other: {
          models: best.model_names ? best.model_names.split(',').map((s:string) => s.trim()) : [],
          modelNumbers: best.model_numbers ? best.model_numbers.split(',').map((s:string) => s.trim()) : [],
          sarValues: {
            head: best.sar_head,
            body: best.sar_body,
          },
          price: best.price,
          releaseDate: best.release_date,
          colors: best.colors ? best.colors.split(',').map((c:string) => c.trim()) : [],
        },
        // Zähler
        count: model.count,
      };
      await updateDeviceModel(model._id, update);
      setSelectedModel({ ...model, ...update });
      toast({ title: 'Gerätebild & Daten aktualisiert', description: 'Alle verfügbaren Spezifikationen wurden automatisch ergänzt.', variant: 'success' });
    } catch (err) {
      toast({ title: 'Fehler beim Gerätebild-Update', description: 'Das Bild konnte nicht automatisch ergänzt werden.', variant: 'destructive' });
      setSelectedModel(model);
    }
  };

  // Load repair services when moving to step 3
  useEffect(() => {
    if (currentStep === 3 && selectedModel && selectedDeviceType) {
      const fetchRepairServices = async () => {
        try {
          setLoadingRepairs(true);
          // Filter by selected device type AND the precise model so customers only see
          // services that actually match their phone (e.g. iPhone 15-specific repairs),
          // plus generic services that have no model assigned.
          const params: any = {
            deviceType: selectedDeviceType.name,
            limit: 200,
          };
          const brandName = manufacturers.find((m) => m._id === selectedBrand)?.name;
          if (brandName) {
            params.manufacturerPrecise = brandName;
          }
          if (selectedModel?.name) {
            params.modelPrecise = selectedModel.name;
          }
          const response = await getServices(params);
          setRepairServices((response as any).services || []);
        } catch (error) {
          console.error('Error fetching repair services:', error);
          toast({
            title: t('common.error'),
            description: t('home.configurator.toasts.loadRepairsError'),
            variant: 'destructive'
          });
        } finally {
          setLoadingRepairs(false);
        }
      };

      fetchRepairServices();
    }
  }, [currentStep, selectedModel, selectedDeviceType, selectedBrand, manufacturers, toast, t]);

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
            description: t('home.configurator.toasts.loadAddOnsError'),
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
        title: t('home.configurator.toasts.chooseModelTitle'),
        description: t('home.configurator.toasts.chooseModelDescription'),
        variant: 'destructive'
      });
      return;
    }
    if (currentStep === 3 && selectedRepairs.length === 0) {
      toast({
        title: t('home.configurator.toasts.chooseRepairTitle'),
        description: t('home.configurator.toasts.chooseRepairDescription'),
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
        title: t('home.configurator.toasts.tooManyImagesTitle'),
        description: t('home.configurator.toasts.tooManyImagesDescription'),
        variant: 'destructive'
      });
      return;
    }

    // Validate file types and sizes
    const validFiles = files.filter(file => {
      if (!file.type.startsWith('image/')) {
        toast({
          title: t('home.configurator.toasts.invalidFileTypeTitle'),
          description: t('home.configurator.toasts.invalidFileTypeDescription', { file: file.name }),
          variant: 'destructive'
        });
        return false;
      }
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        toast({
          title: t('home.configurator.toasts.fileTooLargeTitle'),
          description: t('home.configurator.toasts.fileTooLargeDescription', { file: file.name }),
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
        title: t('home.configurator.toasts.deviceIncompleteTitle'),
        description: t('home.configurator.toasts.deviceIncompleteDescription'),
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
      title: t('home.configurator.toasts.deviceAddedTitle'),
      description: t('home.configurator.toasts.deviceAddedDescription', { count: devices.length + 1 }),
    });
  };

  // Navigate to repair request questionnaire (NEW)
  const navigateToRepairRequest = () => {
    if (!selectedModel) {
      toast({
        title: t('home.configurator.toasts.noDeviceSelectedTitle'),
        description: t('home.configurator.toasts.noDeviceSelectedDescription'),
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
        const previewImage = deviceImages[String(device.deviceType?.name || device.deviceType || '').toLowerCase()] || deviceImages.smartphone;
        const repairOrderData = {
          deviceType: device.deviceType?.name || device.deviceType,
          deviceBrand: device.brand?.name || device.brand,
          deviceModel: device.model?.name || device.model,
          deviceImage: getModelImage(device.model, previewImage),
          services: device.repairs.map((r: any) => r._id || r),
          serviceNames: device.repairs.map((r: any) => r?.name || String(r)).filter(Boolean),
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
        title: t('home.configurator.toasts.addToCartSuccessTitle'),
        description: t('home.configurator.toasts.addToCartSuccessDescription', {
          count: allDevices.reduce((sum, d) => sum + (d.quantity || 1), 0),
        }),
        variant: 'default'
      });

      // Reset configurator after successful add
      resetConfigurator();

      // Navigate to cart
      navigate('/cart');

    } catch (error: any) {
      console.error('Error adding to cart:', error);
      toast({
        title: t('home.configurator.toasts.addToCartErrorTitle'),
        description: error.message || t('home.configurator.toasts.addToCartErrorDescription'),
        variant: 'destructive'
      });
    }
  };

  const { total, duration } = calculateTotals();

  // Get device preview data
  const getDevicePreviewData = () => {
    if (!selectedDeviceType || !selectedModel) return null;
    
    const deviceTypeKey = selectedDeviceType.name.toLowerCase();
    const fallbackImage = deviceImages[deviceTypeKey] || deviceImages.smartphone;
    const image = getModelImage(selectedModel, fallbackImage);
    const modelProblems = Array.isArray(selectedModel.commonProblems)
      ? selectedModel.commonProblems.filter((problem) => String(problem || '').trim().length > 0)
      : [];
    const selectedBrandName = manufacturers.find((manufacturer) => manufacturer._id === selectedBrand)?.name || '';
    
    return {
      image,
      brandName: selectedBrandName,
      modelName: selectedModel.name,
      problems: modelProblems
    };
  };

  const previewData = getDevicePreviewData();
  const getChoiceLabel = (option: 'yes' | 'no' | 'unsure') => t(`home.configurator.${option}`);
  const getConditionLabel = (option: 'original' | 'refurbished' | 'unsure') => t(`home.configurator.${option}`);

  return (
    <>
    <div className="configurator-container" id="repair-order-configurator">
      <div className="configurator">
        {/* Configurator Header */}
        <div ref={configuratorHeaderRef} className="configurator-header">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
          </svg>
          <h3>{t('home.configurator.title')}</h3>
        </div>

        <div className="configurator-body">
          {/* Step Indicators */}
          <div className="config-steps">
            <div className={`config-step-indicator ${currentStep >= 1 ? 'active' : ''}`} data-step="1">
              <span className="step-num">1</span>
              <span className="step-label">{t('home.configurator.steps.deviceType')}</span>
            </div>
            <div className={`config-step-indicator ${currentStep >= 2 ? 'active' : ''}`} data-step="2">
              <span className="step-num">2</span>
              <span className="step-label">{t('home.configurator.steps.model')}</span>
            </div>
            <div className={`config-step-indicator ${currentStep >= 3 ? 'active' : ''}`} data-step="3">
              <span className="step-num">3</span>
              <span className="step-label">{t('home.configurator.steps.repair')}</span>
            </div>
            <div className={`config-step-indicator ${currentStep >= 4 ? 'active' : ''}`} data-step="4">
              <span className="step-num">4</span>
              <span className="step-label">{t('home.configurator.steps.extras')}</span>
            </div>
            <div className={`config-step-indicator ${currentStep >= 5 ? 'active' : ''}`} data-step="5">
              <span className="step-num">5</span>
              <span className="step-label">{t('home.configurator.steps.info')}</span>
            </div>
            <div className={`config-step-indicator ${currentStep >= 6 ? 'active' : ''}`} data-step="6">
              <span className="step-num">6</span>
              <span className="step-label">{t('home.configurator.steps.total')}</span>
            </div>
          </div>

          {/* STEP 1: Device Type */}
          {currentStep === 1 && (
            <div className="config-step-content active" data-step="1">
              <div className="device-grid">
                {loadingDeviceTypes ? (
                  <div className="col-span-full text-center py-8 text-muted-foreground">
                    {t('home.configurator.loadingDeviceTypes')}
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
                    {t('home.configurator.noDeviceTypes')}
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
                    <label htmlFor="brandSelect">{t('home.configurator.selectBrand')}</label>
                  <Select value={selectedBrand} onValueChange={handleBrandSelect} disabled={loadingManufacturers}>
                    <SelectTrigger className="config-select">
                        <SelectValue placeholder={loadingManufacturers ? t('home.configurator.loadingBrands') : t('home.configurator.selectPlaceholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      {manufacturers.map((manufacturer) => (
                        <SelectItem key={manufacturer._id} value={manufacturer._id}>
                          {manufacturer.logo && (
                            <img
                              src={manufacturer.logo}
                              alt={manufacturer.name + ' Logo'}
                              style={{ width: 22, height: 22, objectFit: 'contain', display: 'inline-block', marginRight: 6, marginLeft: 0, verticalAlign: 'middle' }}
                            />
                          )}
                          {manufacturer.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="config-select-wrapper autocomplete-wrapper">
                  <label htmlFor="modelInput">{t('home.configurator.searchModel')}</label>
                  <Input
                    type="text"
                    className="config-input"
                    id="modelInput"
                    placeholder={loadingModels ? t('home.configurator.loadingModels') : t('home.configurator.modelSearchPlaceholder')}
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
                  {t('home.configurator.back')}
                </button>
                <button 
                  className="config-nav-btn next" 
                  onClick={goToNextStep}
                  disabled={!selectedModel}
                >
                  {t('home.configurator.next')}
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
                    {t('home.configurator.loadingRepairs')}
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
                        <div className="repair-price">{t('home.configurator.repairFrom', { price: service.price.toFixed(2) })}</div>
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
                    {t('home.configurator.noRepairs')}
                  </div>
                )}
              </div>

              {/* Vorabdiagnose hint */}
              <div className="config-diagnose-hint" onClick={() => setShowDiagnoseModal(true)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 11l3 3L22 4"></path>
                  <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
                </svg>
                {t('home.configurator.diagnosisHint')} <span>{t('home.configurator.startDiagnosis')}</span>
              </div>

              {/* Divider */}
              <div className="relative my-5">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-gray-200"></span>
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-3 text-gray-400 font-medium">
                    {t('home.configurator.or')}
                  </span>
                </div>
              </div>

              {/* Request Repair Service Option - Now displayed below repairs */}
              <div className="mb-4 p-3 border border-gray-200 bg-gradient-to-br from-gray-50 to-blue-50/30 rounded-lg">
                <div className="flex items-start gap-2.5">
                  <FileText className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="font-semibold text-sm text-gray-800 mb-1">
                      {t('home.configurator.requestRepairTitle')}
                    </h4>
                    <p className="text-xs text-gray-600 leading-relaxed mb-2.5">
                      {t('home.configurator.requestRepairDescription')}
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
                      <span>{t('home.configurator.requestRepairButton')}</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
              <div className="config-nav">
                <button className="config-nav-btn back" onClick={goToPreviousStep}>
                  <ChevronLeft className="w-4 h-4" />
                  {t('home.configurator.back')}
                </button>
                <button 
                  className="config-nav-btn next" 
                  onClick={goToNextStep}
                  disabled={selectedRepairs.length === 0}
                >
                  {t('home.configurator.next')}
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
                  {t('home.configurator.extrasDescription')}
                </p>
              </div>
              <div className="extras-grid">
                {loadingAddOns ? (
                  <div className="text-center py-8 text-muted-foreground">
                    {t('home.configurator.loadingAddOns')}
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
                    <p className="font-medium">{t('home.configurator.noAddOnsTitle')}</p>
                    <p className="text-xs mt-1">{t('home.configurator.noAddOnsDescription')}</p>
                  </div>
                )}
              </div>
              <div className="config-nav">
                <button className="config-nav-btn back" onClick={goToPreviousStep}>
                  <ChevronLeft className="w-4 h-4" />
                  {t('home.configurator.back')}
                </button>
                <button className="config-nav-btn next" onClick={goToNextStep}>
                  {t('home.configurator.next')}
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 5: Unlock Code/Pattern & Additional Info (Combined with old Step 6) */}
          {currentStep === 5 && (
            <div
              className="config-step-content active"
              data-step="5"
              style={{ WebkitTextSizeAdjust: '100%' }}
            >
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
                      <h3 className="font-semibold text-sm" style={{ color: '#1a2a5e' }}>{t('home.configurator.deviceLockTitle')}</h3>
                    </div>
                    {showUnlockDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  
                  {showUnlockDetails && (
                    <div style={{ padding: '16px' }}>
                      <p className="text-xs text-gray-600 mb-3">
                        {t('home.configurator.deviceLockDescription')}
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
                  className="config-step5-additional-toggle"
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
                    transition: 'all 0.3s ease',
                    touchAction: 'manipulation',
                    WebkitTapHighlightColor: 'transparent'
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
                        {t('home.configurator.additionalInfoTitle')}
                      </h4>
                      <p className="text-xs" style={{ color: '#4a5568' }}>
                        {t('home.configurator.additionalInfoDescription')}
                      </p>
                    </div>
                    {showAdditionalInfo ? <ChevronUp className="w-5 h-5" style={{ color: '#1a2a5e' }} /> : <ChevronDown className="w-5 h-5" style={{ color: '#1a2a5e' }} />}
                  </div>
                </button>

                {/* Additional Information Content (Previously Step 6) */}
                {showAdditionalInfo && (
                  <div className="config-step5-additional-panel" style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '20px', background: '#fafbfc', borderRadius: '8px', border: '1px solid #e8eaf0', WebkitTextSizeAdjust: '100%', width: '100%', boxSizing: 'border-box', overflowX: 'hidden' }}>
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
                        {t('home.configurator.errorDescription')}
                      </label>
                      <textarea
                        id="errorDesc"
                        placeholder={t('home.configurator.errorDescriptionPlaceholder')}
                        value={errorDescription}
                        onChange={(e) => setErrorDescription(e.target.value)}
                        rows={4}
                        style={{
                          width: '100%',
                          padding: '12px 16px',
                          border: '2px solid #d8dce6',
                          borderRadius: '6px',
                          fontSize: '16px',
                          fontFamily: 'var(--font-main, Inter, sans-serif)',
                          color: '#2d3748',
                          resize: 'none',
                          boxSizing: 'border-box',
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
                        {t('home.configurator.waterDamage')}
                      </label>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '8px', width: '100%' }}>
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
                              textAlign: 'center',
                              minWidth: 0,
                              overflowWrap: 'anywhere'
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
                            {getChoiceLabel(option as 'yes' | 'no' | 'unsure')}
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
                        {t('home.configurator.previousRepairAttempts')}
                      </label>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '8px', width: '100%' }}>
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
                              textAlign: 'center',
                              minWidth: 0,
                              overflowWrap: 'anywhere'
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
                            {getChoiceLabel(option as 'yes' | 'no' | 'unsure')}
                          </button>
                        ))}
                      </div>

                      {previousRepairAttempts === 'yes' && (
                        <textarea
                          placeholder={t('home.configurator.previousRepairAttemptsPlaceholder')}
                          value={previousRepairDetails}
                          onChange={(e) => setPreviousRepairDetails(e.target.value)}
                          rows={3}
                          style={{
                            width: '100%',
                            padding: '12px 16px',
                            border: '2px solid #d8dce6',
                            borderRadius: '6px',
                            fontSize: '16px',
                            fontFamily: 'var(--font-main, Inter, sans-serif)',
                            color: '#2d3748',
                            resize: 'none',
                            marginTop: '8px',
                            boxSizing: 'border-box',
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
                        {t('home.configurator.itemCondition')}
                      </label>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '8px', width: '100%' }}>
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
                              textAlign: 'center',
                              minWidth: 0,
                              overflowWrap: 'anywhere'
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
                            {getConditionLabel(option as 'original' | 'refurbished' | 'unsure')}
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
                        {t('home.configurator.uploadPhotos')}
                      </label>
                      <Input
                        id="photos"
                        type="file"
                        multiple
                        accept="image/*"
                        onChange={handlePhotoUpload}
                        disabled={photos.length >= 5}
                        style={{
                          width: '100%',
                          padding: '12px 16px',
                          border: '2px solid #d8dce6',
                          borderRadius: '6px',
                          fontSize: '16px',
                          cursor: 'pointer',
                          boxSizing: 'border-box'
                        }}
                      />
                      <p style={{ fontSize: '0.75rem', color: '#8892a8' }}>
                        {t('home.configurator.uploadedPhotos', { count: photos.length })}
                      </p>

                      {/* Photo Previews */}
                      {photoPreviewUrls.length > 0 && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginTop: '12px' }}>
                          {photoPreviewUrls.map((url, index) => (
                            <div key={index} className="relative group">
                              <img
                                src={url}
                                alt={t('home.configurator.photoPreviewAlt', { index: index + 1 })}
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
                  {t('home.configurator.back')}
                </button>
                <button className="config-nav-btn next" onClick={goToNextStep}>
                  {t('home.configurator.next')}
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
                  {t('home.configurator.orderSummary')}
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
                              {t('home.configurator.deviceLabel', { index: idx + 1, model: device.model?.name })}
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
                            <p style={{ marginBottom: '0.25rem' }}><strong>{t('home.configurator.type')}:</strong> {device.deviceType?.name}</p>
                            <p style={{ marginBottom: '0.25rem' }}><strong>{t('home.configurator.brand')}:</strong> {device.brand?.name}</p>
                            
                            {/* Repair Services List */}
                            {device.repairs.length > 0 && (
                              <div style={{ marginTop: '0.5rem', marginBottom: '0.5rem' }}>
                                <p style={{ marginBottom: '0.35rem', color: '#f5b800', fontWeight: 600 }}>{t('home.configurator.repairs')}:</p>
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
                                <p style={{ marginBottom: '0.35rem', color: '#f5b800', fontWeight: 600 }}>{t('home.configurator.extras')}:</p>
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
                              <p style={{ marginBottom: '0.25rem' }}><strong>{t('home.configurator.unlock')}:</strong> ✓</p>
                            )}
                            {device.photos?.length > 0 && (
                              <p style={{ marginBottom: '0.25rem' }}><strong>{t('home.configurator.photos')}:</strong> {device.photos.length}</p>
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
                                  {t('home.configurator.quantityForConfiguration')}
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
                                      {currentDeviceQuantity === 1 ? t('home.configurator.singleDevice') : t('home.configurator.multipleDevices')}
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
                                      {t('home.configurator.identicalRepairsTitle', { count: currentDeviceQuantity })}
                                    </p>
                                    <p style={{ fontSize: '0.7rem', color: '#718096', marginTop: '0.15rem' }}>
                                      {t('home.configurator.identicalRepairsDescription', { count: device.repairs.length })}
                                    </p>
                                  </div>
                                )}
                              </div>
                            )}
                            
                            <div style={{ paddingTop: '0.5rem', borderTop: '1px solid #e2e8f0', marginTop: '0.5rem' }}>
                              {quantity > 1 && (
                                <p style={{ marginBottom: '0.25rem', color: '#718096' }}>
                                  {t('home.configurator.pricePerDevice', { price: singleDeviceTotal.toFixed(2) })}
                                </p>
                              )}
                              <p style={{ fontSize: '1.125rem', fontWeight: 700, color: '#1a2a5e' }}>
                                {quantity > 1 ? t('home.configurator.totalPrice', { price: deviceTotal.toFixed(2) }) : t('home.configurator.singlePrice', { price: deviceTotal.toFixed(2) })}
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
                    <div className="label">{t('home.configurator.totalDevices')}</div>
                    <div className="value">{(() => {
                      let count = devices.reduce((sum, d) => sum + (d.quantity || 1), 0);
                      if (selectedModel && selectedRepairs.length > 0) count += currentDeviceQuantity;
                      return count;
                    })()}</div>
                  </div>
                  <div className="config-result-item">
                    <div className="label">{t('home.configurator.deviceTypes')}</div>
                    <div className="value small">{(() => {
                      let count = devices.length;
                      if (selectedModel && selectedRepairs.length > 0) count++;
                      return count;
                    })()}</div>
                  </div>
                  <div className="config-result-item">
                    <div className="label">{t('home.configurator.priceTotal')}</div>
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
                    <div className="label">{t('home.configurator.shipping')}</div>
                    <div className="value small">{t('home.configurator.free')}</div>
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
                  {t('home.configurator.addAnotherDeviceTitle')}
                </h4>
                <p style={{ fontSize: '0.8rem', color: '#4a5568', marginBottom: '0.65rem' }}>
                  {t('home.configurator.addAnotherDeviceDescription')}
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
                  {t('home.configurator.addAnotherDeviceButton')}
                </button>
                <p style={{ fontSize: '0.7rem', color: '#718096', marginTop: '0.4rem', textAlign: 'center' }}>
                  {t('home.configurator.addAnotherDeviceHint')}
                </p>
              </div>

              {/* CTA Button */}
              <button className="config-result-cta" onClick={handleAddToCart} style={{ marginTop: '1.5rem' }}>
                {t('home.configurator.addToCart')}
                <ChevronRight className="w-5 h-5 ml-2" />
              </button>
              <div className="config-nav" style={{ marginTop: '16px' }}>
                <button className="config-nav-btn back" onClick={goToPreviousStep}>
                  <ChevronLeft className="w-4 h-4" />
                  {t('home.configurator.back')}
                </button>
                <button className="config-nav-btn back" onClick={resetConfigurator}>
                  {t('home.configurator.restart')}
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
              {[previewData?.brandName, previewData?.modelName].filter(Boolean).join(' ')}
            </div>
            <div className="device-preview-panel-problems">
              <div className="device-preview-panel-problems-title">
                <AlertCircle className="w-3 h-3" />
                  {t('home.configurator.commonProblems')}
              </div>
              <ul className="device-preview-panel-list" id="devicePreviewList">
                {previewData?.problems.length ? (
                  previewData.problems.map((problem, index) => (
                    <li key={index}>{problem}</li>
                  ))
                ) : (
                    <li>{t('home.configurator.noCommonProblems')}</li>
                )}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>

    <VorabdiagnoseModal isOpen={showDiagnoseModal} onClose={() => setShowDiagnoseModal(false)} />
    </>
  );
}
