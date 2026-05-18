import React, { useState, useEffect, useRef } from 'react';
import { Search, X, ShoppingCart, Package, Wrench, MonitorSmartphone, BatteryCharging, Droplets, Camera, Volume2, Settings2, Zap, Power, Cpu, HardDrive, AlertCircle, Wifi, SlidersHorizontal, Layers, Lock } from 'lucide-react';
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

interface ServiceWithDeviceInfo extends Omit<RepairService, 'manufacturer'> {
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

const normalizeSearchText = (value: string | undefined | null): string =>
  String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const getSearchTokens = (value: string): string[] =>
  normalizeSearchText(value)
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);

const getPrefixMatchLength = (displayText: string, query: string): number => {
  const left = String(displayText || '').toLowerCase();
  const right = String(query || '').trim().toLowerCase();

  if (!left || !right) {
    return 0;
  }

  const maxLength = Math.min(left.length, right.length);
  let index = 0;

  while (index < maxLength && left[index] === right[index]) {
    index += 1;
  }

  return index;
};

const modelMatchesTokens = (model: DeviceModel, manufacturerName: string, queryTokens: string[]): boolean => {
  if (queryTokens.length === 0) {
    return false;
  }

  const searchableValues = [
    manufacturerName,
    model.name,
    model.series,
    ...(Array.isArray(model.synonyms) ? model.synonyms : []),
    ...(Array.isArray(model.modelNumbers) ? model.modelNumbers : []),
  ]
    .map((value) => normalizeSearchText(value))
    .filter(Boolean);

  if (searchableValues.length === 0) {
    return false;
  }

  return queryTokens.every((token) =>
    searchableValues.some((value) => value.includes(token))
  );
};

const getModelMatchScore = (model: DeviceModel, manufacturerName: string, queryTokens: string[]): number => {
  const normalizedModelName = normalizeSearchText(model.name);
  const normalizedManufacturerName = normalizeSearchText(manufacturerName);
  const modelNumbers = (Array.isArray(model.modelNumbers) ? model.modelNumbers : []).map((value) => normalizeSearchText(value));
  const synonyms = (Array.isArray(model.synonyms) ? model.synonyms : []).map((value) => normalizeSearchText(value));
  const series = normalizeSearchText(model.series);
  const fullQuery = queryTokens.join(' ').trim();

  let score = 0;

  if (fullQuery) {
    if (normalizedModelName === fullQuery) score += 1000;
    else if (normalizedModelName.startsWith(`${fullQuery} `) || normalizedModelName.startsWith(`${fullQuery}-`) || normalizedModelName.startsWith(`${fullQuery} (`)) score += 850;
    else if (normalizedModelName.includes(fullQuery)) score += 600;

    if (normalizedManufacturerName && fullQuery === `${normalizedManufacturerName} ${normalizedModelName}`) {
      score += 150;
    }
  }

  for (const token of queryTokens) {
    if (normalizedModelName === token) {
      score += 260;
      continue;
    }
    if (normalizedModelName.startsWith(token)) {
      score += 200;
      continue;
    }
    if (normalizedModelName.includes(token)) {
      score += 140;
      continue;
    }
    if (series === token) {
      score += 90;
      continue;
    }
    if (series.includes(token)) {
      score += 60;
      continue;
    }
    if (modelNumbers.some((value) => value === token)) {
      score += 120;
      continue;
    }
    if (modelNumbers.some((value) => value.includes(token))) {
      score += 80;
      continue;
    }
    if (synonyms.some((value) => value === token)) {
      score += 70;
      continue;
    }
    if (synonyms.some((value) => value.includes(token))) {
      score += 45;
      continue;
    }
    if (normalizedManufacturerName === token) {
      score += 30;
    }
  }

  return score;
};

const getServiceSearchFallbackScore = (service: RepairService, searchLower: string): number => {
  let score = 0;
  const name = String(service.name || '').toLowerCase();
  const shortDescription = String(service.shortDescription || '').toLowerCase();
  const description = String(service.description || '').toLowerCase();
  const searchKeywords = String(service.searchKeywords || '').toLowerCase();
  const manufacturer = String(service.manufacturer || '').toLowerCase();
  const model = String(service.model || '').toLowerCase();

  if (name === searchLower) score += 300;
  else if (name.startsWith(searchLower)) score += 220;
  else if (name.includes(searchLower)) score += 140;

  if (model === searchLower) score += 260;
  else if (model.startsWith(searchLower)) score += 190;
  else if (model.includes(searchLower)) score += 120;

  if (manufacturer === searchLower) score += 120;
  else if (manufacturer.includes(searchLower)) score += 70;

  if (searchKeywords.includes(searchLower)) score += 65;
  if (shortDescription.includes(searchLower)) score += 45;
  if (description.includes(searchLower)) score += 25;

  return score;
};

const getCategoryIcon = (category: string, size: 'sm' | 'md' = 'sm') => {
  const cls = size === 'sm' ? 'w-4 h-4' : 'w-6 h-6';
  const cat = String(category || '').toLowerCase();
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
  if (cat.includes('power') || cat.includes('strom') || (cat.includes('ein') && cat.includes('aus')))
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

const getCategoryColor = (category: string): { border: string; text: string; bg: string } => {
  const cat = String(category || '').toLowerCase();
  if (cat.includes('display') || cat.includes('bildschirm') || cat.includes('screen') || cat.includes('glas'))
    return { border: 'border-blue-300', text: 'text-blue-700', bg: 'bg-blue-50' };
  if (cat.includes('akku') || cat.includes('batterie') || cat.includes('battery'))
    return { border: 'border-green-300', text: 'text-green-700', bg: 'bg-green-50' };
  if (cat.includes('wasser') || cat.includes('feuchtigkeit') || cat.includes('water') || cat.includes('liquid'))
    return { border: 'border-cyan-300', text: 'text-cyan-700', bg: 'bg-cyan-50' };
  if (cat.includes('kamera') || cat.includes('camera') || cat.includes('foto'))
    return { border: 'border-purple-300', text: 'text-purple-700', bg: 'bg-purple-50' };
  if (cat.includes('lautsprecher') || cat.includes('mikrofon') || cat.includes('audio') || cat.includes('sound') || cat.includes('speaker'))
    return { border: 'border-rose-300', text: 'text-rose-700', bg: 'bg-rose-50' };
  if (cat.includes('software') || cat.includes('system') || cat.includes('reset') || cat.includes('update'))
    return { border: 'border-indigo-300', text: 'text-indigo-700', bg: 'bg-indigo-50' };
  if (cat.includes('laden') || cat.includes('ladebuchse') || cat.includes('anschluss') || cat.includes('charging') || cat.includes('usb') || cat.includes('port'))
    return { border: 'border-yellow-300', text: 'text-yellow-700', bg: 'bg-yellow-50' };
  if (cat.includes('power') || cat.includes('strom'))
    return { border: 'border-amber-300', text: 'text-amber-700', bg: 'bg-amber-50' };
  if (cat.includes('platine') || cat.includes('mainboard') || cat.includes('logic') || cat.includes('board') || cat.includes('chip'))
    return { border: 'border-red-300', text: 'text-red-700', bg: 'bg-red-50' };
  if (cat.includes('hardware') || cat.includes('komponente') || cat.includes('bauteil'))
    return { border: 'border-slate-300', text: 'text-slate-700', bg: 'bg-slate-50' };
  if (cat.includes('emergency') || cat.includes('notfall') || cat.includes('dringend') || cat.includes('urgent'))
    return { border: 'border-red-400', text: 'text-red-800', bg: 'bg-red-100' };
  if (cat.includes('netz') || cat.includes('wifi') || cat.includes('wlan') || cat.includes('signal'))
    return { border: 'border-teal-300', text: 'text-teal-700', bg: 'bg-teal-50' };
  if (cat.includes('taste') || cat.includes('button') || cat.includes('schalter') || cat.includes('switch'))
    return { border: 'border-fuchsia-300', text: 'text-fuchsia-700', bg: 'bg-fuchsia-50' };
  if (cat.includes('schutz') || cat.includes('folie') || cat.includes('protection'))
    return { border: 'border-lime-300', text: 'text-lime-700', bg: 'bg-lime-50' };
  if (cat.includes('gehäuse') || cat.includes('back') || cat.includes('rahmen') || cat.includes('frame'))
    return { border: 'border-orange-300', text: 'text-orange-700', bg: 'bg-orange-50' };
  if (cat.includes('lock') || cat.includes('entsperr') || cat.includes('unlock'))
    return { border: 'border-violet-300', text: 'text-violet-700', bg: 'bg-violet-50' };
  return { border: 'border-orange-300', text: 'text-orange-700', bg: 'bg-orange-50' };
};

const findTokenSequenceIndex = (haystack: string[], needle: string[]): number => {
  if (needle.length === 0 || haystack.length < needle.length) {
    return -1;
  }

  for (let start = 0; start <= haystack.length - needle.length; start += 1) {
    let matches = true;
    for (let offset = 0; offset < needle.length; offset += 1) {
      if (haystack[start + offset] !== needle[offset]) {
        matches = false;
        break;
      }
    }
    if (matches) {
      return start;
    }
  }

  return -1;
};

const isStrictExactModelQuery = (searchTerm: string, queryTokens: string[]): boolean => {
  if (queryTokens.length < 2) {
    return false;
  }

  const normalizedQuery = normalizeSearchText(searchTerm);
  if (!normalizedQuery) {
    return false;
  }

  return /\d/.test(normalizedQuery);
};

const serviceMatchesModelName = (serviceModel: string | undefined, modelName: string, strictExact: boolean = false): boolean => {
  const normalizedServiceModel = normalizeSearchText(serviceModel);
  const normalizedModelName = normalizeSearchText(modelName);

  if (!normalizedServiceModel || !normalizedModelName) {
    return false;
  }

  if (strictExact) {
    const serviceTokens = normalizedServiceModel.split(' ').filter(Boolean);
    const modelTokens = normalizedModelName.split(' ').filter(Boolean);
    const modelStartIndex = findTokenSequenceIndex(serviceTokens, modelTokens);

    if (modelStartIndex === -1) {
      return false;
    }

    const suffixTokens = serviceTokens.slice(modelStartIndex + modelTokens.length);
    if (suffixTokens.length === 0) {
      return true;
    }

    // In exact mode, allow only technical suffix tokens that contain digits
    // (e.g. model codes), but block variant suffixes like pro/max/mini.
    return suffixTokens.every((token) => /\d/.test(token));
  }

  return (
    normalizedServiceModel === normalizedModelName ||
    normalizedServiceModel.startsWith(`${normalizedModelName} `) ||
    normalizedServiceModel.endsWith(` ${normalizedModelName}`) ||
    normalizedServiceModel.includes(` ${normalizedModelName} `) ||
    normalizedServiceModel.startsWith(`${normalizedModelName} (`) ||
    normalizedServiceModel.startsWith(`${normalizedModelName} -`)
  );
};

const getServiceManufacturerValue = (service: RepairService): string => {
  const precise = normalizeSearchText((service as any).manufacturerPrecise);
  if (precise) {
    return precise;
  }
  return normalizeSearchText(service.manufacturer);
};

const getServiceModelValue = (service: RepairService): string => {
  const precise = normalizeSearchText((service as any).modelPrecise);
  if (precise) {
    return precise;
  }
  return normalizeSearchText(service.model);
};

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
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number; width: number } | null>(null);

  const renderModelMatchText = (manufacturer?: string, modelName?: string) => {
    const fullModelName = [manufacturer, modelName].filter(Boolean).join(' ').trim();

    if (!fullModelName) {
      return null;
    }

    const matchLength = getPrefixMatchLength(fullModelName, searchTerm);

    if (matchLength <= 0) {
      return <span className="text-xs text-gray-600 break-words">{fullModelName}</span>;
    }

    return (
      <span className="text-xs text-gray-600 break-words">
        <span className="bg-yellow-100 text-gray-900 font-semibold rounded-sm px-0.5">
          {fullModelName.slice(0, matchLength)}
        </span>
        {fullModelName.slice(matchLength)}
      </span>
    );
  };

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

        const searchLower = searchTerm.toLowerCase();
        const queryTokens = getSearchTokens(searchTerm);
        const strictExactMode = isStrictExactModelQuery(searchTerm, queryTokens);
        const scoredServiceMatches: Array<{ service: ServiceWithDeviceInfo; score: number; modelKey: string }> = [];

        const matchedModels: Array<{
          deviceTypeName: string;
          manufacturerName: string;
          model: DeviceModel;
          modelImage?: string;
          score: number;
        }> = [];

        if (deviceData) {
          for (const [, deviceInfo] of deviceData.models) {
            const manufacturerName = String(deviceInfo.manufacturer?.name || '');
            for (const model of deviceInfo.models) {
              if (!modelMatchesTokens(model, manufacturerName, queryTokens)) {
                continue;
              }

              let modelImage: string | undefined;
              if (model.image) {
                modelImage = model.image;
              } else if (Array.isArray(model.images) && model.images.length > 0) {
                const img = model.images[0];
                modelImage = img?.url || img?.base64;
              }

              matchedModels.push({
                deviceTypeName: deviceInfo.deviceTypeName,
                manufacturerName,
                model,
                modelImage,
                score: getModelMatchScore(model, manufacturerName, queryTokens),
              });
            }
          }
        }

        matchedModels.sort((left, right) => right.score - left.score);

        const normalizedQuery = normalizeSearchText(searchTerm);
        let effectiveMatchedModels = matchedModels;
        if (strictExactMode && normalizedQuery) {
          const exactModels = matchedModels.filter((matchedModel) => {
            const normalizedModelName = normalizeSearchText(matchedModel.model.name);
            const normalizedManufacturerModel = normalizeSearchText(`${matchedModel.manufacturerName} ${matchedModel.model.name}`);
            return normalizedModelName === normalizedQuery || normalizedManufacturerModel === normalizedQuery;
          });

          if (exactModels.length > 0) {
            effectiveMatchedModels = exactModels;
          }
        }

        let topModelServicesFromApi: RepairService[] = [];
        if (effectiveMatchedModels.length > 0) {
          const topModel = effectiveMatchedModels[0];
          try {
            const topModelServiceResponse = await getRepairServices({
              limit: 1000,
              sortBy: 'popularity',
              sortOrder: 'desc',
              manufacturerPrecise: topModel.manufacturerName,
              modelPrecise: topModel.model.name,
            });
            topModelServicesFromApi = ((topModelServiceResponse as any).services || []) as RepairService[];
          } catch (error) {
            console.error('[Search] Failed to load precise top-model services:', error);
          }
        }

        if (effectiveMatchedModels.length > 0) {
          for (let modelIndex = 0; modelIndex < effectiveMatchedModels.length; modelIndex += 1) {
            const matchedModel = effectiveMatchedModels[modelIndex];
            const normalizedManufacturerName = normalizeSearchText(matchedModel.manufacturerName);
            const normalizedModelName = normalizeSearchText(matchedModel.model.name);

            const servicesForModel = (modelIndex === 0 && topModelServicesFromApi.length > 0
              ? topModelServicesFromApi
              : allServices
            ).filter((service) => {
              if (getServiceManufacturerValue(service) !== normalizedManufacturerName) {
                return false;
              }

              const modelPreciseRaw = String((service as any).modelPrecise || '').trim();
              const normalizedServiceModel = getServiceModelValue(service);

              // Backend semantics: when filtering by modelPrecise, generic services
              // without model assignment also belong to that model result set.
              if (!modelPreciseRaw && !normalizedServiceModel) {
                return true;
              }

              if (!modelPreciseRaw && normalizedServiceModel) {
                return serviceMatchesModelName(service.model, matchedModel.model.name, strictExactMode);
              }

              return normalizedServiceModel === normalizedModelName;
            });

            const modelKey = `${normalizeSearchText(matchedModel.manufacturerName)}::${normalizeSearchText(matchedModel.model.name)}`;

            for (const service of servicesForModel) {
              const modelScoreBoost =
                normalizeSearchText(service.model) === normalizeSearchText(matchedModel.model.name) ? 140 : 0;

              scoredServiceMatches.push({
                service: {
                  ...service,
                  resultType: 'service' as const,
                  deviceType: matchedModel.deviceTypeName,
                  manufacturer: matchedModel.manufacturerName,
                  modelName: matchedModel.model.name,
                  modelImage: matchedModel.modelImage,
                },
                score: matchedModel.score + modelScoreBoost + Number(service.popularity || 0),
                modelKey,
              });
            }
          }
        } else {
          // Fallback to broad text search only when no model matched.
          for (const service of allServices) {
            const serviceMatches =
              service.name?.toLowerCase().includes(searchLower) ||
              service.description?.toLowerCase().includes(searchLower) ||
              service.shortDescription?.toLowerCase().includes(searchLower) ||
              service.searchKeywords?.toLowerCase().includes(searchLower) ||
              service.manufacturer?.toLowerCase().includes(searchLower) ||
              service.model?.toLowerCase().includes(searchLower);

            if (!serviceMatches) continue;

            // Use service fields from backend, which should contain deviceTypes, manufacturer, model
            scoredServiceMatches.push({
              service: {
                ...service,
                resultType: 'service' as const,
                deviceType: (service.deviceTypes && service.deviceTypes[0]) || service.category || '',
                manufacturer: service.manufacturer || '',
                modelName: service.model || '',
              },
              score: getServiceSearchFallbackScore(service, searchLower) + Number(service.popularity || 0),
              modelKey: `fallback::${service._id}`,
            });
          }
        }

        // Deduplicate by service id and keep the highest score + originating model group.
        const bestMatchByServiceId = new Map<string, { service: ServiceWithDeviceInfo; score: number; modelKey: string }>();
        for (const entry of scoredServiceMatches) {
          const existing = bestMatchByServiceId.get(entry.service._id);
          if (!existing || entry.score > existing.score) {
            bestMatchByServiceId.set(entry.service._id, entry);
          }
        }

        const deduplicatedEntries = Array.from(bestMatchByServiceId.values());

        // Group model-based matches so all services from a better matching model appear
        // before the next model.
        let uniqueServices: ServiceWithDeviceInfo[] = [];

        if (effectiveMatchedModels.length > 0) {
          const modelScoreByKey = new Map<string, number>();
          for (const model of effectiveMatchedModels) {
            const key = `${normalizeSearchText(model.manufacturerName)}::${normalizeSearchText(model.model.name)}`;
            const current = modelScoreByKey.get(key);
            if (current === undefined || model.score > current) {
              modelScoreByKey.set(key, model.score);
            }
          }

          const grouped = new Map<string, Array<{ service: ServiceWithDeviceInfo; score: number; modelKey: string }>>();
          for (const entry of deduplicatedEntries) {
            if (!grouped.has(entry.modelKey)) {
              grouped.set(entry.modelKey, []);
            }
            grouped.get(entry.modelKey)!.push(entry);
          }

          const orderedModelKeys = Array.from(grouped.keys()).sort((left, right) => {
            const leftScore = modelScoreByKey.get(left) || 0;
            const rightScore = modelScoreByKey.get(right) || 0;
            return rightScore - leftScore;
          });

          for (const modelKey of orderedModelKeys) {
            const servicesForModel = (grouped.get(modelKey) || [])
              .sort((left, right) => right.score - left.score)
              .map((entry) => entry.service);
            uniqueServices.push(...servicesForModel);
          }

          const topModelKey = orderedModelKeys[0];
          const topModelServiceCount = topModelKey ? (grouped.get(topModelKey)?.length || 0) : 0;
          const serviceLimit = Math.max(15, topModelServiceCount);
          uniqueServices = uniqueServices.slice(0, serviceLimit);
        } else {
          uniqueServices = deduplicatedEntries
            .sort((left, right) => right.score - left.score)
            .map((entry) => entry.service)
            .slice(0, 15);
        }

        // Combine results: when we have model-based matches, keep services first so
        // all services for the top model remain in the upper result block.
        const combinedResults = [
          ...(effectiveMatchedModels.length > 0 ? uniqueServices : products.slice(0, 4)),
          ...(effectiveMatchedModels.length > 0 ? products.slice(0, 4) : uniqueServices)
        ].slice(0, effectiveMatchedModels.length > 0 ? Math.max(18, uniqueServices.length) : 18);

        console.log('[Search] Final results:', {
          searchTerm,
          productsFound: products.length,
          servicesMatched: scoredServiceMatches.length,
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

    // Use deviceType, manufacturer, modelName from service props, with fallback to service fields
    const deviceType = service.deviceType || '';
    const manufacturer = service.manufacturer || '';
    const modelName = service.modelName || '';

    console.log('[NavbarSearch] Service clicked:', {
      service: {
        id: service._id,
        name: service.name,
        deviceType,
        manufacturer,
        modelName,
      }
    });

    if (deviceType && manufacturer && modelName) {
      // Set session storage with device info for configurator
      const navDeviceSelection = {
        deviceType,
        manufacturer,
        modelName,
        searchQuery: `${manufacturer} ${modelName}`,
        selectedServiceId: service._id,
        selectedServiceName: service.name
      };

      // Store selected service for automatic selection in step 3
      const selectedService = {
        _id: service._id,
        name: service.name,
        category: service.category,
        price: service.price,
        estimatedTime: service.estimatedTime,
        shortDescription: service.shortDescription
      };

      console.log('[NavbarSearch] Storing navigation data:', {
        navDeviceSelection,
        selectedService,
        step: '3'
      });

      sessionStorage.setItem('navDeviceSelection', JSON.stringify(navDeviceSelection));
      sessionStorage.setItem('navConfiguratorStep', '3');
      sessionStorage.setItem('navPreselectedService', JSON.stringify(selectedService));

      // Dispatch event first, then navigate with a small delay to ensure sessionStorage is written
      window.dispatchEvent(new CustomEvent('navDeviceSelected'));
      
      // Use a small delay to ensure sessionStorage is fully written before navigation
      setTimeout(() => {
        navigate('/');
        setShowResults(false);
      }, 50);
    } else {
      console.error('[NavbarSearch] Service missing required fields:', {
        deviceType,
        manufacturer,
        modelName,
        hasDeviceType: !!service.deviceType,
        hasManufacturer: !!service.manufacturer,
        hasModelName: !!service.modelName
      });
      
      toast({
        variant: 'destructive',
        title: t('common.error'),
        description: 'Service-Daten unvollständig - bitte versuchen Sie es später'
      });
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
              <div className="px-4 py-2.5 bg-gray-50 sticky top-0">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                  {results.length} {results.length === 1 ? 'Ergebnis' : 'Ergebnisse'} gefunden
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
                          <div className="flex-shrink-0 w-14 h-14 bg-white border border-gray-100 rounded-lg flex items-center justify-center overflow-hidden shadow-sm">
                            {service.modelImage ? (
                              <img
                                src={service.modelImage}
                                alt={service.modelName || service.manufacturer}
                                className="w-full h-full object-contain p-1"
                                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                              />
                            ) : (
                              <Wrench className="h-6 w-6 text-orange-400" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                              {service.category && (() => {
                                const colors = getCategoryColor(service.category);
                                return (
                                  <Badge variant="outline" className={`text-xs border-2 ${colors.border} ${colors.text} ${colors.bg} py-0 px-1.5 flex items-center gap-1`}>
                                    {getCategoryIcon(service.category, 'sm')}
                                    {service.category}
                                  </Badge>
                                );
                              })()}
                            </div>
                            <h4 className="font-semibold text-sm text-gray-900 group-hover:text-orange-600 break-words">
                              {service.name}
                            </h4>
                            <div className="mt-0.5">
                              {renderModelMatchText(service.manufacturer, service.modelName)}
                            </div>
                            <span className="text-sm text-orange-600 font-bold">
                              ab €{service.price.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  }
                })}
              </div>
              {/* Footer: "show all services for this model" */}
              {(() => {
                const serviceResults = results.filter(r => r.resultType === 'service') as ServiceWithDeviceInfo[];
                if (serviceResults.length === 0) return null;
                const modelCounts = new Map<string, ServiceWithDeviceInfo>();
                for (const s of serviceResults) {
                  if (s.modelName && !modelCounts.has(s.modelName)) modelCounts.set(s.modelName, s);
                }
                const topEntry = [...modelCounts.entries()][0];
                const topService = topEntry?.[1];
                const label = topService
                  ? `Alle Reparaturen für ${[topService.manufacturer, topEntry[0]].filter(Boolean).join(' ')} anzeigen`
                  : 'Alle Reparaturen anzeigen';
                return (
                  <div className="px-4 py-2.5 bg-orange-50 border-t border-orange-100">
                    <button
                      onClick={() => {
                        if (topService?.deviceType && topService?.manufacturer && topService?.modelName) {
                          sessionStorage.setItem('navDeviceSelection', JSON.stringify({
                            deviceType: topService.deviceType,
                            manufacturer: topService.manufacturer,
                            modelName: topService.modelName,
                            searchQuery: `${topService.manufacturer} ${topService.modelName}`,
                          }));
                          sessionStorage.setItem('navConfiguratorStep', '3');
                          window.dispatchEvent(new CustomEvent('navDeviceSelected'));
                          navigate('/');
                        }
                        setShowResults(false);
                      }}
                      className="w-full text-center text-xs font-semibold text-orange-700 hover:text-orange-900 flex items-center justify-center gap-1 py-0.5"
                    >
                      <Wrench className="h-3.5 w-3.5" />
                      {label} →
                    </button>
                  </div>
                );
              })()}
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
