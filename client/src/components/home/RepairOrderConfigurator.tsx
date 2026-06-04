import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
  Info,
  Search,
  BatteryCharging,
  Camera,
  Volume2,
  Settings2,
  Zap,
  Cpu,
  Wifi,
  SlidersHorizontal,
  Layers,
  LayoutGrid,
  MonitorSmartphone,
  Power,
  HardDrive,
  Tag,
  Truck
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

const LOCAL_BRAND_LOGOS: Record<string, string> = {
  acer: '/assets/brand-logos/acer.png',
  apple: '/assets/brand-logos/apple.png',
  asus: '/assets/brand-logos/asus.png',
  blackberry: '/assets/brand-logos/blackberry.png',
  dell: '/assets/brand-logos/dell.png',
  google: '/assets/brand-logos/google.png',
  'hmd global': '/assets/brand-logos/hmd-global.png',
  htc: '/assets/brand-logos/htc.png',
  huawei: '/assets/brand-logos/huawei.png',
  lenovo: '/assets/brand-logos/lenovo.png',
  lg: '/assets/brand-logos/lg.png',
  microsoft: '/assets/brand-logos/microsoft.png',
  windows: '/assets/brand-logos/microsoft.png',
  motorola: '/assets/brand-logos/motorola.png',
  nokia: '/assets/brand-logos/nokia.png',
  oneplus: '/assets/brand-logos/oneplus.png',
  samsung: '/assets/brand-logos/samsung.png',
  sony: '/assets/brand-logos/sony.png',
  toshiba: '/assets/brand-logos/toshiba.png',
  xiaomi: '/assets/brand-logos/xiaomi.png',
};

const getLocalBrandLogo = (name?: string) => {
  if (!name) return null;
  const normalized = name.trim().toLowerCase();

  if (LOCAL_BRAND_LOGOS[normalized]) {
    return LOCAL_BRAND_LOGOS[normalized];
  }

  if (normalized.includes(',')) {
    for (const part of normalized.split(',').map((value) => value.trim())) {
      if (LOCAL_BRAND_LOGOS[part]) {
        return LOCAL_BRAND_LOGOS[part];
      }
    }
  }

  return null;
};

const normalizeLogoSource = (logo?: string) => {
  const normalizedLogo = logo?.trim();
  if (!normalizedLogo) {
    return null;
  }

  if (
    normalizedLogo.startsWith('http://') ||
    normalizedLogo.startsWith('https://') ||
    normalizedLogo.startsWith('/') ||
    normalizedLogo.startsWith('data:')
  ) {
    return normalizedLogo;
  }

  return `data:image/jpeg;base64,${normalizedLogo}`;
};

const resolveBrandLogo = (name?: string, logo?: string) =>
  getLocalBrandLogo(name) || normalizeLogoSource(logo);

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

const parseServiceDescription = (description: string) => {
  const lines = String(description || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const paragraphs: string[] = [];
  const bullets: string[] = [];

  for (const line of lines) {
    if (/^[-*•]\s+/.test(line)) {
      bullets.push(line.replace(/^[-*•]\s+/, ''));
    } else {
      paragraphs.push(line);
    }
  }

  return { paragraphs, bullets };
};

const formatPrice = (value: number) =>
  new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

const isPriceOnRequestService = (service: RepairService) => Number(service?.price || 0) <= 0;

const getCategoryIcon = (category: string, size: 'sm' | 'md' = 'md') => {
  const cls = size === 'sm' ? 'w-4 h-4' : 'w-6 h-6';
  const cat = category.toLowerCase();
  if (cat.includes('display') || cat.includes('bildschirm') || cat.includes('screen') || cat.includes('glas'))
    return <MonitorSmartphone className={cls} />;
  if (cat.includes('akku') || cat.includes('batterie') || cat.includes('battery'))
    return <BatteryCharging className={cls} />;
  if (cat.includes('wasser') || cat.includes('feuchtigkeit') || cat.includes('water') || cat.includes('liquid'))
    return <Droplets className={cls} />;
  if (cat.includes('kamera') || cat.includes('camera') || cat.includes('foto'))
    return <Camera className={cls} />;
  if (cat.includes('lautsprecher') || cat.includes('mikrofon') || cat.includes('audio') || cat.includes('sound') || cat.includes('speaker'))
    return <Volume2 className={cls} />;
  if (cat.includes('software') || cat.includes('system') || cat.includes('reset') || cat.includes('update'))
    return <Settings2 className={cls} />;
  if (cat.includes('laden') || cat.includes('ladebuchse') || cat.includes('anschluss') || cat.includes('charging') || cat.includes('usb') || cat.includes('port'))
    return <Zap className={cls} />;
  if (cat.includes('power') || cat.includes('strom') || cat.includes('ein') && cat.includes('aus'))
    return <Power className={cls} />;
  if (cat.includes('platine') || cat.includes('mainboard') || cat.includes('logic') || cat.includes('board') || cat.includes('chip'))
    return <Cpu className={cls} />;
  if (cat.includes('hardware') || cat.includes('komponente') || cat.includes('bauteil'))
    return <HardDrive className={cls} />;
  if (cat.includes('emergency') || cat.includes('notfall') || cat.includes('dringend') || cat.includes('urgent'))
    return <AlertCircle className={cls} />;
  if (cat.includes('netz') || cat.includes('wifi') || cat.includes('wlan') || cat.includes('signal') || cat.includes('antenne'))
    return <Wifi className={cls} />;
  if (cat.includes('taste') || cat.includes('button') || cat.includes('schalter') || cat.includes('switch'))
    return <SlidersHorizontal className={cls} />;
  if (cat.includes('schutz') || cat.includes('folie') || cat.includes('protection') || cat.includes('cover'))
    return <Layers className={cls} />;
  if (cat.includes('gehäuse') || cat.includes('back') || cat.includes('rahmen') || cat.includes('frame'))
    return <Package className={cls} />;
  if (cat.includes('lock') || cat.includes('entsperr') || cat.includes('unlock') || cat.includes('pin'))
    return <Lock className={cls} />;
  return <Wrench className={cls} />;
};

const normalizeSearchText = (value: string | undefined | null) =>
  String(value || '')
    .toLowerCase()
    .replace(/[,_;:/]+/g, ' ')
    .trim();

const getSearchTokens = (value: string) =>
  normalizeSearchText(value)
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);

const getModelSearchScore = (model: DeviceModel, queryTokens: string[]) => {
  const normalizedName = normalizeSearchText(model.name);
  const normalizedSeries = normalizeSearchText(model.series);
  const normalizedModelNumbers = (Array.isArray(model.modelNumbers) ? model.modelNumbers : [])
    .map((value) => normalizeSearchText(value))
    .filter(Boolean);
  const normalizedSynonyms = (Array.isArray(model.synonyms) ? model.synonyms : [])
    .map((value) => normalizeSearchText(value))
    .filter(Boolean);

  let score = 0;

  for (const token of queryTokens) {
    if (normalizedName === token) {
      score += 120;
      continue;
    }

    if (normalizedName.startsWith(token)) {
      score += 90;
      continue;
    }

    if (normalizedName.includes(token)) {
      score += 70;
      continue;
    }

    if (normalizedSeries === token) {
      score += 60;
      continue;
    }

    if (normalizedSeries.includes(token)) {
      score += 45;
      continue;
    }

    if (normalizedModelNumbers.some((value) => value === token)) {
      score += 50;
      continue;
    }

    if (normalizedModelNumbers.some((value) => value.includes(token))) {
      score += 35;
      continue;
    }

    if (normalizedSynonyms.some((value) => value === token)) {
      score += 30;
      continue;
    }

    if (normalizedSynonyms.some((value) => value.includes(token))) {
      score += 20;
    }
  }

  const fullQuery = queryTokens.join(' ');
  if (fullQuery) {
    if (normalizedName === fullQuery) {
      score += 300;
    } else if (normalizedName.startsWith(fullQuery)) {
      score += 180;
    } else if (normalizedName.includes(fullQuery)) {
      score += 120;
    }
  }

  return score;
};

// Device images based on device type
const deviceImages: Record<string, string> = {
  smartphone: '/images/smartphone_mu.png',
  tablet: '/images/tablet_mu.png',
  notebook: '/images/notebook_mu.png',
  laptop: '/images/notebook_mu.png',
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
};

export function RepairOrderConfigurator({ onComplete }: RepairOrderConfiguratorProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const navigate = useNavigate();
  const configuratorHeaderRef = useRef<HTMLDivElement | null>(null);
  const additionalInfoSectionRef = useRef<HTMLDivElement | null>(null);
  const previousStepRef = useRef(1);
  const stepDefinitions = [
    { step: 1, labelKey: 'home.configurator.steps.deviceType' },
    { step: 2, labelKey: 'home.configurator.steps.model' },
    { step: 3, labelKey: 'home.configurator.steps.repair' },
    { step: 4, labelKey: 'home.configurator.steps.extras' },
    { step: 5, labelKey: 'home.configurator.steps.info' },
    { step: 6, labelKey: 'home.configurator.steps.total' },
  ];

  // Configurator state
  const [currentStep, setCurrentStep] = useState(1);
  const [showDiagnoseModal, setShowDiagnoseModal] = useState(false);
  const [serviceInfoDialog, setServiceInfoDialog] = useState<RepairService | null>(null);
  const [hoveredTooltip, setHoveredTooltip] = useState<{ service: RepairService; left: number; top: number; arrowLeft: number } | null>(null);
  const shouldJumpToStep3Ref = useRef(false);
  const pendingServiceSelectionIdRef = useRef<string | null>(null);
  const pendingRepairCategoryRef = useRef<string | null>(null);
  const TOOLTIP_WIDTH = 220;
  const TOOLTIP_MARGIN = 8;

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
  const [selectedRepairCategory, setSelectedRepairCategory] = useState<string | null>(null);

  // Unlock code/pattern state (NEW)
  const [unlockPattern, setUnlockPattern] = useState<string[]>([]);
  const [unlockCode, setUnlockCode] = useState<string>('');
  const [noDeviceLock, setNoDeviceLock] = useState(true);
  
  // Additional info toggle state
  const [showAdditionalInfo, setShowAdditionalInfo] = useState(false);
  const [showUnlockDetails, setShowUnlockDetails] = useState(true);

  const scrollAdditionalInfoIntoView = () => {
    if (typeof window === 'undefined') {
      return;
    }

    // Wait for collapse/expand state updates before measuring and scrolling.
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        additionalInfoSectionRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      });
    });
  };

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
  const [showMobileModelModal, setShowMobileModelModal] = useState(false);
  const [isMobileSearchActive, setIsMobileSearchActive] = useState(false);
  const modelInputRef = useRef<HTMLInputElement>(null);

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

  // Jump to step 3 when all required selections are made from navigation
  useEffect(() => {
    if (shouldJumpToStep3Ref.current && selectedDeviceType && selectedBrand && selectedModel) {
      console.log('[Configurator] Jumping to step 3 with:', {
        selectedDeviceType: selectedDeviceType.name,
        selectedBrand,
        selectedModel: selectedModel.name
      });
      setCurrentStep(3);
      shouldJumpToStep3Ref.current = false;
    } else if (shouldJumpToStep3Ref.current) {
      console.log('[Configurator] Waiting for all selections:', {
        shouldJumpToStep3Ref: shouldJumpToStep3Ref.current,
        selectedDeviceType: selectedDeviceType?.name || 'NOT SET',
        selectedBrand: selectedBrand || 'NOT SET',
        selectedModel: selectedModel?.name || 'NOT SET'
      });
    }
  }, [selectedDeviceType, selectedBrand, selectedModel]);

  // Alternative: Jump to step 3 when services are loaded (for when model exists but wasn't explicitly selected)
  useEffect(() => {
    if (currentStep === 3 && repairServices.length > 0 && shouldJumpToStep3Ref.current) {
      console.log('[Configurator] Services loaded, finalizing step 3 jump');
      shouldJumpToStep3Ref.current = false;
    }
  }, [currentStep, repairServices]);

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
            if (navDeviceSelection?.selectedServiceId) {
              pendingServiceSelectionIdRef.current = String(navDeviceSelection.selectedServiceId);
            }
            if (navDeviceSelection?.selectedRepairCategory) {
              pendingRepairCategoryRef.current = String(navDeviceSelection.selectedRepairCategory);
            }

            const navPreselectedServiceJson = sessionStorage.getItem('navPreselectedService');
            if (navPreselectedServiceJson) {
              try {
                const navPreselectedService = JSON.parse(navPreselectedServiceJson);
                if (navPreselectedService?._id) {
                  pendingServiceSelectionIdRef.current = String(navPreselectedService._id);
                }
              } catch (error) {
                console.warn('Error parsing navPreselectedService in mount flow:', error);
              }
            }

            const requestedConfiguratorStep = sessionStorage.getItem('navConfiguratorStep') === '3' ? 3 : 2;
            console.log('[Configurator] Navigation device selection found:', {
              navDeviceSelection,
              requestedConfiguratorStep,
              deviceTypesLoaded: deviceTypesList.length
            });

            // Find the matching device type
            const matchedDeviceType = deviceTypesList.find(
              (dt: DeviceType) => dt.name.toLowerCase() === navDeviceSelection.deviceType.toLowerCase()
            );
            
            console.log('[Configurator] Device type matching:', {
              searchingFor: navDeviceSelection.deviceType,
              availableTypes: deviceTypesList.map((dt: DeviceType) => dt.name),
              matched: matchedDeviceType?.name || 'NOT FOUND'
            });

            if (matchedDeviceType && navDeviceSelection.manufacturer && navDeviceSelection.modelName) {
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
                const matchedModel = findMatchingModelByName(modelsList, navDeviceSelection.modelName);

                if (matchedModel) {
                  setSelectedModel(matchedModel);
                  setModelSearchQuery(getModelSearchPrefill(matchedModel));
                  
                  toast({
                    title: t('common.success'),
                    description: `${matchedModel.name} ${t('home.configurator.toasts.deviceSelectedTitle').toLowerCase()}`,
                  });
                  
                  // Mark that we should jump to step 3 after state updates
                  if (requestedConfiguratorStep === 3) {
                    shouldJumpToStep3Ref.current = true;
                  }
                } else {
                  // No match at all - still show filtered models and jump to step 3 if requested
                  setModelSearchQuery(navDeviceSelection.modelName || '');
                  if (requestedConfiguratorStep === 3) {
                    shouldJumpToStep3Ref.current = true;
                  }
                  
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
            sessionStorage.removeItem('navConfiguratorStep');
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
    const handleNavDeviceSelected = async (event: Event) => {
      const customEvent = event as CustomEvent<{ navDeviceSelection?: any; navPreselectedService?: any }>;
      const detailNavDeviceSelection = customEvent.detail?.navDeviceSelection;
      const detailPreselectedService = customEvent.detail?.navPreselectedService;

      const navDeviceSelectionJson = sessionStorage.getItem('navDeviceSelection');
      const navPreselectedServiceJson = sessionStorage.getItem('navPreselectedService');

      let navDeviceSelection = detailNavDeviceSelection;
      if (!navDeviceSelection && navDeviceSelectionJson) {
        try {
          navDeviceSelection = JSON.parse(navDeviceSelectionJson);
        } catch (error) {
          console.warn('Error parsing navDeviceSelection in event flow:', error);
          return;
        }
      }
      if (!navDeviceSelection) return;

      try {
        if (navDeviceSelection?.selectedServiceId) {
          pendingServiceSelectionIdRef.current = String(navDeviceSelection.selectedServiceId);
        }
        if (navDeviceSelection?.selectedRepairCategory) {
          pendingRepairCategoryRef.current = String(navDeviceSelection.selectedRepairCategory);
        }

        if (detailPreselectedService?._id) {
          pendingServiceSelectionIdRef.current = String(detailPreselectedService._id);
        } else if (navPreselectedServiceJson) {
          try {
            const navPreselectedService = JSON.parse(navPreselectedServiceJson);
            if (navPreselectedService?._id) {
              pendingServiceSelectionIdRef.current = String(navPreselectedService._id);
            }
          } catch (error) {
            console.warn('Error parsing navPreselectedService in event flow:', error);
          }
        }

        const requestedConfiguratorStep = sessionStorage.getItem('navConfiguratorStep') === '3' ? 3 : 2;
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
          if (navDeviceSelection.manufacturer && navDeviceSelection.modelName && !navDeviceSelection.showAllModels) {
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
                const matchingModel = findMatchingModelByName(modelsList, navDeviceSelection.modelName);

                if (matchingModel) {
                  setSelectedModel(matchingModel);
                  setModelSearchQuery(getModelSearchPrefill(matchingModel));
                  toast({
                    title: t('home.configurator.toasts.deviceSelectedTitle'),
                    description: `${matchingManufacturer.name} ${matchingModel.name}`,
                    variant: 'default'
                  });
                  
                  // Mark that we should jump to step 3 if requested
                  if (requestedConfiguratorStep === 3) {
                    shouldJumpToStep3Ref.current = true;
                  }
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
        sessionStorage.removeItem('navConfiguratorStep');
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
    const queryTokens = getSearchTokens(modelSearchQuery);
    if (queryTokens.length < 1) {
      setFilteredModels(models);
      return;
    }

    const filtered = models.filter((model) => {
      const searchableValues = [
        model.name,
        model.series,
        ...(Array.isArray(model.modelNumbers) ? model.modelNumbers : []),
        ...(Array.isArray(model.synonyms) ? model.synonyms : []),
      ];

      const normalizedValues = searchableValues
        .map((value) => normalizeSearchText(value))
        .filter(Boolean);

      return queryTokens.every((token) =>
        normalizedValues.some((value) => value.includes(token))
      );
    });

    filtered.sort((left, right) => {
      const scoreDifference = getModelSearchScore(right, queryTokens) - getModelSearchScore(left, queryTokens);
      if (scoreDifference !== 0) {
        return scoreDifference;
      }

      return left.name.localeCompare(right.name, 'de', { sensitivity: 'base' });
    });

    setFilteredModels(filtered);
  }, [modelSearchQuery, models]);

  // Detect if mobile modal should be used (small screens or horizontal full-width layout)
  const [useMobileModal, setUseMobileModal] = useState(false);
  
  useEffect(() => {
    const checkScreenSize = () => {
      // Use mobile modal for:
      // 1. Very small screens (height < 600px or width < 480px)
      // 2. Tablets and smaller devices where configurator takes full width (width < 1024px)
      const shouldUseMobileModal = 
        window.innerHeight < 600 || 
        window.innerWidth < 480 ||
        window.innerWidth < 1024;
      setUseMobileModal(shouldUseMobileModal);
    };
    
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  // Prevent body scroll when mobile modal is open
  useEffect(() => {
    if (showMobileModelModal) {
      // Save current scroll position
      const scrollY = window.scrollY;
      
      // Prevent body scroll
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
      
      return () => {
        // Restore body scroll
        document.body.style.overflow = '';
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        
        // Restore scroll position
        window.scrollTo(0, scrollY);
      };
    }
  }, [showMobileModelModal]);

  // Handle opening model selection on mobile
  const handleMobileModelClick = () => {
    if (useMobileModal) {
      setShowMobileModelModal(true);
      setIsMobileSearchActive(false);
    } else {
      setShowModelDropdown(true);
    }
  };

  // Handle closing mobile modal
  const closeMobileModelModal = () => {
    setShowMobileModelModal(false);
    setIsMobileSearchActive(false);
    setModelSearchQuery('');
  };

  const getModelSearchPrefill = (model: DeviceModel) => {
    const modelNumbers = Array.isArray(model.modelNumbers)
      ? model.modelNumbers.filter((number) => String(number || '').trim().length > 0)
      : [];

    return modelNumbers.length > 0 ? `${model.name} ${modelNumbers.join(' ')}` : model.name;
  };

  const findMatchingModelByName = (modelsList: DeviceModel[], targetName: string | undefined) => {
    const normalizedTarget = normalizeSearchText(targetName || '');
    if (!normalizedTarget) {
      return null;
    }

    const exactMatch = modelsList.find((model) => normalizeSearchText(model.name) === normalizedTarget);
    if (exactMatch) {
      return exactMatch;
    }

    const partialMatch = modelsList.find((model) => {
      const normalizedModelName = normalizeSearchText(model.name);
      return normalizedModelName.includes(normalizedTarget) || normalizedTarget.includes(normalizedModelName);
    });

    if (partialMatch) {
      return partialMatch;
    }

    const targetTokens = normalizedTarget.split(' ').filter(Boolean);
    if (targetTokens.length === 0) {
      return null;
    }

    let bestMatch: { model: DeviceModel; score: number } | null = null;

    for (const model of modelsList) {
      const modelTokens = normalizeSearchText(model.name).split(' ').filter(Boolean);
      if (modelTokens.length === 0) {
        continue;
      }

      let score = 0;
      for (const token of targetTokens) {
        if (modelTokens.includes(token)) {
          score += 1;
        }
      }

      if (score > 0 && (!bestMatch || score > bestMatch.score)) {
        bestMatch = { model, score };
      }
    }

    return bestMatch?.model || null;
  };

  const prepareModelSearchForEditing = () => {
    if (!selectedModel) {
      return;
    }

    const selectedPrefill = getModelSearchPrefill(selectedModel);
    if (normalizeSearchText(modelSearchQuery) === normalizeSearchText(selectedPrefill)) {
      setModelSearchQuery(selectedModel.name);
    }
  };

  const handleModelInputFocus = () => {
    prepareModelSearchForEditing();
    setShowModelDropdown(true);
  };

  const handleActivateMobileSearch = () => {
    prepareModelSearchForEditing();
    setIsMobileSearchActive(true);
  };

  // Handle model selection
  // Erweiterte Model-Auswahl mit Bild- und Specs-Check
  const handleModelSelect = async (model: DeviceModel) => {
    // Nur wenn wirklich kein nutzbares Bild vorhanden ist, hole Daten von mobileapi.dev
    if (getModelImage(model)) {
      setSelectedModel(model);
      setModelSearchQuery(getModelSearchPrefill(model));
      setShowModelDropdown(false);
      setShowMobileModelModal(false);
      setIsMobileSearchActive(false);
      return;
    }
    try {
      setModelSearchQuery(getModelSearchPrefill(model));
      setShowModelDropdown(false);
      setShowMobileModelModal(false);
      setIsMobileSearchActive(false);
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
        image: (best.image_url && best.image_url.trim()) ? best.image_url : model.image,
        images: (best.image_url && best.image_url.trim()) ? [{ url: best.image_url.trim() }] : model.images || [],
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
          const services = (response as any).services || [];
          setRepairServices(services);
          // If there's 0 or 1 category no chips will be shown; auto-select 'all' so the grid is visible
          const uniqueCategories = Array.from(new Set(services.map((s: any) => (s.category || '').trim()).filter((c: any) => c.length > 0)));
          // Use functional updater to avoid overwriting a category already set by
          // navigation auto-select (which runs synchronously before this async fetch completes).
          setSelectedRepairCategory(prev => {
            if (pendingRepairCategoryRef.current && uniqueCategories.includes(pendingRepairCategoryRef.current)) {
              const restoredCategory = pendingRepairCategoryRef.current;
              pendingRepairCategoryRef.current = null;
              return restoredCategory;
            }
            if (prev !== null && uniqueCategories.includes(prev as string)) {
              return prev; // keep a valid pre-selected category
            }
            return uniqueCategories.length <= 1 ? 'all' : null;
          });
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

  // Auto-select service from navigation search
  useEffect(() => {
    if (currentStep === 3 && repairServices.length > 0) {
      try {
        let serviceIdToSelect: string | undefined = pendingServiceSelectionIdRef.current || undefined;
        
        // Try to get service ID from navDeviceSelection first
        let navDeviceSelectionJson: string | null = null;
        if (!serviceIdToSelect) {
          navDeviceSelectionJson = sessionStorage.getItem('navDeviceSelection');
        }
        if (!serviceIdToSelect && navDeviceSelectionJson) {
          const navDeviceSelection = JSON.parse(navDeviceSelectionJson);
          serviceIdToSelect = navDeviceSelection.selectedServiceId;
        }

        // Fallback to navPreselectedService if available
        if (!serviceIdToSelect) {
          const navPreselectedServiceJson = sessionStorage.getItem('navPreselectedService');
          if (navPreselectedServiceJson) {
            const navPreselectedService = JSON.parse(navPreselectedServiceJson);
            serviceIdToSelect = navPreselectedService._id;
          }
        }

        if (serviceIdToSelect) {
          const serviceToSelect = repairServices.find(s => s._id === serviceIdToSelect);
          if (serviceToSelect) {
            setSelectedRepairs([serviceToSelect]);
            // Also activate the matching category so the repair grid becomes visible
            setSelectedRepairCategory(serviceToSelect.category || 'all');
            console.log('Auto-selected service from search:', serviceToSelect.name, 'category:', serviceToSelect.category);
            pendingServiceSelectionIdRef.current = null;
            
            // Clear both session items after using them
            if (navDeviceSelectionJson) {
              const navDeviceSelection = JSON.parse(navDeviceSelectionJson);
              navDeviceSelection.selectedServiceId = undefined;
              navDeviceSelection.selectedServiceName = undefined;
              sessionStorage.setItem('navDeviceSelection', JSON.stringify(navDeviceSelection));
            }
            sessionStorage.removeItem('navPreselectedService');
          } else {
            // Service not found in the current list (e.g. different model selected) — clear
            // stale refs and session entries so they don't affect subsequent interactions.
            console.warn('[Configurator] Pre-selected service not found in step-3 list, clearing pending ID:', serviceIdToSelect);
            pendingServiceSelectionIdRef.current = null;
            sessionStorage.removeItem('navPreselectedService');
          }
        }
      } catch (error) {
        console.error('Error auto-selecting service:', error);
      }
    }
  }, [currentStep, repairServices]);

  // Handle repair selection
  const toggleRepairSelection = (service: RepairService) => {
    if (isPriceOnRequestService(service)) {
      navigateToRepairRequest();
      return;
    }

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

  const canJumpToStep = (targetStep: number) => {
    if (targetStep <= currentStep) {
      return true;
    }

    if (targetStep === 2) {
      return !!selectedDeviceType;
    }

    if (targetStep === 3) {
      return !!selectedModel;
    }

    if (targetStep >= 4) {
      return !!selectedModel && selectedRepairs.length > 0;
    }

    return true;
  };

  const showStepNavigationToast = (targetStep: number) => {
    if (targetStep === 2) {
      toast({
        title: t('home.configurator.toasts.chooseDeviceTypeTitle', 'Geraetetyp waehlen'),
        description: t('home.configurator.toasts.chooseDeviceTypeDescription', 'Bitte waehlen Sie zuerst einen Geraetetyp aus.'),
        variant: 'destructive',
      });
      return;
    }

    if (targetStep === 3) {
      toast({
        title: t('home.configurator.toasts.chooseModelTitle'),
        description: t('home.configurator.toasts.chooseModelDescription'),
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: t('home.configurator.toasts.chooseRepairTitle'),
      description: t('home.configurator.toasts.chooseRepairDescription'),
      variant: 'destructive',
    });
  };

  const jumpToStep = (targetStep: number) => {
    if (targetStep === currentStep) {
      return;
    }

    if (!canJumpToStep(targetStep)) {
      showStepNavigationToast(targetStep);
      return;
    }

    setCurrentStep(targetStep);
  };

  // Reset configurator
  const resetConfigurator = () => {
    setCurrentStep(1);
    setSelectedDeviceType(null);
    setSelectedBrand('');
    setSelectedModel(null);
    setSelectedRepairs([]);
    setSelectedAddOns([]);
    setSelectedRepairCategory('all');
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

  const handleExitConfigurator = () => {
    resetConfigurator();
    navigate('/');
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
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
    setSelectedRepairCategory('all');
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

    const selectedBrandName = manufacturers.find(m => m._id === selectedBrand)?.name || '';

    if (typeof window !== 'undefined') {
      sessionStorage.setItem(
        'repairRequestBackContext',
        JSON.stringify({
          deviceType: selectedDeviceType?.name || '',
          manufacturer: selectedBrandName,
          modelName: selectedModel.name,
          selectedRepairCategory,
        })
      );
    }

    navigate('/repair-request', {
      state: {
        device: {
          _id: selectedModel._id,
          name: selectedModel.name,
          deviceType: selectedDeviceType?.name || '',
          manufacturer: selectedBrandName,
          manufacturerId: selectedBrand,
          image: selectedModel.image
        },
        repairRequestOrigin: {
          fromConfigurator: true,
          step: 3,
          selectedRepairCategory,
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
          <button
            type="button"
            className="configurator-exit-btn"
            onClick={handleExitConfigurator}
            data-tooltip={t('home.configurator.leave', 'Konfigurator verlassen')}
            aria-label={t('home.configurator.leave', 'Konfigurator verlassen')}
          >
            <X className="configurator-exit-icon" aria-hidden="true" />
          </button>
        </div>

        <div className="configurator-body">
          {/* Step Indicators */}
          <div className="config-steps">
            {stepDefinitions.map(({ step, labelKey }) => {
              const isActive = currentStep >= step;
              const isCompleted = currentStep > step;
              const isJumpAllowed = canJumpToStep(step);

              return (
                <div
                  key={step}
                  role="button"
                  tabIndex={0}
                  aria-label={t('home.configurator.jumpToStep', { step })}
                  aria-disabled={!isJumpAllowed}
                  className={`config-step-indicator ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''} ${isJumpAllowed ? 'is-clickable' : 'is-disabled'}`}
                  data-step={String(step)}
                  onClick={() => jumpToStep(step)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      jumpToStep(step);
                    }
                  }}
                >
                  <span className="step-num">{step}</span>
                  <span className="step-label">{t(labelKey)}</span>
                </div>
              );
            })}
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
                      {manufacturers.map((manufacturer) => {
                        const brandLogo = resolveBrandLogo(manufacturer.name, manufacturer.logo);

                        return (
                        <SelectItem key={manufacturer._id} value={manufacturer._id}>
                          {brandLogo && (
                            <img
                              src={brandLogo}
                              alt={manufacturer.name + ' Logo'}
                              style={{ width: 22, height: 22, objectFit: 'contain', display: 'inline-block', marginRight: 6, marginLeft: 0, verticalAlign: 'middle' }}
                            />
                          )}
                          {manufacturer.name}
                        </SelectItem>
                      )})}
                    </SelectContent>
                  </Select>
                </div>

                <div className="config-select-wrapper autocomplete-wrapper">
                  <label htmlFor="modelInput">{t('home.configurator.searchModel', 'Modell suchen')}</label>
                  {useMobileModal ? (
                    <div 
                      className="config-input mobile-model-trigger"
                      onClick={handleMobileModelClick}
                      style={{ 
                        cursor: !selectedBrand || loadingModels ? 'not-allowed' : 'pointer',
                        opacity: !selectedBrand || loadingModels ? 0.6 : 1
                      }}
                    >
                      {selectedModel ? (
                        <div className="flex items-center gap-2 min-w-0">
                          {getModelImage(selectedModel) && (
                            <img
                              src={getModelImage(selectedModel)}
                              alt={selectedModel.name}
                              className="w-6 h-6 object-contain flex-shrink-0"
                              onError={(e) => e.currentTarget.style.display = 'none'}
                            />
                          )}
                          <span className="truncate">
                            {selectedModel.name}
                            {selectedModel.modelNumbers && selectedModel.modelNumbers.length > 0 && (
                              <span className="text-xs italic text-muted-foreground ml-1">({selectedModel.modelNumbers.join(', ')})</span>
                            )}
                          </span>
                        </div>
                      ) : (loadingModels ? t('home.deviceSelection.loadingModels') : t('home.configurator.modelSearchPlaceholder', 'z.B. iPhone 15 Pro...'))}
                      <Search className="mobile-search-icon" style={{ width: 16, height: 16, position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                    </div>
                  ) : (
                    <>
                      <div className="relative">
                        <Input
                          ref={modelInputRef}
                          type="text"
                          className={`config-input ${selectedModel && !showModelDropdown ? 'text-transparent caret-transparent' : ''}`}
                          style={selectedModel && !showModelDropdown ? { color: 'transparent', caretColor: 'transparent' } : undefined}
                          id="modelInput"
                          placeholder={loadingModels ? t('home.deviceSelection.loadingModels') : t('home.configurator.modelSearchPlaceholder', 'z.B. iPhone 15 Pro...')}
                          value={modelSearchQuery}
                          onChange={(e) => setModelSearchQuery(e.target.value)}
                          onFocus={handleModelInputFocus}
                          autoComplete="off"
                          inputMode="search"
                          disabled={!selectedBrand || loadingModels}
                        />
                        {selectedModel && !showModelDropdown && (
                          <div className="absolute inset-y-0 left-0 right-0 flex items-center px-3 pointer-events-none">
                            <div className="flex items-center gap-2 min-w-0 pr-8">
                              {getModelImage(selectedModel) && (
                                <img
                                  src={getModelImage(selectedModel)}
                                  alt={selectedModel.name}
                                  className="w-6 h-6 object-contain flex-shrink-0"
                                  onError={(e) => e.currentTarget.style.display = 'none'}
                                />
                              )}
                              <span className="truncate text-sm text-gray-700">
                                {selectedModel.name}
                                {selectedModel.modelNumbers && selectedModel.modelNumbers.length > 0 && (
                                  <span className="text-xs italic text-muted-foreground ml-1">({selectedModel.modelNumbers.join(', ')})</span>
                                )}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                      {showModelDropdown && filteredModels.length > 0 && (
                        <div className="autocomplete-dropdown open">
                          {filteredModels.map((model) => (
                            <div
                              key={model._id}
                              className="autocomplete-item"
                              onClick={() => handleModelSelect(model)}
                            >
                              <div className="flex items-center gap-2">
                                {getModelImage(model) && (
                                  <img 
                                    src={getModelImage(model)}
                                    alt={model.name} 
                                    className="w-6 h-6 object-contain"
                                    onError={(e) => e.currentTarget.style.display = 'none'}
                                  />
                                )}
                                <span>
                                  {model.name}
                                  {model.modelNumbers && model.modelNumbers.length > 0 && (
                                    <span className="text-xs italic text-muted-foreground ml-1">({model.modelNumbers.join(', ')})</span>
                                  )}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
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
              {/* "Wie können wir Ihnen helfen?" heading */}
              <h3 className="text-lg font-semibold text-gray-800 mb-3">
                {t('home.configurator.howCanWeHelp')}
              </h3>

              {/* Category filter chips - shown right below the heading */}
              {(() => {
                const categories = Array.from(
                  new Set(
                    repairServices
                      .map((s) => (s.category || '').trim())
                      .filter((c) => c.length > 0)
                  )
                ).sort((a, b) => a.localeCompare(b));

                if (loadingRepairs || categories.length <= 1) {
                  return null;
                }

                return (
                  <>
                    {/* Desktop / tablet: chip row */}
                    <div className="repair-category-bar" role="tablist" aria-label={t('home.configurator.categoryFilter.label')}>
                      <button
                        type="button"
                        role="tab"
                        aria-selected={selectedRepairCategory === 'all'}
                        className={`repair-category-chip ${selectedRepairCategory === 'all' ? 'active' : ''}`}
                        onClick={() => setSelectedRepairCategory('all')}
                      >
                        <LayoutGrid className="w-4 h-4" />
                        {t('home.configurator.categoryFilter.all')}
                      </button>
                      {categories.map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          role="tab"
                          aria-selected={selectedRepairCategory === cat}
                          className={`repair-category-chip ${selectedRepairCategory === cat ? 'active' : ''}`}
                          onClick={() => setSelectedRepairCategory(cat)}
                        >
                          {getCategoryIcon(cat, 'sm')}
                          {cat}
                        </button>
                      ))}
                    </div>

                    {/* Mobile: native dropdown */}
                    <div className="repair-category-select-wrapper">
                      <label htmlFor="repairCategorySelect" className="sr-only">
                        {t('home.configurator.categoryFilter.label')}
                      </label>
                      <select
                        id="repairCategorySelect"
                        className="repair-category-select"
                        value={selectedRepairCategory ?? ''}
                        onChange={(e) => setSelectedRepairCategory(e.target.value || null)}
                        aria-label={t('home.configurator.categoryFilter.label')}
                      >
                        <option value="">{t('home.configurator.categoryFilter.label')}</option>
                        <option value="all">{t('home.configurator.categoryFilter.all')}</option>
                        {categories.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                );
              })()}

              {/* Repair Selection Grid - only shown after a category is selected */}
              {selectedRepairCategory !== null && <div className="repair-grid">
                {loadingRepairs ? (
                  <div className="col-span-full text-center py-8 text-muted-foreground">
                    {t('home.configurator.loadingRepairs')}
                  </div>
                ) : (() => {
                  const visibleServices =
                    selectedRepairCategory === 'all'
                      ? repairServices
                      : repairServices.filter(
                          (s) => (s.category || '').trim() === selectedRepairCategory
                        );

                  if (visibleServices.length === 0) {
                    return (
                      <div className="col-span-full text-center py-8 text-muted-foreground">
                        {t('home.configurator.noRepairs')}
                      </div>
                    );
                  }

                  return visibleServices.map((service) => (
                    <div
                      key={service._id}
                      className={`repair-card ${selectedRepairs.find(s => s._id === service._id) ? 'selected' : ''}`}
                      onClick={() => toggleRepairSelection(service)}
                    >
                      {getCategoryIcon(service.category || '', 'md')}
                      <div className="repair-info">
                        <div className="repair-name">{service.name}</div>
                        {isPriceOnRequestService(service) ? (
                          <div className="repair-price repair-price-on-request">{t('home.configurator.priceOnRequest', 'Preis auf Anfrage')}</div>
                        ) : (
                          <div className="repair-price">{t('home.configurator.repairFrom', { price: formatPrice(service.price) })}</div>
                        )}
                      </div>
                      {(service.shortDescription || service.description) && (
                        <div className="repair-card-info-wrap">
                          <button
                            type="button"
                            className="repair-card-info-btn"
                            aria-label={`${t('home.configurator.serviceInfoLabel', { name: service.name })}`}
                            onMouseEnter={(e) => {
                              if (!service.shortDescription) return;
                              const rect = e.currentTarget.getBoundingClientRect();
                              const iconCenter = rect.left + rect.width / 2;
                              const idealLeft = iconCenter - TOOLTIP_WIDTH / 2;
                              const clampedLeft = Math.max(TOOLTIP_MARGIN, Math.min(idealLeft, window.innerWidth - TOOLTIP_WIDTH - TOOLTIP_MARGIN));
                              setHoveredTooltip({ service, left: clampedLeft, top: rect.bottom + 8, arrowLeft: iconCenter - clampedLeft });
                            }}
                            onMouseLeave={() => setHoveredTooltip(null)}
                            onFocus={(e) => {
                              if (!service.shortDescription) return;
                              const rect = e.currentTarget.getBoundingClientRect();
                              const iconCenter = rect.left + rect.width / 2;
                              const idealLeft = iconCenter - TOOLTIP_WIDTH / 2;
                              const clampedLeft = Math.max(TOOLTIP_MARGIN, Math.min(idealLeft, window.innerWidth - TOOLTIP_WIDTH - TOOLTIP_MARGIN));
                              setHoveredTooltip({ service, left: clampedLeft, top: rect.bottom + 8, arrowLeft: iconCenter - clampedLeft });
                            }}
                            onBlur={() => setHoveredTooltip(null)}
                            onClick={(e) => {
                              e.stopPropagation();
                              setHoveredTooltip(null);
                              setServiceInfoDialog(service);
                            }}
                          >
                            <Info className="repair-card-info-icon" aria-hidden="true" />
                          </button>
                        </div>
                      )}
                    </div>
                  ));
                })()}
              </div>}

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
                        <div className="extras-price">+{formatPrice(addon.price)} €</div>
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
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
                        <button
                          type="button"
                          onClick={() => {
                            setShowUnlockDetails(false);
                            setShowAdditionalInfo(true);
                            scrollAdditionalInfoIntoView();
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '7px 14px',
                            background: '#1a2a5e',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '0.75rem',
                            fontWeight: '600',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = '#2a3f7e'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = '#1a2a5e'; }}
                        >
                          {t('home.configurator.next')}
                          <ChevronRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Additional Information Section */}
                <div
                  ref={additionalInfoSectionRef}
                  style={{
                    border: showAdditionalInfo ? '2px solid #f5b800' : '2px solid #d8dce6',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    transition: 'all 0.3s ease'
                  }}
                >
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
                      padding: '12px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: showAdditionalInfo ? 'rgba(245, 184, 0, 0.06)' : '#f5f6f8',
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'background 0.2s'
                    }}
                    onMouseEnter={(e) => { if (!showAdditionalInfo) e.currentTarget.style.background = '#e8eaf0'; }}
                    onMouseLeave={(e) => { if (!showAdditionalInfo) e.currentTarget.style.background = showAdditionalInfo ? 'rgba(245, 184, 0, 0.06)' : '#f5f6f8'; }}
                  >
                    <div className="flex items-center gap-2">
                      <Info className="w-4 h-4" style={{ color: '#1a2a5e' }} />
                      <h3 className="font-semibold text-sm" style={{ color: '#1a2a5e' }}>{t('home.configurator.additionalInfoTitle')}</h3>
                    </div>
                    {showAdditionalInfo ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>

                  {/* Additional Information Content */}
                  {showAdditionalInfo && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: '#e8eaf0', WebkitTextSizeAdjust: '100%', width: '100%', boxSizing: 'border-box', overflowX: 'hidden' }}>
                      <p style={{ padding: '12px 16px 10px', fontSize: '0.72rem', color: '#4a5568', background: '#fafbfc' }}>
                        {t('home.configurator.additionalInfoDescription')}
                      </p>

                      {/* Error Description */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '12px 16px', background: '#ffffff' }}>
                        <label
                          htmlFor="errorDesc"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontSize: '0.72rem',
                            fontWeight: '700',
                            color: '#1a2a5e',
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em'
                          }}
                        >
                          <AlertCircle className="w-3 h-3" style={{ color: '#1a2a5e' }} />
                          {t('home.configurator.errorDescription')}
                        </label>
                        <textarea
                          id="errorDesc"
                          placeholder={t('home.configurator.errorDescriptionPlaceholder')}
                          value={errorDescription}
                          onChange={(e) => setErrorDescription(e.target.value)}
                          rows={3}
                          style={{
                            width: '100%',
                            padding: '9px 12px',
                            border: '1.5px solid #d8dce6',
                            borderRadius: '6px',
                            fontSize: '13px',
                            fontFamily: 'var(--font-main, Inter, sans-serif)',
                            color: '#2d3748',
                            resize: 'none',
                            boxSizing: 'border-box',
                            transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                            background: '#fafbfc'
                          }}
                          onFocus={(e) => {
                            e.target.style.borderColor = '#f5b800';
                            e.target.style.boxShadow = '0 0 0 2px rgba(245, 184, 0, 0.15)';
                            e.target.style.outline = 'none';
                            e.target.style.background = '#ffffff';
                          }}
                          onBlur={(e) => {
                            e.target.style.borderColor = '#d8dce6';
                            e.target.style.boxShadow = 'none';
                            e.target.style.background = '#fafbfc';
                          }}
                        />
                      </div>

                      {/* Water Damage */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '12px 16px', background: '#ffffff' }}>
                        <label
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontSize: '0.72rem',
                            fontWeight: '700',
                            color: '#1a2a5e',
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em'
                          }}
                        >
                          <Droplets className="w-3 h-3" style={{ color: '#1a2a5e' }} />
                          {t('home.configurator.waterDamage')}
                        </label>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '6px', width: '100%' }}>
                          {['no', 'yes', 'unsure'].map((option) => (
                            <button
                              key={option}
                              type="button"
                              onClick={() => setWaterDamage(option as any)}
                              style={{
                                padding: '7px 8px',
                                background: waterDamage === option ? 'rgba(245, 184, 0, 0.08)' : '#f5f6f8',
                                border: waterDamage === option ? '1.5px solid #f5b800' : '1.5px solid #e8eaf0',
                                borderRadius: '6px',
                                fontSize: '0.72rem',
                                fontWeight: '600',
                                color: waterDamage === option ? '#1a2a5e' : '#4a5568',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                textAlign: 'center',
                                minWidth: 0
                              }}
                              onMouseEnter={(e) => {
                                if (waterDamage !== option) {
                                  e.currentTarget.style.borderColor = '#f5b800';
                                  e.currentTarget.style.background = '#fffbf0';
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (waterDamage !== option) {
                                  e.currentTarget.style.borderColor = '#e8eaf0';
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
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '12px 16px', background: '#ffffff' }}>
                        <label
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontSize: '0.72rem',
                            fontWeight: '700',
                            color: '#1a2a5e',
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em'
                          }}
                        >
                          <Wrench className="w-3 h-3" style={{ color: '#1a2a5e' }} />
                          {t('home.configurator.previousRepairAttempts')}
                        </label>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '6px', width: '100%' }}>
                          {['no', 'yes', 'unsure'].map((option) => (
                            <button
                              key={option}
                              type="button"
                              onClick={() => setPreviousRepairAttempts(option as any)}
                              style={{
                                padding: '7px 8px',
                                background: previousRepairAttempts === option ? 'rgba(245, 184, 0, 0.08)' : '#f5f6f8',
                                border: previousRepairAttempts === option ? '1.5px solid #f5b800' : '1.5px solid #e8eaf0',
                                borderRadius: '6px',
                                fontSize: '0.72rem',
                                fontWeight: '600',
                                color: previousRepairAttempts === option ? '#1a2a5e' : '#4a5568',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                textAlign: 'center',
                                minWidth: 0
                              }}
                              onMouseEnter={(e) => {
                                if (previousRepairAttempts !== option) {
                                  e.currentTarget.style.borderColor = '#f5b800';
                                  e.currentTarget.style.background = '#fffbf0';
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (previousRepairAttempts !== option) {
                                  e.currentTarget.style.borderColor = '#e8eaf0';
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
                            rows={2}
                            style={{
                              width: '100%',
                              padding: '9px 12px',
                              border: '1.5px solid #d8dce6',
                              borderRadius: '6px',
                              fontSize: '13px',
                              fontFamily: 'var(--font-main, Inter, sans-serif)',
                              color: '#2d3748',
                              resize: 'none',
                              marginTop: '6px',
                              boxSizing: 'border-box',
                              transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                              background: '#fafbfc'
                            }}
                            onFocus={(e) => {
                              e.target.style.borderColor = '#f5b800';
                              e.target.style.boxShadow = '0 0 0 2px rgba(245, 184, 0, 0.15)';
                              e.target.style.outline = 'none';
                              e.target.style.background = '#ffffff';
                            }}
                            onBlur={(e) => {
                              e.target.style.borderColor = '#d8dce6';
                              e.target.style.boxShadow = 'none';
                              e.target.style.background = '#fafbfc';
                            }}
                          />
                        )}
                      </div>

                      {/* Item Condition */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '12px 16px', background: '#ffffff' }}>
                        <label
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontSize: '0.72rem',
                            fontWeight: '700',
                            color: '#1a2a5e',
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em'
                          }}
                        >
                          <Package className="w-3 h-3" style={{ color: '#1a2a5e' }} />
                          {t('home.configurator.itemCondition')}
                        </label>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '6px', width: '100%' }}>
                          {['original', 'refurbished', 'unsure'].map((option) => (
                            <button
                              key={option}
                              type="button"
                              onClick={() => setItemCondition(option as any)}
                              style={{
                                padding: '7px 8px',
                                background: itemCondition === option ? 'rgba(245, 184, 0, 0.08)' : '#f5f6f8',
                                border: itemCondition === option ? '1.5px solid #f5b800' : '1.5px solid #e8eaf0',
                                borderRadius: '6px',
                                fontSize: '0.72rem',
                                fontWeight: '600',
                                color: itemCondition === option ? '#1a2a5e' : '#4a5568',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                textAlign: 'center',
                                minWidth: 0
                              }}
                              onMouseEnter={(e) => {
                                if (itemCondition !== option) {
                                  e.currentTarget.style.borderColor = '#f5b800';
                                  e.currentTarget.style.background = '#fffbf0';
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (itemCondition !== option) {
                                  e.currentTarget.style.borderColor = '#e8eaf0';
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
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '12px 16px', background: '#ffffff' }}>
                        <label
                          htmlFor="photos"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontSize: '0.72rem',
                            fontWeight: '700',
                            color: '#1a2a5e',
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em'
                          }}
                        >
                          <Upload className="w-3 h-3" style={{ color: '#1a2a5e' }} />
                          {t('home.configurator.uploadPhotos')}
                        </label>
                        <label
                          htmlFor="photos"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '8px 12px',
                            border: '1.5px dashed #d8dce6',
                            borderRadius: '6px',
                            background: photos.length >= 5 ? '#f5f6f8' : '#fafbfc',
                            cursor: photos.length >= 5 ? 'not-allowed' : 'pointer',
                            transition: 'all 0.2s ease',
                            color: '#4a5568',
                            fontSize: '0.72rem'
                          }}
                          onMouseEnter={(e) => { if (photos.length < 5) { e.currentTarget.style.borderColor = '#f5b800'; e.currentTarget.style.background = '#fffbf0'; } }}
                          onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#d8dce6'; e.currentTarget.style.background = '#fafbfc'; }}
                        >
                          <Upload className="w-3.5 h-3.5" style={{ color: '#1a2a5e', flexShrink: 0 }} />
                          <span style={{ flex: 1 }}>{t('home.configurator.uploadedPhotos', { count: photos.length })} / 5</span>
                          <Input
                            id="photos"
                            type="file"
                            multiple
                            accept="image/*"
                            onChange={handlePhotoUpload}
                            disabled={photos.length >= 5}
                            style={{ display: 'none' }}
                          />
                        </label>

                        {photoPreviewUrls.length > 0 && (
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', marginTop: '4px' }}>
                            {photoPreviewUrls.map((url, index) => (
                              <div key={index} className="relative group">
                                <img
                                  src={url}
                                  alt={t('home.configurator.photoPreviewAlt', { index: index + 1 })}
                                  style={{
                                    width: '100%',
                                    height: '60px',
                                    objectFit: 'cover',
                                    borderRadius: '4px',
                                    border: '1px solid #d8dce6'
                                  }}
                                />
                                <button
                                  type="button"
                                  onClick={() => removePhoto(index)}
                                  className="absolute top-0.5 right-0.5 p-0.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <X className="w-2.5 h-2.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
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
                <div style={{ marginBottom: '0.75rem' }}>
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
                            padding: '0.875rem',
                            backgroundColor: '#ffffff',
                            borderRadius: '10px',
                            border: '1px solid rgba(245, 184, 0, 0.3)',
                            marginBottom: '0.625rem'
                          }}
                        >
                          {/* Card Header: model image + device info */}
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '0.625rem' }}>
                            <div style={{
                              flexShrink: 0,
                              width: '48px',
                              height: '48px',
                              borderRadius: '8px',
                              backgroundColor: '#f0f4ff',
                              border: '1px solid rgba(26,42,94,0.08)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              overflow: 'hidden',
                              position: 'relative'
                            }}>
                              {(() => {
                                const DevIcon = getDeviceIcon(device.deviceType?.name || '');
                                return <DevIcon style={{ width: '1.25rem', height: '1.25rem', color: '#1a2a5e', opacity: 0.35 }} />;
                              })()}
                              {getModelImage(device.model) && (
                                <img
                                  src={getModelImage(device.model)}
                                  alt={device.model?.name}
                                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', padding: '4px' }}
                                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                />
                              )}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.4rem' }}>
                                <h4 style={{ fontSize: '0.875rem', fontWeight: 700, color: '#1a2a5e', lineHeight: 1.3 }}>
                                  {t('home.configurator.deviceLabel', { index: idx + 1, model: device.model?.name })}
                                </h4>
                                {quantity > 1 && !isCurrentDevice && (
                                  <span style={{
                                    padding: '0.2rem 0.55rem',
                                    backgroundColor: '#f5b800',
                                    color: '#1a2a5e',
                                    fontSize: '0.75rem',
                                    borderRadius: '999px',
                                    fontWeight: 700,
                                    flexShrink: 0
                                  }}>
                                    {quantity}×
                                  </span>
                                )}
                              </div>
                              <p style={{ fontSize: '0.7rem', color: '#718096', marginTop: '0.1rem' }}>
                                {device.deviceType?.name}{device.brand?.name ? ` · ${device.brand.name}` : ''}
                              </p>
                            </div>
                          </div>
                          <div style={{ fontSize: '0.78rem', color: '#4a5568' }}>
                            
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
                                    <span style={{ color: '#f5b800', fontWeight: 600 }}>{formatPrice(repair.price)} €</span>
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
                                    <span style={{ color: '#f5b800', fontWeight: 600 }}>{formatPrice(addon.price)} €</span>
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
                                  {t('home.configurator.pricePerDevice', { price: formatPrice(singleDeviceTotal) })}
                                </p>
                              )}
                              <p style={{ fontSize: '1.125rem', fontWeight: 700, color: '#1a2a5e' }}>
                                {quantity > 1 ? t('home.configurator.totalPrice', { price: formatPrice(deviceTotal) }) : t('home.configurator.singlePrice', { price: formatPrice(deviceTotal) })}
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
                    <Smartphone style={{ width: '1rem', height: '1rem', color: '#f5b800', margin: '0 auto 3px', display: 'block' }} />
                    <div className="label">{t('home.configurator.totalDevices')}</div>
                    <div className="value">{(() => {
                      let count = devices.reduce((sum, d) => sum + (d.quantity || 1), 0);
                      if (selectedModel && selectedRepairs.length > 0) count += currentDeviceQuantity;
                      return count;
                    })()}</div>
                  </div>
                  <div className="config-result-item">
                    <Layers style={{ width: '1rem', height: '1rem', color: '#f5b800', margin: '0 auto 3px', display: 'block' }} />
                    <div className="label">{t('home.configurator.deviceTypes')}</div>
                    <div className="value small">{(() => {
                      let count = devices.length;
                      if (selectedModel && selectedRepairs.length > 0) count++;
                      return count;
                    })()}</div>
                  </div>
                  <div className="config-result-item">
                    <Tag style={{ width: '1rem', height: '1rem', color: '#f5b800', margin: '0 auto 3px', display: 'block' }} />
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
                      return formatPrice(total);
                    })()} €</div>
                  </div>
                  <div className="config-result-item">
                    <Truck style={{ width: '1rem', height: '1rem', color: '#f5b800', margin: '0 auto 3px', display: 'block' }} />
                    <div className="label">{t('home.configurator.shipping')}</div>
                    <div className="value small">{t('home.configurator.free')}</div>
                  </div>
                </div>
              </div>

              {/* Add Another Device Option */}
              <div style={{
                marginTop: '0.625rem',
                padding: '0.875rem',
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
              <button className="config-result-cta" onClick={handleAddToCart} style={{ marginTop: '0.875rem' }}>
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

    {/* Portal tooltip for repair service short description */}
    {hoveredTooltip && hoveredTooltip.service.shortDescription && createPortal(
      <div
        className="repair-card-portal-tooltip"
        role="tooltip"
        style={{
          position: 'fixed',
          top: hoveredTooltip.top,
          left: hoveredTooltip.left,
          width: TOOLTIP_WIDTH,
        }}
      >
        <div className="repair-card-portal-tooltip-arrow" style={{ left: hoveredTooltip.arrowLeft }} />
        <p className="repair-card-portal-tooltip-name">{hoveredTooltip.service.name}</p>
        <p className="repair-card-portal-tooltip-text">{hoveredTooltip.service.shortDescription}</p>
        <span className="repair-card-portal-tooltip-hint">{t('home.configurator.serviceInfo.clickForMore')}</span>
      </div>,
      document.body
    )}

    {/* Service Info Dialog */}
    <Dialog open={!!serviceInfoDialog} onOpenChange={(open) => { if (!open) setServiceInfoDialog(null); }}>
      <DialogContent
        className="repair-service-info-dialog sm:max-w-lg"
        aria-describedby={[
          serviceInfoDialog?.shortDescription &&
          serviceInfoDialog.shortDescription.trim() !== String(serviceInfoDialog.description || '').trim()
            ? 'service-dialog-short-description'
            : '',
          serviceInfoDialog?.description ? 'service-dialog-description' : '',
        ].filter(Boolean).join(' ') || undefined}
      >
        {serviceInfoDialog && (
          <>
            <DialogHeader className="repair-service-info-dialog-header">
              <div className="repair-service-info-dialog-badge">
                {serviceInfoDialog.category && (
                  <span className="repair-service-info-dialog-category">{serviceInfoDialog.category}</span>
                )}
              </div>
              <DialogTitle className="repair-service-info-dialog-title" itemProp="name">
                {serviceInfoDialog.seoTitleTag || serviceInfoDialog.name}
              </DialogTitle>
              {serviceInfoDialog.estimatedTime && (
                <div className="repair-service-info-dialog-meta">
                  <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{serviceInfoDialog.estimatedTime}</span>
                </div>
              )}
            </DialogHeader>

            <article
              className="repair-service-info-dialog-body"
              itemScope
              itemType="https://schema.org/Service"
            >
              {/* Hidden SEO metadata */}
              <meta itemProp="name" content={serviceInfoDialog.seoName || serviceInfoDialog.name} />
              {serviceInfoDialog.seoMetaDescription && (
                <meta itemProp="description" content={serviceInfoDialog.seoMetaDescription} />
              )}
              {serviceInfoDialog.seoMetaKeywords && (
                <meta itemProp="keywords" content={serviceInfoDialog.seoMetaKeywords} />
              )}

              {/* Always show short description directly in dialog when available */}
              {serviceInfoDialog.shortDescription &&
                serviceInfoDialog.shortDescription.trim() !== String(serviceInfoDialog.description || '').trim() && (
                  <div id="service-dialog-short-description" className="repair-service-info-dialog-lead">
                    {serviceInfoDialog.shortDescription}
                  </div>
                )}

              {/* Main description */}
              {serviceInfoDialog.description && (() => {
                const { paragraphs, bullets } = parseServiceDescription(serviceInfoDialog.description);

                return (
                  <div
                    id="service-dialog-description"
                    className="repair-service-info-dialog-description"
                    itemProp="description"
                  >
                    {paragraphs.map((paragraph, index) => (
                      <p key={`desc-p-${index}`}>{paragraph}</p>
                    ))}
                    {bullets.length > 0 && (
                      <ul className="repair-service-info-dialog-description-list">
                        {bullets.map((bullet, index) => (
                          <li key={`desc-li-${index}`}>{bullet}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })()}

              {/* Price row */}
              <dl className="repair-service-info-dialog-details">
                <div className="repair-service-info-dialog-detail-row">
                  <dt>{t('home.configurator.serviceInfo.priceFrom')}</dt>
                  <dd itemProp="offers" itemScope itemType="https://schema.org/Offer">
                    <span itemProp="price" content={String(serviceInfoDialog.price)} className="repair-service-info-dialog-price">
                      {t('home.configurator.repairFrom', { price: formatPrice(serviceInfoDialog.price) })}
                    </span>
                    <meta itemProp="priceCurrency" content="EUR" />
                  </dd>
                </div>
                {serviceInfoDialog.estimatedTime && (
                  <div className="repair-service-info-dialog-detail-row">
                    <dt>{t('home.configurator.serviceInfo.estimatedTime')}</dt>
                    <dd>{serviceInfoDialog.estimatedTime}</dd>
                  </div>
                )}
              </dl>

              {/* Note / additional info */}
              {serviceInfoDialog.note && (
                <div className="repair-service-info-dialog-note">
                  <Info className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
                  <p>{serviceInfoDialog.note}</p>
                </div>
              )}
            </article>

            {/* CTA buttons */}
            <div className="repair-service-info-dialog-actions">
              <button
                type="button"
                className="repair-service-info-dialog-select-btn"
                onClick={() => {
                  toggleRepairSelection(serviceInfoDialog);
                  setServiceInfoDialog(null);
                }}
              >
                {selectedRepairs.find(s => s._id === serviceInfoDialog._id)
                  ? t('home.configurator.serviceInfo.deselect')
                  : t('home.configurator.serviceInfo.select')}
              </button>
              <button
                type="button"
                className="repair-service-info-dialog-close-btn"
                onClick={() => setServiceInfoDialog(null)}
              >
                {t('home.configurator.serviceInfo.close')}
              </button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>

    
    {/* Mobile Model Selection Modal for Mobile & Tablet Devices - Rendered as Portal */}
    {showMobileModelModal && useMobileModal && createPortal(
      <div 
        className="mobile-model-modal-overlay" 
        onClick={closeMobileModelModal}
        onTouchMove={(e) => e.preventDefault()}
      >
        <div 
          className="mobile-model-modal" 
          onClick={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
        >
          <div className="mobile-model-modal-header">
            <h3>{t('home.configurator.searchModel', 'Modell suchen')}</h3>
            <button onClick={closeMobileModelModal} className="mobile-modal-close">
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="mobile-model-modal-body">
            {/* Search Toggle */}
            {!isMobileSearchActive && (
              <div className="mobile-model-info">
                <Info className="w-4 h-4" />
                <span>{t('home.configurator.browseOrSearch', 'Durchsuchen oder tippen zum Suchen')}</span>
              </div>
            )}
            
            {/* Search Input - Only show when active */}
            {isMobileSearchActive && (
              <div className="mobile-model-search-wrapper">
                <Input
                  ref={modelInputRef}
                  type="text"
                  className="mobile-model-search-input"
                  placeholder={t('home.configurator.modelSearchPlaceholder', 'z.B. iPhone 15 Pro...')}
                  value={modelSearchQuery}
                  onChange={(e) => setModelSearchQuery(e.target.value)}
                  autoFocus
                  inputMode="search"
                />
                <button 
                  onClick={() => {
                    setIsMobileSearchActive(false);
                    setModelSearchQuery('');
                  }}
                  className="mobile-search-cancel"
                >
                  {t('common.cancel')}
                </button>
              </div>
            )}
            
            {/* Toggle Search Button */}
            {!isMobileSearchActive && (
              <button 
                onClick={handleActivateMobileSearch}
                className="mobile-search-toggle-btn"
              >
                <Search className="w-4 h-4" />
                {t('home.configurator.typeToSearch', 'Tippen zum Suchen')}
              </button>
            )}
            
            {/* Model List */}
            <div className="mobile-model-list">
              {filteredModels.length > 0 ? (
                filteredModels.map((model) => (
                  <div
                    key={model._id}
                    className="mobile-model-item"
                    onClick={() => handleModelSelect(model)}
                  >
                    <div className="mobile-model-item-content">
                        {getModelImage(model) && (
                        <img 
                            src={getModelImage(model)}
                          alt={model.name} 
                          className="mobile-model-image"
                          onError={(e) => e.currentTarget.style.display = 'none'}
                        />
                      )}
                      <span className="mobile-model-name">
                        {model.name}
                        {model.modelNumbers && model.modelNumbers.length > 0 && (
                          <span className="text-xs italic opacity-60 ml-1">({model.modelNumbers.join(', ')})</span>
                        )}
                      </span>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  </div>
                ))
              ) : (
                <div className="mobile-model-empty">
                  {loadingModels ? t('home.deviceSelection.loadingModels') : t('home.deviceSelection.noModelsFound')}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>,
      document.body
    )}
    </>
  );
}
