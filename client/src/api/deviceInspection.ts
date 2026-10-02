import type { AxiosResponse } from 'axios';
import api from './api';

type InspectionApiPayload = {
  error?: string;
  message?: string;
  [key: string]: unknown;
};

const unwrapInspectionResponse = (response: AxiosResponse<InspectionApiPayload>) => {
  if (response.status < 200 || response.status >= 300) {
    throw new Error(response.data?.error || response.data?.message || 'Die Anfrage zur Geräteinspektion ist fehlgeschlagen.');
  }

  return response.data;
};

// api.ts rejects HTTP errors with an ApiError that carries `response`, `status` and `data`.
// Older shapes (raw AxiosResponse, plain Error, network error) are still handled here so the
// real server message always reaches the caller instead of an empty string.
const toInspectionError = (error: any): Error => {
  if (error instanceof Error && error.message) {
    return error;
  }

  const payload = error?.response?.data ?? error?.data;
  const status = error?.response?.status ?? error?.status;

  return new Error(
    payload?.error ||
      payload?.message ||
      error?.message ||
      (status
        ? `Anfrage fehlgeschlagen (HTTP ${status})`
        : 'Server nicht erreichbar. Bitte erneut versuchen.')
  );
};

// The only repair cost that may be displayed: the server's repairOfferKnownCost (number | null).
// Fallback for responses without that field (older server): an explicitly specified cost, or a
// positive legacy cost. A legacy 0 without costSpecified was a client default and is UNKNOWN.
export const getKnownRepairCost = (inspection: any): number | null => {
  if (!inspection) return null;
  if (inspection.repairOfferKnownCost === null) return null;
  if (typeof inspection.repairOfferKnownCost === 'number' && Number.isFinite(inspection.repairOfferKnownCost)) {
    return inspection.repairOfferKnownCost;
  }
  const offer = inspection.repairOffer;
  const cost = offer?.cost;
  if (typeof cost !== 'number' || !Number.isFinite(cost) || cost < 0) return null;
  if (offer?.costSpecified === true) return cost;
  return cost > 0 ? cost : null;
};

// Description: Initialize device inspection for an order
// Endpoint: POST /api/device-inspections/init
// Request: { orderId: string, customerId?: string }
// Response: { inspection: DeviceInspection }
export const initializeInspection = async (orderId: string, customerId?: string | null) => {
  try {
    const payload: { orderId: string; customerId?: string } = { orderId };

    if (customerId) {
      payload.customerId = customerId;
    }

    const response = await api.post('/api/device-inspections/init', payload);
    return unwrapInspectionResponse(response);
  } catch (error: any) {
    throw toInspectionError(error);
  }
};

// Description: Get inspection by order ID
// Endpoint: GET /api/device-inspections/:orderId
// Request: {}
// Response: { inspection: DeviceInspection | null }
export const getInspection = async (orderId: string) => {
  try {
    const response = await api.get(`/api/device-inspections/${orderId}`);
    return unwrapInspectionResponse(response);
  } catch (error: any) {
    // If 404, inspection doesn't exist yet (return null instead of error)
    if ((error?.status ?? error?.response?.status) === 404) {
      return { inspection: null };
    }
    throw toInspectionError(error);
  }
};

// Description: Update model verification step
// Endpoint: PUT /api/device-inspections/:orderId/model-verification
// Request: { reportedModel, actualModel, verificationStatus, costDifference?, notes?, supervisorId?, actualModelConfirmed? }
// Response: { inspection: DeviceInspection, warnings?: string[] }
// actualModelConfirmed marks actualModel as actively chosen/typed by the technician. Only an
// UNCONFIRMED value that merely echoes reportedModel may be replaced by the server with the
// order's corrected device; any replacement is reported back in `warnings`.
export const updateModelVerification = async (
  orderId: string,
  reportedModel: string,
  actualModel: string,
  verificationStatus: 'correct' | 'incorrect-more-expensive' | 'incorrect-same-cheaper' | 'unverifiable',
  costDifference?: number,
  notes?: string,
  supervisorId?: string,
  actualModelConfirmed?: boolean
) => {
  try {
    const response = await api.put(`/api/device-inspections/${orderId}/model-verification`, {
      reportedModel,
      actualModel,
      verificationStatus,
      costDifference,
      notes,
      supervisorId,
      actualModelConfirmed: actualModelConfirmed === true,
    });
    return unwrapInspectionResponse(response);
  } catch (error: any) {
    throw toInspectionError(error);
  }
};

// Description: Update identification numbers
// Endpoint: PUT /api/device-inspections/:orderId/identification
// Request: { deviceType, imei?, serialNumber? }
// Response: { inspection: DeviceInspection }
export const updateIdentification = async (
  orderId: string,
  deviceType: string,
  imei?: string,
  serialNumber?: string
) => {
  try {
    const response = await api.put(`/api/device-inspections/${orderId}/identification`, {
      deviceType,
      imei,
      serialNumber,
    });
    return unwrapInspectionResponse(response);
  } catch (error: any) {
    throw toInspectionError(error);
  }
};

// Description: Update accessories and packaging
// Endpoint: PUT /api/device-inspections/:orderId/accessories
// Request: { originalPackaging, caseCover, powerAdapter, cables, otherAccessories }
// Response: { inspection: DeviceInspection }
export const updateAccessories = async (orderId: string, accessoriesData: any) => {
  try {
    const response = await api.put(`/api/device-inspections/${orderId}/accessories`, accessoriesData);
    return unwrapInspectionResponse(response);
  } catch (error: any) {
    throw toInspectionError(error);
  }
};

// Description: Update external inspection
// Endpoint: PUT /api/device-inspections/:orderId/external-inspection
// Request: { display, frame, backCover, buttons, visibleDamages, uniqueNotes, photos? }
// Response: { inspection: DeviceInspection }
export const updateExternalInspection = async (
  orderId: string,
  inspectionData: any,
  photos?: string[]
) => {
  try {
    const response = await api.put(`/api/device-inspections/${orderId}/external-inspection`, {
      ...inspectionData,
      photos,
    });
    return unwrapInspectionResponse(response);
  } catch (error: any) {
    throw toInspectionError(error);
  }
};

// Description: Update device tests
// Endpoint: PUT /api/device-inspections/:orderId/device-tests
// Request: { charging, power, wifi, frontCamera, mainCamera }
// Response: { inspection: DeviceInspection }
export const updateDeviceTests = async (orderId: string, testData: any) => {
  try {
    const response = await api.put(`/api/device-inspections/${orderId}/device-tests`, testData);
    return unwrapInspectionResponse(response);
  } catch (error: any) {
    throw toInspectionError(error);
  }
};

// Description: Update Apple-specific checks
// Endpoint: PUT /api/device-inspections/:orderId/apple-specific
// Request: { modemFirmware, touchIdFaceId }
// Response: { inspection: DeviceInspection }
export const updateAppleSpecific = async (orderId: string, appleData: any) => {
  try {
    const response = await api.put(`/api/device-inspections/${orderId}/apple-specific`, appleData);
    return unwrapInspectionResponse(response);
  } catch (error: any) {
    throw toInspectionError(error);
  }
};

// Description: Complete inspection
// Endpoint: PUT /api/device-inspections/:orderId/complete
// Request: { repairOffer?: { cost?, costSpecified?, timeframe?, description? }, customerInformation? }
//   isRepairable / completionAction are DEPRECATED and ignored by the server (never written).
//   repairOffer.cost is taken only when given; 0 only together with costSpecified: true.
// Response: { inspection: DeviceInspection } (inspection.repairOfferKnownCost: number | null)
export const completeInspection = async (
  orderId: string,
  isRepairable?: boolean | null,
  repairOffer?: { cost?: number; costSpecified?: boolean; timeframe?: string; description?: string },
  completionAction?: 'repairable' | 'not-repairable' | 'inform-customer',
  customerInformation?: {
    shouldInform?: boolean;
    reason?: string;
    note?: string;
    suggestedStatus?: string;
    mailTemplate?: string;
    // Ausdruecklicher Text an den Kunden; nur damit (und shouldInform) informiert der Server den
    // Kunden (In-App + E-Mail, einmal je Inspektion). note bleibt intern.
    customerMessage?: string;
  }
) => {
  // Response zusaetzlich: customerNotification { status: 'sent' | 'duplicate' | 'skipped' | 'failed', reason?, error? }
  try {
    const response = await api.put(`/api/device-inspections/${orderId}/complete`, {
      isRepairable,
      repairOffer,
      completionAction,
      customerInformation,
    });
    return unwrapInspectionResponse(response);
  } catch (error: any) {
    throw toInspectionError(error);
  }
};

// Description: Generate inspection report
// Endpoint: GET /api/device-inspections/:orderId/report
// Request: {}
// Response: { inspection: DeviceInspection, reportUrl: string }
export const generateInspectionReport = async (orderId: string) => {
  try {
    const response = await api.get(`/api/device-inspections/${orderId}/report`);
    return unwrapInspectionResponse(response);
  } catch (error: any) {
    throw toInspectionError(error);
  }
};

// Description: Get technician inspections
// Endpoint: GET /api/device-inspections
// Request: { status?, hasFailedTests?, page?, limit? }
// Response: { inspections: DeviceInspection[], total: number }
export const getTechnicianInspections = async (filters?: any) => {
  try {
    const response = await api.get('/api/device-inspections', { params: filters });
    return unwrapInspectionResponse(response);
  } catch (error: any) {
    throw toInspectionError(error);
  }
};
