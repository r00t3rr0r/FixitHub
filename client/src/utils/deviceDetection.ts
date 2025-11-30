/**
 * Device Detection Utility
 * Detects and provides information about the user's device
 */

export interface DeviceInfo {
  // Device type
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;

  // Operating System
  os: string;
  osVersion: string;

  // Browser
  browser: string;
  browserVersion: string;

  // Screen Information
  screenWidth: number;
  screenHeight: number;
  screenOrientation: 'portrait' | 'landscape';
  pixelRatio: number;

  // Hardware
  touchSupport: boolean;
  maxTouchPoints: number;

  // Connection
  connectionType: string;
  effectiveType: string;

  // Device Model (if available)
  deviceModel: string;
  vendor: string;

  // Additional
  userAgent: string;
  platform: string;
  language: string;
  timezone: string;
}

/**
 * Detect device type based on screen width and user agent
 */
function detectDeviceType(): { isMobile: boolean; isTablet: boolean; isDesktop: boolean } {
  const ua = navigator.userAgent.toLowerCase();
  const width = window.innerWidth;

  // Mobile detection
  const isMobileUA = /android|webos|iphone|ipod|blackberry|iemobile|opera mini/i.test(ua);
  const isMobileWidth = width < 768;
  const isMobile = isMobileUA || isMobileWidth;

  // Tablet detection
  const isTabletUA = /ipad|android(?!.*mobile)|tablet|kindle|playbook|silk/i.test(ua);
  const isTabletWidth = width >= 768 && width < 1024;
  const isTablet = (isTabletUA || isTabletWidth) && !isMobile;

  // Desktop
  const isDesktop = !isMobile && !isTablet;

  return { isMobile, isTablet, isDesktop };
}

/**
 * Detect operating system and version
 */
function detectOS(): { os: string; osVersion: string } {
  const ua = navigator.userAgent;
  let os = 'Unknown';
  let osVersion = '';

  if (/Windows NT 10.0/i.test(ua)) {
    os = 'Windows';
    osVersion = '10';
  } else if (/Windows NT 6.3/i.test(ua)) {
    os = 'Windows';
    osVersion = '8.1';
  } else if (/Windows NT 6.2/i.test(ua)) {
    os = 'Windows';
    osVersion = '8';
  } else if (/Windows NT 6.1/i.test(ua)) {
    os = 'Windows';
    osVersion = '7';
  } else if (/Mac OS X (\d+[._]\d+)/i.test(ua)) {
    os = 'macOS';
    const match = ua.match(/Mac OS X (\d+[._]\d+)/i);
    osVersion = match ? match[1].replace(/_/g, '.') : '';
  } else if (/iPhone OS (\d+[._]\d+)/i.test(ua)) {
    os = 'iOS';
    const match = ua.match(/iPhone OS (\d+[._]\d+)/i);
    osVersion = match ? match[1].replace(/_/g, '.') : '';
  } else if (/iPad.*OS (\d+[._]\d+)/i.test(ua)) {
    os = 'iPadOS';
    const match = ua.match(/OS (\d+[._]\d+)/i);
    osVersion = match ? match[1].replace(/_/g, '.') : '';
  } else if (/Android (\d+\.?\d*)/i.test(ua)) {
    os = 'Android';
    const match = ua.match(/Android (\d+\.?\d*)/i);
    osVersion = match ? match[1] : '';
  } else if (/Linux/i.test(ua)) {
    os = 'Linux';
  } else if (/CrOS/i.test(ua)) {
    os = 'Chrome OS';
  }

  return { os, osVersion };
}

/**
 * Detect browser and version
 */
function detectBrowser(): { browser: string; browserVersion: string } {
  const ua = navigator.userAgent;
  let browser = 'Unknown';
  let browserVersion = '';

  if (/Edg\//i.test(ua)) {
    browser = 'Microsoft Edge';
    const match = ua.match(/Edg\/(\d+\.?\d*)/i);
    browserVersion = match ? match[1] : '';
  } else if (/Chrome/i.test(ua) && !/Edg/i.test(ua)) {
    browser = 'Google Chrome';
    const match = ua.match(/Chrome\/(\d+\.?\d*)/i);
    browserVersion = match ? match[1] : '';
  } else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) {
    browser = 'Safari';
    const match = ua.match(/Version\/(\d+\.?\d*)/i);
    browserVersion = match ? match[1] : '';
  } else if (/Firefox/i.test(ua)) {
    browser = 'Mozilla Firefox';
    const match = ua.match(/Firefox\/(\d+\.?\d*)/i);
    browserVersion = match ? match[1] : '';
  } else if (/MSIE|Trident/i.test(ua)) {
    browser = 'Internet Explorer';
    const match = ua.match(/(?:MSIE |rv:)(\d+\.?\d*)/i);
    browserVersion = match ? match[1] : '';
  } else if (/Opera|OPR/i.test(ua)) {
    browser = 'Opera';
    const match = ua.match(/(?:Opera|OPR)\/(\d+\.?\d*)/i);
    browserVersion = match ? match[1] : '';
  }

  return { browser, browserVersion };
}

/**
 * Detect screen orientation
 */
function detectScreenOrientation(): 'portrait' | 'landscape' {
  if (window.innerWidth > window.innerHeight) {
    return 'landscape';
  }
  return 'portrait';
}

/**
 * Detect connection information
 */
function detectConnection(): { connectionType: string; effectiveType: string } {
  const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;

  if (connection) {
    return {
      connectionType: connection.type || 'Unknown',
      effectiveType: connection.effectiveType || 'Unknown'
    };
  }

  return {
    connectionType: 'Unknown',
    effectiveType: 'Unknown'
  };
}

/**
 * Detect device model and vendor
 */
function detectDeviceModel(): { deviceModel: string; vendor: string } {
  const ua = navigator.userAgent;
  let deviceModel = 'Unknown';
  let vendor = navigator.vendor || 'Unknown';

  // iPhone detection
  if (/iPhone/i.test(ua)) {
    vendor = 'Apple';
    if (/iPhone14,/i.test(ua)) {
      deviceModel = 'iPhone 13 Series';
    } else if (/iPhone13,/i.test(ua)) {
      deviceModel = 'iPhone 12 Series';
    } else if (/iPhone/i.test(ua)) {
      deviceModel = 'iPhone';
    }
  }
  // iPad detection
  else if (/iPad/i.test(ua)) {
    vendor = 'Apple';
    deviceModel = 'iPad';
  }
  // Samsung detection
  else if (/SM-[A-Z]\d+/i.test(ua)) {
    vendor = 'Samsung';
    const match = ua.match(/SM-([A-Z]\d+)/i);
    deviceModel = match ? `Samsung Galaxy ${match[1]}` : 'Samsung Device';
  }
  // Google Pixel
  else if (/Pixel/i.test(ua)) {
    vendor = 'Google';
    const match = ua.match(/Pixel (\d+)/i);
    deviceModel = match ? `Google Pixel ${match[1]}` : 'Google Pixel';
  }
  // Generic Android
  else if (/Android/i.test(ua)) {
    vendor = 'Android Device';
    deviceModel = 'Android Device';
  }
  // Mac
  else if (/Macintosh/i.test(ua)) {
    vendor = 'Apple';
    deviceModel = 'Mac';
  }
  // Windows
  else if (/Windows/i.test(ua)) {
    vendor = 'Microsoft';
    deviceModel = 'Windows PC';
  }

  return { deviceModel, vendor };
}

/**
 * Get comprehensive device information
 */
export function getDeviceInfo(): DeviceInfo {
  const { isMobile, isTablet, isDesktop } = detectDeviceType();
  const { os, osVersion } = detectOS();
  const { browser, browserVersion } = detectBrowser();
  const { connectionType, effectiveType } = detectConnection();
  const { deviceModel, vendor } = detectDeviceModel();

  return {
    isMobile,
    isTablet,
    isDesktop,
    os,
    osVersion,
    browser,
    browserVersion,
    screenWidth: window.innerWidth,
    screenHeight: window.innerHeight,
    screenOrientation: detectScreenOrientation(),
    pixelRatio: window.devicePixelRatio || 1,
    touchSupport: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
    maxTouchPoints: navigator.maxTouchPoints || 0,
    connectionType,
    effectiveType,
    deviceModel,
    vendor,
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    language: navigator.language,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
  };
}

/**
 * Save device info to localStorage
 */
export function saveDeviceInfo(): void {
  try {
    const deviceInfo = getDeviceInfo();
    localStorage.setItem('deviceInfo', JSON.stringify(deviceInfo));
    localStorage.setItem('deviceInfoTimestamp', new Date().toISOString());
    console.log('Device info saved to localStorage:', deviceInfo);
  } catch (error) {
    console.error('Error saving device info:', error);
  }
}

/**
 * Get saved device info from localStorage
 */
export function getSavedDeviceInfo(): DeviceInfo | null {
  try {
    const saved = localStorage.getItem('deviceInfo');
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (error) {
    console.error('Error retrieving saved device info:', error);
  }
  return null;
}

/**
 * Get a user-friendly device description
 */
export function getDeviceDescription(deviceInfo: DeviceInfo): string {
  const deviceType = deviceInfo.isMobile ? 'Mobile' : deviceInfo.isTablet ? 'Tablet' : 'Desktop';
  const model = deviceInfo.deviceModel !== 'Unknown' ? deviceInfo.deviceModel : `${deviceInfo.os} ${deviceType}`;
  const browser = `${deviceInfo.browser} ${deviceInfo.browserVersion}`;

  return `${model} running ${deviceInfo.os} ${deviceInfo.osVersion} with ${browser}`;
}
