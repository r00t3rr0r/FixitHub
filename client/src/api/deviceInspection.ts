import api from './api';

// Description: Initialize device inspection for an order
// Endpoint: POST /api/device-inspections/init
// Request: { orderId: string, customerId: string }
// Response: { inspection: DeviceInspection }
export const initializeInspection = async (orderId: string, customerId: string) => {
  try {
    const response = await api.post('/api/device-inspections/init', { orderId, customerId });
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get inspection by order ID
// Endpoint: GET /api/device-inspections/:orderId
// Request: {}
// Response: { inspection: DeviceInspection | null }
export const getInspection = async (orderId: string) => {
  try {
    const response = await api.get(`/api/device-inspections/${orderId}`);
    return response.data;
  } catch (error: any) {
    // If 404, inspection doesn't exist yet (return null instead of error)
    if (error?.response?.status === 404) {
      return { inspection: null };
    }
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Update model verification step
// Endpoint: PUT /api/device-inspections/:orderId/model-verification
// Request: { reportedModel, actualModel, verificationStatus, costDifference?, notes?, supervisorId? }
// Response: { inspection: DeviceInspection }
export const updateModelVerification = async (
  orderId: string,
  reportedModel: string,
  actualModel: string,
  verificationStatus: 'correct' | 'incorrect-more-expensive' | 'incorrect-same-cheaper' | 'unverifiable',
  costDifference?: number,
  notes?: string,
  supervisorId?: string
) => {
  try {
    const response = await api.put(`/api/device-inspections/${orderId}/model-verification`, {
      reportedModel,
      actualModel,
      verificationStatus,
      costDifference,
      notes,
      supervisorId,
    });
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
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
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Update accessories and packaging
// Endpoint: PUT /api/device-inspections/:orderId/accessories
// Request: { originalPackaging, caseCover, powerAdapter, cables, otherAccessories }
// Response: { inspection: DeviceInspection }
export const updateAccessories = async (orderId: string, accessoriesData: any) => {
  try {
    const response = await api.put(`/api/device-inspections/${orderId}/accessories`, accessoriesData);
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
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
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Update device tests
// Endpoint: PUT /api/device-inspections/:orderId/device-tests
// Request: { charging, power, wifi, frontCamera, mainCamera }
// Response: { inspection: DeviceInspection }
export const updateDeviceTests = async (orderId: string, testData: any) => {
  try {
    const response = await api.put(`/api/device-inspections/${orderId}/device-tests`, testData);
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Update Apple-specific checks
// Endpoint: PUT /api/device-inspections/:orderId/apple-specific
// Request: { modemFirmware, touchIdFaceId }
// Response: { inspection: DeviceInspection }
export const updateAppleSpecific = async (orderId: string, appleData: any) => {
  try {
    const response = await api.put(`/api/device-inspections/${orderId}/apple-specific`, appleData);
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Complete inspection
// Endpoint: PUT /api/device-inspections/:orderId/complete
// Request: { isRepairable, repairOffer? }
// Response: { inspection: DeviceInspection }
export const completeInspection = async (
  orderId: string,
  isRepairable: boolean,
  repairOffer?: any
) => {
  try {
    const response = await api.put(`/api/device-inspections/${orderId}/complete`, {
      isRepairable,
      repairOffer,
    });
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Generate inspection report
// Endpoint: GET /api/device-inspections/:orderId/report
// Request: {}
// Response: { inspection: DeviceInspection, reportUrl: string }
export const generateInspectionReport = async (orderId: string) => {
  try {
    const response = await api.get(`/api/device-inspections/${orderId}/report`);
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get technician inspections
// Endpoint: GET /api/device-inspections
// Request: { status?, hasFailedTests?, page?, limit? }
// Response: { inspections: DeviceInspection[], total: number }
export const getTechnicianInspections = async (filters?: any) => {
  try {
    const response = await api.get('/api/device-inspections', { params: filters });
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};
