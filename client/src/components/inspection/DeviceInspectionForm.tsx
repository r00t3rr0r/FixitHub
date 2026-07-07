import { useEffect, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
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
} from '@/api/deviceInspection';
import { createQuickAction } from '@/api/inspectionCommunication';
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
type ConditionStatus = 'light-wear' | 'scratches-wear' | 'heavy-scratches-wear' | 'damaged';
type ButtonsStatus = 'working' | 'not-working';
type ChecklistStatus = 'OK' | 'Not OK';
type CompletionAction = 'repairable' | 'not-repairable' | 'inform-customer';

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
  reportedDeviceImage?: string;
  bookedRepairs?: Array<{ name: string; price?: number; quantity?: number }>;
  orderTotalCost?: number;
  forceStartAtStepOne?: boolean;
  onRequestDeviceChange?: () => void;
  onComplete?: () => void;
}

export function DeviceInspectionForm({
  orderId,
  customerId,
  deviceType,
  deviceBrand,
  deviceModel,
  reportedDeviceImage,
  bookedRepairs = [],
  orderTotalCost,
  forceStartAtStepOne = false,
  onRequestDeviceChange,
  onComplete,
}: DeviceInspectionFormProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [inspection, setInspection] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState(1);
  const [expandedSteps, setExpandedSteps] = useState<number[]>([1]);
  const [initializing, setInitializing] = useState(false);

  // Step 1: Model Verification
  const [reportedModel, setReportedModel] = useState('');
  const [actualModel, setActualModel] = useState('');
  const [reportedModelImage, setReportedModelImage] = useState('');
  const [actualModelImage, setActualModelImage] = useState('');
  const [actualModelSearchQuery, setActualModelSearchQuery] = useState('');
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
  const [displayStatus, setDisplayStatus] = useState<ConditionStatus>('light-wear');
  const [frameStatus, setFrameStatus] = useState<ConditionStatus>('light-wear');
  const [backCoverStatus, setBackCoverStatus] = useState<ConditionStatus>('light-wear');
  const [buttonsStatus, setButtonsStatus] = useState<ButtonsStatus>('working');
  const [buttonsDescription, setButtonsDescription] = useState('');
  const [hasDamage, setHasDamage] = useState(false);
  const [damageDescription, setDamageDescription] = useState('');
  const [externalNotes, setExternalNotes] = useState('');

  // Step 5: Device Tests
  const [chargingStatus, setChargingStatus] = useState<ChecklistStatus>('OK');
  const [powerStatus, setPowerStatus] = useState<ChecklistStatus>('OK');
  const [wifiStatus, setWifiStatus] = useState<ChecklistStatus>('OK');
  const [frontCameraStatus, setFrontCameraStatus] = useState<ChecklistStatus>('OK');
  const [mainCameraStatus, setMainCameraStatus] = useState<ChecklistStatus>('OK');
  const [chargingCurrent, setChargingCurrent] = useState('');

  // Step 6: Apple-specific
  const [modemFirmwareStatus, setModemFirmwareStatus] = useState<'working' | 'defective' | 'not-testable'>('working');
  const [touchIdFaceIdStatus, setTouchIdFaceIdStatus] = useState<'not-applicable' | 'working' | 'defective'>('not-applicable');
  const [defectActionRequested, setDefectActionRequested] = useState(false);
  const [defectActionNote, setDefectActionNote] = useState('');

  // Step 7: Summary & Completion
  const [completionAction, setCompletionAction] = useState<CompletionAction | null>(null);
  const [isRepairable, setIsRepairable] = useState<boolean | null>(null);
  const [repairCost, setRepairCost] = useState('');
  const [repairTimeframe, setRepairTimeframe] = useState('');
  const [repairDescription, setRepairDescription] = useState('');
  const [informCustomer, setInformCustomer] = useState(false);
  const [customerInfoReason, setCustomerInfoReason] = useState('');
  const [customerInfoNote, setCustomerInfoNote] = useState('');
  const [customerInfoMailTemplate, setCustomerInfoMailTemplate] = useState('');

  const [submitting, setSubmitting] = useState(false);

  const draftKey = `inspection-draft-${orderId}`;
  const orderReportedModel = [
    deviceBrand && deviceBrand !== 'N/A' ? deviceBrand : '',
    deviceModel || '',
  ].filter(Boolean).join(' ').trim();

  const normalizeCondition = (value?: string): ConditionStatus => {
    if (!value) return 'light-wear';
    if (value === 'OK') return 'light-wear';
    if (value === 'Not OK') return 'damaged';
    if (['light-wear', 'scratches-wear', 'heavy-scratches-wear', 'damaged'].includes(value)) {
      return value as ConditionStatus;
    }
    return 'light-wear';
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

  const handleSelectActualModel = (device: SearchResult) => {
    const modelName = device.displayName || device.name || '';
    setActualModel(modelName);
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
      'light-wear': 'Leichte Gebrauchspuren',
      'scratches-wear': 'Kratzer und Gebrauchspuren',
      'heavy-scratches-wear': 'Schwere Kratzer und Gebrauchspuren',
      'damaged': 'Beschaedigt',
    };
    return labels[value];
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
    if (value === 'OK') {
      return t('inspection.status.ok', 'In Ordnung');
    }
    return t('inspection.status.notOk', 'Nicht in Ordnung');
  };

  const hydrateFromInspection = (insp: any) => {
    if (!insp) return;

    setReportedModel(orderReportedModel || insp.modelVerification?.reportedModel || '');

    if (insp.modelVerification) {
      setActualModel(insp.modelVerification.actualModel || '');
      setActualModelSearchQuery(insp.modelVerification.actualModel || '');
      setVerificationStatus((insp.modelVerification.verificationStatus || 'correct') as VerificationStatus);
      setCostDifference(Number(insp.modelVerification.costDifference || 0));
      setModelNotes(insp.modelVerification.notes || '');
    } else {
      if (orderReportedModel) {
        setActualModel(orderReportedModel);
        setActualModelSearchQuery(orderReportedModel);
      }
    }

    if (insp.identification) {
      setImei(insp.identification.imei || '');
      setSerialNumber(insp.identification.serialNumber || '');
      setImeiRequiredAtCompletion(Boolean(insp.identification.imeiRequired));
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

    if (typeof insp.isRepairable === 'boolean') {
      setIsRepairable(insp.isRepairable);
      setCompletionAction(insp.completionAction || (insp.isRepairable ? 'repairable' : 'not-repairable'));
    }

    if (insp.repairOffer) {
      setRepairCost(insp.repairOffer.cost ? String(insp.repairOffer.cost) : '');
      setRepairTimeframe(insp.repairOffer.timeframe || '');
      setRepairDescription(insp.repairOffer.description || '');
    }

    if (insp.customerInformation) {
      setInformCustomer(Boolean(insp.customerInformation.shouldInform));
      setCustomerInfoReason(insp.customerInformation.reason || '');
      setCustomerInfoNote(insp.customerInformation.note || '');
      setCustomerInfoMailTemplate(insp.customerInformation.mailTemplate || '');
    }

    const completedStepIds: number[] = Array.isArray(insp.completedSteps)
      ? insp.completedSteps.map((s: any) => Number(s.step)).filter((value: number) => Number.isFinite(value))
      : [];

    const nextStep = forceStartAtStepOne
      ? 1
      : Math.min(7, Math.max(1, completedStepIds.length + 1));
    setCurrentStep(nextStep);
    setExpandedSteps([nextStep]);
  };

  const hydrateFromDraft = (draft: any) => {
    if (!draft || typeof draft !== 'object') return;
    setActualModel(draft.actualModel ?? actualModel);
    setVerificationStatus(draft.verificationStatus ?? verificationStatus);
    setCostDifference(Number(draft.costDifference ?? costDifference));
    setModelNotes(draft.modelNotes ?? modelNotes);
    setImei(draft.imei ?? imei);
    setSerialNumber(draft.serialNumber ?? serialNumber);
    setImeiRequiredAtCompletion(Boolean(draft.imeiRequiredAtCompletion));
    setHasOriginalPackaging(Boolean(draft.hasOriginalPackaging));
    setHasCaseCover(Boolean(draft.hasCaseCover));
    setHasPowerAdapter(Boolean(draft.hasPowerAdapter));
    setSimTrayPresent(typeof draft.simTrayPresent === 'boolean' ? draft.simTrayPresent : simTrayPresent);
    setAdditionalAccessories(draft.additionalAccessories ?? additionalAccessories);
    setAccessoriesNotes(draft.accessoriesNotes ?? accessoriesNotes);
    setDisplayStatus(draft.displayStatus ?? displayStatus);
    setFrameStatus(draft.frameStatus ?? frameStatus);
    setBackCoverStatus(draft.backCoverStatus ?? backCoverStatus);
    setButtonsStatus(draft.buttonsStatus ?? buttonsStatus);
    setButtonsDescription(draft.buttonsDescription ?? buttonsDescription);
    setHasDamage(Boolean(draft.hasDamage));
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
    setDefectActionRequested(Boolean(draft.defectActionRequested));
    setDefectActionNote(draft.defectActionNote ?? defectActionNote);
    setCompletionAction(draft.completionAction ?? completionAction);
    setIsRepairable(typeof draft.isRepairable === 'boolean' ? draft.isRepairable : isRepairable);
    setRepairCost(draft.repairCost ?? repairCost);
    setRepairTimeframe(draft.repairTimeframe ?? repairTimeframe);
    setRepairDescription(draft.repairDescription ?? repairDescription);
    setInformCustomer(Boolean(draft.informCustomer));
    setCustomerInfoReason(draft.customerInfoReason ?? customerInfoReason);
    setCustomerInfoNote(draft.customerInfoNote ?? customerInfoNote);
    setCustomerInfoMailTemplate(draft.customerInfoMailTemplate ?? customerInfoMailTemplate);
  };

  // Initialize inspection
  useEffect(() => {
    const init = async () => {
      try {
        setInitializing(true);
        setLoading(true);

        // First, try to get existing inspection
        let existingInspection = null;
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
        }

        setInspection(existingInspection);

        if (existingInspection) {
          hydrateFromInspection(existingInspection);
        }

        try {
          const rawDraft = localStorage.getItem(draftKey);
          if (rawDraft && existingInspection?.status !== 'completed') {
            hydrateFromDraft(JSON.parse(rawDraft));
          }
        } catch (draftError) {
          console.warn('Unable to parse inspection draft', draftError);
        }

        setLoading(false);
      } catch (error) {
        console.error('Error initializing inspection:', error);
        toast({
          title: t('inspection.toast.errorTitle', 'Fehler'),
          description: t('inspection.toast.initError', 'Inspektion konnte nicht initialisiert werden'),
        });
        setLoading(false);
      } finally {
        setInitializing(false);
      }
    };

    init();
  }, [orderId, customerId, deviceBrand, deviceModel, forceStartAtStepOne]);

  useEffect(() => {
    if (orderReportedModel) {
      setReportedModel(orderReportedModel);
    }
  }, [orderReportedModel]);

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
      reportedModel: orderReportedModel,
      actualModel,
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
      completionAction,
      isRepairable,
      repairCost,
      repairTimeframe,
      repairDescription,
      informCustomer,
      customerInfoReason,
      customerInfoNote,
      customerInfoMailTemplate,
      updatedAt: new Date().toISOString(),
    };

    localStorage.setItem(draftKey, JSON.stringify(draftPayload));
  }, [
    initializing,
    reportedModel,
    actualModel,
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
    completionAction,
    isRepairable,
    repairCost,
    repairTimeframe,
    repairDescription,
    informCustomer,
    customerInfoReason,
    customerInfoNote,
    customerInfoMailTemplate,
    draftKey,
    orderReportedModel,
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

      handleSelectActualModel(bestMatch);
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
        toast({ title: t('inspection.toast.errorTitle', 'Fehler'), description: 'Gemeldetes Modell fehlt im Auftrag.' });
        return;
      }

      if (verificationStatus !== 'correct') {
        toast({
          title: t('inspection.toast.errorTitle', 'Fehler'),
          description: 'Bitte zuerst ueber "Geraet aendern" das Modell im Auftrag aktualisieren.',
        });
        return;
      }

      setSubmitting(true);
      const result = await updateModelVerification(
        orderId,
        reportedModel,
        reportedModel,
        verificationStatus,
        costDifference,
        modelNotes
      );
      setInspection(result.inspection);
      toast({
        title: t('inspection.toast.successTitle', 'Erfolg'),
        description: t('inspection.toast.modelSaved', 'Modellprüfung gespeichert'),
      });
      setCurrentStep(2);
      setExpandedSteps([2]);
    } catch (error: any) {
      toast({ title: t('inspection.toast.errorTitle', 'Fehler'), description: error.message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleIdentification = async () => {
    if (submitting) return;

    try {
      if (['Laptop', 'Tablet'].includes(deviceType) && !serialNumber.trim()) {
        toast({ title: t('inspection.toast.errorTitle', 'Fehler'), description: 'Bitte Seriennummer eintragen.' });
        return;
      }

      setSubmitting(true);
      const result = await updateIdentification(orderId, deviceType, imei.trim() || undefined, serialNumber.trim() || undefined);
      setInspection(result.inspection);
      setImeiRequiredAtCompletion(Boolean(result.inspection?.identification?.imeiRequired));
      toast({
        title: t('inspection.toast.successTitle', 'Erfolg'),
        description: t('inspection.toast.identificationSaved', 'Identifikation gespeichert'),
      });
      setCurrentStep(3);
      setExpandedSteps([3]);
    } catch (error: any) {
      toast({ title: t('inspection.toast.errorTitle', 'Fehler'), description: error.message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleAccessories = async () => {
    if (submitting) return;

    try {
      setSubmitting(true);
      const result = await updateAccessories(orderId, {
        originalPackaging: { present: hasOriginalPackaging },
        caseCover: { present: hasCaseCover },
        powerAdapter: { present: hasPowerAdapter },
        simTray: { present: simTrayPresent === true },
        additionalAccessoriesText: additionalAccessories,
        otherAccessories: [],
        description: accessoriesNotes,
      });
      setInspection(result.inspection);
      toast({
        title: t('inspection.toast.successTitle', 'Erfolg'),
        description: t('inspection.toast.accessoriesSaved', 'Zubehör gespeichert'),
      });
      setCurrentStep(4);
      setExpandedSteps([4]);
    } catch (error: any) {
      toast({ title: t('inspection.toast.errorTitle', 'Fehler'), description: error.message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleExternalInspection = async () => {
    if (submitting) return;

    try {
      setSubmitting(true);
      const result = await updateExternalInspection(orderId, {
        display: { status: displayStatus },
        frame: { status: frameStatus },
        backCover: { status: backCoverStatus },
        buttons: { status: buttonsStatus, notes: buttonsDescription },
        visibleDamages: { hasDamage, description: damageDescription },
        uniqueNotes: externalNotes,
      });
      setInspection(result.inspection);
      toast({
        title: t('inspection.toast.successTitle', 'Erfolg'),
        description: t('inspection.toast.externalSaved', 'Äußere Inspektion gespeichert'),
      });
      setCurrentStep(5);
      setExpandedSteps([5]);
    } catch (error: any) {
      toast({ title: t('inspection.toast.errorTitle', 'Fehler'), description: error.message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeviceTests = async () => {
    if (submitting) return;

    try {
      if (chargingCurrent.trim() && !/^\d+(\.\d+)?A$/i.test(chargingCurrent.trim())) {
        toast({ title: t('inspection.toast.errorTitle', 'Fehler'), description: 'Stromstaerke bitte im Format 1.7A eingeben.' });
        return;
      }

      setSubmitting(true);
      const result = await updateDeviceTests(orderId, {
        charging: { status: chargingStatus, current: chargingCurrent.trim() || undefined },
        power: { status: powerStatus },
        wifi: { status: wifiStatus },
        frontCamera: { status: frontCameraStatus },
        mainCamera: { status: mainCameraStatus },
      });
      setInspection(result.inspection);
      toast({
        title: t('inspection.toast.successTitle', 'Erfolg'),
        description: t('inspection.toast.testsSaved', 'Gerätetests gespeichert'),
      });
      setCurrentStep(6);
      setExpandedSteps([6]);
    } catch (error: any) {
      toast({ title: t('inspection.toast.errorTitle', 'Fehler'), description: error.message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleAppleSpecific = async () => {
    if (submitting) return;

    try {
      setSubmitting(true);
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
      setInspection(result.inspection);

      setCurrentStep(7);
      setExpandedSteps([7]);
      toast({
        title: t('inspection.toast.successTitle', 'Erfolg'),
        description: 'Apple-spezifische Pruefungen gespeichert',
      });
    } catch (error: any) {
      toast({ title: t('inspection.toast.errorTitle', 'Fehler'), description: error.message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCompleteInspection = async () => {
    if (submitting) return;

    if (!completionAction) {
      toast({ title: t('inspection.toast.errorTitle', 'Fehler'), description: 'Bitte Abschlussentscheidung waehlen.' });
      return;
    }

    const resolvedRepairable = completionAction === 'repairable';

    if (completionAction === 'repairable' && repairCost.trim()) {
      const parsedCost = Number(repairCost);
      if (!Number.isFinite(parsedCost)) {
        toast({ title: t('inspection.toast.errorTitle', 'Fehler'), description: 'Reparaturkosten sind ungueltig.' });
        return;
      }
    }

    const shouldSendCustomerInfo = informCustomer || completionAction === 'inform-customer' || defectActionRequested;
    const generatedTemplate = customerInfoMailTemplate.trim() || [
      'Betreff: Wichtige Information zu Ihrer Reparatur',
      '',
      'Guten Tag,',
      '',
      `bei der Geraeteinspektion zu Auftrag ${orderId} wurden zusaetzliche Auffaelligkeiten festgestellt.`,
      customerInfoReason ? `Grund: ${customerInfoReason}` : '',
      customerInfoNote ? `Hinweis: ${customerInfoNote}` : '',
      '',
      'Bitte teilen Sie uns mit, wie wir weiter vorgehen sollen.',
      '',
      'Viele Gruesse',
      'Ihr FixitHub Team',
    ].filter(Boolean).join('\n');

    try {
      setSubmitting(true);

      if (deviceType === 'Smartphone' && imei.trim() && imeiRequiredAtCompletion) {
        await updateIdentification(orderId, deviceType, imei.trim(), serialNumber.trim() || undefined);
        setImeiRequiredAtCompletion(false);
      }

      const repairOfferPayload = completionAction === 'repairable'
        ? {
            cost: repairCost.trim() ? Number(repairCost) : 0,
            timeframe: repairTimeframe,
            description: repairDescription,
          }
        : undefined;

      await completeInspection(
        orderId,
        resolvedRepairable,
        repairOfferPayload,
        completionAction,
        {
          shouldInform: shouldSendCustomerInfo,
          reason: customerInfoReason,
          note: customerInfoNote,
          suggestedStatus: completionAction === 'inform-customer' ? 'awaiting-customer' : '',
          mailTemplate: generatedTemplate,
        }
      );

      if (shouldSendCustomerInfo && inspection?._id) {
        try {
          await createQuickAction(
            orderId,
            inspection._id,
            'customer_defect_info',
            customerInfoNote || customerInfoReason || 'Kunde ueber technischen Defekt informieren',
            {
              completionAction,
              reason: customerInfoReason,
              defectActionRequested,
              imeiMissing: deviceType === 'Smartphone' && !imei,
            }
          );
        } catch (quickActionError) {
          console.warn('Could not create customer defect quick action', quickActionError);
        }
      }

      localStorage.removeItem(draftKey);
      toast({
        title: t('inspection.toast.successTitle', 'Erfolg'),
        description: t('inspection.toast.completed', 'Inspektion abgeschlossen'),
      });
      onComplete?.();
    } catch (error: any) {
      toast({ title: t('inspection.toast.errorTitle', 'Fehler'), description: error.message });
    } finally {
      setSubmitting(false);
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
      {bookedRepairs.length > 0 && (
        <Card className="inspection-step-card">
          <CardHeader className="inspection-step-header">
            <CardTitle className="inspection-step-title">Gebuchte Reparatur</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {bookedRepairs.map((repair, index) => (
              <div key={`${repair.name}-${index}`} className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2 text-sm">
                <span>{repair.quantity && repair.quantity > 1 ? `${repair.name} x${repair.quantity}` : repair.name}</span>
                <span className="font-semibold">{typeof repair.price === 'number' ? `${repair.price.toFixed(2)} EUR` : '-'}</span>
              </div>
            ))}
            {typeof orderTotalCost === 'number' && (
              <div className="flex items-center justify-between border-t border-slate-200 pt-2 text-sm font-semibold">
                <span>Aktuelle Auftragssumme</span>
                <span>{orderTotalCost.toFixed(2)} EUR</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 1: Model Verification */}
      <Card className="inspection-step-card">
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
                        alt={reportedModel || 'Reported model'}
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
                      <p className="text-xs text-slate-500">Vom Auftrag uebernommen</p>
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
                        Uebereinstimmung OK
                      </Label>
                      <p className="text-xs text-slate-500">
                        Aktiv lassen, wenn das Geraet mit dem Auftrag uebereinstimmt.
                      </p>
                    </div>
                  </div>

                  {verificationStatus !== 'correct' && (
                    <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                      <p className="mb-2">
                        Modell stimmt nicht ueberein. Bitte den Auftrag ueber "Geraet aendern" aktualisieren.
                      </p>
                      <Button type="button" variant="outline" size="sm" onClick={onRequestDeviceChange}>
                        Geraet aendern
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
              <Textarea
                id="model-notes"
                value={modelNotes}
                onChange={(e) => setModelNotes(e.target.value)}
                placeholder={t('inspection.placeholders.notes', 'Zusätzliche Hinweise...')}
              />
            </div>

            <Button onClick={handleModelVerification} disabled={submitting} className="inspection-primary-button">
              {t('inspection.actions.saveContinue', 'Speichern & Weiter')}
            </Button>
          </CardContent>
        )}
      </Card>

      {/* Step 2: Identification */}
      <Card className="inspection-step-card">
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
            {deviceType === 'Smartphone' ? (
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
            ) : (
              <div>
                <Label htmlFor="serial">{t('inspection.fields.serialNumber', 'Seriennummer')}</Label>
                <Input
                  id="serial"
                  value={serialNumber}
                  onChange={(e) => setSerialNumber(e.target.value)}
                  placeholder={t('inspection.placeholders.serialNumber', 'Seriennummer eingeben')}
                />
              </div>
            )}

            <Button onClick={handleIdentification} disabled={submitting} className="inspection-primary-button">
              {t('inspection.actions.saveContinue', 'Speichern & Weiter')}
            </Button>
          </CardContent>
        )}
      </Card>

      {/* Step 3: Accessories */}
      <Card className="inspection-step-card">
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
                    <SelectValue placeholder="Bitte waehlen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yes">Ja</SelectItem>
                    <SelectItem value="no">Nein</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="additional-accessories">Weiteres Zubehoer (z. B. Stift, Ladekabel)</Label>
                <Input
                  id="additional-accessories"
                  value={additionalAccessories}
                  onChange={(e) => setAdditionalAccessories(e.target.value)}
                  placeholder="Freitext oder Komma-getrennte Liste"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="accessories-notes">{t('inspection.fields.additionalNotes', 'Zusätzliche Notizen')}</Label>
              <Textarea
                id="accessories-notes"
                value={accessoriesNotes}
                onChange={(e) => setAccessoriesNotes(e.target.value)}
                placeholder={t('inspection.placeholders.accessoriesNotes', 'Zubehör oder Zustand beschreiben...')}
              />
            </div>

            <Button onClick={handleAccessories} disabled={submitting} className="inspection-primary-button">
              {t('inspection.actions.saveContinue', 'Speichern & Weiter')}
            </Button>
          </CardContent>
        )}
      </Card>

      {/* Step 4: External Inspection */}
      <Card className="inspection-step-card">
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
                      <SelectItem value="light-wear">{getConditionLabel('light-wear')}</SelectItem>
                      <SelectItem value="scratches-wear">{getConditionLabel('scratches-wear')}</SelectItem>
                      <SelectItem value="heavy-scratches-wear">{getConditionLabel('heavy-scratches-wear')}</SelectItem>
                      <SelectItem value="damaged">{getConditionLabel('damaged')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ))}

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
            </div>

            {buttonsStatus === 'not-working' && (
              <div>
                <Label htmlFor="buttons-description">Beschreibung (optional)</Label>
                <Textarea
                  id="buttons-description"
                  value={buttonsDescription}
                  onChange={(e) => setButtonsDescription(e.target.value)}
                  placeholder="Welche Taste funktioniert nicht?"
                />
              </div>
            )}

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
                  <Textarea
                    id="damage-desc"
                    value={damageDescription}
                    onChange={(e) => setDamageDescription(e.target.value)}
                    placeholder={t('inspection.placeholders.damageDescription', 'Schäden beschreiben...')}
                  />
                </div>
              )}
            </div>

            <div>
              <Label htmlFor="external-notes">{t('inspection.fields.additionalNotes', 'Zusätzliche Notizen')}</Label>
              <Textarea
                id="external-notes"
                value={externalNotes}
                onChange={(e) => setExternalNotes(e.target.value)}
                placeholder={t('inspection.placeholders.externalNotes', 'Besondere Beobachtungen...')}
              />
            </div>

            <Button onClick={handleExternalInspection} disabled={submitting} className="inspection-primary-button">
              {t('inspection.actions.saveContinue', 'Speichern & Weiter')}
            </Button>
          </CardContent>
        )}
      </Card>

      {/* Step 5: Device Tests */}
      <Card className="inspection-step-card">
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
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            <div>
              <Label htmlFor="charging-current">Stromstaerke beim Laden (optional)</Label>
              <Input
                id="charging-current"
                value={chargingCurrent}
                onChange={(e) => setChargingCurrent(e.target.value)}
                placeholder="z. B. 1.7A"
              />
            </div>

            <Button onClick={handleDeviceTests} disabled={submitting} className="inspection-primary-button">
              {t('inspection.actions.saveContinue', 'Speichern & Weiter')}
            </Button>
          </CardContent>
        )}
      </Card>

      {/* Step 6: Apple-Specific */}
      <Card className="inspection-step-card">
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
                <Select value={touchIdFaceIdStatus} onValueChange={(value: 'not-applicable' | 'working' | 'defective') => setTouchIdFaceIdStatus(value)}>
                  <SelectTrigger id="touchid-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="not-applicable">Nicht vorhanden</SelectItem>
                    <SelectItem value="working">Funktioniert</SelectItem>
                    <SelectItem value="defective">Defekt</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {(modemFirmwareStatus === 'defective' || touchIdFaceIdStatus === 'defective') && (
                <div className="space-y-2 rounded-md border border-amber-300 bg-amber-50 p-3">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="defect-action"
                      checked={defectActionRequested}
                      onCheckedChange={(checked) => setDefectActionRequested(checked as boolean)}
                    />
                    <Label htmlFor="defect-action">Zusatzaktion aktivieren: Kunde ueber Defekt informieren</Label>
                  </div>
                  {defectActionRequested && (
                    <Textarea
                      value={defectActionNote}
                      onChange={(e) => setDefectActionNote(e.target.value)}
                      placeholder="Hinweis fuer Kommunikation/Statusnotiz"
                    />
                  )}
                </div>
              )}
            </div>

            <Button
              onClick={handleAppleSpecific}
              disabled={submitting}
              className="w-full inspection-primary-button"
            >
              Speichern & Weiter zu Schritt 7
            </Button>
          </CardContent>
        )}
      </Card>

      {/* Step 7: Summary & Completion */}
      <Card className="inspection-step-card">
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
              <p><strong>Modell:</strong> {actualModel || '-'}</p>
              <p><strong>Identifikation:</strong> {imei || serialNumber || 'Noch nicht erfasst'}</p>
              <p><strong>Aeusserer Zustand:</strong> Display {getConditionLabel(displayStatus)}, Rahmen {getConditionLabel(frameStatus)}, Rueckseite {getConditionLabel(backCoverStatus)}</p>
              <p><strong>Tasten:</strong> {buttonsStatus === 'working' ? 'Funktionieren' : 'Nicht funktionierend'}</p>
              <p><strong>Defekt-Hinweise:</strong> Modem {modemFirmwareStatus}, Touch/Face {touchIdFaceIdStatus}</p>
            </div>

            {deviceType === 'Smartphone' && (!imei || imeiRequiredAtCompletion) && (
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
              <Label>Abschlussentscheidung</Label>
              <div className="inspection-repairable-actions">
                <Button
                  variant={completionAction === 'repairable' ? 'default' : 'outline'}
                  onClick={() => {
                    setCompletionAction('repairable');
                    setIsRepairable(true);
                  }}
                  className={completionAction === 'repairable' ? 'inspection-primary-button' : ''}
                >
                  Reparierbar
                </Button>
                <Button
                  variant={completionAction === 'not-repairable' ? 'destructive' : 'outline'}
                  onClick={() => {
                    setCompletionAction('not-repairable');
                    setIsRepairable(false);
                  }}
                  className={completionAction === 'not-repairable' ? 'inspection-primary-button' : ''}
                  data-destructive={completionAction === 'not-repairable' ? 'true' : 'false'}
                >
                  Nicht reparierbar
                </Button>
              </div>
              <div className="mt-2">
                <Button
                  variant={completionAction === 'inform-customer' ? 'secondary' : 'outline'}
                  onClick={() => {
                    setCompletionAction('inform-customer');
                    setIsRepairable(false);
                    setInformCustomer(true);
                  }}
                >
                  Kunde informieren
                </Button>
              </div>
            </div>

            {completionAction === 'repairable' && (
              <>
                <div>
                  <Label htmlFor="repair-cost">Geschaetzte Reparaturkosten (EUR)</Label>
                  <Input
                    id="repair-cost"
                    type="number"
                    value={repairCost}
                    onChange={(e) => setRepairCost(e.target.value)}
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <Label htmlFor="repair-timeframe">{t('inspection.fields.repairTimeframe', 'Reparaturzeitraum')}</Label>
                  <Input
                    id="repair-timeframe"
                    value={repairTimeframe}
                    onChange={(e) => setRepairTimeframe(e.target.value)}
                    placeholder={t('inspection.placeholders.repairTimeframe', 'z. B. 3-5 Tage')}
                  />
                </div>

                <div>
                  <Label htmlFor="repair-description">{t('inspection.fields.repairDescription', 'Reparaturbeschreibung')}</Label>
                  <Textarea
                    id="repair-description"
                    value={repairDescription}
                    onChange={(e) => setRepairDescription(e.target.value)}
                    placeholder={t('inspection.placeholders.repairDescription', 'Erforderliche Reparatur beschreiben...')}
                  />
                </div>
              </>
            )}

            <div className="space-y-2 rounded-md border border-slate-200 p-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="inform-customer"
                  checked={informCustomer}
                  onCheckedChange={(checked) => setInformCustomer(checked as boolean)}
                />
                <Label htmlFor="inform-customer">Kunde direkt ueber Defekt/Auffaelligkeiten informieren</Label>
              </div>

              {informCustomer && (
                <>
                  <div>
                    <Label htmlFor="customer-info-reason">Grund</Label>
                    <Input
                      id="customer-info-reason"
                      value={customerInfoReason}
                      onChange={(e) => setCustomerInfoReason(e.target.value)}
                      placeholder="z. B. Touch ID defekt / Modem-Firmware fehlerhaft"
                    />
                  </div>
                  <div>
                    <Label htmlFor="customer-info-note">Notiz</Label>
                    <Textarea
                      id="customer-info-note"
                      value={customerInfoNote}
                      onChange={(e) => setCustomerInfoNote(e.target.value)}
                      placeholder="Interne oder kundenbezogene Hinweise"
                    />
                  </div>
                  <div>
                    <Label htmlFor="customer-mail-template">Mail-Vorlage (optional editierbar)</Label>
                    <Textarea
                      id="customer-mail-template"
                      value={customerInfoMailTemplate}
                      onChange={(e) => setCustomerInfoMailTemplate(e.target.value)}
                      placeholder="Automatisch generiert, falls leer"
                    />
                  </div>
                </>
              )}
            </div>

            <Button
              onClick={handleCompleteInspection}
              disabled={submitting || completionAction === null}
              className="w-full inspection-primary-button"
            >
              {t('inspection.actions.completeInspection', 'Inspektion abschließen')}
            </Button>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
