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
  brandId: string;  // Added to support edit functionality
  deviceType: string;
  image?: string;
  specifications?: Record<string, any>;  // Legacy field for backward compatibility
  // Comprehensive specification sections
  images?: Array<{
    url?: string;
    base64?: string;
    caption?: string;
  }>;
  network?: {
    technology2G?: string;
    bands2G?: string;
    technology3G?: string;
    bands3G?: string;
    technology4G?: string;
    bands4G?: string;
    technology5G?: string;
    bands5G?: string;
    speed?: string;
  };
  physical?: {
    dimensions?: string;
    weight?: string;
    build?: string;
    simType?: string;
    simCount?: string;
  };
  display?: {
    type?: string;
    size?: string;
    resolution?: string;
    protection?: string;
    features?: string;
  };
  platform?: {
    os?: string;
    chipset?: string;
    cpu?: string;
    gpu?: string;
  };
  memory?: {
    internal?: Array<{
      ram?: string;
      storage?: string;
    }>;
    cardSlot?: string;
  };
  rearCamera?: {
    modules?: string;
    features?: string;
    video?: string;
  };
  frontCamera?: {
    modules?: string;
    features?: string;
    video?: string;
  };
  audio?: {
    loudspeaker?: string;
    jack3_5mm?: string;
  };
  connectivity?: {
    wlan?: string;
    bluetooth?: string;
    positioning?: string;
    nfc?: string;
    radio?: string;
    usb?: string;
    infrared?: string;
    other?: string;
  };
  features?: {
    sensors?: string;
    special?: string[];
  };
  battery?: {
    type?: string;
    charging?: string;
    standbyTime?: string;
    talkTime?: string;
    musicPlay?: string;
  };
  other?: {
    models?: string[];
    sarValues?: {
      head?: string;
      body?: string;
    };
    price?: string;
    releaseDate?: string;
    colors?: string[];
  };
  count: number;
}

export interface SearchResult {
  _id: string;
  name: string;
  deviceType: string;
  manufacturer: string;
  manufacturerId: string;
  displayName: string;
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

// Description: Search devices by query string (autocomplete)
// Endpoint: GET /api/devices/search?q=iphone
// Request: { q: string }
// Response: { success: boolean, devices: SearchResult[] }
export const searchDevices = async (query: string) => {
  console.log('API: Searching devices with query:', query);

  try {
    const response = await api.get(`/api/devices/search?q=${encodeURIComponent(query)}`);
    console.log('API: Search results:', response.data.devices);
    return response.data;
  } catch (error) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};