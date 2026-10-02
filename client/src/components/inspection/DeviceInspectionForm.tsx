import { formatEUR } from '@/lib/utils';
import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/useToast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Eye,
  Lock,
  Send,
} from 'lucide-react';
import {
  initializeInspection,
  getInspection,
  updateModelVerification,
  updateIdentification,
  updateAccessories,
  updateExternalInspection,
  updateDeviceTests,
  updateAppleSpecific,
  completeInspection,
  getKnownRepairCost,
} from '@/api/deviceInspection';
import {
  getDeviceTypes,
  getManufacturersByDeviceType,
  getModelsByTypeAndManufacturer,
  searchDevices,
  SearchResult,
  type DeviceType as CatalogDeviceType,
  type Manufacturer as CatalogManufacturer,
} from '@/api/devices';

type VerificationStatus = 'correct' | 'incorrect-more-expensive' | 'incorrect-same-cheaper' | 'unverifiable';
type ConditionStatus = '--' | 'light-wear' | 'scratches-wear' | 'heavy-scratches-wear' | 'damaged';
type ButtonsStatus = 'working' | 'not-working';
type ChecklistStatus = 'OK' | 'Not OK' | 'Not tested';
type CompletionAction = 'repairable' | 'not-repairable' | 'inform-customer';
type CanonicalDeviceType = 'Smartphone' | 'Laptop' | 'Tablet' | 'Watch' | 'Headphones' | 'Other';

const CANONICAL_DEVICE_TYPES: Record<string, CanonicalDeviceType> = {
  smartphone: 'Smartphone',
  handy: 'Smartphone',
  mobiltelefon: 'Smartphone',
  mobilephone: 'Smartphone',
  phone: 'Smartphone',
  telefon: 'Smartphone',
  iphone: 'Smartphone',
  laptop: 'Laptop',
  notebook: 'Laptop',
  macbook: 'Laptop',
  tablet: 'Tablet',
  ipad: 'Tablet',
  watch: 'Watch',
  smartwatch: 'Watch',
  applewatch: 'Watch',
  wearable: 'Watch',
  uhr: 'Watch',
  headphone: 'Headphones',
  headset: 'Headphones',
  kopfhoerer: 'Headphones',
  ohrhoerer: 'Headphones',
  earphone: 'Headphones',
  earbud: 'Headphones',
  airpod: 'Headphones',
};

/**
 * Order.deviceType is free-form (admin-editable catalog names, German or English, singular
 * or plural). The rules of this wizard (serial number required, IMEI required) must follow
 * the canonical type, not the raw label.
 * Keep in sync with normalizeInspectionDeviceType() in server/services/deviceInspectionService.js.
 */
const normalizeInspectionDeviceType = (value?: string): CanonicalDeviceType => {
  const slug = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\u00e4/g, 'ae')
    .replace(/\u00f6/g, 'oe')
    .replace(/\u00fc/g, 'ue')
    .replace(/\u00df/g, 'ss')
    .replace(/[^a-z0-9]/g, '');

  if (!slug) return 'Other';

  // Catalogue names are frequently plural ("Smartphones", "Smartwatches").
  const candidates = [slug, slug.replace(/es$/, ''), slug.replace(/s$/, '')];
  for (const candidate of candidates) {
    if (CANONICAL_DEVICE_TYPES[candidate]) {
      return CANONICAL_DEVICE_TYPES[candidate];
    }
  }

  return 'Other';
};

const INSPECTION_DRAFT_PREFIX = 'inspection-draft-';

type ModelsApiResponse = {
  models?: Array<{
    _id?: string;
    name?: string;
    deviceType?: string;
    manufacturer?: string;
    brandId?: string;
    image?: string;
  }>;
};

type DeviceTypesApiResponse = { deviceTypes?: CatalogDeviceType[] };
type ManufacturersApiResponse = { manufacturers?: CatalogManufacturer[] };

interface DeviceInspectionFormProps {
  orderId: string;
  customerId?: string | null;
  deviceType: string;
  deviceBrand?: string;
  deviceModel?: string;
  initialImei?: string;
  initialSerialNumber?: string;
  reportedDeviceImage?: string;
  bookedRepairs?: Array<{ name: string; price?: number; quantity?: number }>;
  orderTotalCost?: number;
  forceStartAtStepOne?: boolean;
  onRequestDeviceChange?: () => void;
  onComplete?: () => void;
  // Reports the loaded or freshly initialised inspection (e.g. so a page can hand its _id to the
  // communication panel on a first visit, before any inspection existed).
  onInspectionLoaded?: (inspection: any) => void;
}

export function DeviceInspectionForm({
  orderId,
  customerId,
  deviceType,
  deviceBrand,
  deviceModel,
  initialImei = '',
  initialSerialNumber = '',
  reportedDeviceImage,
  bookedRepairs = [],
  orderTotalCost,
  forceStartAtStepOne = false,
  onRequestDeviceChange,
  onComplete,
  onInspectionLoaded,
}: DeviceInspectionFormProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [inspection, setInspection] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState(1);
  const [expandedSteps, setExpandedSteps] = useState<number[]>([1]);
  const [initializing, setInitializing] = useState(true);

  // Step 1: Model Verification
  const [reportedModel, setReportedModel] = useState('');
  const [actualModel, setActualModel] = useState('');
  const [reportedModelImage, setReportedModelImage] = useState('');
  const [actualModelImage, setActualModelImage] = useState('');
  const [actualModelSearchQuery, setActualModelSearchQuery] = useState('');
  // Explicit dirty flag: true as soon as the technician actively types or picks the actual
  // model. It is sent to the API so a deliberately entered value is never replaced by the
  // server's stale-draft protection (which would otherwise silently discard the input).
  const [actualModelUserConfirmed, setActualModelUserConfirmed] = useState(false);
  const [actualModelResults, setActualModelResults] = useState<SearchResult[]>([]);
  const [availableDeviceTypes, setAvailableDeviceTypes] = useState<CatalogDeviceType[]>([]);
  const [availableManufacturers, setAvailableManufacturers] = useState<CatalogManufacturer[]>([]);
  const [selectedActualDeviceType, setSelectedActualDeviceType] = useState('');
  const [selectedActualManufacturer, setSelectedActualManufacturer] = useState('');
  const [showActualModelResults, setShowActualModelResults] = useState(false);
  const [searchingActualModel, setSearchingActualModel] = useState(false);
  const [actualModelHighlightedIndex, setActualModelHighlightedIndex] = useState(-1);
  const [skipNextActualModelSearch, setSkipNextActualModelSearch] = useState(false);
  const [autoModelPrefilled, setAutoModelPrefilled] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus>('correct');
  const [costDifference, setCostDifference] = useState(0);
  const [modelNotes, setModelNotes] = useState('');

  // Step 2: Identification
  const [imei, setImei] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [imeiRequiredAtCompletion, setImeiRequiredAtCompletion] = useState(false);

  // Step 3: Accessories
  const [hasOriginalPackaging, setHasOriginalPackaging] = useState(false);
  const [hasCaseCover, setHasCaseCover] = useState(false);
  const [hasPowerAdapter, setHasPowerAdapter] = useState(false);
  const [simTrayPresent, setSimTrayPresent] = useState<boolean | null>(null);
  const [additionalAccessories, setAdditionalAccessories] = useState('');
  const [accessoriesNotes, setAccessoriesNotes] = useState('');

  // Step 4: External Inspection
  const [displayStatus, setDisplayStatus] = useState<ConditionStatus>('--');
  const [frameStatus, setFrameStatus] = useState<ConditionStatus>('--');
  const [backCoverStatus, setBackCoverStatus] = useState<ConditionStatus>('--');

  // Step 5: Device Tests
  const [buttonsStatus, setButtonsStatus] = useState<ButtonsStatus>('working');
  const [buttonsDescription, setButtonsDescription] = useState('');
  const [hasDamage, setHasDamage] = useState(false);
  const [damageDescription, setDamageDescription] = useState('');
  const [externalNotes, setExternalNotes] = useState('');

  const [chargingStatus, setChargingStatus] = useState<ChecklistStatus>('OK');
  const [powerStatus, setPowerStatus] = useState<ChecklistStatus>('OK');
  const [wifiStatus, setWifiStatus] = useState<ChecklistStatus>('OK');
  const [frontCameraStatus, setFrontCameraStatus] = useState<ChecklistStatus>('OK');
  const [mainCameraStatus, setMainCameraStatus] = useState<ChecklistStatus>('OK');
  const [chargingCurrent, setChargingCurrent] = useState('');
  const [deviceTestNotes, setDeviceTestNotes] = useState('');

  // Step 6: Apple-specific
  const [modemFirmwareStatus, setModemFirmwareStatus] = useState<'working' | 'defective' | 'not-testable'>('working');
  const [touchIdFaceIdStatus, setTouchIdFaceIdStatus] = useState<'not-applicable' | 'working' | 'defective' | 'not-testable'>('not-applicable');
  const [defectActionRequested, setDefectActionRequested] = useState(false);
  const [defectActionNote, setDefectActionNote] = useState('');

  // Step 7: Summary & Completion
  // The "Abschlussentscheidung" control was removed from step 7; completionAction is only
  // hydrated for the legacy "inform-customer" follow-up and never sent back. There is no
  // "reparierbar" state any more.
  const [completionAction, setCompletionAction] = useState<CompletionAction | null>(null);
  // Known price of an existing quote (never a default): '' = unknown.
  const [repairCost, setRepairCost] = useState('');
  const [repairTimeframe, setRepairTimeframe] = useState('');
  const [repairDescription, setRepairDescription] = useState('');
  const [informCustomer, setInformCustomer] = useState(false);
  // Warnung, wenn beim Start der Eingangsprüfung Auftragsstatus/-verlauf nicht gespeichert wurden.
  const [orderSyncWarning, setOrderSyncWarning] = useState<string | null>(null);
  const [retryingOrderSync, setRetryingOrderSync] = useState(false);
  const [customerInfoReason, setCustomerInfoReason] = useState('');
  const [customerInfoNote, setCustomerInfoNote] = useState('');
  // "Nachricht an Kunden" (NOTIF-7): der EINZIGE Text, der den Kunden erreicht. customerInfoNote
  // ist die interne Notiz und bleibt im Team. (Der Zustandsname stammt vom frueheren Vorlagenfeld.)
  const [customerInfoMailTemplate, setCustomerInfoMailTemplate] = useState('');
  const [customerInfoSentAt, setCustomerInfoSentAt] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [submittingStep, setSubmittingStep] = useState<number | null>(null);
  // Where "Gemeldetes Modell" came from (server: modelVerification.reportedModelSource).
  const [reportedModelSource, setReportedModelSource] = useState<string | undefined>(undefined);

  // T15: the resume position is taken from the server ONCE per mount. Later re-syncs (e.g. the
  // order's device props arriving after "Gerät ändern") must never move the wizard - they used
  // to pull a technician on step 4 back to step 1 and unmount the step's form.
  const initialLoadDoneRef = useRef(false);
  // Counts completed step saves. A background re-sync whose GET started before a save finished
  // carries an OLDER server state and must not overwrite the saved one.
  const saveSequenceRef = useRef(0);
  // The newest server state returned by a step save (see applySavedInspection).
  const latestSavedInspectionRef = useRef<any>(null);
  const stepCardRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const [scrollToStep, setScrollToStep] = useState<number | null>(null);

  const canonicalDeviceType = normalizeInspectionDeviceType(deviceType);
  // The order's CURRENT device - i.e. the corrected/actual model after "Geraet aendern".
  const orderCurrentModel = [
    deviceBrand && deviceBrand !== 'N/A' ? deviceBrand : '',
    deviceModel || '',
  ].filter(Boolean).join(' ').trim();
  // The draft is scoped to the device it was written for, so a device correction cannot
  // resurrect pre-change values (see clearOutdatedDrafts below).
  const draftKey = `${INSPECTION_DRAFT_PREFIX}${orderId}${
    orderCurrentModel ? `-${orderCurrentModel.toLowerCase().replace(/[^a-z0-9]+/g, '-')}` : ''
  }`;

  const normalizeCondition = (value?: string): ConditionStatus => {
    if (!value) return '--';
    if (value === 'OK') return '--';
    if (value === 'Not OK') return 'damaged';
    if (['--', 'light-wear', 'scratches-wear', 'heavy-scratches-wear', 'damaged'].includes(value)) {
      return value as ConditionStatus;
    }
    return '--';
  };

  const searchModelCandidates = async (
    query: string,
    options?: { deviceType?: string; manufacturer?: string }
  ): Promise<SearchResult[]> => {
    const normalizedQuery = query.trim();
    const selectedType = String(options?.deviceType || '').trim();
    const selectedManufacturerName = String(options?.manufacturer || '').trim();

    // If both hierarchy levels are selected, search directly in that scoped catalog slice.
    if (selectedType && selectedManufacturerName) {
      try {
        const response = (await getModelsByTypeAndManufacturer(selectedType, selectedManufacturerName)) as ModelsApiResponse;
        const models = Array.isArray(response?.models) ? response.models : [];
        const manufacturerMeta = availableManufacturers.find((entry) => entry.name === selectedManufacturerName);
        const normalizedQueryLc = normalizedQuery.toLowerCase();

        const scopedResults = models
          .map((model) => {
            const name = String(model?.name || '').trim();
            return {
              _id: String(model?._id || ''),
              name,
              deviceType: String(model?.deviceType || selectedType),
              manufacturer: String(model?.manufacturer || selectedManufacturerName),
              manufacturerId: String(model?.brandId || manufacturerMeta?._id || ''),
              image: String(model?.image || ''),
              displayName: name,
            } as SearchResult;
          })
          .filter((entry: SearchResult) => {
            if (!entry._id || !entry.name) return false;
            if (!normalizedQueryLc) return true;
            const display = String(entry.displayName || '').toLowerCase();
            const name = String(entry.name || '').toLowerCase();
            return display.includes(normalizedQueryLc) || name.includes(normalizedQueryLc);
          });

        return scopedResults;
      } catch (error) {
        console.warn('Scoped model search failed, falling back to global search', error);
      }
    }

    if (!normalizedQuery || normalizedQuery.length < 2) return [];
    try {
      const response = (await searchDevices(normalizedQuery)) as { devices?: SearchResult[] };
      const devices = Array.isArray(response?.devices) ? response.devices : [];
      const selectedTypeLc = selectedType.toLowerCase();
      const selectedManufacturerLc = selectedManufacturerName.toLowerCase();

      return devices.filter((entry) => {
        const typeMatches = !selectedTypeLc || String(entry.deviceType || '').toLowerCase() === selectedTypeLc;
        const manufacturerMatches = !selectedManufacturerLc || String(entry.manufacturer || '').toLowerCase() === selectedManufacturerLc;
        return typeMatches && manufacturerMatches;
      });
    } catch (error) {
      console.warn('Model search failed', error);
      return [];
    }
  };

  const normalize = (value: string = '') => value.toLowerCase().replace(/\s+/g, ' ').trim();
  const normalizeCompact = (value: string = '') => normalize(value).replace(/[^a-z0-9]/g, '');

  const resolveDeviceImageUrl = (rawUrl?: string) => {
    const value = String(rawUrl || '').trim();
    if (!value) return '';
    if (/^(https?:)?\/\//i.test(value) || value.startsWith('data:') || value.startsWith('blob:')) {
      return value;
    }

    const apiBaseRaw = String(import.meta.env.VITE_SERVER_URL || import.meta.env.VITE_API_URL || '').trim();
    const apiBase = apiBaseRaw.replace(/\/$/, '').replace(/\/api$/, '');
    const normalizedPath = value.startsWith('/') ? value : `/${value}`;
    return apiBase ? `${apiBase}${normalizedPath}` : value;
  };

  const buildSearchQueries = (rawQuery: string) => {
    const query = rawQuery.trim();
    const variants = [
      query,
      query.replace(/\s+/g, ''),
      query.replace(/([a-zA-Z])([0-9])/g, '$1 $2'),
      query.replace(/([0-9])([a-zA-Z])/g, '$1 $2'),
      query.replace(/[-_/]+/g, ' '),
    ];

    return variants
      .map((item) => item.replace(/\s+/g, ' ').trim())
      .filter((item, index, all) => item.length >= 2 && all.indexOf(item) === index);
  };

  const mergeUniqueSearchResults = (resultGroups: SearchResult[][]) => {
    const byId = new Map<string, SearchResult>();
    for (const group of resultGroups) {
      for (const entry of group) {
        if (!entry?._id) continue;
        if (!byId.has(entry._id)) {
          byId.set(entry._id, entry);
        }
      }
    }
    return Array.from(byId.values());
  };

  const resolveCatalogImage = async (modelValue: string, brandHint?: string): Promise<string> => {
    const model = normalize(modelValue);
    const compactModel = normalizeCompact(modelValue);
    const brand = normalize(brandHint || '');

    if (!model) {
      return '';
    }

    const queryCandidates = [
      `${brandHint || ''} ${modelValue || ''}`.trim(),
      modelValue || '',
      String(modelValue || '').replace(/([a-zA-Z])([0-9])/g, '$1 $2').trim(),
      String(modelValue || '').replace(/\s+/g, '').trim(),
    ].filter((candidate, index, all) => candidate.length > 0 && all.indexOf(candidate) === index);

    let devices: SearchResult[] = [];
    for (const query of queryCandidates) {
      const results = await searchModelCandidates(query);
      if (results.length > 0) {
        devices = results;
        break;
      }
    }

    if (devices.length === 0) {
      return '';
    }

    const exactBrandAndModel = devices.find((device) => {
      const name = normalize(device.name);
      const display = normalize(device.displayName || device.name);
      const compactName = normalizeCompact(device.name);
      const compactDisplay = normalizeCompact(device.displayName || device.name);
      const manufacturer = normalize(device.manufacturer || '');
      const hasImage = Boolean(device.image && device.image.trim());
      if (!hasImage) return false;
      const isModelMatch = name === model || display === model || compactName === compactModel || compactDisplay === compactModel;
      const isBrandMatch = !brand || manufacturer === brand;
      return isModelMatch && isBrandMatch;
    });

    const sameModel = devices.find((device) => {
      const name = normalize(device.name);
      const display = normalize(device.displayName || device.name);
      const compactName = normalizeCompact(device.name);
      const compactDisplay = normalizeCompact(device.displayName || device.name);
      const hasImage = Boolean(device.image && device.image.trim());
      if (!hasImage) return false;
      return name === model || display === model || compactName === compactModel || compactDisplay === compactModel;
    });

    const fuzzyMatch = devices.find((device) => {
      const name = normalize(device.name);
      const display = normalize(device.displayName || device.name);
      const compactName = normalizeCompact(device.name);
      const compactDisplay = normalizeCompact(device.displayName || device.name);
      const hasImage = Boolean(device.image && device.image.trim());
      if (!hasImage) return false;
      return display.includes(model) || model.includes(name) || compactDisplay.includes(compactModel) || compactModel.includes(compactName);
    });

    const fallback = devices.find((device) => Boolean(device.image && device.image.trim()));
    const image = exactBrandAndModel?.image || sameModel?.image || fuzzyMatch?.image || fallback?.image || '';
    return resolveDeviceImageUrl(image);
  };

  const resolveImagesFromCatalog = async (reported: string, actual: string) => {
    const reportedImage = await resolveCatalogImage(reported, deviceBrand);
    const actualImage = await resolveCatalogImage(actual, deviceBrand);
    return { reportedImage, actualImage };
  };

  const handleActualModelSearch = (query: string) => {
    setActualModelSearchQuery(query);
    setActualModelHighlightedIndex(-1);
    setActualModelUserConfirmed(true);
  };

  const handleActualDeviceTypeChange = (value: string) => {
    setSelectedActualDeviceType(value);
    setSelectedActualManufacturer('');
    setActualModelResults([]);
    setShowActualModelResults(false);
    setActualModelHighlightedIndex(-1);
    setAutoModelPrefilled(false);
  };

  const handleActualManufacturerChange = (value: string) => {
    setSelectedActualManufacturer(value);
    setActualModelResults([]);
    setShowActualModelResults(false);
    setActualModelHighlightedIndex(-1);
    setAutoModelPrefilled(false);
  };

  // userInitiated=false for the automatic catalog prefill below - only a real technician
  // interaction may set the "user confirmed this value" flag.
  const handleSelectActualModel = (device: SearchResult, userInitiated = true) => {
    const modelName = device.displayName || device.name || '';
    setActualModel(modelName);
    if (userInitiated) {
      setActualModelUserConfirmed(true);
    }
    setActualModelSearchQuery(modelName);
    setActualModelImage(resolveDeviceImageUrl(device.image));
    setActualModelResults([]);
    setShowActualModelResults(false);
    setActualModelHighlightedIndex(-1);
    setSkipNextActualModelSearch(true);
    setAutoModelPrefilled(true);
  };

  const handleActualModelKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (!showActualModelResults || actualModelResults.length === 0) {
      if (event.key === 'ArrowDown' && actualModelResults.length > 0) {
        event.preventDefault();
        setShowActualModelResults(true);
        setActualModelHighlightedIndex(0);
      }
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActualModelHighlightedIndex((current) => Math.min(current + 1, actualModelResults.length - 1));
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActualModelHighlightedIndex((current) => Math.max(current - 1, 0));
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      const index = actualModelHighlightedIndex >= 0 ? actualModelHighlightedIndex : 0;
      const selected = actualModelResults[index];
      if (selected) {
        handleSelectActualModel(selected);
      }
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      setShowActualModelResults(false);
      setActualModelHighlightedIndex(-1);
    }
  };

  const normalizeButtons = (value?: string): ButtonsStatus => {
    if (!value) return 'working';
    if (value === 'OK') return 'working';
    if (value === 'Not OK') return 'not-working';
    return value === 'not-working' ? 'not-working' : 'working';
  };

  const getConditionLabel = (value: ConditionStatus) => {
    const labels: Record<ConditionStatus, string> = {
      '--': 'Keine optischen Auffälligkeiten',
      'light-wear': 'Leichte Gebrauchsspuren',
      'scratches-wear': 'Kratzer und Gebrauchsspuren',
      'heavy-scratches-wear': 'Schwere Kratzer und Gebrauchsspuren',
      'damaged': 'Beschädigt',
    };
    return labels[value];
  };

  const getAppleStatusLabel = (value: string) => {
    const labels: Record<string, string> = {
      working: 'funktioniert',
      defective: 'defekt',
      'not-testable': 'nicht testbar',
      'not-applicable': 'nicht vorhanden',
    };
    return labels[value] || value;
  };

  // Legacy orders without a booking snapshot: say how "Gemeldetes Modell" was determined
  // instead of presenting it as the customer's original statement.
  const getReportedModelSourceNote = (source?: string) => {
    if (source === 'order-timeline') {
      return 'Aus dem Auftragsverlauf ermittelt (keine gespeicherte Buchungsangabe)';
    }
    if (source === 'order-current-unverified' || source === 'order-snapshot-unverified') {
      return 'Ursprüngliche Kundenangabe nicht gesichert erfasst – entspricht dem damaligen Auftragsstand';
    }
    return '';
  };

  const getVerificationStatusLabel = (
    value: 'correct' | 'incorrect-more-expensive' | 'incorrect-same-cheaper' | 'unverifiable'
  ) => {
    switch (value) {
      case 'correct':
        return t('inspection.verification.correct', 'Korrekt - Modell stimmt überein');
      case 'incorrect-more-expensive':
        return t('inspection.verification.incorrectMoreExpensive', 'Falsch - Teureres Modell');
      case 'incorrect-same-cheaper':
        return t('inspection.verification.incorrectSameCheaper', 'Falsch - Gleichwertig oder günstiger');
      case 'unverifiable':
        return t('inspection.verification.unverifiable', 'Nicht verifizierbar - Keine eindeutige Bestimmung');
      default:
        return value;
    }
  };

  const getChecklistStatusLabel = (value: ChecklistStatus) => {
    switch (value) {
      case 'OK':
        return t('inspection.status.ok', 'In Ordnung');
      case 'Not OK':
        return t('inspection.status.notOk', 'Nicht in Ordnung');
      case 'Not tested':
        return t('inspection.status.notTested', 'Tests nicht durchgeführt');
      default:
        return value;
    }
  };

  const setAllDeviceTestsNotTested = () => {
    setChargingStatus('Not tested');
    setPowerStatus('Not tested');
    setWifiStatus('Not tested');
    setFrontCameraStatus('Not tested');
    setMainCameraStatus('Not tested');
    setChargingCurrent('');
  };

  // Device/model fields only. Safe to run again whenever the order's device props change.
  const hydrateModelFromInspection = (insp: any, options: { keepLocalNotes?: boolean } = {}) => {
    if (!insp) return;

    // "Gemeldetes Modell" is what the CUSTOMER originally booked. The server snapshot
    // (Order.reportedDevice) is authoritative and survives a correction via "Gerät ändern";
    // the order's current device is only a fallback for records that have no snapshot.
    setReportedModel(insp.modelVerification?.reportedModel || orderCurrentModel || '');
    setReportedModelSource(insp.modelVerification?.reportedModelSource);

    if (insp.modelVerification) {
      const persistedActual = insp.modelVerification.actualModel || '';
      // The order's current device is the source of truth for corrections made via
      // "Geraet aendern". If it diverges from the persisted actualModel, the device was
      // changed after the inspection was last saved, so the persisted value is stale and
      // must not be shown in Step 7 - the order's current device wins.
      const orderDeviceChanged = Boolean(orderCurrentModel && orderCurrentModel !== persistedActual);
      const effectiveActual = orderDeviceChanged ? orderCurrentModel : persistedActual;
      setActualModel(effectiveActual);
      setActualModelSearchQuery(effectiveActual);
      setActualModelUserConfirmed(false);
      setVerificationStatus(
        orderDeviceChanged
          ? 'correct'
          : (insp.modelVerification.verificationStatus || 'correct') as VerificationStatus
      );
      setCostDifference(Number(insp.modelVerification.costDifference || 0));
      // A re-sync (device props changed) must not wipe notes the technician is typing in step 1.
      if (!options.keepLocalNotes) {
        setModelNotes(insp.modelVerification.notes || '');
      }
    } else {
      if (orderCurrentModel) {
        setActualModel(orderCurrentModel);
        setActualModelSearchQuery(orderCurrentModel);
        setActualModelUserConfirmed(false);
      }
    }
  };

  const hydrateFromInspection = (insp: any, options: { applyPosition: boolean }) => {
    if (!insp) return;

    hydrateModelFromInspection(insp);

    if (insp.identification) {
      setImei(insp.identification.imei || initialImei || '');
      setSerialNumber(insp.identification.serialNumber || initialSerialNumber || '');
      setImeiRequiredAtCompletion(Boolean(insp.identification.imeiRequired));
    } else {
      setImei(initialImei);
      setSerialNumber(initialSerialNumber);
    }

    if (insp.accessories) {
      setHasOriginalPackaging(Boolean(insp.accessories.originalPackaging?.present));
      setHasCaseCover(Boolean(insp.accessories.caseCover?.present));
      setHasPowerAdapter(Boolean(insp.accessories.powerAdapter?.present));
      setSimTrayPresent(
        typeof insp.accessories.simTray?.present === 'boolean'
          ? Boolean(insp.accessories.simTray.present)
          : null
      );
      setAdditionalAccessories(insp.accessories.additionalAccessoriesText || '');
      setAccessoriesNotes(insp.accessories.description || '');
    }

    if (insp.externalInspection) {
      setDisplayStatus(normalizeCondition(insp.externalInspection.display?.status));
      setFrameStatus(normalizeCondition(insp.externalInspection.frame?.status));
      setBackCoverStatus(normalizeCondition(insp.externalInspection.backCover?.status));
      setButtonsStatus(normalizeButtons(insp.externalInspection.buttons?.status));
      setButtonsDescription(insp.externalInspection.buttons?.notes || '');
      setHasDamage(Boolean(insp.externalInspection.visibleDamages?.hasDamage));
      setDamageDescription(insp.externalInspection.visibleDamages?.description || '');
      setExternalNotes(insp.externalInspection.uniqueNotes || '');
    }

    if (insp.deviceTest) {
      setChargingStatus((insp.deviceTest.charging?.status || 'OK') as ChecklistStatus);
      setPowerStatus((insp.deviceTest.power?.status || 'OK') as ChecklistStatus);
      setWifiStatus((insp.deviceTest.wifi?.status || 'OK') as ChecklistStatus);
      setFrontCameraStatus((insp.deviceTest.frontCamera?.status || 'OK') as ChecklistStatus);
      setMainCameraStatus((insp.deviceTest.mainCamera?.status || 'OK') as ChecklistStatus);
      setChargingCurrent(insp.deviceTest.charging?.current || '');
      setButtonsStatus(normalizeButtons(insp.deviceTest.buttons?.status || insp.externalInspection?.buttons?.status));
      setButtonsDescription(insp.deviceTest.buttons?.notes || insp.externalInspection?.buttons?.notes || '');
      setDeviceTestNotes(insp.deviceTest.notes || '');
    }

    if (insp.appleSpecific) {
      if (insp.appleSpecific.modemFirmware?.status) {
        setModemFirmwareStatus(insp.appleSpecific.modemFirmware.status);
      } else {
        setModemFirmwareStatus(insp.appleSpecific.modemFirmware?.present ? 'working' : 'defective');
      }

      if (insp.appleSpecific.touchIdFaceId?.status) {
        setTouchIdFaceIdStatus(insp.appleSpecific.touchIdFaceId.status);
      } else if (insp.appleSpecific.touchIdFaceId?.applicable) {
        setTouchIdFaceIdStatus(insp.appleSpecific.touchIdFaceId?.working ? 'working' : 'defective');
      } else {
        setTouchIdFaceIdStatus('not-applicable');
      }

      setDefectActionRequested(Boolean(insp.appleSpecific.customerInfoAction?.requested));
      setDefectActionNote(insp.appleSpecific.customerInfoAction?.note || '');
    }

    // The "Abschlussentscheidung" control is gone: isRepairable is neither shown nor sent any
    // more (the server ignores it and keeps stored history untouched). completionAction is only
    // read for the legacy "inform-customer" follow-up below.
    if (insp.completionAction) {
      setCompletionAction(insp.completionAction);
    }

    if (insp.repairOffer) {
      // Only a KNOWN price is carried over - a legacy default 0 stays empty (= unknown), an
      // explicitly free quote stays "0".
      const knownCost = getKnownRepairCost(insp);
      setRepairCost(knownCost === null ? '' : String(knownCost));
      setRepairTimeframe(insp.repairOffer.timeframe || '');
      setRepairDescription(insp.repairOffer.description || '');
    }

    if (insp.customerInformation) {
      setInformCustomer(Boolean(insp.customerInformation.shouldInform));
      setCustomerInfoReason(insp.customerInformation.reason || '');
      setCustomerInfoNote(insp.customerInformation.note || '');
      setCustomerInfoMailTemplate(insp.customerInformation.customerMessage || insp.customerInformation.mailTemplate || '');
      setCustomerInfoSentAt(insp.customerInformation.sentAt || null);
    }

    const completedStepIds: number[] = Array.isArray(insp.completedSteps)
      ? insp.completedSteps.map((s: any) => Number(s.step)).filter((value: number) => Number.isFinite(value))
      : [];

    // Resume at the first step that has NOT been completed. Steps can be saved out of
    // order, so neither completedStepIds.length + 1 (repeats a done step) nor
    // max(completedStepIds) + 1 (skips a never-completed gap) is correct.
    let firstOpenStep = 1;
    while (firstOpenStep < 7 && completedStepIds.includes(firstOpenStep)) {
      firstOpenStep += 1;
    }

    if (!options.applyPosition) return;
    const nextStep = forceStartAtStepOne ? 1 : Math.min(7, Math.max(1, firstOpenStep));
    setCurrentStep(nextStep);
    setExpandedSteps([nextStep]);
  };

  const hydrateFromDraft = (draft: any) => {
    if (!draft || typeof draft !== 'object') return;
    // reportedModel / actualModel are deliberately NOT restored from the draft: they are
    // owned by the server snapshot and by the order's current device. Restoring them used
    // to post a pre-change model back to the API and overwrite the corrected device.
    // verificationStatus / costDifference are NOT restored either: a draft "Modell stimmt
    // nicht überein" survived the device correction and blocked "Speichern & Weiter" in step 1
    // (a non-matching status can never be saved anyway - it only leads to "Gerät ändern").
    setModelNotes(draft.modelNotes ?? modelNotes);
    setImei(draft.imei ?? imei);
    setSerialNumber(draft.serialNumber ?? serialNumber);
    setImeiRequiredAtCompletion(
      typeof draft.imeiRequiredAtCompletion === 'boolean'
        ? draft.imeiRequiredAtCompletion
        : imeiRequiredAtCompletion
    );
    setHasOriginalPackaging(
      typeof draft.hasOriginalPackaging === 'boolean'
        ? draft.hasOriginalPackaging
        : hasOriginalPackaging
    );
    setHasCaseCover(
      typeof draft.hasCaseCover === 'boolean'
        ? draft.hasCaseCover
        : hasCaseCover
    );
    setHasPowerAdapter(
      typeof draft.hasPowerAdapter === 'boolean'
        ? draft.hasPowerAdapter
        : hasPowerAdapter
    );
    setSimTrayPresent(typeof draft.simTrayPresent === 'boolean' ? draft.simTrayPresent : simTrayPresent);
    setAdditionalAccessories(draft.additionalAccessories ?? additionalAccessories);
    setAccessoriesNotes(draft.accessoriesNotes ?? accessoriesNotes);
    setDisplayStatus(draft.displayStatus ?? displayStatus);
    setFrameStatus(draft.frameStatus ?? frameStatus);
    setBackCoverStatus(draft.backCoverStatus ?? backCoverStatus);
    setButtonsStatus(draft.buttonsStatus ?? buttonsStatus);
    setButtonsDescription(draft.buttonsDescription ?? buttonsDescription);
    setHasDamage(typeof draft.hasDamage === 'boolean' ? draft.hasDamage : hasDamage);
    setDamageDescription(draft.damageDescription ?? damageDescription);
    setExternalNotes(draft.externalNotes ?? externalNotes);
    setChargingStatus(draft.chargingStatus ?? chargingStatus);
    setPowerStatus(draft.powerStatus ?? powerStatus);
    setWifiStatus(draft.wifiStatus ?? wifiStatus);
    setFrontCameraStatus(draft.frontCameraStatus ?? frontCameraStatus);
    setMainCameraStatus(draft.mainCameraStatus ?? mainCameraStatus);
    setChargingCurrent(draft.chargingCurrent ?? chargingCurrent);
    setModemFirmwareStatus(draft.modemFirmwareStatus ?? modemFirmwareStatus);
    setTouchIdFaceIdStatus(draft.touchIdFaceIdStatus ?? touchIdFaceIdStatus);
    setDefectActionRequested(
      typeof draft.defectActionRequested === 'boolean'
        ? draft.defectActionRequested
        : defectActionRequested
    );
    setDefectActionNote(draft.defectActionNote ?? defectActionNote);
    // completionAction / isRepairable are no longer part of the UI - a stale draft must not
    // re-inject a "Reparatureinschaetzung" nobody chose. repairCost is NOT restored either: step 7
    // has no price input, so a draft value can only be stale (e.g. a default '0' of an older
    // client) and would be re-sent as an explicit quote. Only the server's known cost counts.
    setRepairTimeframe(draft.repairTimeframe ?? repairTimeframe);
    setRepairDescription(draft.repairDescription ?? repairDescription);
    setInformCustomer(typeof draft.informCustomer === 'boolean' ? draft.informCustomer : informCustomer);
    setCustomerInfoReason(draft.customerInfoReason ?? customerInfoReason);
    setCustomerInfoNote(draft.customerInfoNote ?? customerInfoNote);
    setCustomerInfoMailTemplate(draft.customerInfoMailTemplate ?? customerInfoMailTemplate);
  };

  // Drafts of this order that were written for a DIFFERENT device (i.e. before a
  // correction via "Geraet aendern") are obsolete and must not linger.
  const clearOutdatedDrafts = () => {
    const prefix = `${INSPECTION_DRAFT_PREFIX}${orderId}`;
    [localStorage, sessionStorage].forEach((store) => {
      try {
        const obsolete: string[] = [];
        for (let index = 0; index < store.length; index += 1) {
          const key = store.key(index);
          if (key && key.startsWith(prefix) && key !== draftKey) {
            obsolete.push(key);
          }
        }
        obsolete.forEach((key) => store.removeItem(key));
      } catch (storageError) {
        console.warn('Unable to clean up inspection drafts', storageError);
      }
    });
  };

  // Drafts written for a different device of this order are obsolete. Keyed on draftKey so
  // a device correction that changes the key without remounting still cleans up the old one.
  useEffect(() => {
    clearOutdatedDrafts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, draftKey]);

  // Initialize inspection. The first run loads, hydrates everything and sets the resume position.
  // A later run (the order's device props changed, e.g. after "Gerät ändern" the reload arrives
  // after the dialog reopened) only re-syncs the model fields - silently, without the loading
  // screen, without the local draft and WITHOUT touching the current step.
  useEffect(() => {
    let cancelled = false;
    const isInitialLoad = !initialLoadDoneRef.current;
    const saveSequenceAtStart = saveSequenceRef.current;

    const init = async () => {
      try {
        if (isInitialLoad) {
          setInitializing(true);
          setLoading(true);
        }

        // First, try to get existing inspection
        let existingInspection: any = null;
        try {
          const result = await getInspection(orderId);
          existingInspection = result.inspection;
        } catch {
          console.log('No existing inspection found, will create new one');
        }

        // If no existing inspection, initialize a new one
        if (!existingInspection) {
          const result = await initializeInspection(orderId, customerId);
          existingInspection = result.inspection;
          // Auftragsstatus/-verlauf nicht aktualisiert (HIST-5c): sichtbar melden statt verschlucken.
          const initWarnings: string[] = Array.isArray((result as any)?.warnings) ? (result as any).warnings : [];
          if (!cancelled) setOrderSyncWarning(initWarnings[0] || null);
        }

        if (cancelled) return;

        if (!isInitialLoad) {
          // A step was saved while this GET was in flight: the save's response is newer (it has
          // the new completedSteps entry) - drop the stale GET result instead of overwriting it.
          // The device change that triggered this re-sync still has to reach the model fields,
          // so they are re-hydrated from the NEWEST saved state (notes stay local).
          if (saveSequenceRef.current !== saveSequenceAtStart) {
            hydrateModelFromInspection(latestSavedInspectionRef.current || existingInspection, { keepLocalNotes: true });
            return;
          }
          setInspection(existingInspection);
          hydrateModelFromInspection(existingInspection, { keepLocalNotes: true });
          return;
        }

        setInspection(existingInspection);

        if (existingInspection) {
          hydrateFromInspection(existingInspection, { applyPosition: true });
        }

        try {
          const rawDraft = localStorage.getItem(draftKey) || sessionStorage.getItem(draftKey);
          if (rawDraft && existingInspection?.status !== 'completed') {
            hydrateFromDraft(JSON.parse(rawDraft));
          }
        } catch (draftError) {
          console.warn('Unable to parse inspection draft', draftError);
        }

        initialLoadDoneRef.current = true;
        setLoading(false);
      } catch (error: any) {
        if (cancelled) return;
        console.error('Error initializing inspection:', error);
        if (isInitialLoad) {
          toast({
            variant: 'destructive',
            title: t('inspection.toast.errorTitle', 'Fehler'),
            description:
              (typeof error?.message === 'string' && error.message.trim())
                ? error.message
                : t('inspection.toast.initError', 'Inspektion konnte nicht initialisiert werden'),
          });
          setLoading(false);
        }
      } finally {
        if (!cancelled && isInitialLoad) {
          setInitializing(false);
        }
      }
    };

    init();
    return () => {
      cancelled = true;
    };
  }, [orderId, customerId, deviceBrand, deviceModel, forceStartAtStepOne, initialImei, initialSerialNumber]);

  // A successful "Speichern & Weiter" opens the next step AND brings it into view, so the
  // transition is visible even when the previous step was long or the dialog was scrolled.
  useEffect(() => {
    if (scrollToStep === null) return;
    const frame = window.requestAnimationFrame(() => {
      const target = stepCardRefs.current[scrollToStep];
      if (target && typeof target.scrollIntoView === 'function') {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      setScrollToStep(null);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [scrollToStep]);

  const loadedInspectionId = inspection?._id ? String(inspection._id) : '';
  useEffect(() => {
    if (loadedInspectionId) {
      onInspectionLoaded?.(inspection);
    }
    // Only when the inspection identity changes, not on every step save.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadedInspectionId]);

  // Every successful save goes through here so a concurrent background re-sync can tell that
  // its GET result is outdated.
  const applySavedInspection = (saved: any) => {
    saveSequenceRef.current += 1;
    latestSavedInspectionRef.current = saved;
    setInspection(saved);
  };

  const advanceToStep = (step: number) => {
    setCurrentStep(step);
    setExpandedSteps([step]);
    setScrollToStep(step);
  };

  useEffect(() => {
    // Only use the order's device fields as a fallback before the reportedModel has been
    // established; never resync afterwards, since the order fields can later be changed
    // to the corrected/actual model during the inspection workflow.
    if (!reportedModel && orderCurrentModel) {
      setReportedModel(orderCurrentModel);
    }
  }, [orderCurrentModel, reportedModel]);

  useEffect(() => {
    let active = true;

    const loadDeviceTypes = async () => {
      try {
        const response = (await getDeviceTypes()) as DeviceTypesApiResponse;
        const deviceTypes = Array.isArray(response?.deviceTypes) ? response.deviceTypes : [];
        if (!active) return;

        setAvailableDeviceTypes(deviceTypes);

        const normalizedOrderType = String(deviceType || '').trim().toLowerCase();
        const preset = deviceTypes.find((entry: CatalogDeviceType) => String(entry.name || '').trim().toLowerCase() === normalizedOrderType);
        if (preset) {
          setSelectedActualDeviceType(preset.name);
        }
      } catch (error) {
        console.warn('Could not load device types for inspection model search', error);
      }
    };

    loadDeviceTypes();

    return () => {
      active = false;
    };
  }, [deviceType]);

  useEffect(() => {
    let active = true;

    const loadManufacturers = async () => {
      if (!selectedActualDeviceType) {
        setAvailableManufacturers([]);
        setSelectedActualManufacturer('');
        return;
      }

      try {
        const response = (await getManufacturersByDeviceType(selectedActualDeviceType)) as ManufacturersApiResponse;
        const manufacturers = Array.isArray(response?.manufacturers) ? response.manufacturers : [];
        if (!active) return;

        setAvailableManufacturers(manufacturers);

        const currentManufacturer = String(selectedActualManufacturer || '').trim().toLowerCase();
        const stillValid = currentManufacturer && manufacturers.some((entry: CatalogManufacturer) => String(entry.name || '').trim().toLowerCase() === currentManufacturer);
        if (stillValid) {
          return;
        }

        const normalizedOrderBrand = String(deviceBrand || '').trim().toLowerCase();
        const orderBrandMatch = manufacturers.find((entry: CatalogManufacturer) => String(entry.name || '').trim().toLowerCase() === normalizedOrderBrand);
        if (orderBrandMatch) {
          setSelectedActualManufacturer(orderBrandMatch.name);
          return;
        }

        setSelectedActualManufacturer('');
      } catch (error) {
        console.warn('Could not load manufacturers for inspection model search', error);
        if (active) {
          setAvailableManufacturers([]);
          setSelectedActualManufacturer('');
        }
      }
    };

    loadManufacturers();

    return () => {
      active = false;
    };
  }, [selectedActualDeviceType, deviceBrand]);

  useEffect(() => {
    if (initializing) return;
    const draftPayload = {
      verificationStatus,
      costDifference,
      modelNotes,
      imei,
      serialNumber,
      imeiRequiredAtCompletion,
      hasOriginalPackaging,
      hasCaseCover,
      hasPowerAdapter,
      simTrayPresent,
      additionalAccessories,
      accessoriesNotes,
      displayStatus,
      frameStatus,
      backCoverStatus,
      buttonsStatus,
      buttonsDescription,
      hasDamage,
      damageDescription,
      externalNotes,
      chargingStatus,
      powerStatus,
      wifiStatus,
      frontCameraStatus,
      mainCameraStatus,
      chargingCurrent,
      modemFirmwareStatus,
      touchIdFaceIdStatus,
      defectActionRequested,
      defectActionNote,
      repairTimeframe,
      repairDescription,
      informCustomer,
      customerInfoReason,
      customerInfoNote,
      customerInfoMailTemplate,
      updatedAt: new Date().toISOString(),
    };

    const serializedDraft = JSON.stringify(draftPayload);
    localStorage.setItem(draftKey, serializedDraft);
    sessionStorage.setItem(draftKey, serializedDraft);
  }, [
    initializing,
    verificationStatus,
    costDifference,
    modelNotes,
    imei,
    serialNumber,
    imeiRequiredAtCompletion,
    hasOriginalPackaging,
    hasCaseCover,
    hasPowerAdapter,
    simTrayPresent,
    additionalAccessories,
    accessoriesNotes,
    displayStatus,
    frameStatus,
    backCoverStatus,
    buttonsStatus,
    buttonsDescription,
    hasDamage,
    damageDescription,
    externalNotes,
    chargingStatus,
    powerStatus,
    wifiStatus,
    frontCameraStatus,
    mainCameraStatus,
    chargingCurrent,
    modemFirmwareStatus,
    touchIdFaceIdStatus,
    defectActionRequested,
    defectActionNote,
    repairTimeframe,
    repairDescription,
    informCustomer,
    customerInfoReason,
    customerInfoNote,
    customerInfoMailTemplate,
    draftKey,
  ]);

  useEffect(() => {
    let active = true;

    const run = async () => {
      const reported = reportedModel;
      const actual = actualModel;
      const { reportedImage, actualImage } = await resolveImagesFromCatalog(reported, actual);
      if (active) {
        setReportedModelImage(reportedImage || reportedDeviceImage || '');
        setActualModelImage(actualImage);
      }
    };

    run();

    return () => {
      active = false;
    };
  }, [reportedModel, actualModel, deviceBrand, reportedDeviceImage]);

  useEffect(() => {
    if (skipNextActualModelSearch) {
      setSkipNextActualModelSearch(false);
      return;
    }

    const query = actualModelSearchQuery.trim();
    if (query.length < 2) {
      setActualModelResults([]);
      setShowActualModelResults(false);
      setSearchingActualModel(false);
      return;
    }

    const timer = setTimeout(async () => {
      setSearchingActualModel(true);
      try {
        const queryVariants = buildSearchQueries(query);
        const groups = await Promise.all(
          queryVariants.map((candidate) =>
            searchModelCandidates(candidate, {
              deviceType: selectedActualDeviceType,
              manufacturer: selectedActualManufacturer,
            })
          )
        );
        const results = mergeUniqueSearchResults(groups);
        setActualModelResults(results);
        setShowActualModelResults(true);
        setActualModelHighlightedIndex(results.length > 0 ? 0 : -1);
      } catch (error) {
        console.error('Error searching actual model:', error);
        setActualModelResults([]);
        setShowActualModelResults(false);
        setActualModelHighlightedIndex(-1);
      } finally {
        setSearchingActualModel(false);
      }
    }, 280);

    return () => clearTimeout(timer);
  }, [actualModelSearchQuery, skipNextActualModelSearch, selectedActualDeviceType, selectedActualManufacturer]);

  useEffect(() => {
    if (autoModelPrefilled) {
      return;
    }

    const reported = reportedModel.trim();
    if (!reported) {
      return;
    }

    const actual = actualModel.trim();
    if (actual && actual.toLowerCase() !== reported.toLowerCase()) {
      return;
    }

    const timer = setTimeout(async () => {
      const candidates = await searchModelCandidates(reported, {
        deviceType: selectedActualDeviceType,
        manufacturer: selectedActualManufacturer,
      });
      if (!candidates.length) {
        setAutoModelPrefilled(true);
        return;
      }

      const reportedLc = reported.toLowerCase();
      const bestMatch = candidates.find((item) => {
        const display = String(item.displayName || '').toLowerCase();
        const name = String(item.name || '').toLowerCase();
        return display === reportedLc || name === reportedLc || display.includes(reportedLc) || name.includes(reportedLc);
      }) || candidates[0];

      handleSelectActualModel(bestMatch, false);
      setAutoModelPrefilled(true);
    }, 50);

    return () => clearTimeout(timer);
  }, [reportedModel, actualModel, autoModelPrefilled, selectedActualDeviceType, selectedActualManufacturer]);

  useEffect(() => {
    const hasDamagedElement = [displayStatus, frameStatus, backCoverStatus].includes('damaged');
    if (hasDamagedElement) {
      setHasDamage(true);
    }
  }, [displayStatus, frameStatus, backCoverStatus]);

  useEffect(() => {
    const hasCriticalDefect = modemFirmwareStatus === 'defective' || touchIdFaceIdStatus === 'defective';
    if (hasCriticalDefect) {
      setDefectActionRequested(true);
      setInformCustomer(true);
      if (!customerInfoReason) {
        setCustomerInfoReason('Technischer Defekt (Modem-Firmware und/oder Touch ID / Face ID)');
      }
    }
  }, [modemFirmwareStatus, touchIdFaceIdStatus, customerInfoReason]);

  // Every failed save must show the real (German) server message, not an empty toast.
  const showErrorToast = (error: any) => {
    toast({
      variant: 'destructive',
      title: t('inspection.toast.errorTitle', 'Fehler'),
      description:
        (typeof error?.message === 'string' && error.message.trim())
          ? error.message
          : t('inspection.toast.saveFailed', 'Speichern fehlgeschlagen. Bitte erneut versuchen.'),
    });
  };

  // All seven steps advance under the same rule: only a response that actually contains the
  // saved inspection counts as success. Previously only steps 2 and 4 checked this, which is
  // why only those two appeared to "do nothing" on an error.
  const assertSaved = (result: any) => {
    if (!result?.inspection) {
      throw new Error(
        t('inspection.toast.notSaved', 'Der Schritt konnte nicht gespeichert werden. Bitte erneut versuchen.')
      );
    }
    return result.inspection;
  };

  const toggleStep = (step: number) => {
    if (expandedSteps.includes(step)) {
      setExpandedSteps(expandedSteps.filter(s => s !== step));
    } else {
      setExpandedSteps([...expandedSteps, step]);
    }
  };

  const handleModelVerification = async () => {
    if (submitting) return;

    try {
      if (!reportedModel.trim()) {
        toast({
          variant: 'destructive',
          title: t('inspection.toast.errorTitle', 'Fehler'),
          description: 'Gemeldetes Modell fehlt im Auftrag.',
        });
        return;
      }

      if (verificationStatus !== 'correct') {
        toast({
          variant: 'destructive',
          title: t('inspection.toast.errorTitle', 'Fehler'),
          description: 'Bitte zuerst über „Gerät ändern“ das Modell im Auftrag aktualisieren.',
        });
        return;
      }

      setSubmitting(true);
      setSubmittingStep(1);
      const result = await updateModelVerification(
        orderId,
        reportedModel,
        actualModel,
        verificationStatus,
        costDifference,
        modelNotes,
        undefined,
        actualModelUserConfirmed
      );
      const savedInspection = assertSaved(result);
      applySavedInspection(savedInspection);
      // The server replaces an unconfirmed actual model that merely echoes a pre-change
      // draft. It reports that back instead of doing it silently - show it to the technician.
      const serverWarnings: string[] = Array.isArray((result as any)?.warnings)
        ? (result as any).warnings
        : [];
      if (serverWarnings.length > 0) {
        const correctedActual = savedInspection?.modelVerification?.actualModel || '';
        if (correctedActual) {
          setActualModel(correctedActual);
          setActualModelSearchQuery(correctedActual);
          setActualModelUserConfirmed(false);
        }
        toast({
          variant: 'destructive',
          title: 'Hinweis zur Modellprüfung',
          description: serverWarnings.join(' '),
        });
      }
      toast({
        title: t('inspection.toast.successTitle', 'Erfolg'),
        description: t('inspection.toast.modelSaved', 'Modellprüfung gespeichert'),
      });
      advanceToStep(2);
    } catch (error: any) {
      showErrorToast(error);
    } finally {
      setSubmitting(false);
      setSubmittingStep(null);
    }
  };

  const handleIdentification = async () => {
    if (submitting) return;

    try {
      if (['Laptop', 'Tablet'].includes(canonicalDeviceType) && !serialNumber.trim()) {
        toast({
          variant: 'destructive',
          title: t('inspection.toast.errorTitle', 'Fehler'),
          description: 'Bitte Seriennummer eintragen.',
        });
        return;
      }

      setSubmitting(true);
      setSubmittingStep(2);
      const result = await updateIdentification(orderId, deviceType, imei.trim() || undefined, serialNumber.trim() || undefined);
      const savedInspection = assertSaved(result);
      applySavedInspection(savedInspection);
      setImeiRequiredAtCompletion(Boolean(savedInspection?.identification?.imeiRequired));
      toast({
        title: t('inspection.toast.successTitle', 'Erfolg'),
        description: t('inspection.toast.identificationSaved', 'Identifikation gespeichert'),
      });
      advanceToStep(3);
    } catch (error: any) {
      showErrorToast(error);
    } finally {
      setSubmitting(false);
      setSubmittingStep(null);
    }
  };

  const handleAccessories = async () => {
    if (submitting) return;

    try {
      setSubmitting(true);
      setSubmittingStep(3);
      const result = await updateAccessories(orderId, {
        originalPackaging: { present: hasOriginalPackaging },
        caseCover: { present: hasCaseCover },
        powerAdapter: { present: hasPowerAdapter },
        simTray: { present: simTrayPresent === true },
        additionalAccessoriesText: additionalAccessories,
        otherAccessories: [],
        description: accessoriesNotes,
      });
      applySavedInspection(assertSaved(result));
      toast({
        title: t('inspection.toast.successTitle', 'Erfolg'),
        description: t('inspection.toast.accessoriesSaved', 'Zubehör gespeichert'),
      });
      advanceToStep(4);
    } catch (error: any) {
      showErrorToast(error);
    } finally {
      setSubmitting(false);
      setSubmittingStep(null);
    }
  };

  const handleExternalInspection = async () => {
    if (submitting) return;

    try {
      setSubmitting(true);
      setSubmittingStep(4);
      const result = await updateExternalInspection(orderId, {
        display: { status: displayStatus },
        frame: { status: frameStatus },
        backCover: { status: backCoverStatus },
        buttons: { status: buttonsStatus, notes: buttonsDescription },
        visibleDamages: { hasDamage, description: damageDescription },
        uniqueNotes: externalNotes,
      });
      applySavedInspection(assertSaved(result));
      toast({
        title: t('inspection.toast.successTitle', 'Erfolg'),
        description: t('inspection.toast.externalSaved', 'Äußere Inspektion gespeichert'),
      });
      advanceToStep(5);
    } catch (error: any) {
      showErrorToast(error);
    } finally {
      setSubmitting(false);
      setSubmittingStep(null);
    }
  };

  const handleDeviceTests = async () => {
    if (submitting) return;

    try {
      if (chargingCurrent.trim() && !/^\d+(\.\d+)?A$/i.test(chargingCurrent.trim())) {
        toast({
          variant: 'destructive',
          title: t('inspection.toast.errorTitle', 'Fehler'),
          description: 'Stromstärke bitte im Format 1.7A eingeben.',
        });
        return;
      }

      setSubmitting(true);
      setSubmittingStep(5);
      const result = await updateDeviceTests(orderId, {
        charging: { status: chargingStatus, current: chargingCurrent.trim() || undefined },
        power: { status: powerStatus },
        wifi: { status: wifiStatus },
        frontCamera: { status: frontCameraStatus },
        mainCamera: { status: mainCameraStatus },
        buttons: { status: buttonsStatus, notes: buttonsDescription },
        notes: deviceTestNotes.trim(),
      });
      applySavedInspection(assertSaved(result));
      toast({
        title: t('inspection.toast.successTitle', 'Erfolg'),
        description: t('inspection.toast.testsSaved', 'Gerätetests gespeichert'),
      });
      advanceToStep(6);
    } catch (error: any) {
      showErrorToast(error);
    } finally {
      setSubmitting(false);
      setSubmittingStep(null);
    }
  };

  const handleAppleSpecific = async () => {
    if (submitting) return;

    try {
      setSubmitting(true);
      setSubmittingStep(6);
      const result = await updateAppleSpecific(orderId, {
        modemFirmware: {
          status: modemFirmwareStatus,
          present: modemFirmwareStatus !== 'defective',
        },
        touchIdFaceId: {
          status: touchIdFaceIdStatus,
          applicable: touchIdFaceIdStatus !== 'not-applicable',
          working: touchIdFaceIdStatus === 'working',
        },
        customerInfoAction: {
          requested: defectActionRequested,
          note: defectActionNote,
        },
      });
      applySavedInspection(assertSaved(result));

      advanceToStep(7);
      toast({
        title: t('inspection.toast.successTitle', 'Erfolg'),
        description: 'Apple-spezifische Prüfungen gespeichert',
      });
    } catch (error: any) {
      showErrorToast(error);
    } finally {
      setSubmitting(false);
      setSubmittingStep(null);
    }
  };

  const handleCompleteInspection = async () => {
    if (submitting) return;

    // Nur der Haken in Schritt 7 entscheidet (der Haken in Schritt 6 setzt ihn vor; der alte
    // completionAction-Wert zaehlt nicht mehr). Gesendet wird ausschliesslich die "Nachricht an
    // Kunden" - nie die interne Notiz.
    const shouldSendCustomerInfo = informCustomer;
    const customerMessage = customerInfoMailTemplate.trim();
    if (shouldSendCustomerInfo && !customerMessage) {
      toast({
        variant: 'destructive',
        title: t('inspection.toast.errorTitle', 'Fehler'),
        description: 'Bitte geben Sie die Nachricht an den Kunden ein (oder entfernen Sie den Haken „Kunde informieren“).',
      });
      return;
    }

    try {
      setSubmitting(true);
      setSubmittingStep(7);

      if (canonicalDeviceType === 'Smartphone' && imei.trim() && imeiRequiredAtCompletion) {
        await updateIdentification(orderId, deviceType, imei.trim(), serialNumber.trim() || undefined);
        setImeiRequiredAtCompletion(false);
      }

      // A price is sent only when one is actually known (hydrated from a real quote). A missing
      // price stays unknown - it used to become "0 EUR" via Number('') || 0.
      const trimmedCost = repairCost.trim();
      const parsedCost = trimmedCost ? Number(trimmedCost.replace(',', '.')) : NaN;
      const hasKnownCost = Number.isFinite(parsedCost) && parsedCost >= 0;
      const repairOfferPayload = (repairTimeframe.trim() || repairDescription.trim() || hasKnownCost)
        ? {
            ...(hasKnownCost ? { cost: parsedCost, costSpecified: true } : {}),
            timeframe: repairTimeframe,
            description: repairDescription,
          }
        : undefined;

      // isRepairable / completionAction are deliberately not sent: the "Reparatureinschätzung"
      // no longer exists and the server ignores both.
      const completionResult = await completeInspection(
        orderId,
        undefined,
        repairOfferPayload,
        undefined,
        {
          shouldInform: shouldSendCustomerInfo,
          reason: customerInfoReason,
          note: customerInfoNote,
          suggestedStatus: completionAction === 'inform-customer' ? 'awaiting-customer' : '',
          // Only stored when the customer is actually to be informed.
          mailTemplate: shouldSendCustomerInfo ? customerMessage : '',
          // The server informs the customer (in-app + e-mail, once per inspection) only with this text.
          customerMessage: shouldSendCustomerInfo ? customerMessage : '',
        }
      );
      // Step 7 is held to the same rule as steps 1-6: a 2xx without an inspection in the
      // body is NOT a successful completion and must not fire the success toast/onComplete.
      const completedInspection = assertSaved(completionResult);
      applySavedInspection(completedInspection);

      localStorage.removeItem(draftKey);
      sessionStorage.removeItem(draftKey);
      toast({
        title: t('inspection.toast.successTitle', 'Erfolg'),
        description: t('inspection.toast.completed', 'Inspektion abgeschlossen'),
      });

      // Verlauf nicht aktualisiert (HIST-10): getrennt vom Speichererfolg melden.
      const completionWarnings: string[] = Array.isArray((completionResult as any)?.warnings) ? (completionResult as any).warnings : [];
      completionWarnings.forEach((warning) => toast({ variant: 'destructive', title: 'Hinweis', description: warning }));

      // Speichern und Kundeninformation werden getrennt gemeldet.
      if (shouldSendCustomerInfo) {
        const customerNotification = (completionResult as any)?.customerNotification as
          | { status?: string; reason?: string; error?: string }
          | undefined;
        const notifyStatus = customerNotification?.status;
        if (notifyStatus === 'sent') {
          toast({ title: 'Kunde wurde informiert', description: 'Die Nachricht an den Kunden wurde gesendet (Benachrichtigung und E-Mail).' });
        } else if (notifyStatus === 'duplicate') {
          toast({ title: 'Kunde bereits informiert', description: 'Zu dieser Inspektion wurde der Kunde bereits informiert. Es wurde keine zweite Nachricht gesendet.' });
        } else {
          toast({
            variant: 'destructive',
            title: 'Kunde wurde nicht informiert',
            description: customerNotification?.reason === 'no_customer_account'
              ? 'Der Auftrag hat kein Kundenkonto. Bitte informieren Sie den Kunden auf anderem Weg.'
              : `Die Inspektion ist gespeichert, aber die Nachricht an den Kunden konnte nicht gesendet werden${customerNotification?.error ? `: ${customerNotification.error}` : '.'}`,
          });
        }
      }
      onComplete?.();
    } catch (error: any) {
      showErrorToast(error);
    } finally {
      setSubmitting(false);
      setSubmittingStep(null);
    }
  };

  // Erneut versuchen: der Server holt Status und Verlaufseintrag genau einmal nach (idempotent).
  const handleRetryOrderSync = async () => {
    try {
      setRetryingOrderSync(true);
      const result: any = await initializeInspection(orderId, customerId);
      const warnings: string[] = Array.isArray(result?.warnings) ? result.warnings : [];
      setOrderSyncWarning(warnings[0] || null);
      if (!warnings.length) {
        toast({ title: 'Auftragsstatus aktualisiert', description: 'Die Eingangsprüfung steht jetzt auch im Auftragsverlauf.' });
      }
    } catch (error: any) {
      showErrorToast(error);
    } finally {
      setRetryingOrderSync(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-8 text-gray-600 font-medium">
        {t('inspection.loading', 'Inspektion wird geladen...')}
      </div>
    );
  }

  return (
    <div className="inspection-form">
      {orderSyncWarning && (
        <div role="alert" className="mb-3 flex flex-wrap items-center gap-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <span className="flex-1 min-w-[200px]">{orderSyncWarning}</span>
          <Button type="button" size="sm" variant="outline" onClick={handleRetryOrderSync} disabled={retryingOrderSync}>
            {retryingOrderSync ? 'Wird erneut versucht …' : 'Erneut versuchen'}
          </Button>
        </div>
      )}
      {bookedRepairs.length > 0 && (
        <Card className="inspection-step-card">
          <CardHeader className="inspection-step-header">
            <CardTitle className="inspection-step-title">Gebuchte Reparatur</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {bookedRepairs.map((repair, index) => (
              <div key={`${repair.name}-${index}`} className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2 text-sm">
                <span>{repair.quantity && repair.quantity > 1 ? `${repair.name} x${repair.quantity}` : repair.name}</span>
                <span className="font-semibold">{typeof repair.price === 'number' && Number.isFinite(repair.price) ? formatEUR(repair.price) : 'Preis nicht hinterlegt'}</span>
              </div>
            ))}
            {typeof orderTotalCost === 'number' && (
              <div className="flex items-center justify-between border-t border-slate-200 pt-2 text-sm font-semibold">
                <span>Aktuelle Auftragssumme</span>
                <span>{formatEUR(orderTotalCost)}</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 1: Model Verification */}
      <Card className="inspection-step-card" ref={(element) => { stepCardRefs.current[1] = element; }}>
        <CardHeader
          className="inspection-step-header cursor-pointer"
          onClick={() => toggleStep(1)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant={currentStep >= 1 ? 'default' : 'outline'} className={currentStep >= 1 ? 'inspection-step-badge' : ''}>
                {t('inspection.steps.step1', 'Schritt 1')}
              </Badge>
              <CardTitle className="inspection-step-title">{t('inspection.steps.modelVerification', 'Modellprüfung')}</CardTitle>
            </div>
            {expandedSteps.includes(1) ? <ChevronUp /> : <ChevronDown />}
          </div>
        </CardHeader>
        {expandedSteps.includes(1) && (
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="reported-model">{t('inspection.fields.reportedModel', 'Gemeldetes Modell')}</Label>
                <div className="mt-2 rounded-md border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center gap-3">
                    {reportedModelImage ? (
                      <img
                        src={reportedModelImage}
                        alt={reportedModel || 'Gemeldetes Modell'}
                        className="h-12 w-12 rounded-md border border-slate-200 object-cover"
                        onError={() => setReportedModelImage('')}
                      />
                    ) : (
                      <div className="h-12 w-12 rounded-md border border-slate-200 bg-white text-xs text-slate-500 flex items-center justify-center">
                        Kein Bild
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{reportedModel || '-'}</p>
                      <p className="text-xs text-slate-500">{getReportedModelSourceNote(reportedModelSource) || 'Ursprünglich vom Kunden gemeldet'}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <Label>{t('inspection.fields.verificationStatus', 'Prüfstatus')}</Label>
                <div className="mt-2 space-y-3 rounded-md border border-slate-200 bg-white p-3">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="verification-match"
                      checked={verificationStatus === 'correct'}
                      onCheckedChange={(checked) => setVerificationStatus(checked ? 'correct' : 'incorrect-same-cheaper')}
                    />
                    <div>
                      <Label htmlFor="verification-match" className="text-sm font-medium">
                        Übereinstimmung OK
                      </Label>
                      <p className="text-xs text-slate-500">
                        Aktiv lassen, wenn das Gerät mit dem Auftrag übereinstimmt.
                      </p>
                    </div>
                  </div>

                  {verificationStatus !== 'correct' && (
                    <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                      <p className="mb-2">
                        Modell stimmt nicht überein. Bitte den Auftrag über „Gerät ändern“ aktualisieren.
                      </p>
                      <Button type="button" variant="outline" size="sm" onClick={onRequestDeviceChange}>
                        Gerät ändern
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {verificationStatus !== 'correct' && (
              <div>
                <Label htmlFor="cost-difference">{t('inspection.fields.costDifference', 'Kostenabweichung (EUR)')}</Label>
                <Input
                  id="cost-difference"
                  type="number"
                  value={costDifference}
                  onChange={(e) => setCostDifference(Number(e.target.value || 0))}
                />
              </div>
            )}

            <div>
              <Label htmlFor="model-notes">{t('inspection.fields.notes', 'Notizen')}</Label>
              {/* Diese Notiz steht in der Kundenansicht der Inspektion (Allowlist im Server) - Text + Symbol, nicht nur Farbe. */}
              <p id="model-notes-visibility" className="mt-1 mb-1.5 flex w-fit items-center gap-1 rounded-full border border-blue-300 bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-800">
                <Eye className="h-3 w-3" aria-hidden="true" /> Für Kunden sichtbar (erscheint in „Diagnose ansehen“)
              </p>
              <Textarea
                id="model-notes"
                aria-describedby="model-notes-visibility"
                value={modelNotes}
                onChange={(e) => setModelNotes(e.target.value)}
                placeholder={t('inspection.placeholders.notes', 'Zusätzliche Hinweise...')}
              />
            </div>

            <Button onClick={handleModelVerification} disabled={submitting} aria-busy={submittingStep === 1} className="inspection-primary-button">
              {submittingStep === 1 ? 'Speichert...' : t('inspection.actions.saveContinue', 'Speichern & Weiter')}
            </Button>
          </CardContent>
        )}
      </Card>

      {/* Step 2: Identification */}
      <Card className="inspection-step-card" ref={(element) => { stepCardRefs.current[2] = element; }}>
        <CardHeader
          className="inspection-step-header cursor-pointer"
          onClick={() => toggleStep(2)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant={currentStep >= 2 ? 'default' : 'outline'} className={currentStep >= 2 ? 'inspection-step-badge' : ''}>
                {t('inspection.steps.step2', 'Schritt 2')}
              </Badge>
              <CardTitle className="inspection-step-title">{t('inspection.steps.deviceIdentification', 'Geräteidentifikation')}</CardTitle>
            </div>
            {expandedSteps.includes(2) ? <ChevronUp /> : <ChevronDown />}
          </div>
        </CardHeader>
        {expandedSteps.includes(2) && (
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="imei">{t('inspection.fields.imei', 'IMEI-Nummer')}</Label>
              <Input
                id="imei"
                value={imei}
                onChange={(e) => setImei(e.target.value)}
                placeholder={t('inspection.placeholders.imei', 'IMEI eingeben (optional)')}
              />
              <p className="text-xs text-slate-500">Dieses Feld ist optional. Falls leer, wird IMEI im Abschluss erneut abgefragt.</p>
            </div>
            <div>
              <Label htmlFor="serial">{t('inspection.fields.serialNumber', 'Seriennummer')}</Label>
              <Input
                id="serial"
                value={serialNumber}
                onChange={(e) => setSerialNumber(e.target.value)}
                placeholder={t('inspection.placeholders.serialNumber', 'Seriennummer eingeben')}
              />
            </div>

            <Button onClick={handleIdentification} disabled={submitting} aria-busy={submittingStep === 2} className="inspection-primary-button">
              {submittingStep === 2 ? 'Speichert...' : t('inspection.actions.saveContinue', 'Speichern & Weiter')}
            </Button>
          </CardContent>
        )}
      </Card>

      {/* Step 3: Accessories */}
      <Card className="inspection-step-card" ref={(element) => { stepCardRefs.current[3] = element; }}>
        <CardHeader
          className="inspection-step-header cursor-pointer"
          onClick={() => toggleStep(3)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant={currentStep >= 3 ? 'default' : 'outline'} className={currentStep >= 3 ? 'inspection-step-badge' : ''}>
                {t('inspection.steps.step3', 'Schritt 3')}
              </Badge>
              <CardTitle className="inspection-step-title">{t('inspection.steps.accessoriesPackaging', 'Zubehör & Verpackung')}</CardTitle>
            </div>
            {expandedSteps.includes(3) ? <ChevronUp /> : <ChevronDown />}
          </div>
        </CardHeader>
        {expandedSteps.includes(3) && (
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="packaging"
                  checked={hasOriginalPackaging}
                  onCheckedChange={(checked) => setHasOriginalPackaging(checked as boolean)}
                />
                <Label htmlFor="packaging">{t('inspection.fields.originalPackaging', 'Originalverpackung vorhanden')}</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="case"
                  checked={hasCaseCover}
                  onCheckedChange={(checked) => setHasCaseCover(checked as boolean)}
                />
                <Label htmlFor="case">{t('inspection.fields.caseCover', 'Hülle/Case vorhanden')}</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="adapter"
                  checked={hasPowerAdapter}
                  onCheckedChange={(checked) => setHasPowerAdapter(checked as boolean)}
                />
                <Label htmlFor="adapter">{t('inspection.fields.powerAdapter', 'Netzteil vorhanden (falls zutreffend)')}</Label>
              </div>

              <div>
                <Label htmlFor="sim-tray">SIM-Tray vorhanden?</Label>
                <Select
                  value={simTrayPresent === null ? '' : simTrayPresent ? 'yes' : 'no'}
                  onValueChange={(value) => setSimTrayPresent(value === 'yes')}
                >
                  <SelectTrigger id="sim-tray">
                    <SelectValue placeholder="Bitte wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yes">Ja</SelectItem>
                    <SelectItem value="no">Nein</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="additional-accessories">Weiteres Zubehör (z. B. Stift, Ladekabel)</Label>
                <p id="additional-accessories-visibility" className="mt-1 mb-1.5 flex w-fit items-center gap-1 rounded-full border border-blue-300 bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-800">
                  <Eye className="h-3 w-3" aria-hidden="true" /> Für Kunden sichtbar (erscheint in „Diagnose ansehen“)
                </p>
                <Input
                  id="additional-accessories"
                  aria-describedby="additional-accessories-visibility"
                  value={additionalAccessories}
                  onChange={(e) => setAdditionalAccessories(e.target.value)}
                  placeholder="Freitext oder Komma-getrennte Liste"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="accessories-notes">{t('inspection.fields.additionalNotes', 'Zusätzliche Notizen')}</Label>
              {/* Kundenansicht der Inspektion (Allowlist im Server) - Text + Symbol, nicht nur Farbe. */}
              <p id="accessories-notes-visibility" className="mt-1 mb-1.5 flex w-fit items-center gap-1 rounded-full border border-blue-300 bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-800">
                <Eye className="h-3 w-3" aria-hidden="true" /> Für Kunden sichtbar (erscheint in „Diagnose ansehen“)
              </p>
              <Textarea
                id="accessories-notes"
                aria-describedby="accessories-notes-visibility"
                value={accessoriesNotes}
                onChange={(e) => setAccessoriesNotes(e.target.value)}
                placeholder={t('inspection.placeholders.accessoriesNotes', 'Zubehör oder Zustand beschreiben...')}
              />
            </div>

            <Button onClick={handleAccessories} disabled={submitting} aria-busy={submittingStep === 3} className="inspection-primary-button">
              {submittingStep === 3 ? 'Speichert...' : t('inspection.actions.saveContinue', 'Speichern & Weiter')}
            </Button>
          </CardContent>
        )}
      </Card>

      {/* Step 4: External Inspection */}
      <Card className="inspection-step-card" ref={(element) => { stepCardRefs.current[4] = element; }}>
        <CardHeader
          className="inspection-step-header cursor-pointer"
          onClick={() => toggleStep(4)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant={currentStep >= 4 ? 'default' : 'outline'} className={currentStep >= 4 ? 'inspection-step-badge' : ''}>
                {t('inspection.steps.step4', 'Schritt 4')}
              </Badge>
              <CardTitle className="inspection-step-title">{t('inspection.steps.externalInspection', 'Äußere Inspektion')}</CardTitle>
            </div>
            {expandedSteps.includes(4) ? <ChevronUp /> : <ChevronDown />}
          </div>
        </CardHeader>
        {expandedSteps.includes(4) && (
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { label: t('inspection.fields.display', 'Bildschirm'), state: displayStatus, setter: setDisplayStatus },
                { label: t('inspection.fields.frame', 'Rahmen'), state: frameStatus, setter: setFrameStatus },
                { label: t('inspection.fields.backCover', 'Rückseite'), state: backCoverStatus, setter: setBackCoverStatus },
              ].map(({ label, state, setter }) => (
                <div key={label}>
                  <Label htmlFor={label}>{label}</Label>
                  <Select value={state} onValueChange={setter as (value: ConditionStatus) => void}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="--">{getConditionLabel('--')}</SelectItem>
                      <SelectItem value="light-wear">{getConditionLabel('light-wear')}</SelectItem>
                      <SelectItem value="scratches-wear">{getConditionLabel('scratches-wear')}</SelectItem>
                      <SelectItem value="heavy-scratches-wear">{getConditionLabel('heavy-scratches-wear')}</SelectItem>
                      <SelectItem value="damaged">{getConditionLabel('damaged')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ))}

            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="damage"
                  checked={hasDamage}
                  onCheckedChange={(checked) => setHasDamage(checked as boolean)}
                />
                <Label htmlFor="damage">{t('inspection.fields.visibleDamage', 'Sichtbare Schäden festgestellt')}</Label>
              </div>

              {hasDamage && (
                <div>
                  <Label htmlFor="damage-desc">{t('inspection.fields.damageDescription', 'Schäden beschreiben')}</Label>
                  <p id="damage-desc-visibility" className="mt-1 mb-1.5 flex w-fit items-center gap-1 rounded-full border border-blue-300 bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-800">
                    <Eye className="h-3 w-3" aria-hidden="true" /> Für Kunden sichtbar (erscheint in „Diagnose ansehen“)
                  </p>
                  <Textarea
                    id="damage-desc"
                    aria-describedby="damage-desc-visibility"
                    value={damageDescription}
                    onChange={(e) => setDamageDescription(e.target.value)}
                    placeholder={t('inspection.placeholders.damageDescription', 'Schäden beschreiben...')}
                  />
                </div>
              )}
            </div>

            <div>
              <Label htmlFor="external-notes">{t('inspection.fields.additionalNotes', 'Zusätzliche Notizen')}</Label>
              {/* Kundenansicht der Inspektion (Allowlist im Server) - Text + Symbol, nicht nur Farbe. */}
              <p id="external-notes-visibility" className="mt-1 mb-1.5 flex w-fit items-center gap-1 rounded-full border border-blue-300 bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-800">
                <Eye className="h-3 w-3" aria-hidden="true" /> Für Kunden sichtbar (erscheint in „Diagnose ansehen“)
              </p>
              <Textarea
                id="external-notes"
                aria-describedby="external-notes-visibility"
                value={externalNotes}
                onChange={(e) => setExternalNotes(e.target.value)}
                placeholder={t('inspection.placeholders.externalNotes', 'Besondere Beobachtungen...')}
              />
            </div>

            <Button onClick={handleExternalInspection} disabled={submitting} aria-busy={submittingStep === 4} className="inspection-primary-button">
              {submittingStep === 4 ? 'Speichert...' : t('inspection.actions.saveContinue', 'Speichern & Weiter')}
            </Button>
          </CardContent>
        )}
      </Card>

      {/* Step 5: Device Tests */}
      <Card className="inspection-step-card" ref={(element) => { stepCardRefs.current[5] = element; }}>
        <CardHeader
          className="inspection-step-header cursor-pointer"
          onClick={() => toggleStep(5)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant={currentStep >= 5 ? 'default' : 'outline'} className={currentStep >= 5 ? 'inspection-step-badge' : ''}>
                {t('inspection.steps.step5', 'Schritt 5')}
              </Badge>
              <CardTitle className="inspection-step-title">{t('inspection.steps.deviceTests', 'Gerätetests')}</CardTitle>
            </div>
            {expandedSteps.includes(5) ? <ChevronUp /> : <ChevronDown />}
          </div>
        </CardHeader>
        {expandedSteps.includes(5) && (
          <CardContent className="space-y-4">
            <div className="flex justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={setAllDeviceTestsNotTested}
                className="border-amber-300 text-amber-700 hover:bg-amber-50"
              >
                Alle Tests nicht durchgeführt
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { label: t('inspection.fields.charging', 'Laden'), state: chargingStatus, setter: setChargingStatus },
                { label: t('inspection.fields.power', 'Einschalten'), state: powerStatus, setter: setPowerStatus },
                { label: t('inspection.fields.wifi', 'Wi-Fi'), state: wifiStatus, setter: setWifiStatus },
                { label: t('inspection.fields.frontCamera', 'Frontkamera'), state: frontCameraStatus, setter: setFrontCameraStatus },
                { label: t('inspection.fields.mainCamera', 'Hauptkamera'), state: mainCameraStatus, setter: setMainCameraStatus },
              ].map(({ label, state, setter }) => (
                <div key={label}>
                  <Label htmlFor={label}>{label}</Label>
                  <Select value={state} onValueChange={setter as any}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="OK">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-500" /> {getChecklistStatusLabel('OK')}
                        </div>
                      </SelectItem>
                      <SelectItem value="Not OK">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="h-4 w-4 text-red-500" /> {getChecklistStatusLabel('Not OK')}
                        </div>
                      </SelectItem>
                      <SelectItem value="Not tested">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="h-4 w-4 text-amber-500" /> {getChecklistStatusLabel('Not tested')}
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            <div>
              <Label htmlFor="buttons-status">Tasten</Label>
              <Select value={buttonsStatus} onValueChange={(value: ButtonsStatus) => setButtonsStatus(value)}>
                <SelectTrigger id="buttons-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="working">Funktionieren</SelectItem>
                  <SelectItem value="not-working">Nicht funktionierend</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {buttonsStatus === 'not-working' && (
              <div>
                <Label htmlFor="buttons-description">Beschreibung (optional)</Label>
                <p id="buttons-description-visibility" className="mt-1 mb-1.5 flex w-fit items-center gap-1 rounded-full border border-blue-300 bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-800">
                  <Eye className="h-3 w-3" aria-hidden="true" /> Für Kunden sichtbar (erscheint in „Diagnose ansehen“)
                </p>
                <Textarea
                  id="buttons-description"
                  aria-describedby="buttons-description-visibility"
                  value={buttonsDescription}
                  onChange={(e) => setButtonsDescription(e.target.value)}
                  placeholder="Welche Taste funktioniert nicht?"
                />
              </div>
            )}

            <div>
              <Label htmlFor="charging-current">Stromstärke beim Laden (optional)</Label>
              <Input
                id="charging-current"
                value={chargingCurrent}
                onChange={(e) => setChargingCurrent(e.target.value)}
                placeholder="z. B. 1.7A"
              />
            </div>

            <div>
              <Label htmlFor="device-test-notes">Zusätzliche Hinweise zu den Gerätetests</Label>
              <p id="device-test-notes-visibility" className="mt-1 mb-1.5 flex w-fit items-center gap-1 rounded-full border border-blue-300 bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-800">
                <Eye className="h-3 w-3" aria-hidden="true" /> Für Kunden sichtbar (erscheint in „Diagnose ansehen“)
              </p>
              <Textarea
                id="device-test-notes"
                aria-describedby="device-test-notes-visibility"
                value={deviceTestNotes}
                onChange={(e) => setDeviceTestNotes(e.target.value)}
                placeholder="z. B. Gerät lässt sich nicht einschalten"
              />
            </div>

            <Button onClick={handleDeviceTests} disabled={submitting} aria-busy={submittingStep === 5} className="inspection-primary-button">
              {submittingStep === 5 ? 'Speichert...' : t('inspection.actions.saveContinue', 'Speichern & Weiter')}
            </Button>
          </CardContent>
        )}
      </Card>

      {/* Step 6: Apple-Specific */}
      <Card className="inspection-step-card" ref={(element) => { stepCardRefs.current[6] = element; }}>
        <CardHeader
          className="inspection-step-header cursor-pointer"
          onClick={() => toggleStep(6)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant={currentStep >= 6 ? 'default' : 'outline'} className={currentStep >= 6 ? 'inspection-step-badge' : ''}>
                {t('inspection.steps.step6', 'Schritt 6')}
              </Badge>
              <CardTitle className="inspection-step-title">{t('inspection.steps.appleChecks', 'Apple-spezifische Prüfungen')}</CardTitle>
            </div>
            {expandedSteps.includes(6) ? <ChevronUp /> : <ChevronDown />}
          </div>
        </CardHeader>
        {expandedSteps.includes(6) && (
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div>
                <Label htmlFor="modem-status">Modem-Firmware</Label>
                <Select value={modemFirmwareStatus} onValueChange={(value: 'working' | 'defective' | 'not-testable') => setModemFirmwareStatus(value)}>
                  <SelectTrigger id="modem-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="working">Funktioniert</SelectItem>
                    <SelectItem value="defective">Defekt</SelectItem>
                    <SelectItem value="not-testable">Nicht testbar</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="touchid-status">Touch ID / Face ID</Label>
                <Select value={touchIdFaceIdStatus} onValueChange={(value: 'not-applicable' | 'working' | 'defective' | 'not-testable') => setTouchIdFaceIdStatus(value)}>
                  <SelectTrigger id="touchid-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="not-applicable">Nicht vorhanden</SelectItem>
                    <SelectItem value="working">Funktioniert</SelectItem>
                    <SelectItem value="defective">Defekt</SelectItem>
                    <SelectItem value="not-testable">Nicht testbar</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {(modemFirmwareStatus === 'defective' || touchIdFaceIdStatus === 'defective') && (
                <div className="space-y-2 rounded-md border border-amber-300 bg-amber-50 p-3">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="defect-action"
                      checked={defectActionRequested}
                      onCheckedChange={(checked) => {
                        setDefectActionRequested(checked as boolean);
                        // Setzt den Haken in Schritt 7 vor; gesendet wird erst dort mit der Nachricht an den Kunden.
                        if (checked) setInformCustomer(true);
                      }}
                    />
                    <Label htmlFor="defect-action">Zusatzaktion aktivieren: Kunde über Defekt informieren (Nachricht in Schritt 7)</Label>
                  </div>
                  {defectActionRequested && (
                    <>
                      <Label htmlFor="defect-action-note" className="sr-only">Hinweis an den Kunden zum Defekt</Label>
                      <p id="defect-action-note-visibility" className="mt-1 mb-1.5 flex w-fit items-center gap-1 rounded-full border border-blue-300 bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-800">
                        <Eye className="h-3 w-3" aria-hidden="true" /> Für Kunden sichtbar (erscheint in „Diagnose ansehen“)
                      </p>
                      <Textarea
                        id="defect-action-note"
                        aria-describedby="defect-action-note-visibility"
                        value={defectActionNote}
                        onChange={(e) => setDefectActionNote(e.target.value)}
                        placeholder="Hinweis an den Kunden zum Defekt"
                      />
                    </>
                  )}
                </div>
              )}
            </div>

            <Button
              onClick={handleAppleSpecific}
              disabled={submitting}
              aria-busy={submittingStep === 6}
              className="w-full inspection-primary-button"
            >
              {submittingStep === 6 ? 'Speichert...' : 'Speichern & Weiter zu Schritt 7'}
            </Button>
          </CardContent>
        )}
      </Card>

      {/* Step 7: Summary & Completion */}
      <Card className="inspection-step-card" ref={(element) => { stepCardRefs.current[7] = element; }}>
        <CardHeader
          className="inspection-step-header cursor-pointer"
          onClick={() => toggleStep(7)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant={currentStep >= 7 ? 'default' : 'outline'} className={currentStep >= 7 ? 'inspection-step-badge' : ''}>
                Schritt 7
              </Badge>
              <CardTitle className="inspection-step-title">Abschluss & Zusammenfassung</CardTitle>
            </div>
            {expandedSteps.includes(7) ? <ChevronUp /> : <ChevronDown />}
          </div>
        </CardHeader>
        {expandedSteps.includes(7) && (
          <CardContent className="space-y-4">
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
              <p className="font-semibold text-slate-800 mb-1">Zusammenfassung</p>
              <p><strong>Gemeldetes Modell (Kunde):</strong> {reportedModel || '-'}</p>
              {getReportedModelSourceNote(reportedModelSource) && (
                <p className="text-xs text-slate-600">{getReportedModelSourceNote(reportedModelSource)}</p>
              )}
              <p><strong>Tatsächliches Modell:</strong> {actualModel || '-'}</p>
              {reportedModel && actualModel && reportedModel.trim().toLowerCase() !== actualModel.trim().toLowerCase() && (
                <p className="text-xs text-amber-700">Korrigiert von "{reportedModel}" auf "{actualModel}".</p>
              )}
              <p><strong>Identifikation:</strong> {imei || serialNumber || 'Noch nicht erfasst'}</p>
              <p><strong>Äußerer Zustand:</strong> Display {getConditionLabel(displayStatus)}, Rahmen {getConditionLabel(frameStatus)}, Rückseite {getConditionLabel(backCoverStatus)}</p>
              <p><strong>Tasten:</strong> {buttonsStatus === 'working' ? 'Funktionieren' : 'Nicht funktionierend'}</p>
              <p><strong>Defekt-Hinweise:</strong> Modem-Firmware {getAppleStatusLabel(modemFirmwareStatus)}, Touch ID / Face ID {getAppleStatusLabel(touchIdFaceIdStatus)}</p>
            </div>

            {canonicalDeviceType === 'Smartphone' && (!imei || imeiRequiredAtCompletion) && (
              <div className="space-y-2 rounded-md border border-amber-300 bg-amber-50 p-3">
                <p className="text-sm font-semibold text-amber-900">IMEI nachtragen (erneute Abfrage)</p>
                <Input
                  value={imei}
                  onChange={(e) => {
                    setImei(e.target.value);
                    if (e.target.value.trim()) {
                      setImeiRequiredAtCompletion(false);
                    }
                  }}
                  placeholder="IMEI eingeben (optional)"
                />
                <p className="text-xs text-amber-800">Falls weiterhin unbekannt, kann der Abschluss ohne IMEI erfolgen.</p>
              </div>
            )}

            <div>
              <Label htmlFor="repair-timeframe">{t('inspection.fields.repairTimeframe', 'Reparaturzeitraum')}</Label>
              <p id="repair-timeframe-visibility" className="mt-1 mb-1.5 flex w-fit items-center gap-1 rounded-full border border-blue-300 bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-800">
                <Eye className="h-3 w-3" aria-hidden="true" /> Für Kunden sichtbar (erscheint in „Diagnose ansehen“)
              </p>
              <Input
                id="repair-timeframe"
                aria-describedby="repair-timeframe-visibility"
                value={repairTimeframe}
                onChange={(e) => setRepairTimeframe(e.target.value)}
                placeholder={t('inspection.placeholders.repairTimeframe', 'z. B. 3-5 Tage')}
              />
            </div>

            <div>
              <Label htmlFor="repair-description">{t('inspection.fields.repairDescription', 'Reparaturbeschreibung')}</Label>
              <p id="repair-description-visibility" className="mt-1 mb-1.5 flex w-fit items-center gap-1 rounded-full border border-blue-300 bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-800">
                <Eye className="h-3 w-3" aria-hidden="true" /> Für Kunden sichtbar (erscheint in „Diagnose ansehen“)
              </p>
              <Textarea
                id="repair-description"
                aria-describedby="repair-description-visibility"
                value={repairDescription}
                onChange={(e) => setRepairDescription(e.target.value)}
                placeholder={t('inspection.placeholders.repairDescription', 'Erforderliche Reparatur beschreiben...')}
              />
            </div>

            <div className="space-y-2 rounded-md border border-slate-200 p-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="inform-customer"
                  checked={informCustomer}
                  onCheckedChange={(checked) => setInformCustomer(checked as boolean)}
                />
                <Label htmlFor="inform-customer">Kunde direkt über Defekt/Auffälligkeiten informieren</Label>
              </div>

              {informCustomer && (
                <>
                  <div>
                    <Label htmlFor="customer-info-reason">Festgestellter Defekt (erscheint im Prüfbericht für den Kunden)</Label>
                    <Input
                      id="customer-info-reason"
                      value={customerInfoReason}
                      onChange={(e) => setCustomerInfoReason(e.target.value)}
                      placeholder="z. B. Touch ID defekt / Modem-Firmware fehlerhaft"
                    />
                  </div>
                  <div className="space-y-1 rounded-md border border-blue-200 bg-blue-50/40 p-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Label htmlFor="customer-message" className="flex items-center gap-2">
                        <Send className="h-4 w-4" aria-hidden="true" />
                        Nachricht an Kunden
                        <Badge variant="outline" className="border-blue-300 text-blue-800">An Kunden</Badge>
                      </Label>
                      {!customerInfoMailTemplate.trim() && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setCustomerInfoMailTemplate([
                            'Guten Tag,',
                            '',
                            'bei der Eingangsprüfung Ihres Geräts ist uns ein Defekt bzw. eine Auffälligkeit aufgefallen'
                              + (customerInfoReason.trim() ? `: ${customerInfoReason.trim()}.` : '.'),
                            '',
                            'Bitte teilen Sie uns mit, wie wir weiter vorgehen sollen.',
                            '',
                            'Viele Grüße',
                            'Ihr McRepair.de Team',
                          ].join('\n'))}
                        >
                          Vorschlag einfügen
                        </Button>
                      )}
                    </div>
                    <Textarea
                      id="customer-message"
                      value={customerInfoMailTemplate}
                      onChange={(e) => setCustomerInfoMailTemplate(e.target.value)}
                      placeholder="Dieser Text wird dem Kunden als Benachrichtigung und E-Mail gesendet."
                      aria-required="true"
                    />
                    <p className="text-xs text-slate-600">
                      {customerInfoSentAt
                        ? `Bereits am ${new Date(customerInfoSentAt).toLocaleString('de-DE')} an den Kunden gesendet – erneutes Abschließen sendet keine zweite Nachricht.`
                        : 'Wird beim Abschließen der Inspektion einmalig an den Kunden gesendet (Benachrichtigung und E-Mail).'}
                    </p>
                  </div>
                  <div className="space-y-1 rounded-md border border-slate-200 bg-slate-50 p-2">
                    <Label htmlFor="customer-info-note" className="flex items-center gap-2">
                      <Lock className="h-4 w-4" aria-hidden="true" />
                      Interne Notiz
                      <Badge variant="secondary">Intern – nur für das Team</Badge>
                    </Label>
                    <Textarea
                      id="customer-info-note"
                      value={customerInfoNote}
                      onChange={(e) => setCustomerInfoNote(e.target.value)}
                      placeholder="Nur für das Team sichtbar – wird dem Kunden nie gesendet."
                    />
                  </div>
                </>
              )}
            </div>

            <Button
              onClick={handleCompleteInspection}
              disabled={submitting}
              aria-busy={submittingStep === 7}
              className="w-full inspection-primary-button"
            >
              {submittingStep === 7
                ? 'Speichert...'
                : t('inspection.actions.completeInspection', 'Inspektion abschließen')}
            </Button>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
