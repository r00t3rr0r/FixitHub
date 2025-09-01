import api from './api';

export interface DeviceType {
  _id: string;
  name: string;
  count: number;
}

export interface Manufacturer {
  _id: string;
  name: string;
  deviceType: string;
  count: number;
}

export interface DeviceModel {
  _id: string;
  name: string;
  manufacturer: string;
  deviceType: string;
  count: number;
}

// Description: Get all device types from repair services
// Endpoint: GET /api/devices/types
// Request: {}
// Response: { deviceTypes: DeviceType[] }
export const getDeviceTypes = async () => {
  try {
    const response = await api.get('/api/devices/types');
    return response.data;
  } catch (error) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get manufacturers by device type
// Endpoint: GET /api/devices/manufacturers?deviceType=smartphone
// Request: { deviceType: string }
// Response: { manufacturers: Manufacturer[] }
export const getManufacturersByDeviceType = async (deviceType: string) => {
  console.log('API: Getting manufacturers for device type:', deviceType);

  try {
    const response = await api.get(`/api/devices/manufacturers?deviceType=${deviceType}`);
    return response.data;
  } catch (error) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get models by device type and manufacturer
// Endpoint: GET /api/devices/models?deviceType=smartphone&manufacturer=apple
// Request: { deviceType: string, manufacturer: string }
// Response: { models: DeviceModel[] }
export const getModelsByTypeAndManufacturer = async (deviceType: string, manufacturer: string) => {
  console.log('=== API DEVICES DEBUG ===');
  console.log('API: Getting models for device type:', deviceType, 'and manufacturer:', manufacturer);

  try {
    const response = await api.get(`/api/devices/models?deviceType=${deviceType}&manufacturer=${manufacturer}`);
    console.log('=== FINAL RESULT ===');
    console.log('Returning models:', response.data.models);
    console.log('Models count:', response.data.models.length);
    return response.data;
  } catch (error) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};